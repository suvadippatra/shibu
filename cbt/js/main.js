/* CBT Maker Bootstrap Entry Point */
import { $, $$, copyText, attachMathQuickBar } from '../../shared/js/dom.js';
import { initSiteRuntime, triggerPasteStageAnimation } from '../../shared/js/site-prefs.js';
import { openMathBuilderModal } from '../../shared/js/math-builder.js';
import { appState, uiState, defaultRules, showToast, startMemoryTracker } from './cbt-state.js';
import { parseCBTData, generateCBTString, buildAIPrompt, SAMPLE_CBT_TEXT } from './cbt-parser.js';
import { renderPreviewTabs, renderAllPreviews, debouncedRenderAllPreviews } from './cbt-preview.js';
import {
  configureMediaCallbacks, openModal, closeModal, revealAllImages,
  initMediaListeners
} from './cbt-media.js';
import {
  configureEditorCallbacks, showConfirm, initConfirmModal, autoResize,
  renderConstantsTable, addConstantRow, loadDefaultConstants,
  renderMarksTable, addNewSection, renderAllQuestions, refreshQuestionBlock,
  updateMissingImageAlert, updateSearchHint, jumpToQuestion
} from './cbt-editor.js';
import { generateCBTHTML } from './cbt-compiler.js';

let prevSyncUrl = null;

function updateFastScrollElevator() {
  const leftContentScroll = $('leftContentScroll');
  const leftScrollRail = $('leftScrollRail');
  const leftScrollThumb = $('leftScrollThumb');
  if (!leftContentScroll || !leftScrollThumb || !leftScrollRail) return;
  const scrollHeight = leftContentScroll.scrollHeight;
  const clientHeight = leftContentScroll.clientHeight;
  const scrollTop = leftContentScroll.scrollTop;
  if (scrollHeight <= clientHeight) {
    leftScrollThumb.style.display = 'none';
    return;
  }
  leftScrollThumb.style.display = 'block';
  const railHeight = leftScrollRail.clientHeight;
  const thumbHeight = Math.max(36, (clientHeight / scrollHeight) * railHeight);
  leftScrollThumb.style.height = `${thumbHeight}px`;
  const maxScrollTop = scrollHeight - clientHeight;
  const maxThumbTop = railHeight - thumbHeight;
  leftScrollThumb.style.top = `${(scrollTop / maxScrollTop) * maxThumbTop}px`;
}

function scrollToElementInLeftPanel(targetEl) {
  const leftContentScroll = $('leftContentScroll');
  if (!targetEl || !leftContentScroll) return;
  const containerRect = leftContentScroll.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const relativeTop = targetRect.top - containerRect.top;
  if (relativeTop < 0 || relativeTop + targetRect.height > containerRect.height) {
    leftContentScroll.scrollTo({ top: leftContentScroll.scrollTop + relativeTop - 20, behavior: 'smooth' });
  }
}

