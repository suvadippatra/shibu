/* QP Maker Preview Pagination, Booklet Flow, Watermark, Divider, and Auto-fit Renderer */
import { $, esc, toast } from '../shared/js/dom.js';
import { renderTok as sharedRenderTok, stripMarkupLength } from '../shared/js/math-pipeline.js';
import { getUnlockedWatermarkDataUrl } from '../shared/js/watermark-vault.js';
import { S, BN_O, EN_O, bn, sl, getActiveOrient, applyVars, showAutoFitBtn, checkFit, stripLeadingQNum } from './state.js';

const _tokCache = new Map();

export function renderTok(t) {
  const key = (globalThis.katex ? '1:' : '0:') + String(t || '');
  const hit = _tokCache.get(key);
  if (hit !== undefined) return hit;
  const res = sharedRenderTok(t, globalThis.katex, { preserveNewlines: true, allowDollar: true });
  if (_tokCache.size >= 500) _tokCache.clear();
  _tokCache.set(key, res);
  return res;
}

let _pvT = null;
let _pvRaf = 0;
let _lastRenderTs = 0;
export function sched(d = 50) {
  clearTimeout(_pvT);
  const now = performance.now();
  // Leading / rAF-throttled update so dragging sliders or fast typing updates live
  if (d <= 16 || now - _lastRenderTs >= Math.max(d, 45)) {
    if (!_pvRaf) {
      _pvRaf = requestAnimationFrame(() => {
        _pvRaf = 0;
        _lastRenderTs = performance.now();
        render();
      });
    }
    return;
  }
  _pvT = setTimeout(() => {
    _lastRenderTs = performance.now();
    render();
  }, d);
}

export function wmHtmlGenerator() {
  const wmSrc =
    S.wmSrc === 'none'
      ? null
      : S.wmSrc === 'custom' && S.wmCustomData
      ? S.wmCustomData
      : getUnlockedWatermarkDataUrl();
  const wmStyle = `opacity:${S.wmOpacity / 100};pointer-events:none;z-index:5;`;
  return wmSrc
    ? `<div class="qp-wm" style="${wmStyle}"><img src="${wmSrc}" style="max-width:${S.wmSize}%;max-height:${S.wmSize}%" onerror="this.style.display='none'"/></div>`
    : '';
}

export function buildDivHTML(isPortrait = false) {
  const d = S.divider;
  if (d === 'solid') return `<div class="qp-div" style="width:.15cm;border-left:.5pt solid #bbb"></div>`;
  if (d === 'text') {
    return `<div class="qp-div" style="border-left: 1px dashed #999; position: relative; width: .25cm;"><div style="position:absolute; top:10%; left:-6px; font-size:14px; color:#666; transform: rotate(-90deg); display: inline-block;">✂</div><div style="position:absolute; top:50%; left:-6px; font-size:14px; color:#666; transform: rotate(-90deg); display: inline-block;">✂</div><div style="position:absolute; top:90%; left:-6px; font-size:14px; color:#666; transform: rotate(-90deg); display: inline-block;">✂</div></div>`;
  }
  const ch = d === 'dotted' ? '·' : d === 'dashed' ? '-' : '✂';
  const rowCount = isPortrait ? 52 : 36;
  const rows = Array.from({ length: rowCount }, () => `<div style="line-height:1">${ch}</div>`).join('');
  return `<div class="qp-div">${rows}</div>`;
}

function wrapPageNode(htmlString, zoomFactor, isPortrait) {
  const wrap = document.createElement('div');
  wrap.className = 'pp-wrap';
  wrap.style.transform = `scale(${zoomFactor})`;
  const pageH_MM = isPortrait ? 297 : 210;
  const pageH_PX = pageH_MM * 3.7795;
  // Collapse the extra whitespace CSS scale leaves behind, but cap at 0
  // so pages never overlap when zoom is near 1.0.
  const negMargin = Math.min(0, -(pageH_PX * (1 - zoomFactor)) + 24);
  wrap.style.marginBottom = `${negMargin}px`;
  wrap.innerHTML = `<div class="pp">${htmlString}</div>`;
  return wrap.outerHTML;
}

