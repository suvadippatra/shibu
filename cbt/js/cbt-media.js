/* CBT Maker Media Helpers: Cropper.js, Filters, SVG/GIF Original Mode, Table Editor & 20s Lazy Image Flush */
import { $, $$, esc } from '../../shared/js/dom.js';
import { sanitizeHtmlFragment } from '../../shared/js/math-pipeline.js';
import { appState, uiState, showToast } from './cbt-state.js';
import { debouncedUpdateSingleQuestionPreview } from './cbt-preview.js';

let cropperInstance = null;
let currentImageData = null;
let currentCropBase64 = null;
let cropTimeout = null;
let currentTableData = null;

let onRefreshQuestion = () => {};
let onUpdateMissingAlerts = () => {};
let onConfirm = (msg, cb) => { if (confirm(msg)) cb(); };

export function configureMediaCallbacks({ refreshQuestion, updateMissingAlerts, showConfirmModal }) {
  if (refreshQuestion) onRefreshQuestion = refreshQuestion;
  if (updateMissingAlerts) onUpdateMissingAlerts = updateMissingAlerts;
  if (showConfirmModal) onConfirm = showConfirmModal;
}

export function openModal(id) {
  $(id)?.classList.add('active');
}

export function closeModal(id) {
  $(id)?.classList.remove('active');
  if (id === 'cropModal' && cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
}

export function openLightbox(src) {
  $('lightbox-img').src = src;
  $('image-lightbox').classList.add('active');
  $('image-lightbox').classList.remove('hidden');
}

export function revealImg(el) {
  if (!el) return;
  const src = el.getAttribute('data-src');
  const id = el.id;
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(src); });
  el.innerHTML = '';
  el.appendChild(img);
  el.classList.remove('img-lazy-btn');

  if (id && uiState.imageTimers[id]) clearTimeout(uiState.imageTimers[id]);
  if (id) {
    uiState.imageTimers[id] = setTimeout(() => {
      const checkEl = document.getElementById(id);
      if (checkEl) {
        checkEl.innerHTML = '🖼️ View Image';
        checkEl.classList.add('img-lazy-btn');
      }
    }, 20000);
  }
}

export function revealAllImages() {
  showToast('👁️ Revealing all images for 20 seconds...', 'success');
  $$('.img-lazy-wrapper.img-lazy-btn').forEach((wrapper) => revealImg(wrapper));
}

export function handleNewImageUpload(evt, sec, idx, isOption, optIdx) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageData = { sec, idx, isOption, optIdx, rawData: e.target.result, fileType: file.type, fileName: file.name };
    openCropModalWithData(e.target.result, file);
    evt.target.value = '';
    reader.onload = null;
  };
  reader.readAsDataURL(file);
}

export function editOrReplaceImage(sec, idx) {
  const q = appState.questionsBySection[sec]?.[idx];
  onConfirm('Edit existing image? (Cancel to upload new)', () => {
    if (q && q.image && q.image !== 'PLACEHOLDER') {
      currentImageData = { sec, idx, isOption: false, optIdx: 0, rawData: q.image };
      const isSvg = q.image.startsWith('data:image/svg+xml');
      const isGif = q.image.startsWith('data:image/gif');
      openCropModalWithData(q.image, { type: isSvg ? 'image/svg+xml' : isGif ? 'image/gif' : '' });
    }
  });
}

export function removeImage(sec, idx) {
  const q = appState.questionsBySection[sec]?.[idx];
  if (!q) return;
  q.image = '';
  onRefreshQuestion(sec, idx);
  debouncedUpdateSingleQuestionPreview(sec, idx);
  onUpdateMissingAlerts();
}

