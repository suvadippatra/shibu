/* Shared Math, Bengali Scientific Formatting, Tokenization, and Cross-Format Conversion Pipeline */

export const SYM = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ',
  mu: 'μ', pi: 'π', sigma: 'σ', omega: 'Ω', ohm: 'Ω', degree: '°', infinity: '∞',
  arrow: '→', darrow: '⇌', times: '×', div: '÷', approx: '≈', pm: '±',
  neq: '≠', leq: '≤', geq: '≥', sqrt: '√', micro: 'μ', phi: 'φ', psi: 'ψ',
  xi: 'ξ', tau: 'τ', rho: 'ρ', eta: 'η', kappa: 'κ', nu: 'ν', zeta: 'ζ',
  triangle: '△', angle: '∠', perp: '⊥', parallel: '∥', therefore: '∴', because: '∵',
  cong: '≅', sim: '∼'
};

export function escHtml(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitizes preserved HTML fragments (e.g. AI-extracted <table>) against XSS while keeping layout tags intact.
 */
export function sanitizeHtmlFragment(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1=$2#$2');
}

/**
 * Checks for unmatched [EQ:]/[CHEM:]/[SUB:]/[SUP:]/[SYM:] brackets or $ delimiters.
 */
export function findUnmatchedMathTokens(str) {
  if (!str) return [];
  const issues = [];
  const s = String(str);
  const prefixes = ['[EQ:', '[CHEM:', '[SYM:', '[SUB:', '[SUP:'];
  let i = 0;
  let unmasked = '';
  while (i < s.length) {
    let matched = null;
    for (const p of prefixes) {
      if (s.slice(i, i + p.length).toUpperCase() === p) {
        matched = p;
        break;
      }
    }
    if (matched) {
      const start = i + matched.length;
      const closeIdx = findClosingBracket(s, start);
      if (closeIdx === -1) {
        issues.push(`Unclosed ${matched}...] bracket`);
        break;
      }
      i = closeIdx + 1;
      continue;
    }
    if (s[i] === '\\' && (s[i + 1] === '$' || s[i + 1] === '[' || s[i + 1] === ']')) {
      i += 2;
      continue;
    }
    unmasked += s[i];
    i++;
  }
  const withoutDisplay = unmasked.replace(/\$\$[\s\S]*?\$\$/g, '');
  if (withoutDisplay.includes('$$')) {
    issues.push('Unclosed $$ display math delimiter');
  }
  const singleDollars = (withoutDisplay.replace(/\$\$/g, '').match(/\$/g) || []).length;
  if (singleDollars % 2 !== 0) {
    issues.push('Unclosed $ inline math delimiter');
  }
  return issues;
}

/**
 * Finds the matching closing `]` starting right after an opening `[` at `contentStart - 1`.
 * Gracefully recovers on malformed/unclosed intervals (e.g. `[0, 1)`) by falling back to the
 * last `]` on the current line.
 */
export function findClosingBracket(str, contentStart) {
  let depth = 1;
  let lastSingleClose = -1;
  for (let i = contentStart; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
      lastSingleClose = i;
    } else if (ch === '\n' && lastSingleClose !== -1) {
      return lastSingleClose;
    }
  }
  return lastSingleClose;
}

/**
 * Formats chemical formulas while keeping leading stoichiometric coefficients normal-sized
 * and element symbols upright.
 * Examples: "2H2 + O2 -> 2H2O", "Ca(OH)2", "SO4^2-", "Fe^3+"
 */
export function renderChemFormula(raw) {
  let f = String(raw || '')
    .replace(/<->|<=>/g, '⇌')
    .replace(/->/g, '→');
  f = escHtml(f);
  f = f.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  f = f.replace(/\^(\d*[+-]|[+-])/g, '<sup>$1</sup>');
  f = f.replace(/([A-Za-z\)\]])(\d+)/g, '$1<sub>$2</sub>');
  return `<span class="chem-formula" style="font-style:normal;">${f}</span>`;
}

