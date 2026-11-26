/* QP Maker Editor UI: Exam Info, Settings, Sections, Questions, Diagrams, Import & Validator */
import { $, $$, uid, esc, toast, safeDownload, copyText, sha256Hex, attachMathQuickBar } from '../shared/js/dom.js';
import { qpfStateToCbtString } from '../shared/js/math-pipeline.js';
import { openMathBuilderModal } from '../shared/js/math-builder.js';
import {
  DEFAULT_WM_HASH, S, linkMode, BN_O, EN_O, HDGS_BN, HDGS_EN, TYPES,
  bn, sl, getPtrLbl, getHdgs, getActiveOrient, applyVars, recalc,
  clearAutoFit, syncFields, exFname, validateScientificExpression
} from './state.js';
import { parseQPF, serializeQPF, auditQPFState, PROMPT_IMG, PROMPT_TXT } from './qpf-parser.js';
import { sched, runAutoFit } from './renderer.js';
import { exportODT } from './export-odt.js';

const _undoStack = [];
const _redoStack = [];
let _historyReady = false;
let _isRestoringHistory = false;
let _histTimer = null;

function captureSnapshot() {
  return JSON.stringify({
    topTitle: S.topTitle,
    klass: S.klass,
    subject: S.subject,
    time: S.time,
    inst: S.inst,
    paperLang: S.paperLang,
    sections: S.sections
  });
}

function updateHistoryBtns() {
  const u = $('qp-undo');
  const r = $('qp-redo');
  if (u) u.disabled = _undoStack.length <= 1;
  if (r) r.disabled = _redoStack.length === 0;
}

export function pushHistory() {
  if (!_historyReady || _isRestoringHistory) return;
  const snap = captureSnapshot();
  if (_undoStack.length && _undoStack[_undoStack.length - 1] === snap) return;
  _undoStack.push(snap);
  if (_undoStack.length > 40) _undoStack.shift();
  _redoStack.length = 0;
  updateHistoryBtns();
  try {
    const qCount = S.sections.reduce((n, s) => n + s.questions.length, 0);
    if (qCount > 0) {
      localStorage.setItem('shibu_qp_draft', JSON.stringify({
        title: S.topTitle || 'Untitled Paper',
        secs: S.sections.length,
        qCount,
        updatedAt: Date.now(),
        qpf: serializeQPF(S)
      }));
    }
  } catch (_) {}
}

export function scheduleHistoryPush() {
  if (!_historyReady || _isRestoringHistory) return;
  clearTimeout(_histTimer);
  _histTimer = setTimeout(pushHistory, 650);
}

function restoreSnapshot(snap) {
  const data = JSON.parse(snap);
  _isRestoringHistory = true;
  try {
    Object.assign(S, data);
    syncFields();
    rebuildSecs();
    recalc();
    applyVars();
    sched(10);
  } finally {
    _isRestoringHistory = false;
    updateHistoryBtns();
  }
}

export function undoQP() {
  if (_undoStack.length <= 1) return;
  clearTimeout(_histTimer);
  const current = _undoStack.pop();
  _redoStack.push(current);
  restoreSnapshot(_undoStack[_undoStack.length - 1]);
  toast('Undid last change', 'info', 1800);
}

export function redoQP() {
  if (!_redoStack.length) return;
  clearTimeout(_histTimer);
  const next = _redoStack.pop();
  _undoStack.push(next);
  restoreSnapshot(next);
  toast('Redid change', 'info', 1800);
}

export function initUndoRedo() {
  _undoStack.length = 0;
  _redoStack.length = 0;
  _undoStack.push(captureSnapshot());
  _historyReady = true;
  updateHistoryBtns();
  $('qp-undo')?.addEventListener('click', undoQP);
  $('qp-redo')?.addEventListener('click', redoQP);
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoQP();
    } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
      e.preventDefault();
      redoQP();
    }
  });
}

export function applyQPFText(rawText) {
  const newState = parseQPF(rawText);
  Object.assign(S, newState);
  S.autoFit = null;
  syncFields();
  rebuildSecs();
  recalc();
  applyVars();
  sched(10);
  const audit = auditQPFState(S);
  if (audit.illegibleCount > 0) {
    toast(`${audit.illegibleCount} unreadable OCR token(s) (<§>) found — review highlighted items before printing.`, 'warn', 5500);
  } else if (audit.emptyMcqOptions > 0) {
    toast(`${audit.emptyMcqOptions} empty MCQ option(s) detected — please verify.`, 'warn', 4500);
  }
  pushHistory();
}

export function fitZoom(renderNow = true) {
  const vp = $('preview-vp');
  if (!vp || vp.clientWidth <= 0) return;
  const vpW = Math.max(240, vp.clientWidth - 40);
  const ori = getActiveOrient();
  const pageW = ori === 'portrait' ? Math.round(210 * 3.7795) : Math.round(297 * 3.7795);
  S.zoom = Math.max(0.2, Math.min(1.5, vpW / pageW));
  if ($('z-lbl')) $('z-lbl').textContent = Math.round(S.zoom * 100) + '%';
  if (renderNow) sched();
}

export function toggleSettingsPanel() {
  const body = $('settings-panel-body');
  const hdr = $('settings-panel-header');
  const ch = $('settings-chevron');
  const open = body.classList.toggle('open');
  hdr.classList.toggle('open', open);
  if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
}

export function initSliderButtons() {
  $$('.slider-btn').forEach((btn) => {
    let hold = null;
    const fire = () => {
      const slId = btn.dataset.slider;
      if (!slId) return;
      const slEl = $(slId);
      if (!slEl) return;
      const dir = +btn.dataset.dir;
      const step = parseFloat(slEl.step) || 1;
      const min = parseFloat(slEl.min);
      const max = parseFloat(slEl.max);
      const cur = parseFloat(slEl.value);
      slEl.value = Math.min(max, Math.max(min, +(cur + dir * step).toFixed(4)));
      slEl.dispatchEvent(new Event('input', { bubbles: true }));
    };
    btn.addEventListener('click', fire);
    btn.addEventListener('mousedown', () => { hold = setInterval(fire, 120); });
    btn.addEventListener('mouseup', () => clearInterval(hold));
    btn.addEventListener('mouseleave', () => clearInterval(hold));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); fire(); hold = setInterval(fire, 120); }, { passive: false });
    btn.addEventListener('touchend', () => clearInterval(hold));
  });
}

