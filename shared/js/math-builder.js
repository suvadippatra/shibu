/* No-LaTeX Visual Math Builder + Simple Shorthand Modal (#fx-builder-modal) */

import {
  shorthandToLatex,
  chemToLatex,
  renderChemFormula,
  formatMathToHTMLFallback,
  escHtml
} from './math-pipeline.js';

const MODAL_ID = 'fx-builder-modal';

const TEMPLATE_DEFS = [
  { id: 'frac', label: 'Fraction', icon: 'a/b' },
  { id: 'pow', label: 'Power / Sub', icon: 'xⁿ' },
  { id: 'root', label: 'Root', icon: 'ⁿ√x' },
  { id: 'matrix', label: '2×2 Matrix / Det', icon: '[a b]' },
  { id: 'intsum', label: 'Integral / Sum', icon: '∫ / ∑' },
  { id: 'chem', label: 'Chemistry', icon: 'H₂O' }
];

const SHORTHAND_CHIPS = [
  { label: 'a/b', text: '(a)/(b)' },
  { label: '√', text: 'sqrt()' },
  { label: '∛', text: 'cbrt()' },
  { label: 'xⁿ', text: '^' },
  { label: '≠', text: ' != ' },
  { label: '≤', text: ' <= ' },
  { label: '≥', text: ' >= ' },
  { label: '±', text: ' +- ' },
  { label: '→', text: ' -> ' },
  { label: '⇌', text: ' <-> ' },
  { label: '×', text: ' * ' },
  { label: '°', text: 'deg' },
  { label: 'π', text: 'pi' },
  { label: 'θ', text: 'theta' },
  { label: 'α', text: 'alpha' }
];

const CHEM_CHIPS = [
  { label: '→', text: ' -> ' },
  { label: '⇌', text: ' <-> ' },
  { label: '²⁻', text: '^2-' },
  { label: '⁺', text: '^+' },
  { label: '₂', text: '2' },
  { label: 'H₂O', text: 'H2O' }
];