/**
 * Converts a [CHEM:...] formula into valid KaTeX/LaTeX string wrapped in $...$.
 * Handles Ca(OH)2, 2H2 + O2 -> 2H2O, SO4^2-, Fe^3+ without mismatched braces.
 */
export function chemToLatex(raw) {
  let f = String(raw || '').trim();
  if (!f) return '';
  f = f.replace(/<->|<=>/g, ' ##1## ').replace(/->/g, ' ##2## ');
  // Convert charges ^2-, ^{2-}, ^3+, ^+, ^-
  f = f.replace(/\^\{([^}]+)\}/g, '^{$1}');
  f = f.replace(/\^(\d*[+-]|[+-])/g, '^{$1}');
  // Convert subscripts following letters or closing brackets: H2 -> H_{2}, Ca(OH)2 -> Ca(OH)_{2}
  f = f.replace(/([A-Za-z\)\]])(\d+)/g, '$1_{$2}');
  // Wrap contiguous alphabetic/bracket chemical runs in \mathrm{...} while leaving operators/scripts bare
  f = f.replace(/[A-Za-z][A-Za-z\(\)]*/g, (m) => `\\mathrm{${m}}`);
  f = f.replace(/##1##/g, '\\rightleftharpoons').replace(/##2##/g, '\\rightarrow');
  return `$${f.replace(/\s+/g, ' ').trim()}$`;
}

/**
 * QP Maker token renderer:
 * 1. Extracts [EQ:...], [CHEM:...], [SYM:...], [SUB:...], [SUP:...] (and optional $...$) using balanced scanning BEFORE escHtml().
 * 2. Escapes surrounding prose and preserves line breaks.
 * 3. Renders KaTeX on raw, unescaped LaTeX so `&`, `<`, `>`, `\sqrt[3]{27}`, and `[0, 1]` never corrupt.
 */
export function renderTok(rawText, katexApi = globalThis.katex, options = {}) {
  if (!rawText && rawText !== 0) return '';
  const { preserveNewlines = true, allowDollar = true } = options;
  const str = String(rawText);
  const tokens = [];
  let masked = '';
  let i = 0;

  const prefixes = ['[EQ:', '[CHEM:', '[SYM:', '[SUB:', '[SUP:'];
  while (i < str.length) {
    let matchedPrefix = null;
    for (const p of prefixes) {
      if (str.slice(i, i + p.length).toUpperCase() === p) {
        matchedPrefix = p;
        break;
      }
    }

    if (matchedPrefix) {
      const contentStart = i + matchedPrefix.length;
      const closeIdx = findClosingBracket(str, contentStart);
      if (closeIdx !== -1) {
        const val = str.slice(contentStart, closeIdx);
        const type = matchedPrefix.slice(1, -1);
        const idx = tokens.length;
        tokens.push({ type, val });
        masked += `@@QP_TOK_${idx}@@`;
        i = closeIdx + 1;
        continue;
      }
    }

    if (allowDollar && str[i] === '\\' && str[i + 1] === '$') {
      masked += '@@ESC_DOLLAR@@';
      i += 2;
      continue;
    }

    if (allowDollar && str[i] === '$') {
      const isDisplay = str[i + 1] === '$';
      const delim = isDisplay ? '$$' : '$';
      const endIdx = str.indexOf(delim, i + delim.length);
      if (endIdx !== -1) {
        const val = str.slice(i + delim.length, endIdx);
        const idx = tokens.length;
        tokens.push({ type: 'EQ', val, display: isDisplay });
        masked += `@@QP_TOK_${idx}@@`;
        i = endIdx + delim.length;
        continue;
      }
    }

    masked += str[i];
    i++;
  }

  let out = escHtml(masked);
  out = out.replace(/@@ESC_DOLLAR@@/g, '$');
  if (preserveNewlines) {
    out = out.replace(/\r?\n/g, '<br>');
  }

  tokens.forEach((tok, idx) => {
    let replacement = '';
    if (tok.type === 'EQ') {
      const eq = tok.val.trim();
      if (katexApi && typeof katexApi.renderToString === 'function') {
        try {
          const readableEq = tok.display ? eq : eq.replace(/\\frac(?![a-zA-Z])/g, '\\dfrac');
          replacement = katexApi.renderToString(readableEq, {
            throwOnError: false,
            displayMode: !!tok.display
          });
        } catch (_) {
          replacement = `<i>${escHtml(eq)}</i>`;
        }
      } else {
        replacement = formatMathToHTMLFallback(eq, !!tok.display);
      }
    } else if (tok.type === 'CHEM') {
      replacement = renderChemFormula(tok.val);
    } else if (tok.type === 'SYM') {
      const key = tok.val.trim().toLowerCase();
      replacement = `<span>${SYM[key] || escHtml(tok.val)}</span>`;
    } else if (tok.type === 'SUB') {
      replacement = `<sub>${escHtml(tok.val)}</sub>`;
    } else if (tok.type === 'SUP') {
      replacement = `<sup>${escHtml(tok.val)}</sup>`;
    }
    out = out.replace(`@@QP_TOK_${idx}@@`, () => replacement);
  });

  return out;
}