export function initSettings() {
  $('settings-panel-header')?.addEventListener('click', toggleSettingsPanel);
  $('autofit-btn')?.addEventListener('click', runAutoFit);

  $('s-fs')?.addEventListener('input', (e) => {
    S.fontSize = parseFloat(e.target.value);
    $('s-fs-v').textContent = S.fontSize + ' pt';
    clearAutoFit(); applyVars(); sched();
  });
  $('s-lh')?.addEventListener('input', (e) => {
    S.lineHeight = parseFloat(e.target.value);
    $('s-lh-v').textContent = S.lineHeight.toFixed(2);
    clearAutoFit(); applyVars(); sched();
  });
  $('s-mg')?.addEventListener('input', (e) => {
    S.margin = parseFloat((e.target.value / 10).toFixed(1));
    $('s-mg-v').textContent = S.margin.toFixed(1) + ' cm';
    clearAutoFit(); applyVars(); sched();
  });

  $$('.dopt').forEach((o) =>
    o.addEventListener('click', (e) => {
      const p = e.currentTarget.parentElement;
      if (p.id === 's-orient') {
        $$('#s-orient .dopt').forEach((x) => x.classList.remove('on'));
        o.classList.add('on');
        S.orientOverride = o.dataset.v;
        fitZoom();
        sched();
      } else {
        p.querySelectorAll('.dopt').forEach((x) => x.classList.remove('on'));
        o.classList.add('on');
        S.divider = o.dataset.d;
        sched();
      }
    })
  );

  $('s-wmo')?.addEventListener('input', (e) => {
    S.wmOpacity = parseInt(e.target.value, 10);
    $('s-wmo-v').textContent = S.wmOpacity + '%';
    sched();
  });
  $('s-wms')?.addEventListener('input', (e) => {
    S.wmSize = parseInt(e.target.value, 10);
    $('s-wms-v').textContent = S.wmSize + '%';
    sched();
  });

  let _lastWmSrc = S.wmSrc;
  $('s-wmsrc')?.addEventListener('change', async (e) => {
    if (e.target.value === 'custom') {
      $('wm-file').click();
    } else if (e.target.value === 'default') {
      const pwd = prompt('Enter password to access default watermark:');
      if (pwd) {
        const hash = await sha256Hex(pwd.trim());
        if (hash === DEFAULT_WM_HASH) {
          S.wmSrc = 'default'; _lastWmSrc = 'default';
          toast('Watermark applied.', 'success'); sched();
        } else {
          toast('Access Denied: Incorrect Password', 'error');
          e.target.value = _lastWmSrc; S.wmSrc = _lastWmSrc;
        }
      } else {
        e.target.value = _lastWmSrc;
      }
    } else {
      S.wmSrc = 'none'; _lastWmSrc = 'none'; sched();
    }
  });

  $('wm-file')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { $('s-wmsrc').value = _lastWmSrc; return; }
    const r = new FileReader();
    r.onload = (ev) => {
      S.wmCustomData = ev.target.result; S.wmSrc = 'custom'; _lastWmSrc = 'custom';
      sched(); toast('Watermark updated', 'success');
    };
    r.readAsDataURL(f);
  });

  $$('#s-plang .pill').forEach((p) =>
    p.addEventListener('click', () => {
      const oldLang = S.paperLang;
      const newLang = p.dataset.v;
      if (oldLang !== newLang) {
        $$('#s-plang .pill').forEach((x) => x.classList.remove('on'));
        p.classList.add('on');
        S.paperLang = newLang;
        const oldHdgs = oldLang === 'full-en' ? HDGS_EN : HDGS_BN;
        const newHdgs = newLang === 'full-en' ? HDGS_EN : HDGS_BN;
        S.sections.forEach((sec) => {
          const idx = oldHdgs.indexOf(sec.heading);
          if (idx !== -1) sec.heading = newHdgs[idx];
        });
        rebuildSecs(); sched();
      }
    })
  );

  $('ans-space-btn')?.addEventListener('click', (e) => {
    S.ansSpace = !S.ansSpace;
    e.currentTarget.classList.toggle('active', S.ansSpace);
    e.currentTarget.textContent = S.ansSpace ? 'Ans Space: ON' : 'Ans Space: OFF';
    rebuildSecs(); sched();
  });
}

export function initExamInfo() {
  const hdr = $('ei-hdr');
  const bdy = $('ei-body');
  // Single collapse listener (fixed double-toggle bug)
  hdr?.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select')) return;
    S.eiCollapsed = !S.eiCollapsed;
    bdy.classList.toggle('hide', S.eiCollapsed);
    hdr.classList.toggle('open', !S.eiCollapsed);
  });

  $('f-tt')?.addEventListener('input', (e) => { S.topTitle = e.target.value; sched(); });
  $('f-cls')?.addEventListener('input', (e) => { S.klass = e.target.value; sched(); });
  $('f-subj')?.addEventListener('input', (e) => {
    S.subject = e.target.value;
    $('subj-warn').style.display = e.target.value.length > 26 ? 'inline' : 'none';
    sched();
  });
  $('f-time')?.addEventListener('input', (e) => { S.time = parseInt(e.target.value, 10) || 30; sched(); });
  $('f-inst')?.addEventListener('input', (e) => { S.inst = e.target.value; sched(); });
}

function currentImportTab() {
  const t = document.querySelector('.import-tab.on');
  return t ? t.dataset.tab : 'paste';
}
function switchImportTab(tab) {
  $$('.import-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  $$('.import-paste-panel, .import-upload-panel').forEach((p) => p.classList.remove('active'));
  $('import-' + (tab === 'paste' ? 'paste' : 'upload') + '-panel')?.classList.add('active');
}
function openImportDrawer(tab) {
  const d = $('import-drawer');
  const isOpen = d.classList.contains('open');
  if (isOpen && tab === currentImportTab()) { d.classList.remove('open'); return; }
  d.classList.add('open');
  switchImportTab(tab);
}

function loadQPFFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => {
    $('qpf-ta').value = ev.target.result;
    openImportDrawer('paste');
    toast('File loaded — click Apply', 'info');
  };
  r.readAsText(f, 'utf-8');
}

async function handleCopyPrompt(which) {
  const txt = which === 'img' ? PROMPT_IMG : PROMPT_TXT;
  const ok = await copyText(txt);
  toast(ok ? (which === 'img' ? 'Image prompt copied!' : 'Draft prompt copied!') : 'Failed to copy prompt.', ok ? 'success' : 'error');
}