function buildMonoPageHTML(pages, isPortrait) {
  const mg = S.autoFit ? S.autoFit.margin : S.margin;
  const wmHTML = wmHtmlGenerator();
  const oriCls = isPortrait ? 'ori-portrait' : 'ori-landscape';
  const styleDims = isPortrait
    ? 'width: 210mm; min-height: 297mm;'
    : 'width: 297mm; min-height: 210mm;';
  return pages
    .map((p) => {
      const h = `<div class="qp-page preview-mono ${oriCls}" style="${styleDims}"><div class="qp-set" style="padding:${mg}cm; color:#111; width:100%;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${p}</div></div></div>`;
      return wrapPageNode(h, S.zoom, isPortrait);
    })
    .join('');
}

function buildDoublePageHTML(pages, isPortrait) {
  const mg = S.autoFit ? S.autoFit.margin : S.margin;
  const wmHTML = wmHtmlGenerator();
  const divHTML = buildDivHTML(isPortrait);
  const oriCls = isPortrait ? 'ori-portrait' : 'ori-landscape';
  const styleDims = isPortrait
    ? 'width: 210mm; min-height: 297mm;'
    : 'width: 297mm; min-height: 210mm;';
  return pages
    .map((p) => {
      const setBlock = `<div class="qp-set" style="padding:${mg}cm; color:#111;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${p}</div></div>`;
      return wrapPageNode(`<div class="qp-page preview-double ${oriCls}" style="${styleDims}">${setBlock}${divHTML}${setBlock}</div>`, S.zoom, isPortrait);
    })
    .join('');
}

function buildQuadPageHTML(pages, isPortrait) {
  const mg = S.autoFit ? S.autoFit.margin : S.margin;
  const wmHTML = wmHtmlGenerator();
  const oriCls = isPortrait ? 'ori-portrait' : 'ori-landscape';
  const styleDims = isPortrait
    ? 'width: 210mm; min-height: 297mm;'
    : 'width: 297mm; min-height: 210mm;';
  return pages
    .map((p) => {
      const quads = [1, 2, 3, 4]
        .map((n) => `<div class="qp-set q-quad-${n}" style="padding:${mg}cm; color:#111;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${p}</div></div>`)
        .join('');
      return wrapPageNode(`<div class="qp-page preview-quad ${oriCls}" style="${styleDims}"><div class="qp-set-wrapper">${quads}</div></div>`, S.zoom, isPortrait);
    })
    .join('');
}

function buildFlowSheets(pages, isPortrait) {
  const mg = S.autoFit ? S.autoFit.margin : S.margin;
  const wmHTML = wmHtmlGenerator();
  const divHTML = buildDivHTML(isPortrait);
  const oriCls = isPortrait ? 'ori-portrait' : 'ori-landscape';
  const styleDims = isPortrait
    ? 'width: 210mm; min-height: 297mm;'
    : 'width: 297mm; min-height: 210mm;';

  if (pages.length === 1) {
    const h = `<div class="qp-page preview-flow ${oriCls}" style="${styleDims} justify-content: flex-end;"><div class="qp-set" style="max-width:50%; padding:${mg}cm; color:#111; position:relative;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${pages[0]}</div></div></div>`;
    return wrapPageNode(h, S.zoom, isPortrait);
  }

  const paddedPages = [...pages];
  const originalLen = paddedPages.length;
  while (paddedPages.length % 4 !== 0) paddedPages.push('');
  if (originalLen > 4 && originalLen % 4 !== 0) {
    toast(`Added blank pages to complete booklet. Use 'Auto-fit' to reduce extra pages.`, 'warn', 4500);
  }

  const sheetCount = paddedPages.length / 2;
  const total = paddedPages.length;
  let res = '';
  for (let i = 0; i < sheetCount; i++) {
    const leftPage = i % 2 === 0 ? paddedPages[total - 1 - i] : paddedPages[i];
    const rightPage = i % 2 === 0 ? paddedPages[i] : paddedPages[total - 1 - i];
    const LBlock = `<div class="qp-set" style="padding:${mg}cm; color:#111; position:relative;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${leftPage}</div></div>`;
    const ptoHtml =
      i % 2 === 0 && total > 2
        ? `<div style="position:absolute; bottom: calc(${mg}cm - 16px); right: ${mg}cm; font-size: var(--p-fsize); opacity: 0.7; font-weight: normal; z-index: 20;">P.T.O.</div>`
        : '';
    const RBlock = `<div class="qp-set" style="padding:${mg}cm; color:#111; position:relative;">${wmHTML}<div style="position:relative; z-index:10; height:100%;">${rightPage}</div>${ptoHtml}</div>`;
    res += wrapPageNode(`<div class="qp-page preview-flow ${oriCls}" style="${styleDims}">${LBlock}${divHTML}${RBlock}</div>`, S.zoom, isPortrait);
  }
  return res;
}