/**
 * Pure HTML math fallback for CBT HTML_FALLBACK / HTML mode.
 * Handles Bengali digits/text upright, stacked fractions, matrices/cases, and nested braces.
 */
export function formatMathToHTMLFallback(str, isDisplay = false) {
  let s = String(str || '').trim();

  // Matrix & Cases environments before stripping backslashes
  s = s.replace(/\\begin\{(pmatrix|bmatrix|vmatrix|matrix|cases)\}([\s\S]*?)\\end\{\1\}/g, (_, env, body) => {
    const cls = env === 'vmatrix' ? 'fallback-matrix det' : (env === 'cases' ? 'fallback-matrix cases' : 'fallback-matrix');
    const rows = body.trim().split(/\\\\/).map((row) => {
      const cells = row.split('&').map((c) => `<td>${formatMathToHTMLFallback(c.trim(), false)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="${cls}">${rows}</table>`;
  });

  const greek = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\Delta': 'Δ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\Theta': 'Θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\Lambda': 'Λ',
    '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\Xi': 'Ξ', '\\pi': 'π', '\\Pi': 'Π',
    '\\rho': 'ρ', '\\sigma': 'σ', '\\Sigma': 'Σ', '\\tau': 'τ', '\\upsilon': 'υ',
    '\\phi': 'φ', '\\Phi': 'Φ', '\\chi': 'χ', '\\psi': 'ψ', '\\Psi': 'Ψ',
    '\\omega': 'ω', '\\Omega': 'Ω'
  };
  for (const g in greek) {
    s = s.replace(new RegExp(g.replace(/\\/g, '\\\\') + '\\b', 'g'), greek[g]);
  }

  s = s.replace(/\\rightleftharpoons/g, '⇌').replace(/\\leftrightarrow/g, '↔')
       .replace(/\\Rightarrow/g, '⇒').replace(/\\Leftarrow/g, '⇐')
       .replace(/\\rightarrow/g, '→').replace(/\\to\b/g, '→')
       .replace(/\\leftarrow/g, '←').replace(/\\gets\b/g, '←')
       .replace(/\\uparrow/g, '↑').replace(/\\downarrow/g, '↓');

  s = s.replace(/\\dagger/g, '†').replace(/\\ddagger/g, '‡')
       .replace(/\\times/g, '×').replace(/\\cdot/g, '·')
       .replace(/\\div/g, '÷').replace(/\\pm/g, '±').replace(/\\mp/g, '∓')
       .replace(/\\approx/g, '≈').replace(/\\neq/g, '≠').replace(/\\ne\b/g, '≠')
       .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥').replace(/\\le\b/g, '≤').replace(/\\ge\b/g, '≥')
       .replace(/\\lt\b/g, '<').replace(/\\gt\b/g, '>')
       .replace(/\\ll\b/g, '≪').replace(/\\gg\b/g, '≫')
       .replace(/\\equiv/g, '≡').replace(/\\propto/g, '∝')
       .replace(/\\infty/g, '∞').replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇')
       .replace(/\\degree/g, '°').replace(/\\circ/g, '°')
       .replace(/\\in\b/g, '∈').replace(/\\notin/g, '∉')
       .replace(/\\subset/g, '⊂').replace(/\\subseteq/g, '⊆')
       .replace(/\\cap/g, '∩').replace(/\\cup/g, '∪')
       .replace(/\\forall/g, '∀').replace(/\\exists/g, '∃')
       .replace(/\\hbar/g, 'ℏ')
       .replace(/\\triangle/g, '△').replace(/\\angle/g, '∠')
       .replace(/\\perp/g, '⊥').replace(/\\parallel/g, '∥')
       .replace(/\\therefore/g, '∴').replace(/\\because/g, '∵')
       .replace(/\\cong/g, '≅').replace(/\\sim/g, '∼')
       .replace(/\\int/g, '∫').replace(/\\sum/g, '∑').replace(/\\prod/g, '∏');

  s = s.replace(/\\text\{([^{}]+)\}/g, '<span style="font-style:normal;">$1</span>')
       .replace(/\\mathrm\{([^{}]+)\}/g, '<span style="font-style:normal;">$1</span>')
       .replace(/\\mathbf\{([^{}]+)\}/g, '<b>$1</b>')
       .replace(/\\mathit\{([^{}]+)\}/g, '<i>$1</i>')
       .replace(/\\overline\{([^{}]+)\}/g, '<span style="text-decoration:overline;">$1</span>')
       .replace(/\\underline\{([^{}]+)\}/g, '<u>$1</u>');

  s = s.replace(/\\vec\{([^{}]+)\}/g, '$1&#x20D7;').replace(/\\hat\{([^{}]+)\}/g, '$1&#x0302;')
       .replace(/\\bar\{([^{}]+)\}/g, '$1&#x0304;').replace(/\\dot\{([^{}]+)\}/g, '$1&#x0307;')
       .replace(/\\ddot\{([^{}]+)\}/g, '$1&#x0308;');

  s = s.replace(/\\(sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min)\b/g, '<span style="font-style:normal;">$1</span>');

  // Iterative innermost replacement for nested \frac, \binom, \sqrt, ^{...}, _{...}
  let prev = '';
  let guard = 0;
  while (prev !== s && guard < 12) {
    prev = s;
    guard++;
    s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="frac-stack"><span class="frac-num">$1</span><span class="frac-den">$2</span></span>');
    s = s.replace(/\\binom\{([^{}]+)\}\{([^{}]+)\}/g, '(<span class="frac-stack"><span class="frac-num" style="border:none;">$1</span><span class="frac-den">$2</span></span>)');
    s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '<sup>$1</sup>√(<span style="text-decoration:overline;">$2</span>)');
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√(<span style="text-decoration:overline;">$1</span>)');
    s = s.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    s = s.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
  }

  s = s.replace(/\\sqrt\b/g, '√');
  s = s.replace(/\^([0-9০-৯a-zA-Z+-])/g, '<sup>$1</sup>');
  s = s.replace(/_([0-9০-৯a-zA-Z+-])/g, '<sub>$1</sub>');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\[;,!]/g, ' ').replace(/\\quad/g, ' &nbsp; ').replace(/\\qquad/g, ' &nbsp;&nbsp; ')
       .replace(/\\([a-zA-Z]+)/g, '$1');

  // Keep Bengali Unicode characters upright (never italicize conjuncts)
  s = s.replace(/([\u0980-\u09FF]+)/g, '<span style="font-style:normal;">$1</span>');

  return isDisplay
    ? `<div style="text-align:center; margin: 6px 0; font-family: serif;">${s}</div>`
    : `<span style="font-family: serif;">${s}</span>`;
}

