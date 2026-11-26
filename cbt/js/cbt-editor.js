/* CBT Maker DOM Builders (XSS-Safe Event Listeners), Section/Question Controls & Search */
import { $, $$, esc } from '../../shared/js/dom.js';
import { appState, uiState, defaultConstants, showToast } from './cbt-state.js';
import {
  renderPreviewTabs, renderAllPreviews, debouncedRenderAllPreviews,
  debouncedUpdateSingleQuestionPreview, syncPreviewScroll
} from './cbt-preview.js';
import {
  handleNewImageUpload, editOrReplaceImage, removeImage,
  openTableModal, removeTable
} from './cbt-media.js';

let confirmCallback = null;
let onElevationUpdate = () => {};
let onScrollToLeft = () => {};

export function configureEditorCallbacks({ updateElevator, scrollToLeft }) {
  if (updateElevator) onElevationUpdate = updateElevator;
  if (scrollToLeft) onScrollToLeft = scrollToLeft;
}

export function showConfirm(msg, callback) {
  $('confirmMessage').innerText = msg;
  confirmCallback = callback;
  $('confirmModal').classList.add('active');
}

export function initConfirmModal() {
  $('confirmBtn')?.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    $('confirmModal').classList.remove('active');
  });
}

export function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
  onElevationUpdate();
}

export function renderConstantsTable() {
  const tbody = $('constantsTable');
  if (!tbody) return;
  tbody.innerHTML = '';
  appState.constants.forEach((c) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td><input type="text" class="const-name" value="${esc(c.name)}"></td><td><input type="text" class="const-value" value="${esc(c.value)}"></td><td><button type="button" class="btn btn-danger btn-sm del-const-btn" style="border-radius:6px;">✕</button></td>`;
    row.querySelector('.const-name').addEventListener('input', updateConstantsData);
    row.querySelector('.const-value').addEventListener('input', updateConstantsData);
    row.querySelector('.del-const-btn').addEventListener('click', () => {
      row.remove();
      updateConstantsData();
    });
    tbody.appendChild(row);
  });
}

export function updateConstantsData() {
  const arr = [];
  $$('#constantsTable tr').forEach((r) => {
    const n = r.querySelector('.const-name').value.trim();
    const v = r.querySelector('.const-value').value.trim();
    if (n || v) arr.push({ name: n, value: v });
  });
  appState.constants = arr;
}

export function addConstantRow() {
  appState.constants.push({ name: '', value: '' });
  renderConstantsTable();
}

export function loadDefaultConstants() {
  appState.constants = JSON.parse(JSON.stringify(defaultConstants));
  renderConstantsTable();
  showToast('Default Scientific Constants Loaded', 'success');
}

export function populateSearchDropdown() {
  const sel = $('searchSec');
  if (!sel) return;
  sel.innerHTML = '';
  appState.sections.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  updateSearchHint();
}

export function updateSearchHint() {
  const sec = $('searchSec')?.value;
  const len = (appState.questionsBySection[sec] || []).length;
  if ($('searchHint')) $('searchHint').innerText = len > 0 ? `(1-${len})` : '(0)';
}

export function jumpToQuestion() {
  const sec = $('searchSec')?.value;
  const qNum = parseInt($('searchQNum')?.value, 10);
  if (!sec || isNaN(qNum) || qNum < 1) return;
  const idx = qNum - 1;
  const block = document.getElementById(`qblock-${sec}-${idx}`);
  if (block) {
    const det = document.getElementById(`details-${sec}`);
    if (det) det.open = true;
    onScrollToLeft(block);
    block.classList.add('highlight-flash');
    setTimeout(() => block.classList.remove('highlight-flash'), 1500);
    syncPreviewScroll(sec, idx);
  } else {
    showToast(`Q${qNum} not found in ${sec}.`, 'error');
  }
}

export function renderMarksTable() {
  const tbody = $('marksTable');
  if (!tbody) return;
  tbody.innerHTML = '';
  appState.sections.forEach((sec, i) => {
    const qsCount = (appState.questionsBySection[sec.name] || []).length;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="text" class="sec-rename-inp" style="font-weight: 600;" value="${esc(sec.name)}"></td>
      <td style="text-align:center; font-weight:800; font-size: 1.1rem; color:var(--primary); background: rgba(59, 130, 246, 0.05);">${qsCount}</td>
      <td><input type="number" class="sec-mark-inp" value="${sec.marks}" step="0.5"></td>
      <td><input type="number" class="sec-neg-inp" value="${sec.negative}" step="0.5"></td>
      <td><input type="number" class="sec-att-inp" value="${sec.maxAttempts}"></td>`;
    const renameInp = row.querySelector('.sec-rename-inp');
    renameInp.addEventListener('blur', () => handleSectionRename(i, renameInp.value, renameInp));
    renameInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInp.blur(); });
    row.querySelector('.sec-mark-inp').addEventListener('input', (e) => { appState.sections[i].marks = parseFloat(e.target.value) || 0; });
    row.querySelector('.sec-neg-inp').addEventListener('input', (e) => { appState.sections[i].negative = parseFloat(e.target.value) || 0; });
    row.querySelector('.sec-att-inp').addEventListener('input', (e) => { appState.sections[i].maxAttempts = parseInt(e.target.value, 10) || 0; });
    tbody.appendChild(row);
  });
  populateSearchDropdown();
}

