/* QP Maker State, Constants, Bengali Scientific Validator, and Fit Checker */
import { $, $$ } from '../shared/js/dom.js';
import { findUnmatchedMathTokens } from '../shared/js/math-pipeline.js';

export const DEFAULT_WM_HASH = 'd89c34cb1d5083183db108522761b3bec45ac9cb159da982121ee4b4e934297c';

export const BN_L = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
export const EN_L = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const BN_O = ['ক', 'খ', 'গ', 'ঘ'];
export const EN_O = ['a', 'b', 'c', 'd'];

export const HDGS_BN = [
  'সঠিক উত্তরটি নির্বাচন করো:',
  'সংক্ষিপ্ত উত্তর দাও:',
  'নীচের প্রশ্নগুলির উত্তর দাও:',
  'দীর্ঘ উত্তরধর্মী প্রশ্ন:'
];
export const HDGS_EN = [
  'Choose the correct answer:',
  'Give short answers:',
  'Answer the following questions:',
  'Long answer questions:'
];

export const TYPES = [
  { v: 'mcq', l: 'MCQ' },
  { v: 'short', l: 'Short Answer' },
  { v: 'descriptive', l: 'Descriptive' },
  { v: 'long', l: 'Long Answer' }
];

export const S = {
  topTitle: 'Test no. 1',
  klass: '',
  subject: '',
  time: 30,
  inst: '',
  fullMarks: 0,
  paperLang: 'full-bn',
  fontSize: 11,
  lineHeight: 1.45,
  margin: 1.0,
  divider: 'dotted',
  wmSrc: 'none',
  wmData: null,
  wmOpacity: 7,
  wmSize: 65,
  sections: [],
  zoom: 0.55,
  viewMode: 'double',
  autoFit: null,
  autoFitDirty: false,
  wmCustomData: null,
  orient: { mono: 'portrait', double: 'landscape', quad: 'landscape', flow: 'landscape' },
  orientOverride: 'auto',
  ansSpace: false,
  eiCollapsed: false
};

export const linkMode = { active: false, secId: null, sel: [] };

export const bn = (n) => {
  const num = Number(n);
  const clean = Number.isFinite(num) ? String(Number(num.toFixed(2))) : '0';
  return clean
    .split('')
    .map((c) => (S.paperLang === 'full-bn' && c >= '0' && c <= '9' ? ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][+c] : c))
    .join('');
};

export const sl = (i) => (S.paperLang === 'full-en' ? EN_L[i] || String(i + 1) : BN_L[i] || String(i + 1));

export function getPtrLbl(type, i) {
  if (type === 'A') return String.fromCharCode(65 + i);
  if (type === 'a') return String.fromCharCode(97 + i);
  if (type === 'i') return ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][i] || i + 1;
  if (type === 'bn') return BN_L[i] || i + 1;
  return String(i + 1);
}

export function getHdgs() {
  return S.paperLang === 'full-en' ? HDGS_EN : HDGS_BN;
}

export function getDefaultHeading(type, mpq = 1, lang = S.paperLang) {
  const hdgs = lang === 'full-en' ? HDGS_EN : HDGS_BN;
  if (type === 'mcq') return hdgs[0];
  if (type === 'long') return hdgs[3];
  if (type === 'descriptive') return hdgs[2];
  return Number(mpq) >= 2 ? hdgs[2] : hdgs[1];
}

export function stripLeadingQNum(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/^\s*(?:Q\.?\s*)?(?:\d+|[০-৯]+)(?:\.(?:\d+|[০-৯]+))?\s*[\.\)]\s*/i, '');
}

export function getActiveOrient() {
  return S.orientOverride === 'auto' ? S.orient[S.viewMode] || 'landscape' : S.orientOverride;
}

export function applyVars() {
  const af = S.autoFit;
  document.documentElement.style.setProperty('--p-fsize', (af ? af.fontSize : S.fontSize) + 'pt');
  document.documentElement.style.setProperty('--p-lh', af ? af.lineHeight : S.lineHeight);
  document.documentElement.style.setProperty('--p-margin', (af ? af.margin : S.margin) + 'cm');
}