function openCropModalWithData(imgSrc, file) {
  $('cropImage').src = imgSrc;
  openModal('cropModal');
  $('compSlider').value = 80;
  $('compLabel').innerText = 80;
  $('filterSelect').value = 'none';
  $$('.ratio-btn').forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
  $('ratioFree').classList.add('btn-primary');
  $('ratioFree').classList.remove('btn-secondary');

  const isVectorOrAnim =
    file &&
    (file.type === 'image/svg+xml' ||
      file.type === 'image/gif' ||
      (file.name && (file.name.toLowerCase().endsWith('.svg') || file.name.toLowerCase().endsWith('.gif'))));
  const vNotice = $('vectorNotice');
  if (vNotice) vNotice.style.display = isVectorOrAnim ? 'block' : 'none';

  if (cropperInstance) cropperInstance.destroy();
  if (typeof globalThis.Cropper !== 'undefined') {
    cropperInstance = new globalThis.Cropper($('cropImage'), {
      viewMode: 1,
      aspectRatio: NaN,
      autoCropArea: 0.9,
      ready: triggerCropPreview,
      crop: () => {
        clearTimeout(cropTimeout);
        cropTimeout = setTimeout(triggerCropPreview, 50);
      }
    });
  } else {
    $('liveCropPreviewImg').src = imgSrc;
    currentCropBase64 = imgSrc;
  }
}

export function triggerCropPreview() {
  if (!cropperInstance) return;
  const canvas = cropperInstance.getCroppedCanvas({ fillColor: '#fff', maxWidth: 1200, maxHeight: 1200 });
  if (!canvas) return;
  const comp = parseInt($('compSlider').value, 10);
  $('compLabel').innerText = comp;
  const filter = $('filterSelect').value;
  const tc = document.createElement('canvas');
  tc.width = canvas.width;
  tc.height = canvas.height;
  const ctx = tc.getContext('2d');
  if (filter === 'grayscale') ctx.filter = 'grayscale(100%)';
  else if (filter === 'bw') ctx.filter = 'grayscale(100%) contrast(200%)';
  else if (filter === 'color-scan') ctx.filter = 'contrast(160%) brightness(110%) saturate(120%)';
  ctx.drawImage(canvas, 0, 0);

  let b64;
  try {
    b64 = tc.toDataURL('image/jpeg', comp / 100);
  } catch (_) {
    showToast('Cannot crop external image due to CORS — use "Keep Original" or re-upload locally.', 'warn');
    return;
  }
  currentCropBase64 = b64;
  $('estSize').innerText = Math.round((b64.length * 3) / 4 / 1024) + ' KB';
  $('liveCropPreviewImg').src = b64;
}

export function setCropRatio(ratio, btn) {
  if (cropperInstance) {
    cropperInstance.setAspectRatio(ratio);
    $$('.ratio-btn').forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  }
}

export function saveCroppedImage() {
  if (!currentCropBase64 || !currentImageData) return;
  const { sec, idx, isOption, optIdx } = currentImageData;
  const q = appState.questionsBySection[sec]?.[idx];
  if (!q) return;
  if (isOption) {
    const rawOpt = q.options[optIdx] || '';
    const optText = rawOpt.replace(/\|\|IMG:(.+?)\|\|/g, '');
    q.options[optIdx] = optText + `||IMG:${currentCropBase64}||`;
  } else {
    q.image = currentCropBase64;
  }
  currentCropBase64 = null;
  $('liveCropPreviewImg').src = '';
  $('cropImage').src = '';
  onRefreshQuestion(sec, idx);
  debouncedUpdateSingleQuestionPreview(sec, idx);
  closeModal('cropModal');
  onUpdateMissingAlerts();
}

export function saveOriginalImage() {
  if (!currentImageData || !currentImageData.rawData) return;
  const { sec, idx, isOption, optIdx, rawData } = currentImageData;
  const q = appState.questionsBySection[sec]?.[idx];
  if (!q) return;
  if (isOption) {
    const rawOpt = q.options[optIdx] || '';
    const optText = rawOpt.replace(/\|\|IMG:(.+?)\|\|/g, '');
    q.options[optIdx] = optText + `||IMG:${rawData}||`;
  } else {
    q.image = rawData;
  }
  currentCropBase64 = null;
  $('liveCropPreviewImg').src = '';
  $('cropImage').src = '';
  onRefreshQuestion(sec, idx);
  debouncedUpdateSingleQuestionPreview(sec, idx);
  closeModal('cropModal');
  onUpdateMissingAlerts();
  showToast('Original image applied (preserved vector/GIF quality)', 'success');
}