export function handleSectionRename(idx, newName, inputEl) {
  newName = newName.trim();
  if (!newName) { inputEl.value = appState.sections[idx].name; return; }
  if (appState.questionsBySection[newName] && newName !== appState.sections[idx].name) {
    showToast('Duplicate section name.', 'error');
    inputEl.value = appState.sections[idx].name;
    return;
  }
  const oldName = appState.sections[idx].name;
  if (oldName === newName) return;

  appState.sections[idx].name = newName;
  appState.questionsBySection[newName] = appState.questionsBySection[oldName] || [];
  delete appState.questionsBySection[oldName];
  if (uiState.activePreviewSection === oldName) uiState.activePreviewSection = newName;

  renderAllQuestions();
  renderPreviewTabs();
  if (uiState.previewIsVisible) renderAllPreviews();
  showToast(`Section renamed to "${newName}"`, 'success');
}

export function addNewSection() {
  let suffixIdx = appState.sections.length;
  let newName = 'Section ' + String.fromCharCode(65 + suffixIdx);
  while (appState.questionsBySection[newName]) {
    suffixIdx++;
    newName = 'Section ' + String.fromCharCode(65 + (suffixIdx % 26)) + (suffixIdx >= 26 ? suffixIdx : '');
  }
  appState.sections.push({ name: newName, marks: 4, negative: 1, maxAttempts: 0 });
  appState.questionsBySection[newName] = [{ type: 'MCQ', text: '', options: ['', '', '', ''], correct: 0, correctNat: '', image: '', table: '' }];
  uiState.activePreviewSection = newName;
  uiState.activeQuestionIndex = 0;

  renderAllQuestions();
  renderPreviewTabs();
  if (uiState.previewIsVisible) renderAllPreviews();

  setTimeout(() => {
    const secCard = document.getElementById(`details-${newName}`);
    if (secCard) {
      secCard.open = true;
      onScrollToLeft(secCard);
      secCard.classList.add('highlight-flash');
      setTimeout(() => secCard.classList.remove('highlight-flash'), 1500);
      const firstTextarea = secCard.querySelector('.qblock-textarea');
      if (firstTextarea) {
        try { firstTextarea.focus({ preventScroll: true }); } catch (_) { firstTextarea.focus(); }
        autoResize(firstTextarea);
      }
    }
    onElevationUpdate();
  }, 100);
}

export function deleteSection(evt, secName) {
  evt.stopPropagation();
  showConfirm(`⚠️ Are you sure you want to completely delete "${secName}" and ALL its questions?`, () => {
    appState.sections = appState.sections.filter((s) => s.name !== secName);
    delete appState.questionsBySection[secName];
    if (uiState.activePreviewSection === secName) uiState.activePreviewSection = appState.sections[0]?.name || '';
    renderAllQuestions();
    renderPreviewTabs();
    if (uiState.previewIsVisible) renderAllPreviews();
    onElevationUpdate();
  });
}

