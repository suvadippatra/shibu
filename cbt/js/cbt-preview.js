/* CBT Maker Live Preview Renderer & Scroll Sync */
import { $, esc } from '../../shared/js/dom.js';
import { formatContent, stripMarkupLength, findUnmatchedMathTokens } from '../../shared/js/math-pipeline.js';
import { animateLiveReveal } from '../../shared/js/site-prefs.js';
import { appState, uiState } from './cbt-state.js';

const granularTimeouts = {};
let globalPreviewTimeout = null;

export function renderPreviewTabs() {
  const tabsContainer = $('previewTabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';
  if (appState.sections.length === 0) {
    $('previewArea').innerHTML =
      '<div style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-weight: 600;">Add a section to view preview.</div>';
    return;
  }
  if (!appState.sections.find((s) => s.name === uiState.activePreviewSection)) {
    uiState.activePreviewSection = appState.sections[0].name;
  }

  appState.sections.forEach((sec) => {
    const tab = document.createElement('div');
    tab.className = `ptab ${sec.name === uiState.activePreviewSection ? 'active' : ''}`;
    tab.innerText = sec.name;
    tab.addEventListener('click', () => {
      uiState.activePreviewSection = sec.name;
      renderPreviewTabs();
      renderAllPreviews();
    });
    tabsContainer.appendChild(tab);
  });
}

export function generateSinglePreviewHTML(sec, idx, q) {
  const processedText = formatContent(q.text, appState.renderEngine, appState.mathMode, globalThis.katex);
  const processedTable = q.table ? formatContent(q.table, appState.renderEngine, appState.mathMode, globalThis.katex) : '';
  const mathIssues = appState.mathMode === 'LATEX' ? findUnmatchedMathTokens([q.text, ...(q.options || [])].join(' ')) : [];
  if ([q.text, q.table, ...(q.options || [])].some((s) => String(s || '').includes('<§>'))) {
    mathIssues.unshift('Illegible OCR marker (<§>) — verify text');
  }
  const warnBadge = mathIssues.length
    ? `<div style="margin:0.35rem 0; padding:0.35rem 0.6rem; border-radius:6px; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.45); color:#f59e0b; font-size:0.78rem; font-weight:600;">⚠️ ${esc(mathIssues.join('; '))}</div>`
    : '';

  let html = `<div class="preview-question">${warnBadge}<div class="preview-qtext">Q${idx + 1}. ${processedText || '<span style="color:#aaa;">Typing question...</span>'}</div>`;

  if (q.image) {
    if (q.image === 'PLACEHOLDER') {
      html += `<div style="margin: 0.75rem 0; color: var(--danger); font-weight: bold; border: 1px dashed var(--danger); padding: 10px; border-radius: 4px; text-align: center;">🚨 Missing Image [Upload via Left Panel]</div>`;
    } else {
      html += `<div id="prev-img-${esc(sec)}-${idx}" class="img-lazy-wrapper img-lazy-btn" data-src="${esc(q.image)}" style="margin: 0.75rem 0;">🖼️ View Attached Image</div>`;
    }
  }
  if (processedTable) {
    html += `<div style="margin: 0.75rem 0; overflow-x: auto; border-radius: 8px; border: 1px dashed var(--border);">${processedTable}</div>`;
  }

  if (q.type === 'NAT') {
    html += `<div class="preview-nat">Answer Key: <strong>${esc(q.correctNat || '-')}</strong></div>`;
  } else {
    html += `<div class="preview-mcq-container">`;
    (q.options || []).forEach((opt, oi) => {
      let rawOpt = opt || '';
      let optImgSrc = '';
      const imgMatch = rawOpt.match(/\|\|IMG:(.+?)\|\|/);
      if (imgMatch) {
        optImgSrc = imgMatch[1];
        rawOpt = rawOpt.replace(imgMatch[0], '');
      }
      const safeOpt = formatContent(rawOpt, appState.renderEngine, appState.mathMode, globalThis.katex);
      const visLen = stripMarkupLength(rawOpt);
      const optLength = visLen > 100 ? 'long' : visLen > 50 ? 'medium' : 'short';

      html += `<div class="preview-option ${oi === q.correct ? 'correct' : ''}" data-length="${optLength}">`;
      html += `<strong>${String.fromCharCode(65 + oi)}.</strong> ${safeOpt || '<span style="color:#aaa;">...</span>'}`;

      if (optImgSrc) {
        if (optImgSrc === 'PLACEHOLDER') {
          html += `<div style="margin-top: 0.5rem; display: inline-flex; width: 100%; color:var(--danger); font-weight:bold;">🚨 Missing Option Image</div>`;
        } else {
          html += `<div id="prev-opt-img-${esc(sec)}-${idx}-${oi}" class="img-lazy-wrapper img-lazy-btn" data-src="${esc(optImgSrc)}" style="margin-top: 0.5rem; display: inline-flex; width: 100%;">🖼️ View Option Image</div>`;
        }
      }
      html += `</div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function runAutoRenderIfNeeded(container) {
  if (
    appState.mathMode === 'LATEX' &&
    (appState.renderEngine === 'KATEX_ONLINE' || appState.renderEngine === 'KATEX_LOCAL') &&
    typeof globalThis.renderMathInElement !== 'undefined'
  ) {
    globalThis.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }
}

export function updateSingleQuestionPreview(sec, idx) {
  if (!uiState.previewIsVisible) return;
  if (uiState.activePreviewSection !== sec) {
    syncPreviewScroll(sec, idx);
    return;
  }
  const qBox = document.getElementById(`preview-qbox-${sec}-${idx}`);
  const q = appState.questionsBySection[sec]?.[idx];
  if (!qBox || !q) return;

  const prevLen = (qBox.textContent || '').length;
  qBox.innerHTML = generateSinglePreviewHTML(sec, idx, q);
  runAutoRenderIfNeeded(qBox);
  const nextLen = (qBox.textContent || '').length;
  if (prevLen > 0 && prevLen !== nextLen) {
    animateLiveReveal(qBox, prevLen, nextLen);
  }
}

const _lastGranularTs = {};
export function debouncedUpdateSingleQuestionPreview(sec, idx) {
  if (!uiState.previewIsVisible) return;
  const key = `${sec}-${idx}`;
  const now = performance.now();
  if (granularTimeouts[key]) clearTimeout(granularTimeouts[key]);
  if (!_lastGranularTs[key] || now - _lastGranularTs[key] >= 60) {
    _lastGranularTs[key] = now;
    requestAnimationFrame(() => updateSingleQuestionPreview(sec, idx));
    return;
  }
  granularTimeouts[key] = setTimeout(() => {
    _lastGranularTs[key] = performance.now();
    updateSingleQuestionPreview(sec, idx);
  }, 60);
}

export function renderAllPreviews() {
  if (!uiState.previewIsVisible) return;
  const area = $('previewArea');
  if (!area) return;
  const qs = appState.questionsBySection[uiState.activePreviewSection] || [];
  if (qs.length === 0) {
    area.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 3rem; font-weight: 600;"><div style="font-size: 2rem; margin-bottom: 1rem;">👆</div>No questions in ${esc(uiState.activePreviewSection)} yet.</div>`;
    return;
  }

  let html = '';
  qs.forEach((q, idx) => {
    html += `<div id="preview-qbox-${esc(uiState.activePreviewSection)}-${idx}">${generateSinglePreviewHTML(uiState.activePreviewSection, idx, q)}</div>`;
  });
  area.innerHTML = html;
  runAutoRenderIfNeeded(area);
}

export function debouncedRenderAllPreviews() {
  if (!uiState.previewIsVisible) return;
  clearTimeout(globalPreviewTimeout);
  globalPreviewTimeout = setTimeout(() => renderAllPreviews(), 250);
}

export function scrollPreviewToQuestion(sec, idx) {
  const prevArea = $('previewArea');
  const prevEl = document.getElementById(`preview-qbox-${sec}-${idx}`);
  if (!prevArea || !prevEl) return;
  const containerRect = prevArea.getBoundingClientRect();
  const elRect = prevEl.getBoundingClientRect();
  prevArea.scrollTo({
    top: prevArea.scrollTop + (elRect.top - containerRect.top) - 24,
    behavior: 'smooth'
  });
  prevEl.classList.remove('highlight-flash');
  void prevEl.offsetWidth;
  prevEl.classList.add('highlight-flash');
  setTimeout(() => prevEl.classList.remove('highlight-flash'), 1200);
}

export function syncPreviewScroll(sec, idx) {
  uiState.activeQuestionIndex = idx;
  if (!uiState.previewIsVisible) return;
  const secChanged = uiState.activePreviewSection !== sec;
  uiState.activePreviewSection = sec;
  if (secChanged) {
    renderPreviewTabs();
    renderAllPreviews();
  }
  setTimeout(() => scrollPreviewToQuestion(sec, idx), secChanged ? 90 : 20);
}
