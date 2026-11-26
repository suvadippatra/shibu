// PDF Merge Utility
import { $, $$, esc, initTheme, toast, safeDownload } from '../shared/js/dom.js';

initTheme({ storageKey: 'qpm-theme' });

const state = {
  pdfFiles: [],
  mergedBlob: null,
  mergedUrl: null,
};

function setPdfFiles(files) {
  const valid = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!valid.length) {
    toast('Please choose valid PDF files.', 'warn');
    return;
  }
  state.pdfFiles.push(...valid);
  renderList();
}

function reorderFiles(fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= state.pdfFiles.length) return;
  const moved = state.pdfFiles.splice(fromIdx, 1)[0];
  state.pdfFiles.splice(toIdx, 0, moved);
  renderList();
}

function removeFile(idx) {
  state.pdfFiles.splice(idx, 1);
  renderList();
}

function renderList() {
  const list = $('merge-list');
  list.innerHTML = '';
  state.pdfFiles.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'merge-item';
    item.innerHTML = `
      <div class="merge-idx">${i + 1}</div>
      <div class="merge-info">
        <div class="merge-name" title="${esc(f.name)}">${esc(f.name)}</div>
        <div class="merge-meta">${(f.size / 1024).toFixed(1)} KB</div>
      </div>
      <div class="merge-actions">
        <button class="btn btn-ghost btn-xs" data-action="up" data-index="${i}">↑</button>
        <button class="btn btn-ghost btn-xs" data-action="down" data-index="${i}">↓</button>
        <button class="btn btn-danger btn-xs" data-action="remove" data-index="${i}">✕</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function mergePdfs() {
  if (!globalThis.PDFLib) {
    toast('PDF-Lib not loaded', 'error');
    return;
  }
  if (state.pdfFiles.length < 2) {
    toast('Please add at least 2 PDF files to merge.', 'warn');
    return;
  }
  const btn = $('merge-btn');
  btn.disabled = true;
  try {
    const { PDFDocument } = globalThis.PDFLib;
    const mergedDoc = await PDFDocument.create();
    for (const file of state.pdfFiles) {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      const copied = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copied.forEach(page => mergedDoc.addPage(page));
    }
    const mergedBytes = await mergedDoc.save();
    state.mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });
    if (state.mergedUrl) URL.revokeObjectURL(state.mergedUrl);
    state.mergedUrl = URL.createObjectURL(state.mergedBlob);
    $('pdf-preview').src = state.mergedUrl;
    $('preview-section').classList.remove('hidden');
    toast('PDFs merged successfully', 'success');
  } catch (e) {
    console.error(e);
    toast('Merge failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function downloadMerged() {
  if (!state.mergedBlob) return;
  safeDownload(state.mergedBlob, 'merged.pdf');
}

document.addEventListener('DOMContentLoaded', () => {
  const drop = $('drop-zone');
  const input = $('file-input');
  if (drop && input) {
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer?.files?.length) setPdfFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', e => {
      if (e.target.files?.length) setPdfFiles(e.target.files);
      e.target.value = '';
    });
  }

  $('merge-btn')?.addEventListener('click', mergePdfs);
  $('download-btn')?.addEventListener('click', downloadMerged);

  $('merge-list')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    const act = btn.dataset.action;
    if (act === 'up') reorderFiles(idx, idx - 1);
    else if (act === 'down') reorderFiles(idx, idx + 1);
    else if (act === 'remove') removeFile(idx);
  });
});