export function updateMissingImageAlert() {
  let missingImagesCount = 0;
  const missingLocs = [];
  appState.sections.forEach((sec) => {
    (appState.questionsBySection[sec.name] || []).forEach((q, i) => {
      let hasMissing = false;
      if (q.image === 'PLACEHOLDER') hasMissing = true;
      (q.options || []).forEach((o) => { if (o.includes('||IMG:PLACEHOLDER||')) hasMissing = true; });
      if (hasMissing) {
        missingImagesCount++;
        missingLocs.push(`Q${i + 1} (${sec.name})`);
      }
    });
  });
  const navIcon = $('missingImgIcon');
  const countText = $('missingImgCount');
  const modalList = $('missingImageList');
  if (!navIcon || !countText || !modalList) return;
  if (missingImagesCount > 0) {
    navIcon.classList.remove('hidden');
    countText.innerText = missingImagesCount;
    modalList.innerHTML = missingLocs.map((loc) => `<li>${esc(loc)}</li>`).join('');
  } else {
    navIcon.classList.add('hidden');
  }
}

export function renderAllQuestions() {
  const cont = $('questionsListAll');
  if (!cont) return;
  cont.innerHTML = '';
  appState.sections.forEach((secObj) => {
    const sec = secObj.name;
    const qs = appState.questionsBySection[sec] || [];
    const safeGridId = `grid-${sec.replace(/\s+/g, '_')}`;
    const details = document.createElement('details');
    details.className = 'card';
    details.id = `details-${sec}`;
    details.open = true;

    details.innerHTML = `
      <summary>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <span style="font-size: 1rem;">${esc(sec)}</span>
          <span class="sec-stats">${qs.length} Qs</span>
          <button type="button" class="btn btn-sm btn-danger del-sec-btn" style="padding:0.2rem 0.4rem; border-radius: 6px; margin-left: 0.5rem;" title="Delete Section">🗑️</button>
        </div>
      </summary>
      <div class="card-inner">
        <div class="section-questions-grid" id="${esc(safeGridId)}"></div>
      </div>`;

    details.querySelector('.del-sec-btn').addEventListener('click', (e) => deleteSection(e, sec));
    cont.appendChild(details);

    const grid = details.querySelector('.section-questions-grid');
    qs.forEach((q, idx) => grid.appendChild(createQuestionBlock(sec, idx, q)));

    const cardInner = details.querySelector('.card-inner');
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary btn-sm btn-block';
    addBtn.style.cssText = 'padding: 0.65rem; font-size: 0.85rem; border-radius: 8px;';
    addBtn.innerText = `➕ Add Question to ${sec}`;
    addBtn.addEventListener('click', (e) => { e.preventDefault(); addQuestion(sec); });
    cardInner.appendChild(addBtn);
  });

  renderMarksTable();
  updateMissingImageAlert();
  setTimeout(() => {
    $$('.auto-expand, .qblock-textarea').forEach(autoResize);
    onElevationUpdate();
  }, 50);
}

export function refreshQuestionBlock(sec, idx) {
  const oldBlock = document.getElementById(`qblock-${sec}-${idx}`);
  const q = appState.questionsBySection[sec]?.[idx];
  if (!oldBlock || !q) return;

  const scrollContainer = $('leftContentScroll');
  const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : null;
  const newBlock = createQuestionBlock(sec, idx, q);
  oldBlock.replaceWith(newBlock);
  newBlock.querySelectorAll('.auto-expand, .qblock-textarea').forEach(autoResize);

  if (scrollContainer && savedScrollTop !== null) {
    scrollContainer.scrollTop = savedScrollTop;
    onElevationUpdate();
  }
}