export function initImport() {
  $('btn-paste-tab')?.addEventListener('click', () => openImportDrawer('paste'));
  $$('.import-tab').forEach((t) => t.addEventListener('click', () => switchImportTab(t.dataset.tab)));
  $('close-drawer')?.addEventListener('click', () => $('import-drawer').classList.remove('open'));

  $('qpf-apply')?.addEventListener('click', () => {
    const txt = $('qpf-ta').value.trim();
    if (!txt) { toast('Paste QPF text first.', 'warn'); return; }
    try {
      applyQPFText(txt);
      toast('Form filled from QPF!', 'success');
      $('import-drawer').classList.remove('open');
    } catch (e) {
      toast('Parse error: ' + e.message, 'error');
    }
  });

  $('qpf-clear')?.addEventListener('click', () => { $('qpf-ta').value = ''; });
  $('qpf-file')?.addEventListener('change', (e) => loadQPFFile(e.target.files[0]));
  const dz = $('drop-zone');
  dz?.addEventListener('click', () => $('qpf-file2').click());
  $('qpf-file2')?.addEventListener('change', (e) => loadQPFFile(e.target.files[0]));
  dz?.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz?.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz?.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) loadQPFFile(e.dataTransfer.files[0]);
  });

  $('ocr-prompt-quick')?.addEventListener('click', () => handleCopyPrompt('img'));
  $$('.prompt-tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('.prompt-tab').forEach((x) => x.classList.toggle('on', x.dataset.ptab === t.dataset.ptab));
      $$('.prompt-content').forEach((p) => p.classList.remove('active'));
      $('ptab-' + t.dataset.ptab)?.classList.add('active');
    })
  );
  $('copy-prompt-img')?.addEventListener('click', () => handleCopyPrompt('img'));
  $('copy-prompt-txt')?.addEventListener('click', () => handleCopyPrompt('txt'));

  $('menu-trigger-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('menu-dropdown').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const dropdown = $('menu-dropdown');
    if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

export function initZoom() {
  $('z-in')?.addEventListener('click', () => {
    S.zoom = Math.min(1.5, +(S.zoom + 0.05).toFixed(2));
    $('z-lbl').textContent = Math.round(S.zoom * 100) + '%';
    sched();
  });
  $('z-out')?.addEventListener('click', () => {
    S.zoom = Math.max(0.2, +(S.zoom - 0.05).toFixed(2));
    $('z-lbl').textContent = Math.round(S.zoom * 100) + '%';
    sched();
  });
  $('z-fit')?.addEventListener('click', fitZoom);

  $$('#pv-mode .pill').forEach((p) =>
    p.addEventListener('click', () => {
      $$('#pv-mode .pill').forEach((x) => x.classList.remove('on'));
      p.classList.add('on');
      S.viewMode = p.dataset.m;
      fitZoom();
      sched();
    })
  );
}

export function initResize() {
  const handle = $('resize-handle');
  const sidebar = $('sidebar');
  const secsCont = $('secs');
  if (!handle || !sidebar) return;
  let dragging = false, startX = 0, startW = 0;

  const startDrag = (e) => {
    dragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const doDrag = (e) => {
    if (!dragging) return;
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const newW = Math.max(280, Math.min(window.innerWidth * 0.8, startW + (clientX - startX)));
    sidebar.style.width = newW + 'px';
    if (newW / window.innerWidth > 0.5) secsCont.classList.add('two-col');
    else secsCont.classList.remove('two-col');
  };
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setTimeout(fitZoom, 50);
  };

  handle.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', endDrag);
  handle.addEventListener('touchstart', startDrag, { passive: true });
  document.addEventListener('touchmove', doDrag, { passive: true });
  document.addEventListener('touchend', endDrag);
}

export function rebuildSecs() {
  const c = $('secs');
  if (!c) return;
  c.innerHTML = '';
  S.sections.forEach((sec, idx) => c.appendChild(mkSecCard(sec, idx)));
  recalc();
  pushHistory();
}

function mkSecCard(sec, idx) {
  const letter = sl(idx);
  const hdgs = getHdgs();
  if (sec.isCollapsed === undefined) sec.isCollapsed = false;

  let actualCount = 0;
  for (let i = 0; i < sec.questions.length; i++) {
    actualCount++;
    if (sec.questions[i].isOrNext) i++;
  }
  const countedQ = sec.answerAny && sec.answerAny < actualCount ? sec.answerAny : actualCount;
  const total = (sec.mpq || 0) * countedQ;
  const typeLabel = TYPES.find((t) => t.v === sec.type)?.l || sec.type;

  const card = document.createElement('div');
  card.className = 'card sc-card';
  card.dataset.si = idx;

  let headingOptions = '';
  hdgs.forEach((h) => {
    headingOptions += `<option value="${esc(h)}" ${h === sec.heading ? 'selected' : ''}>${esc(h.slice(0, 26))}</option>`;
  });
  headingOptions += `<option value="__c" ${!hdgs.includes(sec.heading) && sec.heading ? 'selected' : ''}>Custom…</option>`;

  const typeOptions = TYPES.map((t) => `<option value="${t.v}" ${t.v === sec.type ? 'selected' : ''}>${t.l}</option>`).join('');
  const isLinking = linkMode.active && linkMode.secId === sec.id;

  const linkModeHTML = isLinking
    ? `<div style="position:sticky; top:0; z-index:10; display:flex; gap:6px; padding: 6px; background:var(--bg3); border-radius:var(--r2); border: 1px solid var(--accent); margin-bottom:8px;">
         <span style="font-size:11px; flex:1; color:var(--accent3); display:flex; align-items:center; padding-left:4px;">Select 2 questions to link...</span>
         <button class="btn btn-primary btn-sm confirm-link">OK</button>
         <button class="btn btn-ghost btn-sm cancel-link">Cancel</button>
       </div>`
    : '';

  const footerHtml = isLinking
    ? ''
    : `<div style="display:flex; gap:6px;">
         <button class="btn btn-ghost btn-sm add-q no-print" style="flex:1;">+ Add question</button>
         <button class="btn btn-accent btn-sm start-link no-print" title="Link two questions with OR">🔗 Link OR</button>
       </div>`;

  const chipText = sec.questions.length === 0 ? 'Empty' : `${sec.mpq}×${countedQ}=${total}`;
  const ansGapVal = sec.ansGap !== undefined ? sec.ansGap : sec.type === 'long' ? 80 : sec.type === 'descriptive' ? 40 : 20;
  const isHidden = sec.isCollapsed;

  card.innerHTML = `
    <div class="card-hdr ${isHidden ? '' : 'open'}" id="hdr${sec.id}">
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      <span class="card-ttl">বিভাগ '${letter}' · ${typeLabel}</span>
      <span class="chip">${chipText}</span>
      <div style="display:flex; gap:3px" class="no-print">
        <button class="btn btn-ghost btn-xs move-sec-up" title="Move Up">↑</button>
        <button class="btn btn-ghost btn-xs move-sec-dn" title="Move Down">↓</button>
        <button class="btn btn-danger btn-sm del-sec" title="Delete section" style="margin-left:4px">✕</button>
      </div>
    </div>
    <div class="card-body ${isHidden ? 'hide' : ''}" id="bd${sec.id}">
      <div class="sec-params-wrap" style="background:var(--bg3); padding:8px 12px; border-radius:var(--r2); border:1px solid var(--border); display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:6px;">
        <div class="fgrp" style="flex:1 1 150px; min-width:140px;">
          <label class="flabel">Section Heading</label>
          <select class="sec-hdg">${headingOptions}</select>
        </div>
        <div class="fgrp" style="flex:1 1 120px; min-width:110px;">
          <label class="flabel">Question Type</label>
          <select class="sec-type">${typeOptions}</select>
        </div>
        <div class="fgrp" style="flex:1 1 70px; min-width:60px;">
          <label class="flabel">Marks / Q</label>
          <input type="number" class="sec-mpq" value="${sec.mpq}" min="0.5" step="0.5"/>
        </div>
        <div class="fgrp" style="flex:1 1 70px; min-width:60px;">
          <label class="flabel" title="Leave blank = all questions required">Answer Any</label>
          <input type="number" class="sec-aany" value="${sec.answerAny || ''}" min="1" placeholder="all"/>
        </div>
        <div class="fgrp" style="flex:1 1 70px; min-width:60px; display:${S.ansSpace && sec.type !== 'mcq' ? 'flex' : 'none'};">
          <label class="flabel" title="Section-wide blank space in mm">Gap(mm)</label>
          <input type="number" class="sec-ag" value="${ansGapVal}" min="0" step="5"/>
        </div>
        <div class="fgrp" style="flex:1 1 100px; min-width:90px; ${sec.type !== 'mcq' ? 'display:none' : ''}" id="os-wrap-${sec.id}">
          <label class="flabel">Opt Style</label>
          <div class="pill-group sec-os">
            <div class="pill ${sec.os === 'bn' ? 'on' : ''}" data-v="bn" style="flex:1; text-align:center">ক খ</div>
            <div class="pill ${sec.os === 'en' ? 'on' : ''}" data-v="en" style="flex:1; text-align:center">a b</div>
          </div>
        </div>
      </div>
      ${linkModeHTML}
      <div class="q-list" id="ql${sec.id}"></div>
      ${footerHtml}
    </div>
  `;

  const hdrEl = card.querySelector('.card-hdr');
  const bodyEl = card.querySelector('.card-body');
  hdrEl.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, option, .del-sec')) return;
    sec.isCollapsed = !sec.isCollapsed;
    hdrEl.classList.toggle('open', !sec.isCollapsed);
    bodyEl.classList.toggle('hide', sec.isCollapsed);
  });
  card.querySelector('.move-sec-up').addEventListener('click', () => {
    if (idx > 0) { [S.sections[idx - 1], S.sections[idx]] = [S.sections[idx], S.sections[idx - 1]]; rebuildSecs(); sched(); }
  });
  card.querySelector('.move-sec-dn').addEventListener('click', () => {
    if (idx < S.sections.length - 1) { [S.sections[idx + 1], S.sections[idx]] = [S.sections[idx], S.sections[idx + 1]]; rebuildSecs(); sched(); }
  });
  card.querySelector('.del-sec').addEventListener('click', () => {
    if (S.sections.length <= 1) { toast('Keep at least one section.', 'warn'); return; }
    S.sections = S.sections.filter((s) => s.id !== sec.id); rebuildSecs(); sched();
  });

  const hs = card.querySelector('.sec-hdg');
  hs.addEventListener('change', (e) => {
    if (e.target.value === '__c') {
      const c = prompt('Custom heading:', sec.heading || '');
      if (c) sec.heading = c; else { hs.value = sec.heading; return; }
    } else {
      sec.heading = e.target.value;
    }
    rebuildSecs(); sched();
  });

  card.querySelector('.sec-type').addEventListener('change', (e) => {
    sec.type = e.target.value;
    rebuildSecs(); sched();
  });
  card.querySelector('.sec-mpq').addEventListener('input', (e) => { sec.mpq = parseFloat(e.target.value) || 1; recalc(); sched(); });
  card.querySelector('.sec-aany').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    sec.answerAny = v && v > 0 && v < actualCount ? v : null;
    recalc(); sched();
  });
  card.querySelector('.sec-ag')?.addEventListener('input', (e) => { sec.ansGap = parseInt(e.target.value, 10) || 0; sched(); });

  card.querySelectorAll('.sec-os .pill').forEach((p) =>
    p.addEventListener('click', () => {
      card.querySelectorAll('.sec-os .pill').forEach((x) => x.classList.remove('on'));
      p.classList.add('on');
      sec.os = p.dataset.v;
      sched();
    })
  );

  if (isLinking) {
    card.classList.add('link-active');
    card.querySelector('.confirm-link').addEventListener('click', () => {
      if (linkMode.sel.length !== 2) { toast('Select exactly 2 questions.', 'warn'); return; }
      const q1Idx = sec.questions.findIndex((q) => q.id === linkMode.sel[0]);
      const q2Idx = sec.questions.findIndex((q) => q.id === linkMode.sel[1]);
      const first = Math.min(q1Idx, q2Idx), second = Math.max(q1Idx, q2Idx);
      const q2 = sec.questions.splice(second, 1)[0];
      sec.questions.splice(first + 1, 0, q2);
      sec.questions[first].isOrNext = true;
      linkMode.active = false; linkMode.secId = null; linkMode.sel = [];
      rebuildSecs(); sched();
    });
    card.querySelector('.cancel-link').addEventListener('click', () => {
      linkMode.active = false; linkMode.secId = null; linkMode.sel = [];
      rebuildSecs();
    });
  } else {
    card.querySelector('.start-link').addEventListener('click', () => {
      if (sec.questions.length < 2) { toast('Need at least 2 questions to link.', 'warn'); return; }
      linkMode.active = true; linkMode.secId = sec.id; linkMode.sel = [];
      rebuildSecs();
    });
    card.querySelector('.add-q').addEventListener('click', () => {
      sec.questions.push({ id: uid(), text: '', options: ['', '', '', ''], img: null, imgSize: 60, imgAlign: 'right', extra: [], isOrNext: false });
      rebuildSecs(); sched();
    });
  }

  renderQList(sec, idx, card.querySelector('.q-list'));
  return card;
}