export function exFname(ext) {
  const t = (S.topTitle || 'QuestionPaper').replace(/[/\\?%*:|"<>]/g, '').trim();
  const now = new Date();
  const hm = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0');
  return `${t} — ${hm}.${ext}`;
}

export function validateScientificExpression(text) {
  if (!text) return { valid: true };
  const warnings = [];
  if (/<§(?:_NUM|_TBL)?>/.test(String(text))) {
    warnings.push('⚠️ Illegible OCR/note token (<§>) detected — verify and replace with actual text.');
  }
  const bracketIssues = findUnmatchedMathTokens(text);
  if (bracketIssues.length) {
    warnings.push(`⚠️ ${bracketIssues.join('; ')}`);
  }
  const bengaliScientificPattern =
    /(বর্গ\s*(?:সেমি|মিটার|সেকেন্ড|একক)|ঘন\s*(?:সেমি|মিটার)|প্রতি\s*সেকেন্ড|আলফা|বিটা|গামা|ডেলটা|থিটা|ল্যাম্বডা|পাই|সিগমা|ওমেগা)/gi;
  if (bengaliScientificPattern.test(text)) {
    warnings.push(
      '⚠️ Bengali scientific/Greek words detected. Prefer LaTeX tokens: [EQ:s^2], [EQ:\\text{cm}^2], [EQ:\\alpha, \\theta, \\pi]'
    );
  }
  if (warnings.length) {
    return { valid: false, message: warnings.join('\n') };
  }
  return { valid: true };
}

export function renderFraction(numerator, denominator) {
  return `[EQ:\\frac{${numerator}}{${denominator}}]`;
}

export function recalc() {
  let statsStr = '';
  let totalQ = 0;

  S.fullMarks = S.sections.reduce((t, s, idx) => {
    let actualCount = 0;
    for (let i = 0; i < s.questions.length; i++) {
      actualCount++;
      if (s.questions[i].isOrNext) i++;
    }
    if (s.answerAny && s.answerAny >= actualCount) s.answerAny = null;
    if (actualCount > 0) {
      statsStr += `[${sl(idx)}: ${bn(actualCount)}] `;
      totalQ += actualCount;
    }
    const countedQ = s.answerAny && s.answerAny < actualCount ? s.answerAny : actualCount;
    return t + (s.mpq || 0) * countedQ;
  }, 0);

  const el = $('f-fm');
  if (el) el.value = S.fullMarks;

  const statEl = $('topbar-stats');
  if (statEl) {
    const fmLabel = S.paperLang === 'full-en' ? 'Marks' : 'নম্বর';
    const qLabel = S.paperLang === 'full-en' ? 'Total Q' : 'মোট প্রশ্ন';
    statEl.textContent = `${statsStr} | ${qLabel}: ${bn(totalQ)} | ${fmLabel}: ${bn(S.fullMarks)}`;
  }

  S.autoFitDirty = true;
  showAutoFitBtn();
}

export function showAutoFitBtn() {
  const btn = $('autofit-btn');
  if (!btn) return;
  if (S.autoFitDirty && S.sections.length > 0) btn.style.display = 'flex';
  if (S.autoFit) {
    btn.classList.add('active');
    btn.title = `Auto-fit Active (${S.autoFit.fontSize}pt · LH${S.autoFit.lineHeight.toFixed(2)} · ${S.autoFit.margin.toFixed(1)}cm)`;
  } else {
    btn.classList.remove('active');
    btn.title = 'Auto-fit content to page';
  }
}

export function clearAutoFit() {
  if (S.autoFit) {
    S.autoFit = null;
    showAutoFitBtn();
  }
}

export function checkFit(pageCount) {
  const badge = $('fit-badge');
  if (!badge) return;
  badge.className = '';
  if (!S.sections.length || pageCount <= 0) {
    badge.classList.add('ok');
    badge.textContent = '✓ Ready';
    return;
  }
  if (S.viewMode === 'flow') {
    if (pageCount === 1 || pageCount % 4 === 0) {
      badge.classList.add('ok');
      badge.textContent = `✓ ${pageCount}p Booklet`;
    } else {
      badge.classList.add('warn');
      badge.textContent = `⚠ ${pageCount}p (pads to ${Math.ceil(pageCount / 4) * 4}p)`;
    }
  } else if (pageCount === 1) {
    badge.classList.add('ok');
    badge.textContent = '✓ Fits 1 page';
  } else if (pageCount === 2) {
    badge.classList.add('warn');
    badge.textContent = '⚠ 2 pages';
  } else {
    badge.classList.add('over');
    badge.textContent = `⚠ ${pageCount} pages`;
  }
}

export function syncFields() {
  const set = (id, v) => {
    const e = $(id);
    if (e) e.value = v !== undefined && v !== null ? v : '';
  };
  set('f-tt', S.topTitle);
  set('f-cls', S.klass);
  set('f-subj', S.subject);
  set('f-time', S.time);
  set('f-inst', S.inst);

  const eiBdy = $('ei-body');
  const eiHdr = $('ei-hdr');
  if (eiBdy && eiHdr) {
    eiBdy.classList.toggle('hide', S.eiCollapsed);
    eiHdr.classList.toggle('open', !S.eiCollapsed);
  }

  if ($('s-fs')) { $('s-fs').value = S.fontSize; $('s-fs-v').textContent = S.fontSize + ' pt'; }
  if ($('s-lh')) { $('s-lh').value = S.lineHeight; $('s-lh-v').textContent = S.lineHeight.toFixed(2); }
  if ($('s-mg')) { $('s-mg').value = S.margin * 10; $('s-mg-v').textContent = S.margin.toFixed(1) + ' cm'; }
  $$('.dopt').forEach((o) => {
    if (o.parentElement.id === 's-orient') o.classList.toggle('on', o.dataset.v === S.orientOverride);
    else o.classList.toggle('on', o.dataset.d === S.divider);
  });
  $$('#s-plang .pill').forEach((p) => p.classList.toggle('on', p.dataset.v === S.paperLang));
  $$('#pv-mode .pill').forEach((p) => p.classList.toggle('on', p.dataset.m === S.viewMode));
  if ($('subj-warn')) $('subj-warn').style.display = S.subject.length > 26 ? 'inline' : 'none';
  if ($('ans-space-btn')) {
    $('ans-space-btn').classList.toggle('active', S.ansSpace);
    $('ans-space-btn').textContent = S.ansSpace ? 'Ans Space: ON' : 'Ans Space: OFF';
  }
}