export function addQuestion(sec) {
  const newQ = { type: 'MCQ', text: '', options: ['', '', '', ''], correct: 0, correctNat: '', image: '', table: '' };
  if (!appState.questionsBySection[sec]) appState.questionsBySection[sec] = [];
  appState.questionsBySection[sec].push(newQ);
  const idx = appState.questionsBySection[sec].length - 1;

  const safeGridId = `grid-${sec.replace(/\s+/g, '_')}`;
  const grid = document.getElementById(safeGridId);

  if (grid) {
    const newBlock = createQuestionBlock(sec, idx, newQ);
    grid.appendChild(newBlock);
    const badge = document.querySelector(`#details-${CSS.escape(sec)} .sec-stats`);
    if (badge) badge.innerText = `${appState.questionsBySection[sec].length} Qs`;
    renderMarksTable();
    if (uiState.activePreviewSection === sec) debouncedRenderAllPreviews();

    onScrollToLeft(newBlock);
    newBlock.classList.add('highlight-flash');
    setTimeout(() => newBlock.classList.remove('highlight-flash'), 1200);
    const textarea = newBlock.querySelector('.qblock-textarea');
    if (textarea) {
      try { textarea.focus({ preventScroll: true }); } catch (_) { textarea.focus(); }
      autoResize(textarea);
    }
    onElevationUpdate();
  } else {
    renderAllQuestions();
  }
}