function renderQList(sec, si, cont) {
  cont.innerHTML = '';
  if (!sec.questions.length) {
    cont.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:8px 0 4px;text-align:center">No questions yet — click below to add</div>';
    return;
  }
  let qNum = 1;
  const isLinking = linkMode.active && linkMode.secId === sec.id;
  sec.questions.forEach((q, qi) => {
    const isOrChild = qi > 0 && sec.questions[qi - 1].isOrNext;
    cont.appendChild(mkQItem(q, qi, sec, si, cont, qNum, isOrChild, isLinking));
    if (!q.isOrNext) qNum++;
  });
}

function attachValidatorHint(inputEl, hintContainer, hintKey = 'q') {
  let checkTimer = null;
  const runCheck = () => {
    const res = validateScientificExpression(inputEl.value);
    let hint = hintContainer.querySelector(`.val-hint[data-hkey="${hintKey}"]`);
    if (!res.valid) {
      inputEl.style.borderColor = 'var(--gold)';
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'val-hint';
        hint.dataset.hkey = hintKey;
        hintContainer.appendChild(hint);
      }
      hint.textContent = res.message;
    } else {
      inputEl.style.borderColor = '';
      if (hint) hint.remove();
    }
  };
  inputEl.addEventListener('blur', runCheck);
  inputEl.addEventListener('input', () => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(runCheck, 400);
  });
  if (inputEl.value) runCheck();
}

