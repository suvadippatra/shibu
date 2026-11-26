import { $, $$, initTheme, toast, safeDownload } from '../shared/js/dom.js';

initTheme({ storageKey: 'qpm-theme' });

const state = {
  pdfFile: null,
  wmType: 'text', // 'text' | 'img' | 'svg'
  customImgFile: null,
  customImgUrl: null,
  defaultSvgRaw: null,
  defaultSvgValid: false,
  lastBlob: null,
  lastUrl: null,
};

function hexToRgbNorm(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const num = parseInt(full, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function getControls() {
  return {
    x: Number($('ctrl-x')?.value ?? 50),
    y: Number($('ctrl-y')?.value ?? 50),
    scale: Number($('ctrl-s')?.value ?? 1),
    rot: Number($('ctrl-r')?.value ?? -35),
    opacity: Number($('ctrl-o')?.value ?? 0.25),
    text: $('wm-text')?.value ?? 'CONFIDENTIAL',
    textColor: $('wm-text-color')?.value ?? '#4f46e5',
    svgColor: $('wm-svg-color')?.value ?? '#4f46e5',
  };
}

function tintSvg(svgRaw, hexColor) {
  let out = svgRaw.replace(/currentColor/gi, hexColor);
  out = out.replace(/(fill|stroke)="(?!none|transparent)([^"]*)"/gi, `$1="${hexColor}"`);
  if (!/fill=/i.test(out)) {
    out = out.replace('<svg', `<svg fill="${hexColor}"`);
  }
  return out;
}

async function svgTextToPngBytes(svgText, targetWidth = 900) {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const ratio = img.naturalHeight && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = Math.max(64, Math.round(targetWidth * ratio));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToPngBytes(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function normalizeImageToPngBytes(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return await canvasToPngBytes(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Render non-ASCII / Bengali text via HarfBuzz browser canvas so Indic conjuncts and
 * vowel signs shape accurately before embedding as a transparent PNG in PDF-lib.
 */
async function renderUnicodeTextPngBytes(text, hexColor) {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  const fontSize = 112;
  const fontSpec = `700 ${fontSize}px 'Tiro Bangla', 'Kalpurush', 'Plus Jakarta Sans', sans-serif`;
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = fontSpec;
  const metrics = mctx.measureText(text);
  const padX = 28;
  const padY = 26;
  const w = Math.max(64, Math.ceil(metrics.width + padX * 2));
  const h = Math.max(64, Math.ceil(fontSize * 1.45 + padY * 2));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.font = fontSpec;
  ctx.fillStyle = hexColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);

  const bytes = await canvasToPngBytes(canvas);
  return { bytes, ptWidth: w / 3.2, ptHeight: h / 3.2 };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to decode'));
    img.src = url;
  });
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Canvas export failed'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

function updateSimPreview() {
  const c = getControls();
  if ($('val-x')) $('val-x').textContent = `${c.x}%`;
  if ($('val-y')) $('val-y').textContent = `${c.y}%`;
  if ($('val-s')) $('val-s').textContent = `${c.scale.toFixed(1)}x`;
  if ($('val-r')) $('val-r').textContent = `${c.rot}°`;
  if ($('val-o')) $('val-o').textContent = `${Math.round(c.opacity * 100)}%`;

  const container = $('sim-wm-container');
  const txtEl = $('sim-wm-text');
  const imgEl = $('sim-wm-img');
  if (!container) return;

  container.style.left = `${c.x}%`;
  container.style.top = `${c.y}%`;
  container.style.opacity = String(c.opacity);
  container.style.transform = `translate(-50%, -50%) rotate(${c.rot}deg) scale(${c.scale})`;

  if (state.wmType === 'text') {
    if (txtEl) {
      txtEl.style.display = 'block';
      txtEl.textContent = c.text || ' ';
      txtEl.style.color = c.textColor;
    }
    if (imgEl) imgEl.style.display = 'none';
  } else if (state.wmType === 'img') {
    if (txtEl) txtEl.style.display = 'none';
    if (imgEl) {
      if (state.customImgUrl) {
        imgEl.src = state.customImgUrl;
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    }
  } else if (state.wmType === 'svg') {
    if (txtEl) txtEl.style.display = 'none';
    if (imgEl) {
      if (state.defaultSvgRaw && state.defaultSvgValid) {
        const tinted = tintSvg(state.defaultSvgRaw, c.svgColor);
        imgEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tinted);
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    }
  }
}

async function initDefaultSvg() {
  try {
    const res = await fetch('watermark.svg');
    if (!res.ok) return;
    const raw = await res.text();
    state.defaultSvgRaw = raw;
    state.defaultSvgValid = /<svg[\s>]/i.test(raw);
    if (!state.defaultSvgValid) {
      toast('Default watermark.svg is invalid; SVG preset skipped.', 'warn', 4000);
    }
    updateSimPreview();
  } catch (_) {
    // Offline/missing watermark.svg still leaves Text and Image tabs working cleanly.
  }
}

function setSelectedPdf(file) {
  if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
    toast('Please select a valid PDF file.', 'warn');
    return;
  }
  state.pdfFile = file;
  if ($('file-name')) $('file-name').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if ($('file-icon')) $('file-icon').textContent = '✅';
}

function switchTab(type) {
  state.wmType = type;
  $$('.type-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  ['text', 'img', 'svg'].forEach((t) => {
    $(`sec-${t}`)?.classList.toggle('hidden', t !== type);
  });
  updateSimPreview();
}

async function applyWatermark() {
  if (!state.pdfFile) {
    toast('Select a target PDF file first.', 'warn');
    return;
  }
  if (!globalThis.PDFLib) {
    toast('PDF-Lib library is not loaded.', 'error');
    return;
  }
  const btn = $('apply-btn');
  if (btn) btn.disabled = true;

  try {
    const c = getControls();
    const { PDFDocument, rgb, degrees, StandardFonts } = globalThis.PDFLib;
    const pdfBytes = await state.pdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const rotDeg = degrees(-c.rot);
    const rad = (-c.rot * Math.PI) / 180;

    if (state.wmType === 'text') {
      const txt = c.text || '';
      if (!txt.trim()) {
        toast('Enter watermark text first.', 'warn');
        return;
      }
      const hasUnicode = /[^\x00-\xFF]/.test(txt);
      if (hasUnicode) {
        const rendered = await renderUnicodeTextPngBytes(txt, c.textColor);
        const embedded = await pdfDoc.embedPng(rendered.bytes);
        const drawW = rendered.ptWidth * c.scale;
        const drawH = rendered.ptHeight * c.scale;
        const dx = (drawW / 2) * Math.cos(rad) - (drawH / 2) * Math.sin(rad);
        const dy = (drawW / 2) * Math.sin(rad) + (drawH / 2) * Math.cos(rad);
        for (const page of pages) {
          const { width, height } = page.getSize();
          const cx = (c.x / 100) * width;
          const cy = (1 - c.y / 100) * height;
          page.drawImage(embedded, {
            x: cx - dx,
            y: cy - dy,
            width: drawW,
            height: drawH,
            opacity: c.opacity,
            rotate: rotDeg,
          });
        }
      } else {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const { r, g, b } = hexToRgbNorm(c.textColor);
        const fontSize = Math.max(8, 36 * c.scale);
        const tw = font.widthOfTextAtSize(txt, fontSize);
        const th = font.heightAtSize(fontSize);
        const dx = (tw / 2) * Math.cos(rad) - (th / 2) * Math.sin(rad);
        const dy = (tw / 2) * Math.sin(rad) + (th / 2) * Math.cos(rad);
        for (const page of pages) {
          const { width, height } = page.getSize();
          const cx = (c.x / 100) * width;
          const cy = (1 - c.y / 100) * height;
          page.drawText(txt, {
            x: cx - dx,
            y: cy - dy,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity: c.opacity,
            rotate: rotDeg,
          });
        }
      }
    } else if (state.wmType === 'img') {
      if (!state.customImgFile) {
        toast('Choose a logo/image file first.', 'warn');
        return;
      }
      let embedded;
      if (state.customImgFile.type === 'image/png') {
        embedded = await pdfDoc.embedPng(await state.customImgFile.arrayBuffer());
      } else if (state.customImgFile.type === 'image/jpeg') {
        embedded = await pdfDoc.embedJpg(await state.customImgFile.arrayBuffer());
      } else {
        const pngBytes = await normalizeImageToPngBytes(state.customImgFile);
        embedded = await pdfDoc.embedPng(pngBytes);
      }
      const dims = embedded.scaleToFit(220 * c.scale, 220 * c.scale);
      const dx = (dims.width / 2) * Math.cos(rad) - (dims.height / 2) * Math.sin(rad);
      const dy = (dims.width / 2) * Math.sin(rad) + (dims.height / 2) * Math.cos(rad);
      for (const page of pages) {
        const { width, height } = page.getSize();
        const cx = (c.x / 100) * width;
        const cy = (1 - c.y / 100) * height;
        page.drawImage(embedded, {
          x: cx - dx,
          y: cy - dy,
          width: dims.width,
          height: dims.height,
          opacity: c.opacity,
          rotate: rotDeg,
        });
      }
    } else if (state.wmType === 'svg') {
      if (!state.defaultSvgRaw || !state.defaultSvgValid) {
        toast('Valid default watermark.svg is not available.', 'warn');
        return;
      }
      const tinted = tintSvg(state.defaultSvgRaw, c.svgColor);
      const pngBytes = await svgTextToPngBytes(tinted, 900);
      const embedded = await pdfDoc.embedPng(pngBytes);
      const dims = embedded.scaleToFit(220 * c.scale, 220 * c.scale);
      const dx = (dims.width / 2) * Math.cos(rad) - (dims.height / 2) * Math.sin(rad);
      const dy = (dims.width / 2) * Math.sin(rad) + (dims.height / 2) * Math.cos(rad);
      for (const page of pages) {
        const { width, height } = page.getSize();
        const cx = (c.x / 100) * width;
        const cy = (1 - c.y / 100) * height;
        page.drawImage(embedded, {
          x: cx - dx,
          y: cy - dy,
          width: dims.width,
          height: dims.height,
          opacity: c.opacity,
          rotate: rotDeg,
        });
      }
    }

    const outBytes = await pdfDoc.save();
    state.lastBlob = new Blob([outBytes], { type: 'application/pdf' });
    if (state.lastUrl) URL.revokeObjectURL(state.lastUrl);
    state.lastUrl = URL.createObjectURL(state.lastBlob);

    if ($('pdf-preview')) $('pdf-preview').src = state.lastUrl;
    $('preview-section')?.classList.remove('hidden');
    $('preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast('Watermark applied to all PDF pages!', 'success');
  } catch (err) {
    console.error(err);
    toast(`Failed to apply watermark: ${err.message || err}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initDefaultSvg();
  updateSimPreview();

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
      if (e.dataTransfer?.files?.[0]) setSelectedPdf(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files?.[0]) setSelectedPdf(e.target.files[0]);
    });
  }

  $$('.type-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.type));
  });

  ['ctrl-x', 'ctrl-y', 'ctrl-s', 'ctrl-r', 'ctrl-o', 'wm-text', 'wm-text-color', 'wm-svg-color'].forEach((id) => {
    $(id)?.addEventListener('input', updateSimPreview);
  });

  $('wm-img-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (state.customImgUrl) URL.revokeObjectURL(state.customImgUrl);
    state.customImgFile = f;
    state.customImgUrl = URL.createObjectURL(f);
    updateSimPreview();
  });

  $('apply-btn')?.addEventListener('click', applyWatermark);

  $('open-browser-btn')?.addEventListener('click', () => {
    if (state.lastUrl) window.open(state.lastUrl, '_blank', 'noopener');
  });

  $('download-btn')?.addEventListener('click', () => {
    if (!state.lastBlob) return;
    const base = state.pdfFile?.name?.replace(/\.pdf$/i, '') || 'document';
    safeDownload(state.lastBlob, `${base}_watermarked.pdf`);
  });
});