export function buildExtH(q) {
  let floatH = '';
  let bottomH = '';

  (q.extra || []).forEach((ex) => {
    const align = ex.align || 'center';
    let style = '';
    let isFloat = false;

    if (ex.type === 'table') {
      isFloat = false;
    } else if (ex.type !== 'labeled') {
      if (align === 'right') { style = 'float:right; margin: 2pt 0 4pt 8pt; max-width: 55%;'; isFloat = true; }
      else if (align === 'left') { style = 'float:left; margin: 2pt 8pt 4pt 0; max-width: 55%;'; isFloat = true; }
      else { style = 'text-align:center; margin:4pt 0; clear:both; width:100%; display:block;'; }
    }

    let inner = '';
    const szPct = ex.size || 60;

    if (ex.type === 'image') {
      inner = `<img src="${esc(ex.data)}" style="max-width:${szPct}%;max-height:36mm;object-fit:contain"/>`;
    } else if (ex.type === 'diagram' && ex.png) {
      inner = `<img src="${esc(ex.png)}" style="max-width:${szPct}%;max-height:36mm;object-fit:contain"/>`;
    } else if (ex.type === 'table') {
      const alignStyle = align === 'left' ? 'margin-right:auto;' : align === 'right' ? 'margin-left:auto;' : 'margin:0 auto;';
      let t = `<table class="qp-itable" style="${alignStyle} width:${szPct}%;">`;
      ex.rows.forEach((row) => {
        t += `<tr>${row.map((c) => `<td>${renderTok(c)}</td>`).join('')}</tr>`;
      });
      t += `</table>`;
      inner = t;
    } else if (ex.type === 'labeled') {
      let pts = '';
      if (ex.pointers && ex.pointers.length > 0) {
        pts = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap:8px 12px; text-align:left; font-size:calc(var(--p-fsize) - 1pt); width:100%; align-content:start;">`;
        ex.pointers.forEach((p) => {
          const lbl = p.label ? esc(p.label) + ')' : '';
          pts += `<div style="display:flex; align-items:flex-end; gap:4px; white-space:nowrap;"><span>${lbl}</span><span style="flex:1; border-bottom:0.75pt solid #333; min-width:30px; display:inline-block; margin-bottom:3px;"></span></div>`;
        });
        pts += `</div>`;
      }
      const imgPart = ex.data ? `<img src="${esc(ex.data)}" style="width:100%; max-height:50mm; object-fit:contain; display:block;"/>` : '';
      if (align === 'left') {
        inner = `<div style="display:grid; grid-template-columns: ${szPct}% 1fr; gap:16px; align-items:start; width:100%; margin-top:8px;"><div>${imgPart}</div><div style="padding-top:4px;">${pts}</div></div>`;
      } else if (align === 'right') {
        inner = `<div style="display:grid; grid-template-columns: 1fr ${szPct}%; gap:16px; align-items:start; width:100%; margin-top:8px;"><div style="padding-top:4px;">${pts}</div><div>${imgPart}</div></div>`;
      } else {
        inner = `<div style="display:flex; flex-direction:column; gap:12px; align-items:center; width:100%; margin-top:8px;"><div style="width:${szPct}%;">${imgPart}</div><div style="width:100%;">${pts}</div></div>`;
      }
    }

    if (ex.type === 'labeled') {
      bottomH += inner;
    } else {
      const wrapper = isFloat ? `<div style="${style}">${inner}</div>` : `<div style="width:100%; margin-top:6pt;">${inner}</div>`;
      if (isFloat) floatH += wrapper;
      else bottomH += wrapper;
    }
  });

  return { floats: floatH, bottom: bottomH };
}