function mkQItem(q, qi, sec, si, cont, qNum, isOrChild, isLinking) {
  const w = document.createElement('div');
  w.className = 'qitem';
  const num = `${bn(si + 1)}.${bn(qNum)})`;
  if (q.imgSize === undefined) q.imgSize = 60;
  if (!q.imgAlign) q.imgAlign = 'right';
  const typeLabel = TYPES.find((t) => t.v === sec.type)?.l || sec.type;

  const hdrHtml = `
    <div class="qitem-hdr">
      <div class="qnum" style="${isOrChild ? 'opacity:0.4' : ''}">${num}</div>
      <span class="q-type-badge">${typeLabel}</span>
      ${isOrChild ? '<span style="font-size:9px; color:var(--gold); font-weight:bold; margin-left:6px">(OR Variant)</span>' : ''}
      ${q.isOrNext ? '<span style="font-size:9px; color:var(--accent3); font-weight:bold; margin-left:6px">🔗 LINKED TO NEXT</span>' : ''}
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-xs toggle-ex no-print" title="Minimize/Expand Question" style="transition:transform 0.2s;">^</button>
      <button class="btn btn-ghost btn-xs move-q-up no-print" title="Move Up">↑</button>
      <button class="btn btn-ghost btn-xs move-q-dn no-print" title="Move Down">↓</button>
      <button class="btn btn-danger btn-sm del-q no-print" title="Delete" style="margin-left:4px">✕</button>
    </div>`;

  if (sec.type === 'mcq') {
    const ls = sec.os === 'en' ? EN_O : BN_O;
    const optsHtml = [0, 1, 2, 3]
      .map(
        (i) => `<div class="opt-row"><span class="opt-ltr">${ls[i]}</span><input type="text" class="opt-f bn-field" data-i="${i}" value="${esc(q.options[i] || '')}" placeholder="Option ${i + 1}"/></div>`
      )
      .join('');

    w.innerHTML = `
      ${hdrHtml}
      <div class="q-body-wrap" style="display:block;">
        <div class="q-img-row" style="margin-top:6px;">
          <div class="q-txt-wrap" style="flex:1;min-width:0">
            <textarea class="q-txt bn-field" rows="2" placeholder="Question text (Bengali or English)…">${esc(q.text)}</textarea>
            <div class="opt-grid">${optsHtml}</div>
          </div>
          <div class="img-slot no-print" title="Click to add image (optional)">
            ${q.img ? `<img src="${q.img}" alt=""/>` : '<span style="line-height:1.4">+<br>Image</span>'}
            <input type="file" accept="image/*" hidden class="qi-file"/>
          </div>
        </div>
        <div class="q-actions no-print" style="justify-content:flex-end">
          ${
            q.img
              ? `<div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                   <div class="slider-wrap"><span style="font-size:9px;color:var(--t3)">Align:</span>
                     <button class="btn btn-ghost btn-xs set-img-align" data-val="left" style="background:${q.imgAlign === 'left' ? 'var(--accent)' : 'transparent'};color:${q.imgAlign === 'left' ? '#fff' : 'var(--t2)'}">L</button>
                     <button class="btn btn-ghost btn-xs set-img-align" data-val="center" style="background:${q.imgAlign === 'center' ? 'var(--accent)' : 'transparent'};color:${q.imgAlign === 'center' ? '#fff' : 'var(--t2)'}">C</button>
                     <button class="btn btn-ghost btn-xs set-img-align" data-val="right" style="background:${q.imgAlign === 'right' ? 'var(--accent)' : 'transparent'};color:${q.imgAlign === 'right' ? '#fff' : 'var(--t2)'}">R</button>
                   </div>
                   <div class="slider-wrap"><span style="font-size:9px;color:var(--t3)">Size:</span> <input type="range" class="qi-size" min="20" max="100" value="${q.imgSize}"> <span style="font-size:9px;color:var(--t3)" class="qi-sv">${q.imgSize}%</span></div>
                 </div>`
              : ''
          }
        </div>
      </div>`;
  } else {
    w.innerHTML = `
      ${hdrHtml}
      <div class="q-body-wrap" style="display:block; margin-top:6px;">
        <div class="q-txt-wrap">
          <textarea class="q-txt bn-field" rows="3" placeholder="Type your question here…">${esc(q.text)}</textarea>
        </div>
        <div class="q-actions no-print"></div>
        <div class="q-actions-extra no-print" style="display:flex; align-items:center;">
          <button class="btn btn-ghost btn-xs add-img-q">🖼 Image</button>
          <button class="btn btn-ghost btn-xs add-tbl-q">⊞ Table</button>
          <button class="btn btn-ghost btn-xs add-dia-q">✏ Diagram</button>
          <button class="btn btn-ghost btn-xs add-lbl-q">🏷 Labeled Diagram</button>
          <div style="margin-left:auto; display:${S.ansSpace ? 'flex' : 'none'}; align-items:center; gap:4px; font-size:10px; color:var(--t3);" title="Custom blank space height for this question">
            Gap(mm): <input type="number" class="q-ag-inp bn-field" value="${q.ansGap !== undefined && q.ansGap !== '' ? q.ansGap : ''}" placeholder="auto" style="width:45px; padding:2px 4px; font-size:11px;"/>
          </div>
        </div>
        <div class="extra-cont"></div>
      </div>`;

    const extraCont = w.querySelector('.extra-cont');
    renderExtras(q, extraCont);
    w.querySelector('.add-img-q').addEventListener('click', () => addExtraImg(q, extraCont));
    w.querySelector('.add-tbl-q').addEventListener('click', () => addExtraTbl(q, extraCont));
    w.querySelector('.add-dia-q').addEventListener('click', () => openDia(q, extraCont));
    w.querySelector('.add-lbl-q').addEventListener('click', () => addExtraLabeled(q, extraCont));
    w.querySelector('.q-ag-inp')?.addEventListener('input', (e) => {
      q.ansGap = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
      sched();
    });
  }

  const toggleBtn = w.querySelector('.toggle-ex');
  const bodyWrap = w.querySelector('.q-body-wrap');
  toggleBtn?.addEventListener('click', () => {
    const isHidden = bodyWrap.style.display === 'none';
    bodyWrap.style.display = isHidden ? 'block' : 'none';
    toggleBtn.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  if (q.isOrNext) {
    const qact = w.querySelector('.q-actions') || bodyWrap;
    qact.insertAdjacentHTML('beforeend', `<button class="btn btn-ghost btn-xs unlink-q no-print" style="margin-top:4px;" title="Remove OR link">Unlink 🔗</button>`);
    w.querySelector('.unlink-q').addEventListener('click', () => { q.isOrNext = false; rebuildSecs(); sched(); });
  }

  if (isLinking) {
    const isSelected = linkMode.sel.includes(q.id);
    w.style.cursor = 'pointer';
    w.style.border = isSelected ? '2px solid var(--accent)' : '1px dashed var(--border2)';
    if (isSelected) w.style.background = 'rgba(91,80,240,.06)';
    w.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (isSelected) linkMode.sel = linkMode.sel.filter((id) => id !== q.id);
      else if (linkMode.sel.length < 2) linkMode.sel.push(q.id);
      rebuildSecs();
    }, true);
  }

  w.querySelector('.del-q').addEventListener('click', () => { sec.questions = sec.questions.filter((x) => x.id !== q.id); rebuildSecs(); sched(); });
  w.querySelector('.move-q-up').addEventListener('click', () => { if (qi > 0) { [sec.questions[qi - 1], sec.questions[qi]] = [sec.questions[qi], sec.questions[qi - 1]]; rebuildSecs(); sched(); } });
  w.querySelector('.move-q-dn').addEventListener('click', () => { if (qi < sec.questions.length - 1) { [sec.questions[qi + 1], sec.questions[qi]] = [sec.questions[qi], sec.questions[qi + 1]]; rebuildSecs(); sched(); } });

  const qTxt = w.querySelector('.q-txt');
  qTxt.addEventListener('input', (e) => { q.text = e.target.value; sched(); scheduleHistoryPush(); });
  attachValidatorHint(qTxt, w.querySelector('.q-txt-wrap'), 'q');

  if (sec.type === 'mcq') {
    w.querySelectorAll('.opt-f').forEach((inp) => {
      inp.addEventListener('input', (e) => { q.options[+e.target.dataset.i] = e.target.value; sched(); scheduleHistoryPush(); });
      attachValidatorHint(inp, w.querySelector('.q-txt-wrap'), `opt-${inp.dataset.i}`);
    });
    const slot = w.querySelector('.img-slot');
    const fi = w.querySelector('.qi-file');
    slot.addEventListener('click', () => fi.click());
    fi.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => { q.img = ev.target.result; rebuildSecs(); sched(); };
      r.readAsDataURL(f);
    });
    w.querySelector('.qi-size')?.addEventListener('input', (e) => {
      q.imgSize = parseInt(e.target.value, 10);
      w.querySelector('.qi-sv').textContent = q.imgSize + '%';
      sched();
    });
    w.querySelectorAll('.set-img-align').forEach((btn) =>
      btn.addEventListener('click', (e) => { q.imgAlign = e.currentTarget.dataset.val; rebuildSecs(); sched(); })
    );
  }
  return w;
}