function applyParsedCBT(rawText) {
  const parsed = parseCBTData(rawText);
  appState.sections = parsed.sections;
  appState.questionsBySection = parsed.questionsBySection;
  appState.constants = parsed.constants;
  appState.rules = parsed.rules.length ? parsed.rules : [...defaultRules];
  appState.audio = parsed.audio;
  appState.agencyName = parsed.agencyName;
  appState.examTitle = parsed.examTitle;
  appState.examSubtitle = parsed.examSubtitle;
  appState.duration = parsed.duration;
  appState.timerMode = parsed.timerMode || 'STOPWATCH';
  appState.fontName = parsed.fontName || appState.fontName;
  appState.mathMode = parsed.mathMode || 'LATEX';

  $('agencyName').value = appState.agencyName;
  $('examTitle').value = appState.examTitle;
  $('examSubtitle').value = appState.examSubtitle;
  $('duration').value = appState.duration;
  $('timerMode').value = appState.timerMode;
  $('rules').value = appState.rules.join('\n');
  $('audioBg').value = appState.audio.bg;
  $('audioStart').value = appState.audio.start;
  $('audioSubmit').value = appState.audio.submit;

  const fontSel = $('fontSelect');
  if (Array.from(fontSel.options).some((o) => o.value === appState.fontName)) {
    fontSel.value = appState.fontName;
  } else if (appState.fontName.toLowerCase().includes('tiro')) {
    fontSel.value = "'Tiro Bangla', 'Kalpurush', serif";
  }
  document.documentElement.style.setProperty('--preview-font', appState.fontName);

  switchPrompt(appState.mathMode);
  renderConstantsTable();
  renderMarksTable();
  renderAllQuestions();
  if (appState.sections.length > 0) uiState.activePreviewSection = appState.sections[0].name;
  uiState.activeQuestionIndex = 0;
  renderPreviewTabs();

  setTimeout(() => {
    $$('.auto-expand, .qblock-textarea').forEach(autoResize);
    if (uiState.previewIsVisible) {
      renderAllPreviews();
      triggerPasteStageAnimation($('previewArea'));
    }
    updateFastScrollElevator();
  }, 150);

  if (String(rawText || '').includes('<§>')) {
    showToast('Some words were marked unreadable (<§>) — review flagged questions before compiling.', 'warn');
  }
}

function switchPrompt(mode) {
  appState.mathMode = mode;
  $('tab-btn-latex').classList.remove('active');
  $('tab-btn-html').classList.remove('active');
  const engineNotice = $('engineHtmlNotice');
  const latexOptions = $$('.engine-latex-opt');

  if (mode === 'LATEX') {
    $('tab-btn-latex').classList.add('active');
    engineNotice.style.display = 'none';
    latexOptions.forEach((opt) => { opt.style.display = 'flex'; });
  } else {
    $('tab-btn-html').classList.add('active');
    engineNotice.style.display = 'block';
    latexOptions.forEach((opt) => { opt.style.display = 'none'; });
    $('engineHtmlRadio').checked = true;
    appState.renderEngine = 'HTML_FALLBACK';
    if (uiState.previewIsVisible) debouncedRenderAllPreviews();
  }
  $('aiPrompt').value = buildAIPrompt(appState);
  renderPreviewTabs();
}

function syncCBT() {
  const out = generateCBTString(appState);
  $('cbtInput').value = out;
  autoResize($('cbtInput'));
  const blob = new Blob([out], { type: 'text/plain; charset=utf-8' });
  if (prevSyncUrl) URL.revokeObjectURL(prevSyncUrl);
  prevSyncUrl = URL.createObjectURL(blob);
  const link = $('downloadLinkCBT');
  link.href = prevSyncUrl;
  link.download = `${appState.examTitle ? appState.examTitle.replace(/\s+/g, '_') : 'Exam'}.cbt`;
  $('downloadAreaCBT').classList.remove('hidden');
  showToast('CBT Synced and ready for backup!', 'success');
}

function togglePreviewLayout() {
  uiState.previewIsVisible = !uiState.previewIsVisible;
  const right = $('rightPanel');
  const left = $('leftPanel');
  const res = $('dragMe');
  // Only apply mobile-style data-cbt-tab on small screens
  const isMobile = window.matchMedia('(max-width: 820px)').matches;

  left.style.flex = ''; left.style.maxWidth = ''; left.style.maxHeight = ''; left.style.width = ''; left.style.height = '';
  right.style.flex = ''; right.style.maxWidth = ''; right.style.maxHeight = '';

  if (uiState.previewIsVisible) {
    right.classList.remove('hidden-panel');
    left.classList.remove('expanded');
    left.classList.add('split-view');
    res.style.display = isMobile ? 'none' : 'flex';
    document.body.classList.add('cbt-preview-open');
    if (isMobile) {
      document.body.setAttribute('data-cbt-tab', 'preview');
      $$('#cbt-mobile-tabs .cbt-mtab').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'preview'));
    }
    renderPreviewTabs();
    renderAllPreviews();
  } else {
    right.classList.add('hidden-panel');
    left.classList.add('expanded');
    left.classList.remove('split-view');
    res.style.display = 'none';
    document.body.classList.remove('cbt-preview-open');
    if (isMobile) {
      document.body.setAttribute('data-cbt-tab', 'editor');
      $$('#cbt-mobile-tabs .cbt-mtab').forEach((b) => b.classList.toggle('on', b.dataset.tab === 'editor'));
    }
  }
  setTimeout(updateFastScrollElevator, 250);
}