/**
 * Unified CBT content pipeline (Single Source of Truth for CBT Maker & Preview).
 */
export function formatContent(text, engine = 'MATHML', mathMode = 'LATEX', katexApi = globalThis.katex) {
  if (!text) return '';

  const mathBlocks = [];
  let maskedText = sanitizeHtmlFragment(String(text));

  // 1. Protect explicitly escaped dollars
  maskedText = maskedText.replace(/\\\$/g, '@@ESC_DOLLAR@@');

  // 2. Mask $$...$$ and $...$ before markdown/escaping
  maskedText = maskedText.replace(/\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g, (match, display, inline) => {
    mathBlocks.push({
      raw: match,
      content: display !== undefined ? display : inline,
      isDisplay: display !== undefined
    });
    return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
  });

  // 3. Smart HTML escaping: preserve intentional tags like <table>, <sub>, <sup>, <br>, <b>, <i>, <u>
  maskedText = maskedText
    .replace(/<(\s|[0-9=])/g, '&lt;$1')
    .replace(/(\s|[0-9=])>/g, '$1&gt;');

  // 4. Markdown emphasis
  maskedText = maskedText
    .replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([\s\S]*?)__/g, '<u>$1</u>')
    .replace(/\*([^\*]+?)\*/g, '<em>$1</em>');

  // 5. Restore escaped dollars safely so KATEX_ONLINE auto-render doesn't treat currency as math
  if (engine === 'KATEX_ONLINE' && mathMode === 'LATEX') {
    maskedText = maskedText.replace(/@@ESC_DOLLAR@@/g, '<span class="escaped-dollar">&#36;</span>');
  } else {
    maskedText = maskedText.replace(/@@ESC_DOLLAR@@/g, '$');
  }

  // 6. Render math blocks & unmask
  mathBlocks.forEach((block, i) => {
    let processedMath = '';
    const rawContent = block.content.trim();

    if (mathMode === 'LATEX') {
      if (engine === 'MATHML') {
        if (katexApi && typeof katexApi.renderToString === 'function') {
          try {
            processedMath = katexApi.renderToString(rawContent, {
              displayMode: block.isDisplay,
              output: 'mathml',
              throwOnError: false
            });
          } catch (_) {
            processedMath = '<span style="color:red; font-weight:bold;">[Math Error]</span>';
          }
        } else {
          processedMath = formatMathToHTMLFallback(rawContent, block.isDisplay);
        }
      } else if (engine === 'HTML_FALLBACK') {
        processedMath = formatMathToHTMLFallback(rawContent, block.isDisplay);
      } else {
        // KATEX_ONLINE or KATEX_LOCAL (handled by client-side auto-render)
        processedMath = block.raw;
      }
    } else {
      processedMath = formatMathToHTMLFallback(rawContent, block.isDisplay);
    }

    maskedText = maskedText.replace(`@@MATH_BLOCK_${i}@@`, () => processedMath);
  });

  return maskedText;
}

