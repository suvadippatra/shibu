/* QP Maker Bootstrap Entry Point */
import { $, $$, initTheme, toast, uid } from '../shared/js/dom.js';
import { initSiteRuntime } from '../shared/js/site-prefs.js';
import { S, HDGS_BN, applyVars, getHdgs } from './state.js';
import { SAMPLE_BN_MATH_QPF } from './qpf-parser.js';
import { sched } from './renderer.js';
import {
  applyQPFText, fitZoom, initSettings, initExamInfo, initImport,
  initZoom, initResize, initSliderButtons, initDiagramModal,
  initInfoAndExports, initMathQuickBar, initUndoRedo, rebuildSecs
} from './editor-ui.js';

function initMobileTabs() {
  document.body.setAttribute('data-qp-tab', 'editor');
  $$('#qp-mobile-tabs .qp-mtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('#qp-mobile-tabs .qp-mtab').forEach((b) => b.classList.toggle('on', b === btn));
      document.body.setAttribute('data-qp-tab', tab);
      if (tab === 'preview') {
        setTimeout(() => { fitZoom(); sched(10); }, 40);
      }
    });
  });
}

function init() {
  try { localStorage.setItem('shibu_last_tool', 'qp/index.html'); } catch (_) {}
  initTheme({ btnId: 'theme-btn', darkIconId: 'theme-icon-dark', lightIconId: 'theme-icon-light' });
  initSiteRuntime();
  applyVars();
  initSettings();
  initExamInfo();
  initImport();
  initZoom();
  initResize();
  initSliderButtons();
  initDiagramModal();
  initInfoAndExports();
  initMathQuickBar();
  initMobileTabs();
  fitZoom(false);

  document.querySelector('.logo')?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    document.body.classList.toggle('glow-mode');
    toast('Hidden glow mode toggled!', 'success');
  });

  $('add-sec')?.addEventListener('click', () => {
    if (S.sections.length >= 10) { toast('Maximum 10 sections.', 'warn'); return; }
    const i = S.sections.length;
    const hdgs = getHdgs();
    S.sections.push({
      id: uid(),
      heading: hdgs[Math.min(i, 3)],
      type: ['mcq', 'short', 'descriptive', 'long'][Math.min(i, 3)],
      mpq: [1, 1, 2, 3][Math.min(i, 3)],
      os: 'bn',
      answerAny: null,
      isCollapsed: false,
      questions: []
    });
    rebuildSecs();
    sched();
  });

  // Check if launched from Landing Hub with a sample or dropped .qpf file
  let loadedFromExternal = false;
  try {
    const pendingQpf = sessionStorage.getItem('shibu_pending_qpf');
    if (pendingQpf) {
      sessionStorage.removeItem('shibu_pending_qpf');
      applyQPFText(pendingQpf);
      toast('Loaded QPF file into editor!', 'success');
      loadedFromExternal = true;
    }
  } catch (err) {
    toast('Import error: ' + err.message, 'error');
  }

  const params = new URLSearchParams(window.location.search);
  if (!loadedFromExternal && params.get('sample') === 'bn-math') {
    try {
      applyQPFText(SAMPLE_BN_MATH_QPF);
      toast('Sample Bengali Math paper loaded!', 'success');
      loadedFromExternal = true;
    } catch (err) {
      toast('Sample load error: ' + err.message, 'error');
    }
  }

  if (!loadedFromExternal) {
    S.sections.push({
      id: uid(),
      heading: HDGS_BN[0],
      type: 'mcq',
      mpq: 1,
      os: 'bn',
      answerAny: null,
      isCollapsed: false,
      questions: []
    });
    rebuildSecs();
    sched(50);
  }
  initUndoRedo();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fitZoom(true), 200);
  });
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