function renderExtras(q, cont) {
  cont.innerHTML = '';
  (q.extra || []).forEach((ex, idx) => {
    const align = ex.align || 'center';
    const sz = ex.size || 60;
    const d = document.createElement('div');
    d.className = 'extra-block';

    const alignUI = `
      <div style="position:absolute; top:4px; right:28px; display:flex; background:var(--bg1); border:1px solid var(--border2); border-radius:var(--r3); overflow:hidden; z-index:10;">
        <button class="extra-align-btn" data-xi="${idx}" data-val="left" style="background:${align === 'left' ? 'var(--accent)' : 'transparent'};color:${align === 'left' ? '#fff' : 'var(--t2)'};border:none;padding:2px 6px;font-size:9px;cursor:pointer;">L</button>
        <button class="extra-align-btn" data-xi="${idx}" data-val="center" style="background:${align === 'center' ? 'var(--accent)' : 'transparent'};color:${align === 'center' ? '#fff' : 'var(--t2)'};border:none;border-left:1px solid var(--border2);border-right:1px solid var(--border2);padding:2px 6px;font-size:9px;cursor:pointer;">C</button>
        <button class="extra-align-btn" data-xi="${idx}" data-val="right" style="background:${align === 'right' ? 'var(--accent)' : 'transparent'};color:${align === 'right' ? '#fff' : 'var(--t2)'};border:none;padding:2px 6px;font-size:9px;cursor:pointer;">R</button>
      </div>`;
    const del = `<button class="extra-del" data-xi="${idx}" title="Remove">✕</button>`;
    const szSlider =
      ex.type === 'image' || ex.type === 'diagram' || ex.type === 'labeled'
        ? `<div class="slider-wrap" style="position:absolute; bottom:6px; right:6px; background:var(--bg1); padding:2px 6px; border-radius:4px; border:1px solid var(--border2); z-index:10;">
             <span style="font-size:9px;color:var(--t3)">Size:</span>
             <input type="range" class="ex-size-inp" data-xi="${idx}" min="20" max="100" value="${sz}" style="max-width:50px;">
           </div>`
        : '';

    if (ex.type === 'image') {
      d.innerHTML = `${alignUI}${del}${szSlider}<div style="font-size:9px;color:var(--t3);margin-bottom:3px">📎 Image below question</div><img src="${ex.data}" style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto;"/>`;
    } else if (ex.type === 'table') {
      const rc = ex.rows.length;
      const cc = ex.rows[0] ? ex.rows[0].length : 0;
      const rowsHtml = ex.rows
        .map(
          (row, ri) =>
            `<tr>${row
              .map((c, ci) => `<td><textarea rows="1" class="bn-field tbl-cell" data-r="${ri}" data-c="${ci}">${esc(c)}</textarea></td>`)
              .join('')}</tr>`
        )
        .join('');
      d.innerHTML = `${alignUI}${del}<div style="font-size:9px;color:var(--t3);margin-bottom:4px">⊞ Table ${rc}×${cc}</div><div class="inline-tbl-wrap"><table class="inline-tbl">${rowsHtml}</table></div>`;
      const autoGrowCell = (el) => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      };
      d.querySelectorAll('.tbl-cell').forEach((inp) => {
        autoGrowCell(inp);
        inp.addEventListener('input', (e) => {
          autoGrowCell(e.target);
          ex.rows[+e.target.dataset.r][+e.target.dataset.c] = e.target.value;
          sched();
        });
      });
    } else if (ex.type === 'diagram') {
      d.innerHTML = `${alignUI}${del}${szSlider}<div style="font-size:9px;color:var(--t3);margin-bottom:3px">✏ Diagram</div><img src="${ex.png}" style="max-height:70px;max-width:100%;object-fit:contain;display:block;margin:0 auto;"/>`;
    } else if (ex.type === 'labeled') {
      const ptrsHtml = (ex.pointers || [])
        .map(
          (pt, pti) => `<div class="ptr-row"><input type="text" class="ptr-lbl" data-xi="${idx}" data-pi="${pti}" value="${esc(pt.label)}" placeholder="A" style="width:40px; font-size:10px; padding:3px"/><span style="font-size:10px;color:var(--t3)">________</span><button class="btn btn-ghost btn-xs ptr-del" data-xi="${idx}" data-pi="${pti}">✕</button></div>`
        )
        .join('');
      d.innerHTML = `${alignUI}${del}${szSlider}<div style="font-size:9px;color:var(--t3);margin-bottom:3px">🏷 Labeled Diagram</div>
        <div style="display:flex; flex-direction:row; gap:8px; padding-bottom:15px;">
          <div style="flex:1;">
            <div class="img-slot ptr-img-slot" data-xi="${idx}" style="width:100%; height:80px">
              ${ex.data ? `<img src="${ex.data}" alt=""/>` : '<span>+<br>Image</span>'}
              <input type="file" accept="image/*" hidden class="lbl-file"/>
            </div>
          </div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:600; color:var(--t2); display:flex; align-items:center; gap:4px; margin-bottom:4px;">
              Pointers: <button class="btn btn-ghost btn-xs ptr-add" data-xi="${idx}">+ Add</button>
              <select class="ptr-type-sel" data-xi="${idx}" style="font-size:9px; padding:2px; height:20px; width:auto;">
                <option value="1" ${ex.ptrType === '1' ? 'selected' : ''}>1, 2</option>
                <option value="A" ${ex.ptrType === 'A' ? 'selected' : ''}>A, B</option>
                <option value="a" ${ex.ptrType === 'a' ? 'selected' : ''}>a, b</option>
                <option value="i" ${ex.ptrType === 'i' ? 'selected' : ''}>i, ii</option>
                <option value="bn" ${ex.ptrType === 'bn' ? 'selected' : ''}>ক, খ</option>
              </select>
            </div>
            <div class="ptr-list">${ptrsHtml}</div>
          </div>
        </div>`;

      d.querySelector('.ptr-add').addEventListener('click', () => {
        ex.pointers.push({ label: getPtrLbl(ex.ptrType || 'i', ex.pointers.length), blank: true });
        renderExtras(q, cont); sched();
      });
      d.querySelector('.ptr-type-sel').addEventListener('change', (e) => { ex.ptrType = e.target.value; sched(); });
      d.querySelectorAll('.ptr-del').forEach((btn) =>
        btn.addEventListener('click', (e) => { ex.pointers.splice(+e.target.dataset.pi, 1); renderExtras(q, cont); sched(); })
      );
      d.querySelectorAll('.ptr-lbl').forEach((inp) =>
        inp.addEventListener('input', (e) => { ex.pointers[+e.target.dataset.pi].label = e.target.value; sched(); })
      );
      const slot = d.querySelector('.ptr-img-slot');
      const fi = d.querySelector('.lbl-file');
      slot.addEventListener('click', () => fi.click());
      fi.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => { ex.data = ev.target.result; renderExtras(q, cont); sched(); };
        r.readAsDataURL(f);
      });
    }

    d.querySelector('.extra-del').addEventListener('click', (e) => { q.extra.splice(+e.target.dataset.xi, 1); renderExtras(q, cont); sched(); });
    d.querySelectorAll('.extra-align-btn').forEach((btn) =>
      btn.addEventListener('click', (e) => { q.extra[+e.target.dataset.xi].align = e.target.dataset.val; renderExtras(q, cont); sched(); })
    );
    d.querySelectorAll('.ex-size-inp').forEach((inp) =>
      inp.addEventListener('input', (e) => { q.extra[+e.target.dataset.xi].size = parseInt(e.target.value, 10); sched(); })
    );
    cont.appendChild(d);
  });
}