/**
 * Computes approximate visible text length for MCQ column sizing, ignoring LaTeX/HTML/MathML markup.
 */
export function stripMarkupLength(str) {
  if (!str) return 0;
  let s = String(str);
  s = s.replace(/<math[\s\S]*?<\/math>/gi, (m) => m.replace(/<[^>]+>/g, ''));
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\[(?:EQ|CHEM|SYM|SUB|SUP):/gi, '').replace(/\]/g, '');
  s = s.replace(/\\(?:frac|sqrt|left|right|text|mathrm|mathbf|begin|end|times|cdot|div|pm)\b/g, ' ');
  s = s.replace(/[{}$]/g, '');
  return s.replace(/\s+/g, ' ').trim().length;
}

/**
 * Cross-converts QP Maker tokens ([EQ:], [CHEM:], [SUB:], [SUP:], [SYM:]) -> CBT LaTeX ($...$).
 */
export function qpTextToCbt(text) {
  if (!text) return '';
  let out = String(text);
  let res = '';
  let i = 0;
  while (i < out.length) {
    const sliceUpper = out.slice(i, i + 6).toUpperCase();
    if (sliceUpper.startsWith('[EQ:')) {
      const closeIdx = findClosingBracket(out, i + 4);
      if (closeIdx !== -1) {
        res += `$${out.slice(i + 4, closeIdx)}$`;
        i = closeIdx + 1;
        continue;
      }
    } else if (sliceUpper.startsWith('[CHEM:')) {
      const closeIdx = findClosingBracket(out, i + 6);
      if (closeIdx !== -1) {
        res += chemToLatex(out.slice(i + 6, closeIdx));
        i = closeIdx + 1;
        continue;
      }
    }
    res += out[i];
    i++;
  }
  out = res;
  out = out.replace(/\[SYM:([a-z]+)\]/gi, (_, sym) => `$\\${sym.toLowerCase()}$`);
  out = out.replace(/\[SUB:([^\]]+)\]/gi, '<sub>$1</sub>');
  out = out.replace(/\[SUP:([^\]]+)\]/gi, '<sup>$1</sup>');
  return out;
}