export function openTableModal(sec, idx, isEdit) {
  currentTableData = { sec, idx };
  if (isEdit) {
    const q = appState.questionsBySection[sec]?.[idx];
    try {
      const rawTable = q?.table || '';
      let tblContent = sanitizeHtmlFragment(rawTable).trim();
      if (!tblContent || !tblContent.startsWith('<table')) {
        tblContent = `<table class="editor-table"><tr><td contenteditable="true">${esc(tblContent)}</td></tr></table>`;
      }
      $('tblEditorContainer').innerHTML = tblContent;
      const tblEl = $('tblEditorContainer').querySelector('table');
      if (tblEl) tblEl.classList.add('editor-table');
      $('tblEditorContainer').querySelectorAll('th, td').forEach((cell) => cell.setAttribute('contenteditable', 'true'));
    } catch (_) {
      $('tblRows').value = 3; $('tblCols').value = 2; drawTableEditor();
    }
  } else {
    $('tblRows').value = 3; $('tblCols').value = 2; drawTableEditor();
  }
  openModal('tableModal');
}

export function drawTableEditor() {
  const r = Math.min(20, Math.max(1, parseInt($('tblRows').value, 10) || 3));
  const c = Math.min(12, Math.max(1, parseInt($('tblCols').value, 10) || 2));
  let html = '<table class="editor-table">';
  for (let i = 0; i < r; i++) {
    html += '<tr>';
    for (let j = 0; j < c; j++) {
      const type = i === 0 ? 'th' : 'td';
      html += `<${type} contenteditable="true"></${type}>`;
    }
    html += '</tr>';
  }
  $('tblEditorContainer').innerHTML = html + '</table>';
}

export function saveTableEditor() {
  if (!currentTableData) return;
  const clone = $('tblEditorContainer').cloneNode(true);
  clone.querySelectorAll('th, td').forEach((cell) => cell.removeAttribute('contenteditable'));
  const { sec, idx } = currentTableData;
  appState.questionsBySection[sec][idx].table = clone.innerHTML;
  onRefreshQuestion(sec, idx);
  debouncedUpdateSingleQuestionPreview(sec, idx);
  closeModal('tableModal');
}

export function removeTable(sec, idx) {
  appState.questionsBySection[sec][idx].table = '';
  onRefreshQuestion(sec, idx);
  debouncedUpdateSingleQuestionPreview(sec, idx);
}

export function initMediaListeners() {
  $('compSlider')?.addEventListener('input', triggerCropPreview);
  $('filterSelect')?.addEventListener('change', triggerCropPreview);
  $('btnRotate90')?.addEventListener('click', () => cropperInstance?.rotate(90));
  $('btnSaveCrop')?.addEventListener('click', saveCroppedImage);
  $('btnSaveOrig')?.addEventListener('click', saveOriginalImage);
  $$('.ratio-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      const raw = btn.dataset.ratio;
      const ratio = raw === 'NaN' ? NaN : evalRatio(raw);
      setCropRatio(ratio, btn);
    })
  );

  $('btnDrawTable')?.addEventListener('click', drawTableEditor);
  $('btnSaveTable')?.addEventListener('click', saveTableEditor);

  // Delegated click for lazy image wrappers in both editor and preview
  document.addEventListener('click', (e) => {
    const lazy = e.target.closest('.img-lazy-wrapper.img-lazy-btn');
    if (lazy) {
      e.stopPropagation();
      revealImg(lazy);
    }
  });
}

function evalRatio(str) {
  if (str === '1') return 1;
  if (str === '4/3') return 4 / 3;
  if (str === '16/9') return 16 / 9;
  return NaN;
}