function addExtraImg(q, cont) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
  inp.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { q.extra.push({ type: 'image', data: ev.target.result, size: 60, align: 'right' }); renderExtras(q, cont); sched(); };
    r.readAsDataURL(f);
  });
  document.body.appendChild(inp); inp.click(); inp.remove();
}

function addExtraTbl(q, cont) {
  const rows = parseInt(prompt('Number of rows?', '3') || '3', 10);
  const cols = parseInt(prompt('Number of columns?', '3') || '3', 10);
  if (!rows || !cols || rows < 1 || cols < 1 || rows > 30 || cols > 12) { toast('Invalid table size.', 'warn'); return; }
  q.extra.push({ type: 'table', rows: Array.from({ length: rows }, () => Array(cols).fill('')), align: 'center' });
  renderExtras(q, cont); sched();
}

function addExtraLabeled(q, cont) {
  q.extra.push({ type: 'labeled', data: null, align: 'right', size: 60, pointers: [{ label: 'i', blank: true }], ptrType: 'i' });
  renderExtras(q, cont); sched();
}

let _dQ = null, _dCont = null, _drawing = false, _snap = null, _sx = 0, _sy = 0, _tool = 'free';
function openDia(q, cont) {
  _dQ = q; _dCont = cont;
  const cv = $('dia-canvas');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  _snap = null; _tool = 'free';
  $$('.dia-t').forEach((b) => b.classList.remove('on'));
  $$('.dia-t')[0]?.classList.add('on');
  $('dia-modal').classList.add('show');

  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    const ce = e.touches ? e.touches[0] : e;
    return { x: (ce.clientX - r.left) * (cv.width / r.width), y: (ce.clientY - r.top) * (cv.height / r.height) };
  };
  const down = (e) => {
    _drawing = true;
    const p = pos(e); _sx = p.x; _sy = p.y;
    _snap = ctx.getImageData(0, 0, cv.width, cv.height);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e) => {
    if (!_drawing) return;
    const p = pos(e);
    const col = $('dia-col').value;
    const lw = parseInt($('dia-w').value, 10);
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (_tool === 'free') { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
    ctx.putImageData(_snap, 0, 0);
    ctx.beginPath();
    if (_tool === 'line') { ctx.moveTo(_sx, _sy); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    else if (_tool === 'rect') { ctx.strokeRect(_sx, _sy, p.x - _sx, p.y - _sy); }
    else if (_tool === 'circle') {
      const rx = Math.abs(p.x - _sx) / 2, ry = Math.abs(p.y - _sy) / 2;
      ctx.ellipse(_sx + (p.x - _sx) / 2, _sy + (p.y - _sy) / 2, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (_tool === 'arrow') {
      const ang = Math.atan2(p.y - _sy, p.x - _sx);
      ctx.moveTo(_sx, _sy); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 13 * Math.cos(ang - 0.42), p.y - 13 * Math.sin(ang - 0.42));
      ctx.lineTo(p.x - 13 * Math.cos(ang + 0.42), p.y - 13 * Math.sin(ang + 0.42));
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
  };
  const up = () => { _drawing = false; };
  cv.onmousedown = down; cv.onmousemove = move; cv.onmouseup = up;
  cv.ontouchstart = (e) => { e.preventDefault(); down(e); };
  cv.ontouchmove = (e) => { e.preventDefault(); move(e); };
  cv.ontouchend = up;

  const loadBtn = $('dia-load-img');
  const fileInp = $('dia-file');
  const newLoadBtn = loadBtn.cloneNode(true);
  loadBtn.parentNode.replaceChild(newLoadBtn, loadBtn);
  const newFileInp = fileInp.cloneNode(true);
  fileInp.parentNode.replaceChild(newFileInp, fileInp);
  newLoadBtn.addEventListener('click', () => newFileInp.click());
  newFileInp.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, cv.width, cv.height);
        const scale = Math.min(cv.width / img.width, cv.height / img.height);
        const x = cv.width / 2 - (img.width / 2) * scale;
        const y = cv.height / 2 - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  });
}