export function buildSet(asBlocks = false) {
  const lang = S.paperLang;
  const isBn = lang !== 'full-en';
  const fsPt = (S.autoFit ? S.autoFit.fontSize : S.fontSize) + 'pt';

  const fmLabel = isBn ? 'পূর্ণমান' : 'Full Marks';
  const timeLabel = isBn ? 'সময়' : 'Time';
  const timeUnit = isBn ? 'মিনিট' : 'min';
  const classLabel = isBn ? 'শ্রেণি' : 'Class';
  const subjectLabel = isBn ? 'বিষয়' : 'Subject';

  const klass = esc(S.klass || '—');
  const subj = esc(S.subject || '—');
  const fm = S.fullMarks;

  const blocks = [];
  let h = `<div class="qp-title" style="font-size:14pt">${esc(S.topTitle || 'Question Paper')}</div>`;

  if (S.subject.length > 22) {
    h += `<div class="qp-info" style="font-size:${fsPt}"><span>${fmLabel}: ${isBn ? bn(fm) : fm}</span><span>${classLabel}: ${klass}</span><span>${timeLabel}: ${isBn ? bn(S.time) : S.time} ${timeUnit}</span></div><div style="text-align:center;font-family:var(--font-tt);font-size:${fsPt};padding-bottom:2pt;">${subjectLabel}: ${subj}</div>`;
  } else {
    h += `<div class="qp-info" style="font-size:${fsPt}"><span>${fmLabel}: ${isBn ? bn(fm) : fm}</span><span>${classLabel}: ${klass} &nbsp;|&nbsp; ${subjectLabel}: ${subj}</span><span>${timeLabel}: ${isBn ? bn(S.time) : S.time} ${timeUnit}</span></div>`;
  }

  if (S.inst) {
    h += `<div style="font-style:italic;font-size:calc(${fsPt} - 0.5pt);padding-bottom:2pt;line-height:1.3">${esc(S.inst)}</div>`;
  }
  blocks.push(h);

  S.sections.forEach((sec, idx) => {
    const L = sl(idx);
    let actualCount = 0;
    for (let i = 0; i < sec.questions.length; i++) {
      actualCount++;
      if (sec.questions[i].isOrNext) i++;
    }
    const countedQ = sec.answerAny && sec.answerAny < actualCount ? sec.answerAny : actualCount;
    const tot = (sec.mpq || 0) * countedQ;
    const mfNum = isBn ? `${bn(sec.mpq)} × ${bn(countedQ)} = ${bn(tot)}` : `${sec.mpq} × ${countedQ} = ${tot}`;
    const secPrefix = isBn ? `বিভাগ '${L}'` : `Section '${L}'`;
    const secNumPrefix = isBn ? `${bn(idx + 1)}.` : `${idx + 1}.`;
    const anyNote = sec.answerAny ? (isBn ? ` (যেকোনো ${bn(sec.answerAny)}টি)` : ` (any ${sec.answerAny})`) : '';

    blocks.push(
      `<div class="qp-sec-hdr" style="font-size:${fsPt}">${secPrefix}</div><div class="qp-sec-row" style="font-size:${fsPt}"><span>${secNumPrefix} ${esc(sec.heading)}${anyNote}</span><span>${mfNum}</span></div>`
    );

    if (!sec.questions.length) {
      blocks.push(`<div style="color:#aaa;font-size:8pt;line-height:var(--p-lh)">(no questions)</div>`);
      return;
    }

    let qCounter = 1;
    sec.questions.forEach((q, qi) => {
      const numStr = isBn ? `${bn(qCounter)})` : `${qCounter})`;
      const isOrChild = qi > 0 && sec.questions[qi - 1].isOrNext;
      const numH = `<div style="flex-shrink:0; font-weight:normal; margin-right:4pt; line-height:var(--p-lh); ${isOrChild ? 'opacity:0;' : ''}">${numStr}</div>`;

      // Render math/tokens BEFORE any marks badge formatting, stripping accidental duplicate leading question numbers
      let renderedText = renderTok(stripLeadingQNum(q.text));
      renderedText = renderedText.replace(
        /([।?.]|<br>)\s*[\(\[]([0-9০-৯]+(?:\s*\+\s*[0-9০-৯]+)*)[\)\]]\s*$/,
        '$1 <span style="float:right; font-weight:normal; margin-left:10px;">($2)</span>'
      );

      const qTextHtml = `<div class="qp-q-text">${renderedText}</div>`;
      let oph = '', bottomHtml = '', leftHtml = '', rightHtml = '';

      if (sec.type === 'mcq') {
        const opts = (q.options || ['', '', '', '']).slice(0, 4);
        let maxVisualLen = 0;
        opts.forEach((o) => {
          const visLen = stripMarkupLength(o);
          if (visLen > maxVisualLen) maxVisualLen = visLen;
        });

        const ls = sec.os === 'en' ? EN_O : BN_O;
        const optsHtml = opts.map((opt, i) => `<span>(${ls[i]}) ${renderTok(opt)}</span>`).join('');

        if (maxVisualLen <= 13) oph = `<div class="qp-q-mcq-opts" style="margin-left: 18pt;">${optsHtml}</div>`;
        else if (maxVisualLen <= 25) oph = `<div class="qp-q-mcq-opts g2" style="margin-left: 18pt;">${optsHtml}</div>`;
        else oph = `<div class="qp-q-mcq-opts g1" style="margin-left: 18pt;">${optsHtml}</div>`;

        if (q.img) {
          const iH = `<img src="${esc(q.img)}" style="max-width:100%; max-height:40mm; object-fit:contain;"/>`;
          if (q.imgAlign === 'left') leftHtml += `<div style="width:${q.imgSize || 60}%;">${iH}</div>`;
          else if (q.imgAlign === 'center') bottomHtml += `<div style="text-align:center; width:100%; margin-top:4pt;">${iH}</div>`;
          else rightHtml += `<div style="width:${q.imgSize || 60}%; text-align:right;">${iH}</div>`;
        }
      }

      const ext = buildExtH(q);
      leftHtml += ext.floats.includes('float:left') ? ext.floats : '';
      rightHtml += ext.floats.includes('float:right') ? ext.floats : '';
      bottomHtml += ext.bottom;

      let mainBlock = `<div style="display:flex; flex-direction:row; align-items:flex-start; width: 100%;">${numH}<div style="flex: 1; display:flex; flex-direction:row; gap:8pt; min-width:0;">`;
      if (leftHtml) mainBlock += `<div style="flex-shrink:0; max-width:55%; overflow:hidden;">${leftHtml}</div>`;
      mainBlock += qTextHtml;
      if (rightHtml) mainBlock += `<div style="flex-shrink:0; max-width:55%; overflow:hidden;">${rightHtml}</div>`;
      mainBlock += `</div></div>`;

      let spaceH = '';
      const hasTableOrLabeled = (q.extra || []).some((ex) => ex.type === 'table' || ex.type === 'labeled');
      const isSkipGap = sec.type === 'mcq' || hasTableOrLabeled;
      if (S.ansSpace && !isSkipGap) {
        let gap = sec.type === 'long' ? 80 : sec.type === 'descriptive' ? 40 : 20;
        if (sec.ansGap !== undefined && sec.ansGap !== null && sec.ansGap !== '') gap = parseInt(sec.ansGap, 10);
        if (q.ansGap !== undefined && q.ansGap !== null && q.ansGap !== '') gap = parseInt(q.ansGap, 10);
        if (gap > 0) spaceH = `<div style="height:${gap}mm; width:100%"></div>`;
      }

      const qHTML = `<div class="qp-q">${mainBlock}${oph}${bottomHtml}${spaceH}</div>`;
      const orH =
        q.isOrNext && qi < sec.questions.length - 1
          ? `<div style="text-align:center; font-weight:bold; margin: 2pt 0; font-size:calc(var(--p-fsize) - 1pt)">${isBn ? 'অথবা' : 'OR'}</div>`
          : '';
      blocks.push(`<div style="font-size:${fsPt};line-height:var(--p-lh)">${qHTML + orH}</div>`);

      if (!q.isOrNext) qCounter++;
    });
  });

  return asBlocks ? blocks : blocks.join('');
}