/**
 * Cross-converts CBT LaTeX ($...$, $$...$$) -> QP Maker tokens ([EQ:...]).
 */
export function cbtTextToQp(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\\$/g, '@@ESC_D@@')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => `[EQ:${eq.trim()}]`)
    .replace(/\$([^$\n]+?)\$/g, (_, eq) => `[EQ:${eq.trim()}]`)
    .replace(/@@ESC_D@@/g, '$');
}

export function qpfStateToCbtString(S) {
  let out = `[EXAM_INFO]\n`;
  if (S.topTitle) out += `Title: ${S.topTitle}\n`;
  if (S.klass || S.subject) out += `Subtitle: ${[S.klass ? `Class ${S.klass}` : '', S.subject].filter(Boolean).join(' — ')}\n`;
  if (S.time) out += `Duration: ${S.time}\n`;
  out += `Timer: COUNTDOWN\nFont: 'Tiro Bangla', 'Kalpurush', serif\nMathMode: LATEX\n[FORMAT_WATERMARK: LATEX]\n`;
  if (S.inst) out += `Rules: ${S.inst.replace(/\r?\n/g, ' ')}\n`;

  (S.sections || []).forEach((sec, idx) => {
    const label = sec.heading ? `Section ${idx + 1}: ${sec.heading}` : `Section ${idx + 1}`;
    out += `\n[SECTION:${label}|Marks:${sec.mpq || 1}|Neg:0|MaxAtt:${sec.answerAny || 0}]\n`;
    (sec.questions || []).forEach((q) => {
      out += `QType: ${sec.type === 'mcq' ? 'MCQ' : 'NAT'}\n`;
      out += `Q: ${qpTextToCbt(q.text).replace(/\r?\n/g, '\\n')}\n`;
      if (sec.type === 'mcq') {
        (q.options || ['', '', '', '']).slice(0, 4).forEach((o) => {
          out += `O: ${qpTextToCbt(o).replace(/\r?\n/g, '\\n')}\n`;
        });
        out += `A: A\n`;
      } else {
        out += `A: \n`;
      }
      if (q.img) out += `I: ${q.img}\n`;
      (q.extra || []).forEach((ex) => {
        if (ex.type === 'table' && ex.rows) {
          const tbl = `<table>${ex.rows.map((r) => `<tr>${r.map((c) => `<td>${qpTextToCbt(c)}</td>`).join('')}</tr>`).join('')}</table>`;
          out += `T: ${tbl}\n`;
        } else if (ex.type === 'image' && ex.data && !q.img) {
          out += `I: ${ex.data}\n`;
        } else if (ex.type === 'diagram' && ex.png && !q.img) {
          out += `I: ${ex.png}\n`;
        }
      });
    });
  });
  return out;
}

const SHORTHAND_GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
  'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega'
];
const GREEK_WORD_RE = new RegExp(`(?<![a-zA-Z\\\\])(${SHORTHAND_GREEK.join('|')})(?![a-zA-Z])`, 'g');