export function createQuestionBlock(sec, idx, q) {
  const div = document.createElement('div');
  div.className = 'question-block';
  div.id = `qblock-${sec}-${idx}`;
  const isNAT = q.type === 'NAT';
  const optsDisplay = isNAT ? 'none' : 'grid';
  const natDisplay = isNAT ? 'block' : 'none';

  div.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('textarea') && !e.target.closest('select')) {
      syncPreviewScroll(sec, idx);
    }
  });

  const optItemsHtml = (q.options || [])
    .map((opt, oi) => {
      let placeholderText = `Option ${String.fromCharCode(65 + oi)}`;
      const rawOpt = opt || '';
      let optText = rawOpt;
      let optImg = '';
      const imgMatch = rawOpt.match(/\|\|IMG:(.+?)\|\|/);
      if (imgMatch) { optImg = imgMatch[1]; optText = rawOpt.replace(imgMatch[0], ''); }

      let optImgPreview = '';
      if (optImg === 'PLACEHOLDER') {
        optImgPreview = `<div style="margin-top: 0.3rem; padding-left: 24px; width: 100%; display: flex; align-items: center; gap: 0.4rem;"><button type="button" class="btn btn-danger btn-sm highlight-flash trigger-opt-img" data-oi="${oi}" style="flex:1;">🚨 MISSING IMAGE</button></div>`;
        placeholderText = '🚨 Image Required...';
      } else if (optImg) {
        optImgPreview = `<div style="margin-top: 0.3rem; padding-left: 24px; width: 100%; display: flex; align-items: center; gap: 0.4rem;"><div id="edit-opt-img-${esc(sec)}-${idx}-${oi}" class="img-lazy-wrapper img-lazy-btn" data-src="${esc(optImg)}" style="padding:0.2rem 0.5rem; font-size:0.75rem; flex: 1;">🖼️ View Option Image</div><button type="button" class="btn btn-sm btn-danger rm-opt-img" data-oi="${oi}" style="padding:0.2rem 0.4rem;">✕</button></div>`;
      }

      return `
        <div class="qblock-option-item">
          <div class="option-main-row">
            <input type="radio" name="ans-${esc(sec)}-${idx}" class="option-radio" value="${oi}" ${q.correct === oi ? 'checked' : ''}>
            <span class="option-label">${String.fromCharCode(65 + oi)}.</span>
            <div class="option-input-wrap">
              <textarea class="auto-expand opt-ta" data-oi="${oi}" rows="1" placeholder="${placeholderText}">${esc(optText)}</textarea>
              <button type="button" class="opt-img-btn" data-oi="${oi}" title="Add Image (JPG, PNG, GIF, SVG)">🖼️</button>
              <input type="file" class="opt-img-file" data-oi="${oi}" accept="image/*,.gif,.svg,image/svg+xml,image/gif" style="display:none;">
            </div>
          </div>
          ${optImgPreview}
        </div>`;
    })
    .join('');

  const imgPreview =
    q.image === 'PLACEHOLDER'
      ? `<button type="button" class="btn btn-danger btn-sm highlight-flash trigger-q-img">🚨 UPLOAD MISSING IMAGE</button>`
      : q.image
      ? `<div id="edit-img-${esc(sec)}-${idx}" class="img-lazy-wrapper img-lazy-btn" data-src="${esc(q.image)}">🖼️ View Attached Image</div><button type="button" class="btn btn-sm btn-secondary edit-q-img" style="margin-left:5px;">Edit</button><button type="button" class="btn btn-sm btn-danger rm-q-img" style="margin-left:5px;">✕</button>`
      : '';

  const tablePreview = q.table
    ? `<div class="q-table-preview-container"><span class="table-overlay">📊 Table Inserted</span><button type="button" class="btn btn-sm btn-secondary edit-q-tbl">Edit</button><button type="button" class="btn btn-sm btn-danger rm-q-tbl">✕</button></div>`
    : '';

  div.innerHTML = `
    <div class="qblock-header">
      <div class="qnum">${idx + 1}</div>
      <div class="qblock-textarea-wrap">
        <textarea class="qblock-textarea" rows="1" placeholder="Type question text... Use **bold**, *italic*, __underline__. Math goes in $ signs.">${esc(q.text || '')}</textarea>
        <select class="form-control hide-desktop-only qtype-sel-mobile" style="width: auto; font-weight: 600; padding: 0.3rem 0.5rem;">
          <option value="MCQ" ${!isNAT ? 'selected' : ''}>Type: MCQ</option>
          <option value="NAT" ${isNAT ? 'selected' : ''}>Type: NAT</option>
        </select>
      </div>
    </div>
    <div class="options-grid" style="display: ${optsDisplay};">${optItemsHtml}</div>
    <div class="nat-config-block" style="display: ${natDisplay};">
      <label style="font-weight:600; font-size:0.8rem; color:var(--primary-dark);">Correct Answer (Exact/Range):</label>
      <input type="text" class="form-control nat-answer-input" style="font-family: monospace; font-weight:bold; margin-top:0.3rem;" value="${esc(q.correctNat || '')}" placeholder="e.g. 2.5 or 2.5-3.5">
    </div>
    <div class="qblock-media">${imgPreview} ${tablePreview}</div>
    <div class="compact-actions-row">
      <select class="form-control hide-mobile qtype-sel-desktop" style="width: auto; font-weight: 600; padding: 0.3rem 0.5rem;">
        <option value="MCQ" ${!isNAT ? 'selected' : ''}>Type: MCQ</option>
        <option value="NAT" ${isNAT ? 'selected' : ''}>Type: NAT</option>
      </select>
      <button type="button" class="btn btn-secondary btn-sm add-opt-btn" style="display: ${optsDisplay};">➕ <span class="hide-mobile">Option</span></button>
      <button type="button" class="btn btn-secondary btn-sm rm-opt-btn" style="display: ${optsDisplay};">➖ <span class="hide-mobile">Option</span></button>
      <button type="button" class="btn btn-secondary btn-sm trigger-q-img">🖼️ <span class="hide-mobile">Image</span></button>
      <input type="file" class="q-img-file" accept="image/*,.gif,.svg,image/svg+xml,image/gif" style="display:none;">
      <button type="button" class="btn btn-secondary btn-sm open-tbl-btn">📊 <span class="hide-mobile">Table</span></button>
      <div style="flex-grow: 1;"></div>
      <button type="button" class="btn btn-danger btn-sm del-q-btn" style="border-radius: 4px;">✕ <span class="hide-mobile">Remove</span></button>
    </div>`;

  // Wire all interactions cleanly via addEventListener (safe against quotes/XSS)
  const qTa = div.querySelector('.qblock-textarea');
  qTa.addEventListener('focus', () => { syncPreviewScroll(sec, idx); autoResize(qTa); });
  qTa.addEventListener('input', () => {
    autoResize(qTa);
    q.text = qTa.value;
    debouncedUpdateSingleQuestionPreview(sec, idx);
  });

  const handleTypeChange = (val) => {
    q.type = val;
    refreshQuestionBlock(sec, idx);
    debouncedUpdateSingleQuestionPreview(sec, idx);
  };
  div.querySelector('.qtype-sel-mobile').addEventListener('change', (e) => handleTypeChange(e.target.value));
  div.querySelector('.qtype-sel-desktop').addEventListener('change', (e) => handleTypeChange(e.target.value));

  div.querySelectorAll('.option-radio').forEach((r) =>
    r.addEventListener('change', () => {
      q.correct = parseInt(r.value, 10);
      debouncedUpdateSingleQuestionPreview(sec, idx);
      syncPreviewScroll(sec, idx);
    })
  );

  div.querySelectorAll('.opt-ta').forEach((ta) => {
    const oi = parseInt(ta.dataset.oi, 10);
    ta.addEventListener('focus', () => { syncPreviewScroll(sec, idx); autoResize(ta); });
    ta.addEventListener('input', () => {
      autoResize(ta);
      const rawOpt = q.options[oi] || '';
      const imgMatch = rawOpt.match(/\|\|IMG:(.+?)\|\|/);
      q.options[oi] = ta.value + (imgMatch ? `||IMG:${imgMatch[1]}||` : '');
      debouncedUpdateSingleQuestionPreview(sec, idx);
    });
  });

  div.querySelectorAll('.opt-img-btn, .trigger-opt-img').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const oi = btn.dataset.oi;
      div.querySelector(`.opt-img-file[data-oi="${oi}"]`)?.click();
    })
  );
  div.querySelectorAll('.opt-img-file').forEach((inp) =>
    inp.addEventListener('change', (e) => handleNewImageUpload(e, sec, idx, true, parseInt(inp.dataset.oi, 10)))
  );
  div.querySelectorAll('.rm-opt-img').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const oi = parseInt(btn.dataset.oi, 10);
      q.options[oi] = (q.options[oi] || '').replace(/\|\|IMG:(.+?)\|\|/g, '');
      refreshQuestionBlock(sec, idx);
      debouncedUpdateSingleQuestionPreview(sec, idx);
      updateMissingImageAlert();
    })
  );

  const natInp = div.querySelector('.nat-answer-input');
  natInp?.addEventListener('focus', () => syncPreviewScroll(sec, idx));
  natInp?.addEventListener('input', () => {
    q.correctNat = natInp.value;
    debouncedUpdateSingleQuestionPreview(sec, idx);
    syncPreviewScroll(sec, idx);
  });

  const qImgFile = div.querySelector('.q-img-file');
  div.querySelectorAll('.trigger-q-img').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); qImgFile.click(); }));
  qImgFile.addEventListener('change', (e) => handleNewImageUpload(e, sec, idx, false, 0));
  div.querySelector('.edit-q-img')?.addEventListener('click', (e) => { e.stopPropagation(); editOrReplaceImage(sec, idx); });
  div.querySelector('.rm-q-img')?.addEventListener('click', (e) => { e.stopPropagation(); removeImage(sec, idx); });

  div.querySelector('.open-tbl-btn').addEventListener('click', (e) => { e.stopPropagation(); openTableModal(sec, idx, false); });
  div.querySelector('.edit-q-tbl')?.addEventListener('click', (e) => { e.stopPropagation(); openTableModal(sec, idx, true); });
  div.querySelector('.rm-q-tbl')?.addEventListener('click', (e) => { e.stopPropagation(); removeTable(sec, idx); });

  div.querySelector('.add-opt-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    q.options.push('');
    refreshQuestionBlock(sec, idx);
    debouncedUpdateSingleQuestionPreview(sec, idx);
  });
  div.querySelector('.rm-opt-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (q.options.length > 2) {
      q.options.pop();
      if (q.correct >= q.options.length) q.correct = Math.max(0, q.options.length - 1);
      refreshQuestionBlock(sec, idx);
      debouncedUpdateSingleQuestionPreview(sec, idx);
    }
  });
  div.querySelector('.del-q-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm(`Delete Question ${idx + 1}?`, () => {
      appState.questionsBySection[sec].splice(idx, 1);
      renderAllQuestions();
      debouncedRenderAllPreviews();
    });
  });

  return div;
}
