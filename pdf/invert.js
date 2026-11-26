import { $, initTheme, toast } from '../shared/js/dom.js';

initTheme({ storageKey: 'qpm-theme' });

let selectedFile = null;
let previewUrl = null;
let isInverted = true;

function handleFile(file) {
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
    toast('Please choose a valid PDF file.', 'warn');
    return;
  }
  selectedFile = file;
  if ($('file-name')) $('file-name').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if ($('file-icon')) $('file-icon').textContent = '🌙';
}

function updateToggleUi() {
  const frame = $('pdf-preview');
  const toggleBtn = $('toggle-invert');
  if (frame) frame.classList.toggle('inverted-pdf', isInverted);
  if (toggleBtn) {
    toggleBtn.textContent = isInverted ? 'Switch to Normal Colors' : 'Switch to Dark Invert';
  }
}

function openInvertedPreview() {
  if (!selectedFile) {
    toast('Please select a PDF file first.', 'warn');
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(selectedFile);
  isInverted = true;
  if ($('pdf-preview')) $('pdf-preview').src = previewUrl;
  $('preview-section')?.classList.remove('hidden');
  updateToggleUi();
  $('preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  toast('Dark night-reading filter enabled.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });
  }

  $('invert-btn')?.addEventListener('click', openInvertedPreview);

  $('toggle-invert')?.addEventListener('click', () => {
    isInverted = !isInverted;
    updateToggleUi();
  });

  $('open-browser-btn')?.addEventListener('click', () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener');
  });
});