export function initDiagramModal() {
  $$('.dia-t').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.dataset.t) return;
      $$('.dia-t').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      _tool = b.dataset.t;
    })
  );
  $('dia-clr')?.addEventListener('click', () => $('dia-canvas').getContext('2d').clearRect(0, 0, 520, 320));
  $('dia-save')?.addEventListener('click', () => {
    const png = $('dia-canvas').toDataURL('image/png');
    if (_dQ) {
      _dQ.extra.push({ type: 'diagram', png, size: 60, align: 'center' });
      renderExtras(_dQ, _dCont);
      sched();
    }
    $('dia-modal').classList.remove('show');
  });
  $('dia-cancel')?.addEventListener('click', () => $('dia-modal').classList.remove('show'));
  $('dia-modal')?.addEventListener('click', (e) => { if (e.target === $('dia-modal')) $('dia-modal').classList.remove('show'); });
}

export function initInfoAndExports() {
  const closePanels = () => {
    $('info')?.classList.remove('show');
    $('guide')?.classList.remove('show');
    $('ov')?.classList.remove('show');
  };
  $('info-btn')?.addEventListener('click', () => { $('guide')?.classList.remove('show'); $('info')?.classList.add('show'); $('ov')?.classList.add('show'); });
  $('guide-btn')?.addEventListener('click', () => { $('info')?.classList.remove('show'); $('guide')?.classList.add('show'); $('ov')?.classList.add('show'); });
  $('info-close')?.addEventListener('click', closePanels);
  $('guide-close')?.addEventListener('click', closePanels);
  $('ov')?.addEventListener('click', closePanels);

  $('ex-qpf')?.addEventListener('click', (e) => {
    e.preventDefault();
    safeDownload(new Blob([serializeQPF(S)], { type: 'text/plain;charset=utf-8' }), exFname('qpf'));
    toast('QPF backup saved!', 'success');
  });
  $('ex-cbt')?.addEventListener('click', (e) => {
    e.preventDefault();
    safeDownload(new Blob([qpfStateToCbtString(S)], { type: 'text/plain;charset=utf-8' }), exFname('cbt'));
    toast('Converted & saved as .cbt!', 'success');
  });
  $('ex-odt')?.addEventListener('click', (e) => { e.preventDefault(); exportODT(); });
  $('ex-pdf')?.addEventListener('click', () => {
    const origTitle = document.title;
    const ori = getActiveOrient();
    let pStyle = document.getElementById('dynamic-print-page');
    if (!pStyle) {
      pStyle = document.createElement('style');
      pStyle.id = 'dynamic-print-page';
      document.head.appendChild(pStyle);
    }
    pStyle.textContent = `@page { size: A4 ${ori}; margin: 0; }`;
    document.documentElement.classList.remove('print-portrait', 'print-landscape');
    document.documentElement.classList.add('print-' + ori);
    document.title = exFname('pdf').replace('.pdf', '');
    const cleanup = () => {
      document.title = origTitle;
      document.documentElement.classList.remove('print-portrait', 'print-landscape');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2500);
    }, 60);
  });
}

export function initMathQuickBar() {
  attachMathQuickBar(
    $('qp-math-bar'),
    $('sidebar-scroll'),
    [
      { label: 'fx Easy', action: 'builder', title: 'Visual Math Builder (No LaTeX)' },
      { label: '[EQ: ]', snippet: '[EQ:]', cursorBack: 1, title: 'LaTeX Equation' },
      { label: 'a/b', snippet: '[EQ:\\frac{}{}]', cursorBack: 4, title: 'Fraction' },
      { label: '√x', snippet: '[EQ:\\sqrt{}]', cursorBack: 2, title: 'Square Root' },
      { label: 'ⁿ√x', snippet: '[EQ:\\sqrt[3]{}]', cursorBack: 2, title: 'nth Root' },
      { label: '[CHEM]', snippet: '[CHEM:]', cursorBack: 1, title: 'Chemistry Formula' },
      { label: 'x²', snippet: '[SUP:2]', cursorBack: 0, title: 'Superscript' },
      { label: 'x₂', snippet: '[SUB:2]', cursorBack: 0, title: 'Subscript' },
      { label: '×', snippet: '[SYM:times]', cursorBack: 0 },
      { label: '÷', snippet: '[SYM:div]', cursorBack: 0 },
      { label: '±', snippet: '[SYM:pm]', cursorBack: 0 },
      { label: '°', snippet: '[SYM:degree]', cursorBack: 0 },
      { label: '∠', snippet: '[SYM:angle]', cursorBack: 0 },
      { label: '△', snippet: '[SYM:triangle]', cursorBack: 0 },
      { label: '∥', snippet: '[SYM:parallel]', cursorBack: 0 },
      { label: '⊥', snippet: '[SYM:perp]', cursorBack: 0 },
      { label: 'π', snippet: '[SYM:pi]', cursorBack: 0 },
      { label: 'θ', snippet: '[SYM:theta]', cursorBack: 0 }
    ],
    '.q-txt, .opt-f, .tbl-cell',
    (activeEl, insertCb) => {
      const sel = activeEl ? activeEl.value.slice(activeEl.selectionStart || 0, activeEl.selectionEnd || 0) : '';
      openMathBuilderModal({ mode: 'qp', initialText: sel, onInsert: insertCb });
    }
  );
}
