import { $, initTheme, toast, safeDownload } from '../shared/js/dom.js';

initTheme({ storageKey: 'qpm-theme' });

let targetPdf = null;
let outBlob = null;
let outUrl = null;

function hexToRgbNorm(hex) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function getMaskBox() {
  return {
    xPct: Number($('ctrl-x')?.value ?? 10),
    yPct: Number($('ctrl-y')?.value ?? 90),
    wPct: Number($('ctrl-w')?.value ?? 80),
    hPct: Number($('ctrl-h')?.value ?? 8),
    color: $('ctrl-color')?.value ?? '#ffffff',
  };
}

function updateSimMask() {
  const b = getMaskBox();
  if ($('val-x')) $('val-x').textContent = `${b.xPct}%`;
  if ($('val-y')) $('val-y').textContent = `${b.yPct}%`;
  if ($('val-w')) $('val-w').textContent = `${b.wPct}%`;
  if ($('val-h')) $('val-h').textContent = `${b.hPct}%`;

  const mask = $('sim-mask');
  if (!mask) return;
  mask.style.left = `${b.xPct}%`;
  mask.style.top = `${b.yPct}%`;
  mask.style.width = `${b.wPct}%`;
  mask.style.height = `${b.hPct}%`;
  mask.style.backgroundColor = b.color;
}

function setFile(file) {
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
    toast('Please choose a valid PDF file.', 'warn');
    return;
  }
  targetPdf = file;
  if ($('file-name')) $('file-name').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if ($('file-icon')) $('file-icon').textContent = '✅';
}

async function applyMask() {
  if (!targetPdf) {
    toast('Select a target PDF first.', 'warn');
    return;
  }
  if (!globalThis.PDFLib) {
    toast('PDF-Lib library is missing.', 'error');
    return;
  }
  const btn = $('apply-btn');
  if (btn) btn.disabled = true;

  try {
    const b = getMaskBox();
    const { PDFDocument, rgb } = globalThis.PDFLib;
    const { r, g, b: blue } = hexToRgbNorm(b.color);
    const doc = await PDFDocument.load(await targetPdf.arrayBuffer());
    const pages = doc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const boxW = (b.wPct / 100) * width;
      const boxH = (b.hPct / 100) * height;
      const boxX = (b.xPct / 100) * width;
      // PDF y-axis grows upward from bottom-left; top slider is percentage from top edge
      const boxY = height - (b.yPct / 100) * height - boxH;
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        color: rgb(r, g, blue),
      });
    }

    const bytes = await doc.save();
    outBlob = new Blob([bytes], { type: 'application/pdf' });
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = URL.createObjectURL(outBlob);

    if ($('pdf-preview')) $('pdf-preview').src = outUrl;
    $('preview-section')?.classList.remove('hidden');
    $('preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`Applied mask box to ${pages.length} page${pages.length === 1 ? '' : 's'}.`, 'success');
  } catch (err) {
    console.error(err);
    toast(`Redaction failed: ${err.message || err}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateSimMask();

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
      if (e.dataTransfer?.files?.[0]) setFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) setFile(e.target.files[0]);
    });
  }

  ['ctrl-x', 'ctrl-y', 'ctrl-w', 'ctrl-h', 'ctrl-color'].forEach((id) => {
    $(id)?.addEventListener('input', updateSimMask);
  });

  $('apply-btn')?.addEventListener('click', applyMask);

  $('open-browser-btn')?.addEventListener('click', () => {
    if (outUrl) window.open(outUrl, '_blank', 'noopener');
  });

  $('download-btn')?.addEventListener('click', () => {
    if (!outBlob) return;
    const base = targetPdf?.name?.replace(/\.pdf$/i, '') || 'document';
    safeDownload(outBlob, `${base}_masked.pdf`);
  });
});