async function waitForImagesIn(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  if (!imgs.length) return;
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      return new Promise((res) => {
        const done = () => res();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 400);
      });
    })
  );
}

let _renderSeq = 0;
export async function render() {
  const seq = ++_renderSeq;
  try {
    const vp = $('preview-vp');
    if (!vp) return;
    const has = S.sections.length > 0 || S.subject || S.klass || (S.topTitle && S.topTitle !== 'Test no. 1');

    if (!has) {
      vp.innerHTML = `<div class="empty-ph" id="ph"><div class="ei">📄</div>Fill in exam info and add sections<br>to see the live preview here.</div>`;
      checkFit(0);
      return;
    }

    // Show spinner immediately so the UI doesn't look frozen during async render
    if (!vp.querySelector('.render-spinner')) {
      const spinner = document.createElement('div');
      spinner.className = 'render-spinner';
      spinner.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:28px;opacity:0.4;pointer-events:none;z-index:99;';
      spinner.textContent = '⏳';
      vp.style.position = 'relative';
      vp.appendChild(spinner);
    }

    let measDiv = document.getElementById('__meas__rv');
    if (!measDiv) {
      measDiv = document.createElement('div');
      measDiv.id = '__meas__rv';
      measDiv.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:0;overflow:hidden;';
      document.body.appendChild(measDiv);
    }

    const curMg = S.autoFit ? S.autoFit.margin : S.margin;
    const curFs = S.autoFit ? S.autoFit.fontSize : S.fontSize;
    const curLh = S.autoFit ? S.autoFit.lineHeight : S.lineHeight;
    const isPortrait = getActiveOrient() === 'portrait';

    let usableW, availH_PX;
    if (S.viewMode === 'mono') {
      usableW = `calc(${isPortrait ? '210mm' : '297mm'} - ${curMg * 2}cm)`;
      availH_PX = Math.round((isPortrait ? 297 : 210) * 3.7795) - curMg * 37.795 * 2 - 14;
    } else if (S.viewMode === 'double' || S.viewMode === 'flow') {
      usableW = `calc((${isPortrait ? '210mm' : '297mm'} - 1.2cm) / 2 - ${curMg * 2}cm)`;
      availH_PX = Math.round((isPortrait ? 297 : 210) * 3.7795) - curMg * 37.795 * 2 - 14;
    } else {
      usableW = `calc((${isPortrait ? '210mm' : '297mm'} - 1.2cm) / 2 - ${curMg * 2}cm)`;
      availH_PX = Math.round(((isPortrait ? 297 : 210) / 2) * 3.7795) - curMg * 37.795 * 2 - 14;
    }

    measDiv.style.width = usableW;
    measDiv.style.fontFamily = 'var(--font-bn)';
    measDiv.style.fontSize = curFs + 'pt';
    measDiv.style.lineHeight = curLh;
    measDiv.style.padding = '0';

    const blocks = buildSet(true);
    const hasImages = blocks.some((b) => b.includes('<img'));
    if (hasImages) {
      measDiv.innerHTML = blocks.join('');
      await waitForImagesIn(measDiv);
      if (seq !== _renderSeq) return;
    }

    const logicalPages = [];
    let currentHTML = '';
    measDiv.innerHTML = '';
    for (let i = 0; i < blocks.length; i++) {
      measDiv.insertAdjacentHTML('beforeend', blocks[i]);
      if (measDiv.scrollHeight > availH_PX && currentHTML !== '') {
        logicalPages.push(currentHTML);
        currentHTML = blocks[i];
        measDiv.innerHTML = blocks[i];
      } else {
        currentHTML += blocks[i];
      }
    }
    if (currentHTML) logicalPages.push(currentHTML);

    let renderedHTML = '';
    if (S.viewMode === 'mono') renderedHTML = buildMonoPageHTML(logicalPages, isPortrait);
    else if (S.viewMode === 'double') renderedHTML = buildDoublePageHTML(logicalPages, isPortrait);
    else if (S.viewMode === 'quad') renderedHTML = buildQuadPageHTML(logicalPages, isPortrait);
    else if (S.viewMode === 'flow') renderedHTML = buildFlowSheets(logicalPages, isPortrait);

    // Only update DOM if this is still the latest render (not superseded by a newer call)
    if (seq !== _renderSeq) return;
    vp.innerHTML = renderedHTML; // also removes spinner since we replace all content
    checkFit(logicalPages.length);
  } catch (error) {
    console.error('Rendering Error:', error);
    const vp = $('preview-vp');
    if (vp) vp.innerHTML = `<div style="color:var(--red); padding: 40px; font-family: monospace;">Render Error: ${esc(error.message)}</div>`;
  }
}