function initResizerAndElevator() {
  const resizer = $('dragMe');
  const leftPanel = $('leftPanel');
  const rightPanel = $('rightPanel');
  const mainContainer = document.querySelector('.main');
  let isResizing = false;
  let animationFrameId = null;

  const handleResizeMove = (clientX, clientY) => {
    if (!isResizing) return;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(() => {
      const mainRect = mainContainer.getBoundingClientRect();
      const isColumn = window.getComputedStyle(mainContainer).flexDirection === 'column';
      if (!isColumn) {
        const newWidth = ((clientX - mainRect.left) / mainRect.width) * 100;
        if (newWidth >= 18 && newWidth <= 82) {
          leftPanel.style.flex = `0 0 ${newWidth}%`;
          leftPanel.style.maxWidth = `${newWidth}%`;
          leftPanel.style.width = `${newWidth}%`;
          rightPanel.style.flex = `1 1 ${100 - newWidth}%`;
          rightPanel.style.maxWidth = `${100 - newWidth}%`;
        }
      } else {
        const newHeight = ((clientY - mainRect.top) / mainRect.height) * 100;
        if (newHeight >= 15 && newHeight <= 85) {
          leftPanel.style.flex = `0 0 ${newHeight}%`;
          leftPanel.style.maxHeight = `${newHeight}%`;
          leftPanel.style.height = `${newHeight}%`;
          rightPanel.style.flex = `1 1 ${100 - newHeight}%`;
          rightPanel.style.maxHeight = `${100 - newHeight}%`;
        }
      }
    });
  };
  const startResizing = () => {
    isResizing = true;
    document.body.classList.add('is-resizing');
    resizer.classList.add('resizing');
  };
  const stopResizing = (e) => {
    if (!isResizing) return;
    try { if (e && e.pointerId) resizer.releasePointerCapture(e.pointerId); } catch (_) {}
    isResizing = false;
    document.body.classList.remove('is-resizing');
    resizer.classList.remove('resizing');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  };

  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { resizer.setPointerCapture(e.pointerId); } catch (_) {}
    startResizing();
  });
  resizer.addEventListener('pointermove', (e) => { if (isResizing) { e.preventDefault(); handleResizeMove(e.clientX, e.clientY); } });
  resizer.addEventListener('pointerup', stopResizing);
  resizer.addEventListener('pointercancel', stopResizing);
  window.addEventListener('resize', () => {
    leftPanel.style.flex = ''; leftPanel.style.maxWidth = ''; leftPanel.style.width = ''; leftPanel.style.height = '';
    rightPanel.style.flex = ''; rightPanel.style.maxWidth = '';
    updateFastScrollElevator();
  });

  const leftContentScroll = $('leftContentScroll');
  const leftScrollRail = $('leftScrollRail');
  const leftScrollThumb = $('leftScrollThumb');
  let isScrubbing = false;
  const handleScrub = (clientY) => {
    const railRect = leftScrollRail.getBoundingClientRect();
    const maxThumbTop = railRect.height - leftScrollThumb.clientHeight;
    let clickY = clientY - railRect.top - leftScrollThumb.clientHeight / 2;
    clickY = Math.max(0, Math.min(clickY, maxThumbTop));
    const scrollRatio = maxThumbTop > 0 ? clickY / maxThumbTop : 0;
    leftContentScroll.scrollTop = scrollRatio * (leftContentScroll.scrollHeight - leftContentScroll.clientHeight);
    updateFastScrollElevator();
  };
  leftScrollRail.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { leftScrollRail.setPointerCapture(e.pointerId); } catch (_) {}
    isScrubbing = true;
    handleScrub(e.clientY);
  });
  leftScrollRail.addEventListener('pointermove', (e) => { if (isScrubbing) { e.preventDefault(); handleScrub(e.clientY); } });
  const stopScrubbing = (e) => {
    if (!isScrubbing) return;
    try { if (e && e.pointerId) leftScrollRail.releasePointerCapture(e.pointerId); } catch (_) {}
    isScrubbing = false;
  };
  leftScrollRail.addEventListener('pointerup', stopScrubbing);
  leftScrollRail.addEventListener('pointercancel', stopScrubbing);
  leftContentScroll.addEventListener('scroll', updateFastScrollElevator, { passive: true });
}

