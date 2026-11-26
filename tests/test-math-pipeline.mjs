import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTok,
  formatContent,
  formatMathToHTMLFallback,
  chemToLatex,
  qpTextToCbt,
  cbtTextToQp,
  stripMarkupLength,
  findUnmatchedMathTokens,
  qpfStateToCbtString,
  shorthandToLatex
} from '../shared/js/math-pipeline.js';

test('renderTok handles balanced nested [EQ:\\sqrt[3]{27}] and interval [0, 1]', () => {
  const html1 = renderTok('মান: [EQ:\\sqrt[3]{27}]');
  assert.match(html1, /<sup>3<\/sup>√/);
  assert.match(html1, /27/);

  const html2 = renderTok('Interval [EQ:x \\in [0, 1]] and [EQ:x < 5]');
  assert.match(html2, /\[0, 1\]/);
  assert.match(html2, /x\s*<\s*5/);
});

test('renderTok renders [CHEM:2H2 + O2 -> 2H2O] with upright coefficients and arrow', () => {
  const html = renderTok('বিক্রিয়া: [CHEM:2H2 + O2 -> 2H2O]');
  assert.match(html, /2H<sub>2<\/sub> \+ O<sub>2<\/sub> → 2H<sub>2<\/sub>O/);
});

test('formatMathToHTMLFallback handles matrices, stacked fractions, and Bengali superscripts', () => {
  const mat = formatMathToHTMLFallback('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}');
  assert.match(mat, /<table class="fallback-matrix">/);
  assert.match(mat, /<td>.*a.*<\/td>/);

  const frac = formatMathToHTMLFallback('\\frac{x^২ + ১}{\\sqrt{2}}');
  assert.match(frac, /frac-stack/);
  assert.match(frac, /<sup>.*২.*<\/sup>/);
});

test('formatContent escapes currency \\$50...\\$10 safely for KATEX_ONLINE and sanitizes tables', () => {
  const out = formatContent('A book costs \\$50 and has a \\$10 discount.', 'KATEX_ONLINE', 'LATEX');
  assert.match(out, /escaped-dollar/);
  assert.doesNotMatch(out, /(?<!&#)\$50/);

  const xss = formatContent('<table><tr><td onclick="alert(1)">OK</td></tr></table><script>alert(1)</script>', 'HTML_FALLBACK', 'LATEX');
  assert.doesNotMatch(xss, /<script/i);
  assert.doesNotMatch(xss, /onclick=/i);
  assert.match(xss, /<table>/);
});

test('chemToLatex and qpTextToCbt handle complex formulas like Ca(OH)2 without mismatched braces', () => {
  assert.equal(chemToLatex('Ca(OH)2'), '$\\mathrm{Ca(OH)}_{2}$');
  assert.equal(chemToLatex('2H2 + O2 -> 2H2O'), '$2\\mathrm{H}_{2} + \\mathrm{O}_{2} \\rightarrow 2\\mathrm{H}_{2}\\mathrm{O}$');
  assert.equal(chemToLatex('SO4^2-'), '$\\mathrm{SO}_{4}^{2-}$');

  const cbt = qpTextToCbt('সমীকরণ [CHEM:Ca(OH)2] ও [EQ:\\sqrt[3]{27}]');
  assert.equal(cbt, 'সমীকরণ $\\mathrm{Ca(OH)}_{2}$ ও $\\sqrt[3]{27}$');
  assert.equal(cbtTextToQp('মান $\\frac{1}{2}$'), 'মান [EQ:\\frac{1}{2}]');
});

test('findUnmatchedMathTokens catches unclosed [EQ:...] and $ delimiters', () => {
  assert.deepEqual(findUnmatchedMathTokens('ঠিক আছে [EQ:x^2] এবং $y=1$'), []);
  assert.ok(findUnmatchedMathTokens('ত্রুটি [EQ:x^2').length > 0);
  assert.ok(findUnmatchedMathTokens('ত্রুটি $x^2 + 1').length > 0);
});

test('stripMarkupLength ignores markup and measures visible characters', () => {
  assert.equal(stripMarkupLength('[EQ:\\frac{1}{2}]'), 2);
  assert.equal(stripMarkupLength('<math><mi>x</mi></math>'), 1);
});

test('qpfStateToCbtString exports sections and Bengali math cleanly', () => {
  const cbtStr = qpfStateToCbtString({
    topTitle: 'Test 1',
    klass: 'X',
    subject: 'Math',
    time: 45,
    inst: 'All questions mandatory',
    sections: [
      {
        heading: 'MCQ',
        type: 'mcq',
        mpq: 2,
        questions: [
          { text: 'মান [EQ:x^2]?', options: ['[EQ:1]', '[CHEM:H2O]', '3', '4'], extra: [] }
        ]
      }
    ]
  });
  assert.match(cbtStr, /\[EXAM_INFO\]/);
  assert.match(cbtStr, /\$x\^2\$/);
  assert.match(cbtStr, /\$\\mathrm\{H\}_\{2\}\\mathrm\{O\}\$/);
});

test('shorthandToLatex converts fractions, roots, powers, operators, degrees, and Greek words', () => {
  assert.equal(shorthandToLatex('a/b'), '\\frac{a}{b}');
  assert.equal(shorthandToLatex('(x+1)/(x-1)'), '\\frac{x+1}{x-1}');
  assert.equal(shorthandToLatex('sqrt(x+1)'), '\\sqrt{x+1}');
  assert.equal(shorthandToLatex('cbrt(27)'), '\\sqrt[3]{27}');
  assert.equal(shorthandToLatex('sqrt((x+1)/(x-1))'), '\\sqrt{\\frac{x+1}{x-1}}');
  assert.equal(shorthandToLatex('x^2026 + x^(n+1)'), 'x^{2026} + x^{n+1}');
  assert.equal(shorthandToLatex('a != b <= c >= d +- 1'), 'a \\neq b \\leq c \\geq d \\pm 1');
  assert.equal(shorthandToLatex('A -> B <-> C * D'), 'A \\rightarrow B \\rightleftharpoons C \\times D');
  assert.equal(shorthandToLatex('sin(30deg) + 90 deg'), 'sin(30^\\circ) + 90^\\circ');
  assert.equal(
    shorthandToLatex('alpha + beta + gamma + theta + pi + delta'),
    '\\alpha + \\beta + \\gamma + \\theta + \\pi + \\delta'
  );
  assert.equal(
    shorthandToLatex('(x+1)/2 + sqrt(x) != 0'),
    '\\frac{x+1}{2} + \\sqrt{x} \\neq 0'
  );
});

test('shorthandToLatex preserves existing LaTeX commands and handles incomplete typing safely', () => {
  assert.equal(shorthandToLatex('\\frac{1}{2} + a/b'), '\\frac{1}{2} + \\frac{a}{b}');
  assert.equal(
    shorthandToLatex('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'),
    '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'
  );
  assert.equal(shorthandToLatex('\\alpha + beta'), '\\alpha + \\beta');
  assert.equal(shorthandToLatex(''), '');
  assert.equal(shorthandToLatex(null), '');
  assert.equal(shorthandToLatex('(x+1)/'), '(x+1)/');
});