let modalState = {
  mode: 'qp',
  onInsert: null,
  activeTab: 'templates',
  activeTemplate: 'frac',
  fields: {
    fracNum: '',
    fracDen: '',
    powBase: 'x',
    powSup: '2',
    powSub: '',
    rootIdx: '',
    rootVal: '',
    matEnv: 'pmatrix',
    matA: 'a',
    matB: 'b',
    matC: 'c',
    matD: 'd',
    intOp: 'int',
    intLow: '0',
    intHigh: '1',
    intExpr: 'x dx',
    chemFormula: ''
  },
  simpleText: ''
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeField(labelText, key, placeholder, onUpdate) {
  const wrap = el('label', 'fx-field');
  const lbl = el('span', 'fx-field-lbl', labelText);
  const input = el('input', 'fx-input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = modalState.fields[key] || '';
  input.addEventListener('input', () => {
    modalState.fields[key] = input.value;
    onUpdate();
  });
  wrap.append(lbl, input);
  return { wrap, input };
}

function buildTemplateLatex() {
  const f = modalState.fields;
  const conv = (v, fallback = '') => {
    const t = (v || '').trim();
    return t ? shorthandToLatex(t) : fallback;
  };
  switch (modalState.activeTemplate) {
    case 'frac':
      return `\\frac{${conv(f.fracNum, 'a')}}{${conv(f.fracDen, 'b')}}`;
    case 'pow': {
      const base = conv(f.powBase, 'x');
      const sup = conv(f.powSup);
      const sub = conv(f.powSub);
      let out = base;
      if (sub) out += `_{${sub}}`;
      if (sup) out += `^{${sup}}`;
      return out;
    }
    case 'root': {
      const idx = (f.rootIdx || '').trim();
      const val = conv(f.rootVal, 'x');
      return idx && idx !== '2' ? `\\sqrt[${conv(idx)}]{${val}}` : `\\sqrt{${val}}`;
    }
    case 'matrix': {
      const env = f.matEnv || 'pmatrix';
      return `\\begin{${env}} ${conv(f.matA, 'a')} & ${conv(f.matB, 'b')} \\\\ ${conv(f.matC, 'c')} & ${conv(f.matD, 'd')} \\end{${env}}`;
    }
    case 'intsum': {
      const op = f.intOp || 'int';
      const low = conv(f.intLow);
      const high = conv(f.intHigh);
      const expr = conv(f.intExpr, 'f(x)\\,dx');
      const lims = (low ? `_{${low}}` : '') + (high ? `^{${high}}` : '');
      return `\\${op}${lims} ${expr}`;
    }
    case 'chem':
      return (f.chemFormula || '').trim();
    default:
      return '';
  }
}

function computeCurrentOutput() {
  const isChem = modalState.activeTab === 'templates' && modalState.activeTemplate === 'chem';
  if (isChem) {
    const rawChem = (modalState.fields.chemFormula || '').trim();
    return {
      isChem: true,
      raw: rawChem,
      latex: rawChem ? chemToLatex(rawChem).replace(/^\$|\$$/g, '') : '',
      token: rawChem
        ? (modalState.mode === 'cbt' ? chemToLatex(rawChem) : `[CHEM:${rawChem}]`)
        : ''
    };
  }

  const latex = modalState.activeTab === 'simple'
    ? shorthandToLatex(modalState.simpleText)
    : buildTemplateLatex();

  const token = latex
    ? (modalState.mode === 'cbt' ? `$${latex}$` : `[EQ:${latex}]`)
    : '';

  return { isChem: false, raw: latex, latex, token };
}

function renderPreview(previewEl, latexOutEl) {
  const { isChem, raw, latex } = computeCurrentOutput();
  if (!raw && !latex) {
    previewEl.textContent = 'Preview will appear here…';
    previewEl.classList.add('is-empty');
    if (latexOutEl) latexOutEl.textContent = '';
    return;
  }
  previewEl.classList.remove('is-empty');

  if (isChem) {
    if (globalThis.katex && typeof globalThis.katex.renderToString === 'function') {
      try {
        previewEl.innerHTML = globalThis.katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false
        });
      } catch (_) {
        previewEl.innerHTML = renderChemFormula(raw);
      }
    } else {
      previewEl.innerHTML = renderChemFormula(raw);
    }
    if (latexOutEl) latexOutEl.textContent = modalState.mode === 'cbt' ? chemToLatex(raw) : `[CHEM:${raw}]`;
    return;
  }

  if (globalThis.katex && typeof globalThis.katex.renderToString === 'function') {
    try {
      const readable = latex.replace(/\\frac(?![a-zA-Z])/g, '\\dfrac');
      previewEl.innerHTML = globalThis.katex.renderToString(readable, {
        throwOnError: false,
        displayMode: false
      });
    } catch (_) {
      previewEl.textContent = latex;
    }
  } else {
    previewEl.innerHTML = formatMathToHTMLFallback(escHtml(latex), false);
  }
  if (latexOutEl) latexOutEl.textContent = latex;
}