function init() {
  try { localStorage.setItem('shibu_last_tool', 'cbt/cbt_index.html'); } catch (_) {}
  initSiteRuntime();
  startMemoryTracker();
  initConfirmModal();
  initMediaListeners();
  initResizerAndElevator();

  configureEditorCallbacks({ updateElevator: updateFastScrollElevator, scrollToLeft: scrollToElementInLeftPanel });
  configureMediaCallbacks({ refreshQuestion: refreshQuestionBlock, updateMissingAlerts: updateMissingImageAlert, showConfirmModal: showConfirm });

  // Sync theme & icon
  const syncThemeIcon = (theme) => {
    const btn = $('btnTheme');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  };
  try {
    const savedTheme = localStorage.getItem('qpm-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', savedTheme);
      syncThemeIcon(savedTheme);
    } else {
      syncThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');
    }
  } catch (_) {}

  // Topbar actions
  $('btnTheme')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    syncThemeIcon(next);
    try { localStorage.setItem('qpm-theme', next); } catch (_) {}
  });
  $('previewToggleBtn')?.addEventListener('click', togglePreviewLayout);
  $('btnPromptModal')?.addEventListener('click', () => openModal('promptModal'));
  $('btnImportModal')?.addEventListener('click', () => openModal('pasteModal'));
  $('missingImgIcon')?.addEventListener('click', () => openModal('missingImageModal'));

  const closeDropdown = () => $$('.dropdown-content').forEach((d) => d.classList.remove('show'));
  $('btnMenuToggle')?.addEventListener('click', (e) => { e.stopPropagation(); $('mainMenu').classList.toggle('show'); });
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) closeDropdown();
  });

  $('menuFullscreen')?.addEventListener('click', () => {
    closeDropdown();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => showToast('Fullscreen blocked', 'error'));
    else document.exitFullscreen?.();
  });
  $('menuEngine')?.addEventListener('click', () => { closeDropdown(); openModal('engineModal'); });
  $('menuRevealAll')?.addEventListener('click', () => { closeDropdown(); revealAllImages(); });
  $('menuCompile')?.addEventListener('click', () => { closeDropdown(); generateCBTHTML(); });
  $('menuHelp')?.addEventListener('click', () => { closeDropdown(); openModal('helpModal'); });
  $('menuClear')?.addEventListener('click', () => {
    closeDropdown();
    showConfirm('🚨 Are you sure you want to delete ALL sections and questions? This will free up RAM.', () => {
      appState.sections = [];
      appState.questionsBySection = {};
      renderAllQuestions();
      renderPreviewTabs();
      showToast('Workspace Cleared. Memory Freed.', 'success');
    });
  });

  // Mobile segmented tabs (≤820px only)
  document.body.setAttribute('data-cbt-tab', 'editor');
  $$('#cbt-mobile-tabs .cbt-mtab').forEach((btn) =>
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('#cbt-mobile-tabs .cbt-mtab').forEach((b) => b.classList.toggle('on', b === btn));
      document.body.setAttribute('data-cbt-tab', tab);
      if (tab === 'preview') {
        uiState.previewIsVisible = true;
        $('rightPanel')?.classList.remove('hidden-panel');
        $('leftPanel')?.classList.remove('expanded');
        $('leftPanel')?.classList.add('split-view');
        document.body.classList.add('cbt-preview-open');
        renderPreviewTabs();
        renderAllPreviews();
      }
    })
  );

  const mobileMq = window.matchMedia?.('(max-width: 820px)');
  mobileMq?.addEventListener?.('change', (e) => {
    const res = $('dragMe');
    if (e.matches) {
      if (res) res.style.display = 'none';
    } else if (uiState.previewIsVisible) {
      $('rightPanel')?.classList.remove('hidden-panel');
      $('leftPanel')?.classList.remove('expanded');
      $('leftPanel')?.classList.add('split-view');
      if (res) res.style.display = 'flex';
      renderPreviewTabs();
      renderAllPreviews();
    } else {
      $('rightPanel')?.classList.add('hidden-panel');
      $('leftPanel')?.classList.add('expanded');
      $('leftPanel')?.classList.remove('split-view');
      if (res) res.style.display = 'none';
    }
  });


  // Modal close buttons
  $$('[data-close-modal]').forEach((btn) => btn.addEventListener('click', () => closeModal(btn.dataset.closeModal)));
  $('image-lightbox')?.addEventListener('click', () => {
    $('image-lightbox').classList.remove('active');
    $('image-lightbox').classList.add('hidden');
  });

  // Exam details bindings
  $('agencyName')?.addEventListener('input', (e) => { appState.agencyName = e.target.value; debouncedRenderAllPreviews(); });
  $('examTitle')?.addEventListener('input', (e) => {
    appState.examTitle = e.target.value;
    $('aiPrompt').value = buildAIPrompt(appState);
    debouncedRenderAllPreviews();
  });
  $('examSubtitle')?.addEventListener('input', (e) => { appState.examSubtitle = e.target.value; debouncedRenderAllPreviews(); });
  $('duration')?.addEventListener('input', (e) => { appState.duration = parseInt(e.target.value, 10) || ''; });
  $('timerMode')?.addEventListener('change', (e) => { appState.timerMode = e.target.value; });
  $('fontSelect')?.addEventListener('change', (e) => {
    appState.fontName = e.target.value;
    document.documentElement.style.setProperty('--preview-font', e.target.value);
    debouncedRenderAllPreviews();
  });

  $('btnOpenRules')?.addEventListener('click', () => openModal('rulesModal'));
  $('btnOpenConstants')?.addEventListener('click', () => openModal('constantsModal'));
  const updateRulesData = () => {
    appState.rules = $('rules').value.split('\n').filter((r) => r.trim());
    appState.audio.bg = $('audioBg').value.trim();
    appState.audio.start = $('audioStart').value.trim();
    appState.audio.submit = $('audioSubmit').value.trim();
  };
  ['rules', 'audioBg', 'audioStart', 'audioSubmit'].forEach((id) => $(id)?.addEventListener('input', updateRulesData));
  $('btnAddConstant')?.addEventListener('click', addConstantRow);
  $('btnLoadDefConstants')?.addEventListener('click', loadDefaultConstants);

  $$('input[name="mathEngine"]').forEach((r) =>
    r.addEventListener('change', () => {
      appState.renderEngine = r.value;
      debouncedRenderAllPreviews();
    })
  );

  $('searchSec')?.addEventListener('change', updateSearchHint);
  $('btnJumpQ')?.addEventListener('click', jumpToQuestion);
  $('btnAddSection')?.addEventListener('click', addNewSection);
  $('compileBtn')?.addEventListener('click', generateCBTHTML);

  $('tab-btn-latex')?.addEventListener('click', () => switchPrompt('LATEX'));
  $('tab-btn-html')?.addEventListener('click', () => switchPrompt('HTML'));
  $('btnCopyPrompt')?.addEventListener('click', async () => {
    const ok = await copyText($('aiPrompt').value);
    showToast(ok ? 'Copied to clipboard!' : 'Copy failed', ok ? 'success' : 'error');
  });

  $('btnBrowseCBT')?.addEventListener('click', () => $('cbtFileUpload').click());
  $('cbtFileUpload')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      $('cbtInput').value = ev.target.result;
      autoResize($('cbtInput'));
    };
    reader.readAsText(f);
    e.target.value = '';
  });
  $('btnSyncCBT')?.addEventListener('click', syncCBT);
  $('btnClearCBT')?.addEventListener('click', () => { $('cbtInput').value = ''; autoResize($('cbtInput')); });
  $('btnImportCBT')?.addEventListener('click', () => {
    const txt = $('cbtInput').value;
    if (!txt.trim()) { showToast('Paste content or load file first', 'error'); return; }
    applyParsedCBT(txt);
    closeModal('pasteModal');
    showToast('Imported Successfully', 'success');
  });
  $('btnHelpLang')?.addEventListener('click', () => {
    $('help-eng').classList.toggle('hidden');
    $('help-ben').classList.toggle('hidden');
  });

  // Touch Math Quick-Bar
  attachMathQuickBar(
    $('cbt-math-bar'),
    $('questionsListAll'),
    [
      { label: 'fx Easy', action: 'builder', title: 'Visual Math Builder (No LaTeX)' },
      { label: '$ $', snippet: '$$', cursorBack: 1, title: 'Inline Math' },
      { label: '$$ $$', snippet: '$$$$', cursorBack: 2, title: 'Display Math' },
      { label: 'a/b', snippet: '$\\frac{}{}$', cursorBack: 4, title: 'Fraction' },
      { label: '√x', snippet: '$\\sqrt{}$', cursorBack: 2, title: 'Square Root' },
      { label: '×', snippet: '\\times ', cursorBack: 0 },
      { label: '≠', snippet: '\\neq ', cursorBack: 0 },
      { label: '≤', snippet: '\\leq ', cursorBack: 0 },
      { label: '≥', snippet: '\\geq ', cursorBack: 0 },
      { label: 'xⁿ', snippet: '^{}', cursorBack: 1 },
      { label: 'xₙ', snippet: '_{}', cursorBack: 1 },
      { label: '**B**', snippet: '****', cursorBack: 2, title: 'Bold' },
      { label: '*I*', snippet: '**', cursorBack: 1, title: 'Italic' }
    ],
    '.qblock-textarea, .opt-ta',
    (activeEl, insertCb) => {
      const sel = activeEl ? activeEl.value.slice(activeEl.selectionStart || 0, activeEl.selectionEnd || 0) : '';
      openMathBuilderModal({ mode: 'cbt', initialText: sel, onInsert: insertCb });
    }
  );

  // Boot state: sessionStorage handoff, ?sample=cbt, or fresh section
  renderConstantsTable();
  $('rules').value = appState.rules.join('\n');
  let loadedExternal = false;
  try {
    const pendingCbt = sessionStorage.getItem('shibu_pending_cbt');
    if (pendingCbt) {
      sessionStorage.removeItem('shibu_pending_cbt');
      applyParsedCBT(pendingCbt);
      showToast('Loaded .cbt exam into workspace!', 'success');
      loadedExternal = true;
    }
  } catch (err) {
    showToast('Load error: ' + err.message, 'error');
  }

  const params = new URLSearchParams(window.location.search);
  if (!loadedExternal && params.get('sample') === 'cbt') {
    applyParsedCBT(SAMPLE_CBT_TEXT);
    showToast('Sample Bengali Math & STEM CBT loaded!', 'success');
    loadedExternal = true;
  }

  if (!loadedExternal && appState.sections.length === 0) {
    addNewSection();
  }
  $('aiPrompt').value = buildAIPrompt(appState);
  renderPreviewTabs();
  setTimeout(() => {
    $$('.auto-expand').forEach(autoResize);
    updateFastScrollElevator();
  }, 150);
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
