/* Shared DOM, theme, toast, hashing, clipboard, download, and touch Quick-Bar helpers */

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => root.querySelectorAll(sel);
export const uid = () => Math.random().toString(36).slice(2, 9);

export function esc(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setTheme(t, { darkIconId = 'theme-icon-dark', lightIconId = 'theme-icon-light', storageKey = 'qpm-theme' } = {}) {
  document.documentElement.dataset.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(storageKey, t); } catch (_) {}
  const dIcon = $(darkIconId);
  const lIcon = $(lightIconId);
  if (dIcon) dIcon.style.display = t === 'dark' ? '' : 'none';
  if (lIcon) lIcon.style.display = t === 'light' ? '' : 'none';
}

export function initTheme(opts = {}) {
  const storageKey = opts.storageKey || 'qpm-theme';
  let saved = opts.defaultTheme || 'dark';
  try { saved = localStorage.getItem(storageKey) || saved; } catch (_) {}
  setTheme(saved, opts);
  const btn = $(opts.btnId || 'theme-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || document.documentElement.getAttribute('data-theme') || 'dark';
      setTheme(cur === 'dark' ? 'light' : 'dark', opts);
    });
  }
}

export function toast(msg, type = 'info', dur = 3200, containerId = 'toasts', action = null) {
  const ic = { success: '✓', warn: '⚠', error: '✕', info: 'ℹ' };
  const cl = { success: 'ok', warn: 'warn', error: 'err' };
  const w = $(containerId);
  if (!w) return;
  const t = document.createElement('div');
  t.className = `toast ${cl[type] || ''}`;
  const iconSpan = document.createElement('span');
  iconSpan.textContent = ic[type] || 'ℹ';
  const msgSpan = document.createElement('span');
  msgSpan.textContent = String(msg);
  t.append(iconSpan, msgSpan);
  if (action && action.label && typeof action.fn === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.textContent = action.label;
    actionBtn.style.cssText = 'margin-left:10px;background:none;border:1px solid currentColor;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;color:inherit;';
    actionBtn.addEventListener('click', () => { action.fn(); t.remove(); });
    t.append(actionBtn);
  }
  w.appendChild(t);
  const removeToast = () => {
    t.style.transition = 'opacity 0.3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  };
  setTimeout(removeToast, dur);
}

export function safeDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fallback below
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  ta.remove();
  return ok;
}

/* Pure-JS SHA-256 fallback so LAN HTTP (non-secure context) works without crypto.subtle */
function sha256Fallback(ascii) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash[7] = hash[6]; hash[6] = hash[5]; hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2]; hash[2] = hash[1]; hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return sha256Fallback(bin);
}

export function initDrawer({ openBtnId = 'info-btn', drawerId = 'info', closeBtnId = 'info-close', overlayId = 'ov' } = {}) {
  const openBtn = $(openBtnId);
  const drawer = $(drawerId);
  const closeBtn = $(closeBtnId);
  const ov = $(overlayId);
  const close = () => {
    drawer?.classList.remove('show');
    ov?.classList.remove('show');
  };
  openBtn?.addEventListener('click', () => {
    drawer?.classList.add('show');
    ov?.classList.add('show');
  });
  closeBtn?.addEventListener('click', close);
  ov?.addEventListener('click', close);
  return close;
}

export function attachMathQuickBar(barEl, rootEl, presets, targetSelector, onOpenBuilder = null) {
  if (!barEl || !rootEl) return;
  let activeInput = null;
  let hideTimer = null;

  const insertIntoInput = (target, text, cursorBack = 0) => {
    if (!target) return;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const val = target.value;
    let inserted = text;
    let nextPos;
    if (start < end && cursorBack > 0 && cursorBack <= text.length) {
      const splitAt = text.length - cursorBack;
      inserted = text.slice(0, splitAt) + val.slice(start, end) + text.slice(splitAt);
      nextPos = start + inserted.length;
    } else {
      nextPos = start + text.length - cursorBack;
    }
    target.value = val.slice(0, start) + inserted + val.slice(end);
    target.setSelectionRange(nextPos, nextPos);
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };

  barEl.innerHTML = '';
  presets.forEach((item) => {
    const { label, snippet = '', cursorBack = 0, title, action } = item;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mq-btn';
    btn.textContent = label;
    if (title) btn.title = title;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // Prevent stealing focus from active input
      if (!activeInput) return;
      clearTimeout(hideTimer);
      if (action === 'builder' && typeof onOpenBuilder === 'function') {
        const target = activeInput;
        onOpenBuilder(target, (token) => insertIntoInput(target, token, 0));
        return;
      }
      insertIntoInput(activeInput, snippet, cursorBack);
    });
    barEl.appendChild(btn);
  });

  rootEl.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches(targetSelector)) {
      clearTimeout(hideTimer);
      activeInput = e.target;
      barEl.classList.add('visible');
    }
  });

  rootEl.addEventListener('focusout', (e) => {
    if (e.target && e.target.matches(targetSelector)) {
      hideTimer = setTimeout(() => {
        if (!document.activeElement || !document.activeElement.matches(targetSelector)) {
          barEl.classList.remove('visible');
        }
      }, 180);
    }
  });
}