function replaceBalancedCall(str, fnName, formatInner) {
  let out = '';
  let i = 0;
  const len = fnName.length;
  while (i < str.length) {
    const prev = i > 0 ? str[i - 1] : '';
    if (str.slice(i, i + len) === fnName && str[i + len] === '(' && !/[a-zA-Z\\]/.test(prev)) {
      let depth = 1;
      let j = i + len + 1;
      while (j < str.length && depth > 0) {
        if (str[j] === '(') depth++;
        else if (str[j] === ')') depth--;
        j++;
      }
      if (depth === 0) {
        const inner = replaceBalancedCall(str.slice(i + len + 1, j - 1), fnName, formatInner);
        out += formatInner(inner);
        i = j;
        continue;
      }
    }
    out += str[i];
    i++;
  }
  return out;
}

function replaceBalancedScript(str, op) {
  let out = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === op && str[i + 1] === '(') {
      let depth = 1;
      let j = i + 2;
      while (j < str.length && depth > 0) {
        if (str[j] === '(') depth++;
        else if (str[j] === ')') depth--;
        j++;
      }
      if (depth === 0) {
        out += `${op}{${str.slice(i + 2, j - 1)}}`;
        i = j;
        continue;
      }
    }
    out += str[i];
    i++;
  }
  return out;
}

