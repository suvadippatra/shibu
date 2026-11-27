/* Site-wide preferences, custom font loader (IndexedDB), Manim-style animation helpers, and page transitions */

const PREFS_KEY = 'shibu_site_prefs';
const FONT_DB_NAME = 'shibu_fonts_db';
const FONT_STORE = 'fonts';

export function getSitePrefs() {
  const defaults = { animations: true, hasCustomFonts: false };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch (_) {
    return defaults;
  }
}

export function saveSitePrefs(patch) {
  const next = { ...getSitePrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch (_) {}
  applyAnimPref(next.animations);
  return next;
}

export function animationsEnabled() {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.anim === 'off') return false;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function applyAnimPref(enabled) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.anim = enabled ? 'on' : 'off';
}

/* IndexedDB helpers for custom uploaded fonts */
function openFontDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(FONT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FONT_STORE)) db.createObjectStore(FONT_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomFont(slot, name, arrayBuffer) {
  const db = await openFontDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(FONT_STORE, 'readwrite');
    tx.objectStore(FONT_STORE).put({ name, buffer: arrayBuffer }, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  saveSitePrefs({ hasCustomFonts: true });
  await applyCustomFonts();
}

export async function getCustomFontMeta(slot) {
  try {
    const db = await openFontDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(FONT_STORE, 'readonly');
      const req = tx.objectStore(FONT_STORE).get(slot);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

export async function clearCustomFont(slot) {
  try {
    const db = await openFontDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FONT_STORE, 'readwrite');
      tx.objectStore(FONT_STORE).delete(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {}
  const root = document.documentElement;
  if (slot === 'bn') root.style.removeProperty('--font-bn');
  if (slot === 'tt') root.style.removeProperty('--font-tt');
  if (slot === 'ui') root.style.removeProperty('--font-ui');
}

export async function applyCustomFonts() {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const slots = [
    { slot: 'bn', family: 'ShibuCustomBN', cssVar: '--font-bn', fallback: "'Tiro Bangla', 'Times New Roman', serif" },
    { slot: 'tt', family: 'ShibuCustomTT', cssVar: '--font-tt', fallback: "'DM Serif Text', Georgia, serif" },
    { slot: 'ui', family: 'ShibuCustomUI', cssVar: '--font-ui', fallback: "'Plus Jakarta Sans', system-ui, sans-serif" }
  ];
  for (const cfg of slots) {
    const rec = await getCustomFontMeta(cfg.slot);
    if (rec && rec.buffer) {
      try {
        const face = new FontFace(cfg.family, rec.buffer);
        const loaded = await face.load();
        document.fonts.add(loaded);
        document.documentElement.style.setProperty(cfg.cssVar, `'${cfg.family}', ${cfg.fallback}`);
      } catch (_) {}
    }
  }
}

export async function clearExtraCaches() {
  let deletedCount = 0;
  if ('caches' in window) {
    const keys = await caches.keys();
    for (const k of keys) {
      if (await caches.delete(k)) deletedCount++;
    }
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.update();
    }
  } catch (_) {}
  return deletedCount;
}

/* Manim-like Staggered Whole-Page Reveal (for QPF/CBT Paste & Apply) */
export function triggerPasteStageAnimation(container) {
  if (!container || !animationsEnabled()) return;
  const items = container.querySelectorAll('.qp-title, .qp-info, .qp-sec-hdr, .qp-sec-row, .qp-q, .qp-itable, .preview-card, [id^="preview-qbox-"]');
  items.forEach((el, idx) => {
    el.style.setProperty('--manim-i', String(Math.min(idx, 14)));
  });
  container.classList.remove('manim-paste-stage');
  void container.offsetWidth;
  container.classList.add('manim-paste-stage');
  setTimeout(() => container.classList.remove('manim-paste-stage'), 750);
}

/* Lightweight Manim-like Live Typing Reveal (animates only the newly added tail/node — zero frame drop) */
export function animateLiveReveal(containerEl, prevLen = 0, nextLen = 0) {
  if (!containerEl || !animationsEnabled()) return;
  if (nextLen > prevLen && nextLen - prevLen <= 4) {
    // Find last non-empty text node inside containerEl (skipping hidden katex-mathml)
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest('.katex-mathml')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let lastText = null;
    while (walker.nextNode()) lastText = walker.currentNode;
    if (lastText && lastText.nodeValue.length > 0) {
      const val = lastText.nodeValue;
      const tailLen = Math.min(nextLen - prevLen, val.length, 2);
      const head = val.slice(0, val.length - tailLen);
      const tail = val.slice(val.length - tailLen);
      const span = document.createElement('span');
      span.className = 'manim-char-in';
      span.textContent = tail;
      const parent = lastText.parentNode;
      if (parent) {
        lastText.nodeValue = head;
        parent.insertBefore(span, lastText.nextSibling);
        return;
      }
    }
  }
  // Fallback for math expressions, tables, or bulk edits: animate container subtly
  containerEl.classList.remove('manim-pop-in');
  void containerEl.offsetWidth;
  containerEl.classList.add('manim-pop-in');
}

/* Page Open & Close Transition Wiring */
export function initSiteRuntime() {
  const prefs = getSitePrefs();
  applyAnimPref(prefs.animations);
  if (prefs.hasCustomFonts) applyCustomFonts();

  if (typeof document === 'undefined') return;
  const body = document.body;
  if (body && animationsEnabled()) {
    body.classList.add('anim-page-enter');
  }

  // Handle browser back/forward cache restore
  window.addEventListener('pageshow', () => {
    if (document.body) document.body.classList.remove('anim-page-exit');
  });

  // Smooth exit animation for internal page navigation
  document.addEventListener('click', (e) => {
    if (!animationsEnabled()) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || a.target === '_blank' || a.hasAttribute('download')) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      document.body.classList.remove('anim-page-enter');
      document.body.classList.add('anim-page-exit');
      setTimeout(() => { window.location.href = url.href; }, 135);
    } catch (_) {}
  });
}