function insertAtCursor(fieldEl, text) {
  const start = fieldEl.selectionStart ?? fieldEl.value.length;
  const end = fieldEl.selectionEnd ?? fieldEl.value.length;
  const val = fieldEl.value;
  fieldEl.value = val.slice(0, start) + text + val.slice(end);
  const pos = text.endsWith('()') ? start + text.length - 1 : start + text.length;
  fieldEl.setSelectionRange(pos, pos);
  fieldEl.focus();
  fieldEl.dispatchEvent(new Event('input', { bubbles: true }));
}

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  modal = el('div');
  modal.id = MODAL_ID;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-hidden', 'true');

  const panel = el('div', 'fx-panel');

  // Header
  const hdr = el('div', 'fx-hdr');
  const titleWrap = el('div', 'fx-title-wrap');
  const title = el('strong', 'fx-title', 'Visual Math Builder');
  const modeBadge = el('span', 'fx-mode-badge', 'QP');
  titleWrap.append(title, modeBadge);
  const closeBtn = el('button', 'icon-btn fx-close', '✕');
  closeBtn.type = 'button';
  closeBtn.title = 'Close';
  hdr.append(titleWrap, closeBtn);

  // Live Preview
  const previewWrap = el('div', 'fx-preview-wrap');
  const previewBox = el('div', 'fx-preview is-empty', 'Preview will appear here…');
  const latexOut = el('div', 'fx-latex-out');
  previewWrap.append(previewBox, latexOut);

  // Tabs
  const tabsBar = el('div', 'fx-tabs');
  const tabTemplates = el('button', 'fx-tab active', 'Templates');
  tabTemplates.type = 'button';
  tabTemplates.dataset.tab = 'templates';
  const tabSimple = el('button', 'fx-tab', 'Simple Math');
  tabSimple.type = 'button';
  tabSimple.dataset.tab = 'simple';
  tabsBar.append(tabTemplates, tabSimple);

  // Body container
  const body = el('div', 'fx-body');
  const templatesPane = el('div', 'fx-pane');
  const simplePane = el('div', 'fx-pane hidden');

  const tplPills = el('div', 'fx-tpl-pills');
  const tplForm = el('div', 'fx-grid');
  templatesPane.append(tplPills, tplForm);

  // Simple Math pane
  const simpleHint = el(
    'div',
    'fx-hint',
    'Type plain math like (x+1)/(x-1) + sqrt(x) != 0, cbrt(27), x^2026, 30deg, alpha, ->'
  );
  const simpleTa = el('textarea', 'fx-textarea');
  simpleTa.rows = 3;
  simpleTa.placeholder = 'e.g. (x+1)/2 + sqrt(x) != 0';
  const simpleChips = el('div', 'fx-chips');
  SHORTHAND_CHIPS.forEach(({ label, text }) => {
    const chip = el('button', 'fx-chip', label);
    chip.type = 'button';
    chip.addEventListener('click', () => insertAtCursor(simpleTa, text));
    simpleChips.appendChild(chip);
  });
  simplePane.append(simpleHint, simpleTa, simpleChips);
  body.append(templatesPane, simplePane);

  // Footer
  const footer = el('div', 'fx-footer');
  const cancelBtn = el('button', 'btn btn-ghost btn-sm', 'Cancel');
  cancelBtn.type = 'button';
  const insertBtn = el('button', 'btn btn-primary btn-sm', 'Insert');
  insertBtn.type = 'button';
  footer.append(cancelBtn, insertBtn);

  panel.append(hdr, previewWrap, tabsBar, body, footer);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  const updatePreview = () => renderPreview(previewBox, latexOut);

  const renderTemplateForm = () => {
    tplForm.innerHTML = '';
    const tpl = modalState.activeTemplate;
    let firstInput = null;

    if (tpl === 'frac') {
      const a = makeField('Numerator', 'fracNum', 'e.g. x + 1', updatePreview);
      const b = makeField('Denominator', 'fracDen', 'e.g. x - 1', updatePreview);
      tplForm.append(a.wrap, b.wrap);
      firstInput = a.input;
    } else if (tpl === 'pow') {
      const base = makeField('Base', 'powBase', 'e.g. x', updatePreview);
      const sup = makeField('Power (Superscript)', 'powSup', 'e.g. 2 or n+1', updatePreview);
      const sub = makeField('Subscript (Optional)', 'powSub', 'e.g. i', updatePreview);
      tplForm.append(base.wrap, sup.wrap, sub.wrap);
      firstInput = base.input;
    } else if (tpl === 'root') {
      const idx = makeField('Root Index (blank = √)', 'rootIdx', 'e.g. 3', updatePreview);
      const val = makeField('Inside Root', 'rootVal', 'e.g. x + 1', updatePreview);
      tplForm.append(idx.wrap, val.wrap);
      firstInput = val.input;
    } else if (tpl === 'matrix') {
      const envWrap = el('label', 'fx-field fx-field-full');
      envWrap.appendChild(el('span', 'fx-field-lbl', 'Bracket Style'));
      const sel = el('select', 'fx-input');
      [
        { val: 'pmatrix', txt: '( ) Parentheses Matrix' },
        { val: 'bmatrix', txt: '[ ] Square Matrix' },
        { val: 'vmatrix', txt: '| | Determinant' }
      ].forEach(({ val, txt }) => {
        const opt = el('option', '', txt);
        opt.value = val;
        if (modalState.fields.matEnv === val) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        modalState.fields.matEnv = sel.value;
        updatePreview();
      });
      envWrap.appendChild(sel);
      const a = makeField('Top-Left (a)', 'matA', 'a', updatePreview);
      const b = makeField('Top-Right (b)', 'matB', 'b', updatePreview);
      const c = makeField('Bottom-Left (c)', 'matC', 'c', updatePreview);
      const d = makeField('Bottom-Right (d)', 'matD', 'd', updatePreview);
      tplForm.append(envWrap, a.wrap, b.wrap, c.wrap, d.wrap);
      firstInput = a.input;
    } else if (tpl === 'intsum') {
      const opWrap = el('label', 'fx-field');
      opWrap.appendChild(el('span', 'fx-field-lbl', 'Operator'));
      const sel = el('select', 'fx-input');
      [
        { val: 'int', txt: '∫ Integral' },
        { val: 'sum', txt: '∑ Summation' },
        { val: 'prod', txt: '∏ Product' }
      ].forEach(({ val, txt }) => {
        const opt = el('option', '', txt);
        opt.value = val;
        if (modalState.fields.intOp === val) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        modalState.fields.intOp = sel.value;
        updatePreview();
      });
      opWrap.appendChild(sel);
      const low = makeField('Lower Limit', 'intLow', 'e.g. 0 or i=1', updatePreview);
      const high = makeField('Upper Limit', 'intHigh', 'e.g. 1 or n', updatePreview);
      const expr = makeField('Expression', 'intExpr', 'e.g. x^2 dx', updatePreview);
      tplForm.append(opWrap, low.wrap, high.wrap, expr.wrap);
      firstInput = expr.input;
    } else if (tpl === 'chem') {
      const chem = makeField('Chemical Formula / Reaction', 'chemFormula', 'e.g. 2H2 + O2 -> 2H2O or Ca(OH)2', updatePreview);
      chem.wrap.classList.add('fx-field-full');
      const chips = el('div', 'fx-chips fx-field-full');
      CHEM_CHIPS.forEach(({ label, text }) => {
        const chip = el('button', 'fx-chip', label);
        chip.type = 'button';
        chip.addEventListener('click', () => insertAtCursor(chem.input, text));
        chips.appendChild(chip);
      });
      tplForm.append(chem.wrap, chips);
      firstInput = chem.input;
    }

    updatePreview();
    return firstInput;
  };

  // Template category pills
  TEMPLATE_DEFS.forEach(({ id, label, icon }) => {
    const pill = el('button', 'fx-tpl-pill');
    pill.type = 'button';
    pill.dataset.tpl = id;
    const ic = el('span', 'fx-tpl-ic', icon);
    const tx = el('span', '', label);
    pill.append(ic, tx);
    pill.addEventListener('click', () => {
      modalState.activeTemplate = id;
      tplPills.querySelectorAll('.fx-tpl-pill').forEach((p) => {
        p.classList.toggle('active', p.dataset.tpl === id);
      });
      const firstInput = renderTemplateForm();
      firstInput?.focus();
    });
    tplPills.appendChild(pill);
  });

  const switchTab = (tabName) => {
    modalState.activeTab = tabName;
    tabTemplates.classList.toggle('active', tabName === 'templates');
    tabSimple.classList.toggle('active', tabName === 'simple');
    templatesPane.classList.toggle('hidden', tabName !== 'templates');
    simplePane.classList.toggle('hidden', tabName !== 'simple');
    updatePreview();
    if (tabName === 'simple') simpleTa.focus();
  };

  tabTemplates.addEventListener('click', () => switchTab('templates'));
  tabSimple.addEventListener('click', () => switchTab('simple'));

  simpleTa.addEventListener('input', () => {
    modalState.simpleText = simpleTa.value;
    updatePreview();
  });

  const closeModal = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  insertBtn.addEventListener('click', () => {
    const { token } = computeCurrentOutput();
    if (token && typeof modalState.onInsert === 'function') {
      modalState.onInsert(token);
    }
    closeModal();
  });

  modal._syncAndShow = ({ mode, initialText, onInsert }) => {
    modalState.mode = mode === 'cbt' ? 'cbt' : 'qp';
    modalState.onInsert = typeof onInsert === 'function' ? onInsert : null;
    modeBadge.textContent = modalState.mode === 'cbt' ? 'CBT ($…$)' : 'QP ([EQ:…])';

    if (initialText) {
      modalState.simpleText = String(initialText);
      simpleTa.value = modalState.simpleText;
      switchTab('simple');
    } else {
      modalState.simpleText = '';
      simpleTa.value = '';
      tplPills.querySelectorAll('.fx-tpl-pill').forEach((p) => {
        p.classList.toggle('active', p.dataset.tpl === modalState.activeTemplate);
      });
      renderTemplateForm();
      switchTab('templates');
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    if (modalState.activeTab === 'simple') {
      simpleTa.focus();
    } else {
      tplForm.querySelector('input, select')?.focus();
    }
  };

  return modal;
}

/**
 * Opens the reusable No-LaTeX Visual Math Builder modal (#fx-builder-modal).
 */
export function openMathBuilderModal({ mode = 'qp', initialText = '', onInsert } = {}) {
  const modal = ensureModal();
  modal._syncAndShow({ mode, initialText, onInsert });
}