function findMatchingOpen(str, closeIdx, openCh, closeCh) {
  let depth = 1;
  for (let i = closeIdx - 1; i >= 0; i--) {
    if (str[i] === closeCh) depth++;
    else if (str[i] === openCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingClose(str, openIdx, openCh, closeCh) {
  let depth = 1;
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === openCh) depth++;
    else if (str[i] === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function convertFractions(str) {
  let s = str;
  let guard = 0;
  while (guard++ < 32) {
    let slashIdx = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '/' && s[i - 1] !== '/' && s[i + 1] !== '/') {
        // Check that there is a valid atom on both sides
        let l = i - 1;
        while (l >= 0 && s[l] === ' ') l--;
        let r = i + 1;
        while (r < s.length && s[r] === ' ') r++;
        if (l >= 0 && r < s.length) {
          slashIdx = i;
          break;
        }
      }
    }
    if (slashIdx === -1) break;

    let lEnd = slashIdx - 1;
    while (lEnd >= 0 && s[lEnd] === ' ') lEnd--;
    let lStart = lEnd;
    let numText = '';
    if (s[lEnd] === ')') {
      const openIdx = findMatchingOpen(s, lEnd, '(', ')');
      if (openIdx === -1) break;
      lStart = openIdx;
      numText = s.slice(openIdx + 1, lEnd);
    } else if (s[lEnd] === '}') {
      let cur = findMatchingOpen(s, lEnd, '{', '}');
      if (cur === -1) break;
      if (cur > 0 && s[cur - 1] === ']') {
        const optOpen = findMatchingOpen(s, cur - 1, '[', ']');
        if (optOpen !== -1) cur = optOpen;
      }
      if (cur > 0 && (s[cur - 1] === '^' || s[cur - 1] === '_')) cur--;
      while (cur > 0 && /[a-zA-Z0-9\u09E6-\u09EF._@\\]/.test(s[cur - 1])) cur--;
      lStart = cur;
      numText = cur === findMatchingOpen(s, lEnd, '{', '}') ? s.slice(cur + 1, lEnd) : s.slice(cur, lEnd + 1);
    } else {
      while (lStart >= 0 && /[a-zA-Z0-9\u09E6-\u09EF._^@\\]/.test(s[lStart])) lStart--;
      lStart++;
      numText = s.slice(lStart, lEnd + 1);
    }

    let rStart = slashIdx + 1;
    while (rStart < s.length && s[rStart] === ' ') rStart++;
    let rEnd = rStart;
    let denText = '';
    if (s[rStart] === '(') {
      const closeIdx = findMatchingClose(s, rStart, '(', ')');
      if (closeIdx === -1) break;
      rEnd = closeIdx + 1;
      denText = s.slice(rStart + 1, closeIdx);
    } else if (s[rStart] === '{') {
      const closeIdx = findMatchingClose(s, rStart, '{', '}');
      if (closeIdx === -1) break;
      rEnd = closeIdx + 1;
      denText = s.slice(rStart + 1, closeIdx);
    } else {
      while (rEnd < s.length) {
        if (/[a-zA-Z0-9\u09E6-\u09EF._@^\\]/.test(s[rEnd])) {
          rEnd++;
        } else if (s[rEnd] === '[' && rEnd > rStart) {
          const closeIdx = findMatchingClose(s, rEnd, '[', ']');
          if (closeIdx === -1) break;
          rEnd = closeIdx + 1;
        } else if (s[rEnd] === '{' && rEnd > rStart) {
          const closeIdx = findMatchingClose(s, rEnd, '{', '}');
          if (closeIdx === -1) break;
          rEnd = closeIdx + 1;
        } else {
          break;
        }
      }
      denText = s.slice(rStart, rEnd);
    }

    if (!numText || !denText) break;
    s = s.slice(0, lStart) + `\\frac{${numText}}{${denText}}` + s.slice(rEnd);
  }
  return s;
}

/**
 * Converts beginner math shorthand (e.g. (x+1)/(x-1), sqrt(x+1), cbrt(27), x^2026, !=, <=, >=, +-, ->, <->, *, deg, alpha)
 * into clean LaTeX while leaving existing LaTeX commands (\frac, \begin{...}, etc.) untouched.
 */
export function shorthandToLatex(expr) {
  if (!expr && expr !== 0) return '';
  let s = String(expr);
  if (!s.trim()) return '';

  // 1. Mask existing LaTeX commands so they are never altered
  const masked = [];
  s = s.replace(/\\(?:[a-zA-Z]+|[^a-zA-Z\s])/g, (m) => {
    const idx = masked.length;
    masked.push(m);
    return `@@LTX_${idx}@@`;
  });

  // 2. Convert cbrt(...) and sqrt(...) with balanced parentheses
  s = replaceBalancedCall(s, 'cbrt', (inner) => `\\sqrt[3]{${inner}}`);
  s = replaceBalancedCall(s, 'sqrt', (inner) => `\\sqrt{${inner}}`);

  // 3. Convert exponents/subscripts: x^(n+1), x^2026, x^-1, a_10
  s = replaceBalancedScript(s, '^');
  s = replaceBalancedScript(s, '_');
  s = s.replace(/\^(-?[0-9\u09E6-\u09EF]+|[a-zA-Z]{2,})/g, (m, exp) => {
    if (exp.length === 1 && !exp.startsWith('-')) return m;
    return `^{${exp}}`;
  });
  s = s.replace(/_([0-9\u09E6-\u09EF]{2,}|[a-zA-Z]{2,})/g, '_{$1}');

  // 4. Convert fractions a/b and (x+1)/(x-1)
  s = convertFractions(s);

  // 5. Convert relational/arrow/arithmetic shorthand
  s = s.replace(/<->/g, '\\rightleftharpoons')
       .replace(/->/g, '\\rightarrow')
       .replace(/<-/g, '\\leftarrow')
       .replace(/!=/g, '\\neq')
       .replace(/<=/g, '\\leq')
       .replace(/>=/g, '\\geq')
       .replace(/\+-/g, '\\pm')
       .replace(/-\+/g, '\\mp')
       .replace(/\*/g, '\\times')
       .replace(/\s*(?<![a-zA-Z\\])deg(?![a-zA-Z])/g, '^\\circ')
       .replace(/(?<![a-zA-Z\\])(infinity|infty)(?![a-zA-Z])/g, '\\infty');

  // 6. Convert common Greek words
  s = s.replace(GREEK_WORD_RE, '\\$1');

  // 7. Restore masked LaTeX commands
  s = s.replace(/@@LTX_(\d+)@@/g, (_, idx) => masked[Number(idx)] ?? '');

  return s.replace(/ {2,}/g, ' ').trim();
}

export { attachMathQuickBar } from './dom.js';