export async function runAutoFit() {
  let mDiv = document.getElementById('__meas');
  if (!mDiv) {
    mDiv = document.createElement('div');
    mDiv.id = '__meas';
    mDiv.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;top:-9999px;left:0;';
    document.body.appendChild(mDiv);
  }

  const isPortrait = getActiveOrient() === 'portrait';
  const PAGE_H = isPortrait ? 1122 : 793;
  const maxAvailH = S.viewMode === 'quad' ? PAGE_H / 2 : PAGE_H;
  let fs = S.fontSize, lh = S.lineHeight, mg = S.margin;
  const fsMin = 7, fsMax = 15, lhMin = 0.8, lhMax = 1.75, mgMin = 0.0;

  mDiv.innerHTML = buildSet();
  await waitForImagesIn(mDiv);

  const measure = (f, l, m) => {
    document.documentElement.style.setProperty('--p-fsize', f + 'pt');
    document.documentElement.style.setProperty('--p-lh', l);
    document.documentElement.style.setProperty('--p-margin', m + 'cm');
    if (S.viewMode === 'mono' || S.viewMode === 'flow') {
      mDiv.style.width = isPortrait ? '210mm' : '297mm';
    } else {
      mDiv.style.width = isPortrait ? 'calc((210mm - 1.2cm) / 2)' : 'calc((297mm - 1.2cm) / 2)';
    }
    mDiv.style.padding = m + 'cm';
    mDiv.style.fontFamily = 'var(--font-bn)';
    mDiv.style.fontSize = f + 'pt';
    mDiv.style.lineHeight = l;
    return mDiv.scrollHeight;
  };

  let h = measure(fs, lh, mg);
  if (h <= maxAvailH) { applyAutoFit(fs, lh, mg); return; }
  while (lh > lhMin && h > maxAvailH) { lh = +(lh - 0.05).toFixed(3); h = measure(fs, lh, mg); }
  if (h <= maxAvailH) { applyAutoFit(fs, lh, mg); return; }
  while (fs > fsMin && h > maxAvailH) { fs = +(fs - 0.5).toFixed(1); h = measure(fs, lh, mg); }
  if (h <= maxAvailH) { applyAutoFit(fs, lh, mg); return; }
  while (mg > mgMin && h > maxAvailH) { mg = +(mg - 0.1).toFixed(2); h = measure(fs, lh, mg); }
  if (h <= maxAvailH) { applyAutoFit(fs, lh, mg); return; }

  const FILL_TARGET = maxAvailH * 1.6;
  while ((fs < fsMax || lh < lhMax) && h < FILL_TARGET) {
    if (lh < lhMax) lh = +(lh + 0.05).toFixed(3);
    else if (fs < fsMax) fs = +(fs + 0.5).toFixed(1);
    h = measure(fs, lh, mg);
  }
  const approxPages = Math.ceil(h / maxAvailH);
  applyAutoFit(fs, lh, mg);
  toast(`Content needs ${approxPages} pages — filled automatically.`, 'warn');
}

function applyAutoFit(fs, lh, mg) {
  S.autoFit = { fontSize: fs, lineHeight: lh, margin: mg };
  if ($('s-fs')) { $('s-fs').value = fs; $('s-fs-v').textContent = fs + ' pt'; }
  if ($('s-lh')) { $('s-lh').value = lh; $('s-lh-v').textContent = lh.toFixed(2); }
  if ($('s-mg')) { $('s-mg').value = mg * 10; $('s-mg-v').textContent = mg.toFixed(1) + ' cm'; }
  applyVars();
  showAutoFitBtn();
  sched();
  toast(`Auto-fit: ${fs}pt · LH${lh.toFixed(2)} · ${mg.toFixed(1)}cm`, 'success');
}
