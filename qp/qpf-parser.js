/* Pure QPF v1.1 Parser, Serializer, Sample Paper & AI OCR Prompts */
import { uid } from '../shared/js/dom.js';
import { HDGS_BN } from './state.js';

export const SEC_QPF = ['KA', 'KHA', 'GA', 'GHA', 'UMA', 'CHA', 'CHHA', 'JA', 'JHA', 'NYA'];

const KNOWN_SEC_KEYS = new Set([
  'HEADING', 'TYPE', 'MARKS_PER_Q', 'MARKS', 'OPT_STYLE', 'ANSWER_ANY', 'ANSWERANY',
  'Q', 'OR_NEXT', 'Q_IMAGE', 'Q_IMAGE_MCQ', 'Q_IMAGE_BELOW',
  'OP_K', 'OPT_K', 'OP_KH', 'OPT_KH', 'OP_G', 'OPT_G', 'OP_GH', 'OPT_GH',
  'TABLE_START', 'TABLE_END', 'POINTER'
]);

export const PROMPT_IMG = `You are a highly advanced data-extraction algorithm processing an exam paper (which may be printed or handwritten). Use your most advanced reasoning and transcription capabilities. Extract and format STRICTLY according to the schema below.

CRITICAL RULES:
1. OUTPUT: Output raw plain text ONLY. Do NOT use markdown code blocks, backticks, or any fences. Start output directly with "// Question Paper Format v1.1".
2. NO FILLER: Do NOT add explanations, preambles, or filler text.
3. TWO-PASS STRUCTURE & ZERO HALLUCINATION: First mentally segment Header / Sections / Questions / Sub-parts / Tables / Diagrams before emitting tokens. Never merge two distinct questions when numbering is faint or missing — emit a separate Q: for each. If any word is illegible write <§>; if a number/mark is illegible write <§_NUM>; if a table's column alignment is ambiguous write <§_TBL> inside the affected cell. Do NOT guess or autocorrect. Preserve all Bengali and English characters exactly as printed.
4. FULL MARKS: Do NOT extract or calculate full marks for the paper — omit FULL_MARKS.
5. NUMBERING (CRITICAL): Do NOT include main question numbering (1., 2., Q3, etc.) in Q: values. The UI automatically numbers them.
6. DITTO MARKS: Replace any standalone double comma (") acting as a ditto mark with the exact word(s) from the line immediately above.
7. BLANKS: Transcribe fill-in-the-blank lines (long dashes, underscores) as "________।" (Bengali) or "________." (English).
8. TRUE/FALSE: For True/False questions: write the full sentence, add "।" or ".", then append "(সত্য/মিথ্যা)" for Bengali or "(T/F)" for English. Never both.
9. INSTRUCTIONS: For sections with "answer any N" or "যেকোনো N টি" instruction, set ANSWER_ANY: N in that section block.
10. SUB-PARTS: Do this ONLY if there are written part-by-part marks in the uploaded sample. Start each sub-part on a NEW LINE, indenting with spaces. Set MARKS_PER_Q to the total. Append the breakdown like (1+3+1) at the very end of the Q: text.
11. LABELED DIAGRAMS (CRITICAL): If the image contains a diagram with dashed pointer lines for labeling, use the LABELED_START and LABELED_END tokens. For each pointer line, output POINTER: [Label] : ___ where [Label] is the letter/number pointing to the blank (e.g., A, B, i, ii). Do NOT guess the answers.
12. HEADINGS: Auto-generate HEADING based on TYPE and MARKS_PER_Q:
    - TYPE mcq, any marks → সঠিক উত্তরটি নির্বাচন করো:
    - TYPE short, MARKS_PER_Q 1 → সংক্ষিপ্ত উত্তর দাও:
    - TYPE short, MARKS_PER_Q 2 → নীচের প্রশ্নগুলির উত্তর দাও:
    - TYPE descriptive or long, MARKS_PER_Q 3+ → দীর্ঘ উত্তরধর্মী প্রশ্ন:
13. Use the ending hashtag "##END" at the end of the qpf formatter, when there is nothing to write then use this.

SCHEMA:
// Question Paper Format v1.1
##META
TOP_TITLE: Test No. [number only]
CLASS: [Roman numeral class, no board name]
SUBJECT: [subject name]
TIME: [minutes only, number]
FONT_SIZE: 11
LINE_HEIGHT: 1.45
MARGIN: 1.0
DIVIDER: dotted

##SECTION_KA
HEADING: [auto-generate per rule 12]
TYPE: [mcq | short | descriptive | long]
MARKS_PER_Q: [numeric, total per question including sub-parts]
OPT_STYLE: [bn | en]
ANSWER_ANY: [N if "answer any N" instruction exists, else omit this line]
Q: [full question text, one line, NO main numbering. Sub-parts on new lines. Breakdown appended ONLY if present in image]
OR_NEXT: [true if this question has an alternative OR / অথবা question immediately following it, else omit]
OP_K: [MCQ option 1]
OP_KH: [MCQ option 2]
OP_G: [MCQ option 3]
OP_GH: [MCQ option 4]
[Repeat Q: block for all questions. Create new ##SECTION_ blocks as needed.]
##END

TOKENS FOR SPECIAL CONTENT:
[EQ:\\frac{a}{b}] for LaTeX math (always wrap |x| or matrices inside [EQ:...] so '|' does not split table columns)
[CHEM:H2SO4] for chemical formulas
C[SUB:3] for subscript
x[SUP:2] for superscript
[SYM:alpha] for Greek/special symbols
TABLE_START: 3x2
col1 | col2 | col3
...rows... (use <§> in any unreadable cell, and ALWAYS close with TABLE_END)
TABLE_END
LABELED_START
POINTER: Part ___ : ___
LABELED_END`;

export const PROMPT_TXT = `You are a highly advanced QPF (Question Paper Format) conversion algorithm. The user will provide rough text, handwritten OCR dumps, messy tables, or uncategorized notes. Convert it to strict QPF format v1.1.

CRITICAL RULES:
1. OUTPUT: Output raw plain text ONLY. Do NOT use markdown code blocks, backticks, or any fences. Start output directly with "// Question Paper Format v1.1".
2. NO FILLER: Do NOT add explanations, preambles, or conversational text.
3. TWO-PASS STRUCTURE & ILLEGIBILITY GUARD: First identify Header / Sections / Individual Questions / Tables before formatting. Never merge two separate questions when numbering is missing or messy. Preserve original wording and values strictly. If any word is unreadable output <§>; if a number/mark is unreadable output <§_NUM>; if a table cell/alignment is ambiguous output <§_TBL>. NEVER guess or invent missing text.
4. NUMBERING (CRITICAL): Strip out and delete all main question numbering (e.g., 1., 2., Q1, etc.) from the Q: values. The system handles numbering natively.
5. SUB-PARTS: If questions are grouped logically with sub-parts, put them on a new indented line (or separated by [BR]) within the same Q: value.
6. INFER SECTIONS: Group similar questions together and create ##SECTION_ blocks (e.g., group all MCQs into ##SECTION_KA, short questions into ##SECTION_KHA).
7. AUTO-HEADINGS:
    - TYPE mcq → সঠিক উত্তরটি নির্বাচন করো:
    - TYPE short (1 mark) → সংক্ষিপ্ত উত্তর দাও:
    - TYPE short (2 marks) → নীচের প্রশ্নগুলির উত্তর দাও:
    - TYPE descriptive/long (3+ marks) → দীর্ঘ উত্তরধর্মী প্রশ্ন:
8. TOKENS & TABLES: Use [EQ:\\frac{a}{b}], [CHEM:H2O], C[SUB:3], x[SUP:2], [SYM:alpha]. Always wrap vertical bars like |x| inside [EQ:|x|]. Format tables using:
TABLE_START: RxC
col1 | col2
val1 | val2
TABLE_END
Format labeled diagrams using LABELED_START / POINTER: A : ___ / LABELED_END.

SCHEMA TO FOLLOW:
// Question Paper Format v1.1
##META
TOP_TITLE: Test No. [number only]
CLASS: [Roman numeral class]
SUBJECT: [subject name]
TIME: 30
FONT_SIZE: 11
LINE_HEIGHT: 1.45
MARGIN: 1.0
DIVIDER: dotted

##SECTION_KA
HEADING: [auto-generate]
TYPE: [mcq | short | descriptive | long]
MARKS_PER_Q: [numeric]
OPT_STYLE: bn
Q: State and prove the Cayley-Hamilton theorem.
OR_NEXT: true
Q: Explain the central force orbital mechanics of the Two-Body Problem.
##END`;

export const SAMPLE_BN_MATH_QPF = `// Question Paper Format v1.1
##META
TOP_TITLE: Unit Test - I (গণিত)
CLASS: X
SUBJECT: গণিত (Mathematics)
TIME: 45
FONT_SIZE: 11
LINE_HEIGHT: 1.45
MARGIN: 1.0
DIVIDER: dotted
PAPER_LANG: full-bn

##SECTION_KA
HEADING: সঠিক উত্তরটি নির্বাচন করো:
TYPE: mcq
MARKS_PER_Q: 1
OPT_STYLE: bn
Q: যদি [EQ:x \\neq 0] এবং [EQ:\\frac{1}{x} + x = 2] হয়, তবে [EQ:x^{2026} + \\frac{1}{x^{2026}}]-এর মান কত?
OP_K: [EQ:0]
OP_KH: [EQ:1]
OP_G: [EQ:2]
OP_GH: [EQ:\\sqrt[3]{27}]

Q: [EQ:\\triangle ABC]-এ AB // CD এবং [EQ:x \\in [0, 1]] হলে, [EQ:\\angle BAC] এর মান নির্ণয় করো:
OP_K: [EQ:30^\\circ]
OP_KH: [EQ:45^\\circ]
OP_G: [EQ:60^\\circ]
OP_GH: [EQ:90^\\circ]

##SECTION_KHA
HEADING: নীচের প্রশ্নগুলির উত্তর দাও:
TYPE: descriptive
MARKS_PER_Q: 3
OPT_STYLE: bn
ANSWER_ANY: 2
Q: সমাধান করো: [BR]  (i) [EQ:\\sqrt[3]{x + 1} = 3] এবং অনুপাত a : b = 2 : 3 [BR]  (ii) নির্ণায়ক [EQ:\\begin{vmatrix} 1 & 2 \\\\ 3 & x \\end{vmatrix} = 0] হলে [EQ:x] এর মান কত?
OR_NEXT: true
Q: জলের সংকেত [CHEM:2H2 + O2 -> 2H2O] অনুযায়ী সমীকরণটির ভারসাম্য দেখাও এবং [EQ:x < 5] শর্তে লেখচিত্র আঁকো।
Q: একটি গোলকের ব্যাসার্ধ [EQ:r = 7\\text{ cm}] হলে সমগ্রতলের ক্ষেত্রফল কত?
TABLE_START: 2x3
ব্যাসার্ধ (r) | ক্ষেত্রফল | আয়তন
7 cm | 616 | 1437.33
TABLE_END
##END`;

function splitTableRow(line, expectedCols) {
  const cells = [];
  let cur = '';
  let eqDepth = 0;
  let inDollar = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      cur += ch + line[i + 1];
      i++;
      continue;
    }
    if (!inDollar && (line.slice(i, i + 4).toUpperCase() === '[EQ:' || line.slice(i, i + 6).toUpperCase() === '[CHEM:')) {
      eqDepth++;
    } else if (eqDepth > 0 && ch === '[') {
      eqDepth++;
    } else if (eqDepth > 0 && ch === ']') {
      eqDepth--;
    } else if (eqDepth === 0 && ch === '$') {
      inDollar = !inDollar;
    }
    if (ch === '|' && eqDepth === 0 && !inDollar) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  while (cells.length < expectedCols) cells.push('');
  return cells.slice(0, expectedCols);
}

export function repairCommonQPFMistakes(rawText) {
  return String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `[EQ:${inner.trim()}]`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `[EQ:${inner.trim()}]`)
    .replace(/^\s*\*\*(##(?:META|END|SECTION_[A-Z0-9_]+))\*\*\s*$/gim, '$1')
    .replace(/^\s*\*\*([A-Z_]+):\*\*\s*/gim, '$1: ');
}

export function auditQPFState(state) {
  let illegibleCount = 0;
  let emptyMcqOptions = 0;
  const markerRe = /<§(?:_NUM|_TBL)?>/g;
  (state?.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      illegibleCount += (String(q.text || '').match(markerRe) || []).length;
      if (sec.type === 'mcq') {
        (q.options || []).forEach((o) => {
          if (!String(o || '').trim()) emptyMcqOptions++;
          illegibleCount += (String(o || '').match(markerRe) || []).length;
        });
      }
      (q.extra || []).forEach((ex) => {
        if (ex.type === 'table') {
          (ex.rows || []).forEach((r) => r.forEach((c) => {
            illegibleCount += (String(c || '').match(markerRe) || []).length;
          }));
        }
      });
    });
  });
  return { illegibleCount, emptyMcqOptions };
}

export function parseQPF(rawText) {
  const lines = repairCommonQPFMistakes(rawText).split(/\r?\n/).map((l) => l.trim());
  const stripped = [];

  for (const l of lines) {
    if (/^```/.test(l)) continue;
    stripped.push(l);
  }

  const newState = {
    topTitle: 'Test no. XXX',
    klass: '',
    subject: '',
    time: 30,
    inst: '',
    fontSize: 11,
    lineHeight: 1.45,
    margin: 1.0,
    divider: 'dotted',
    paperLang: 'full-bn',
    wmSrc: 'none',
    sections: []
  };

  let mode = '';
  let curSec = null;
  let curQ = null;
  let inTable = false;
  let inLabeled = false;

  const ensureDefaultSec = () => {
    if (!curSec) {
      curSec = {
        id: uid(),
        heading: HDGS_BN[0],
        type: 'short',
        mpq: 1,
        os: 'bn',
        answerAny: null,
        questions: [],
        isCollapsed: false
      };
      mode = 'sec';
    }
  };

  const flushQ = () => {
    if (curQ && curSec) {
      curSec.questions.push(curQ);
      curQ = null;
    }
  };
  const flushSec = () => {
    flushQ();
    if (curSec) {
      newState.sections.push(curSec);
      curSec = null;
    }
  };

  for (const raw of stripped) {
    const line = raw.replace(/\s+/g, ' ');
    // Strip only full-line comments starting with // so geometry like "AB // CD" survives
    if (!line || line.startsWith('//')) continue;
    const cleanLine = line;

    const secMatch = cleanLine.replace(/\s/g, '').match(/^##SECTION_([A-Z0-9_]+)$/i);
    if (secMatch) {
      flushSec();
      curSec = {
        id: uid(),
        heading: HDGS_BN[0],
        type: 'mcq',
        mpq: 1,
        os: 'bn',
        answerAny: null,
        questions: [],
        isCollapsed: false
      };
      mode = 'sec';
      inTable = false;
      inLabeled = false;
      continue;
    }

    if (cleanLine.replace(/\s/g, '') === '##META') { mode = 'meta'; continue; }
    if (cleanLine.replace(/\s/g, '') === '##END') { flushSec(); break; }

    if (cleanLine === 'TABLE_END') {
      inTable = false;
      continue;
    }
    if (cleanLine === 'LABELED_START' && curQ) {
      curQ.extra.push({ type: 'labeled', data: null, align: 'right', size: 60, pointers: [], ptrType: 'i' });
      inLabeled = true;
      continue;
    }
    if (cleanLine === 'LABELED_END' && curQ) {
      inLabeled = false;
      continue;
    }

    const ci = cleanLine.indexOf(':');
    const rawKey = ci >= 0 ? cleanLine.slice(0, ci).trim().toUpperCase() : '';
    if (!curSec && rawKey === 'Q') ensureDefaultSec();
    const isDirective =
      ci >= 0 &&
      (mode === 'meta' || (mode === 'sec' && KNOWN_SEC_KEYS.has(rawKey)));

    if (!isDirective) {
      if (inTable && curQ) {
        const lastEx = curQ.extra[curQ.extra.length - 1];
        if (lastEx && lastEx.type === 'table') {
          const cols = lastEx.rows[0] ? lastEx.rows[0].length : 2;
          const cells = splitTableRow(cleanLine, cols);
          const emptyRowIdx = lastEx.rows.findIndex((r) => r.every((c) => !c));
          if (emptyRowIdx >= 0) lastEx.rows[emptyRowIdx] = cells;
          else if (lastEx.rows.length < 30) lastEx.rows.push(cells);
        }
      } else if (curQ && !inTable && !inLabeled && mode === 'sec') {
        curQ.text += `\n${cleanLine.replace(/\[BR\]/gi, '\n')}`;
      }
      continue;
    }

    const k = rawKey;
    const v = cleanLine.slice(ci + 1).trim().replace(/\[BR\]/gi, '\n');

    if (mode === 'meta') {
      if (k === 'TOP_TITLE') newState.topTitle = v;
      else if (k === 'TEACHER') newState.topTitle = newState.topTitle.replace('Teacher', v) || v;
      else if (k === 'TEST_NO') {
        if (newState.topTitle.includes('no. 1')) newState.topTitle = newState.topTitle.replace('1', v);
      } else if (k === 'CLASS') newState.klass = v;
      else if (k === 'SUBJECT') newState.subject = v;
      else if (k === 'TIME') newState.time = parseInt(v, 10) || 30;
      else if (k === 'FONT_SIZE') newState.fontSize = Math.min(15, Math.max(7, parseFloat(v) || 11));
      else if (k === 'LINE_HEIGHT') newState.lineHeight = Math.min(1.75, Math.max(0.8, parseFloat(v) || 1.45));
      else if (k === 'MARGIN') newState.margin = parseFloat(v) || 1.0;
      else if (k === 'DIVIDER') {
        if (['dotted', 'dashed', 'solid', 'text'].includes(v.toLowerCase())) newState.divider = v.toLowerCase();
      } else if (k === 'PAPER_LANG') {
        if (['full-bn', 'mixed', 'full-en'].includes(v.toLowerCase())) newState.paperLang = v.toLowerCase();
      }
    } else if (mode === 'sec' && curSec) {
      if (k === 'TABLE_START' && curQ) {
        const dims = v.split('x').map((x) => parseInt(x.trim(), 10) || 2);
        const r = Math.min(Math.max(dims[0], 1), 30);
        const c = Math.min(Math.max(dims[1] || dims[0], 1), 12);
        curQ.extra.push({ type: 'table', rows: Array.from({ length: r }, () => Array(c).fill('')), align: 'center' });
        inTable = true;
        continue;
      }
      if (k === 'TABLE_END') { inTable = false; continue; }

      if (inTable && curQ && k !== 'Q') {
        const lastEx = curQ.extra[curQ.extra.length - 1];
        if (lastEx && lastEx.type === 'table') {
          const cols = lastEx.rows[0] ? lastEx.rows[0].length : 2;
          const origCells = splitTableRow(cleanLine, cols);
          const emptyRowIdx = lastEx.rows.findIndex((r) => r.every((c) => !c));
          if (emptyRowIdx >= 0) lastEx.rows[emptyRowIdx] = origCells;
          else if (lastEx.rows.length < 30) lastEx.rows.push(origCells);
        }
        continue;
      }

      if (inLabeled && curQ && k !== 'Q') {
        if (k === 'POINTER') {
          const lastEx = curQ.extra[curQ.extra.length - 1];
          if (lastEx && lastEx.type === 'labeled') {
            const pts = v.split(':');
            const lbl = pts[0] && !pts[0].includes('___') ? pts[0].replace(/[\(\)\.]/g, '').trim() : '';
            if (lastEx.pointers.length === 0 && lbl) {
              const firstChar = lbl.charAt(0);
              if (/[A-Z]/.test(firstChar)) lastEx.ptrType = 'A';
              else if (/[ক-ঞ]/.test(firstChar)) lastEx.ptrType = 'bn';
              else if (['i', 'v', 'x'].includes(firstChar)) lastEx.ptrType = 'i';
              else if (/[a-z]/.test(firstChar)) lastEx.ptrType = 'a';
              else lastEx.ptrType = '1';
            }
            lastEx.pointers.push({ label: lbl || '?', blank: true });
          }
        }
        continue;
      }

      if (k === 'HEADING') curSec.heading = v;
      else if (k === 'TYPE') {
        const typeMap = { mcq: 'mcq', short: 'short', descriptive: 'descriptive', long: 'long', sa: 'short', la: 'long', desc: 'descriptive' };
        curSec.type = typeMap[v.toLowerCase()] || 'short';
      } else if (k === 'MARKS_PER_Q' || k === 'MARKS') {
        curSec.mpq = parseFloat(v) || 1;
      } else if (k === 'OPT_STYLE') {
        curSec.os = v.toLowerCase() === 'en' ? 'en' : 'bn';
      } else if (k === 'ANSWER_ANY' || k === 'ANSWERANY') {
        const aVal = parseInt(v, 10);
        if (aVal > 0) curSec.answerAny = aVal;
      } else if (k === 'Q') {
        flushQ();
        curQ = { id: uid(), text: v, options: ['', '', '', ''], img: null, imgSize: 60, imgAlign: 'right', extra: [], isOrNext: false };
        inTable = false;
        inLabeled = false;
      } else if (k === 'OR_NEXT') {
        if (curQ) curQ.isOrNext = v.toLowerCase() === 'true';
      } else if (k === 'Q_IMAGE' || k === 'Q_IMAGE_MCQ') {
        if (curQ && /^(data:|https?:|\.?\.\/)/i.test(v)) curQ.img = v;
      } else if (k === 'Q_IMAGE_BELOW') {
        if (curQ && /^(data:|https?:|\.?\.\/)/i.test(v)) curQ.extra.push({ type: 'image', data: v, size: 60, align: 'right' });
      } else {
        const OPT_KEYS = { OP_K: 0, OPT_K: 0, OP_KH: 1, OPT_KH: 1, OP_G: 2, OPT_G: 2, OP_GH: 3, OPT_GH: 3 };
        if (OPT_KEYS[k] !== undefined && curQ) curQ.options[OPT_KEYS[k]] = v;
      }
    }
  }

  flushSec();

  if (newState.sections.length === 0) throw new Error('No sections identified in QPF.');

  newState.fullMarks = newState.sections.reduce((t, sec) => {
    let actualCount = 0;
    for (let i = 0; i < sec.questions.length; i++) {
      actualCount++;
      if (sec.questions[i].isOrNext) i++;
    }
    if (sec.answerAny && sec.answerAny >= actualCount) sec.answerAny = null;
    const countedQ = sec.answerAny && sec.answerAny < actualCount ? sec.answerAny : actualCount;
    return t + (sec.mpq || 0) * countedQ;
  }, 0);

  return newState;
}

export function serializeQPF(S) {
  let o = `// Question Paper Format v1.1\n// Generated by প্রশ্নপত্র Maker\n// ${new Date().toLocaleString()}\n\n##META\n`;
  o += `TOP_TITLE: ${S.topTitle}\nCLASS: ${S.klass}\nSUBJECT: ${S.subject}\nFULL_MARKS: ${S.fullMarks}\nTIME: ${S.time}\n`;
  o += `FONT_SIZE: ${S.fontSize}\nLINE_HEIGHT: ${S.lineHeight}\nMARGIN: ${S.margin}\nDIVIDER: ${S.divider}\nPAPER_LANG: ${S.paperLang}\nWATERMARK: ${S.wmSrc}\n\n`;

  S.sections.forEach((sec, idx) => {
    const key = SEC_QPF[idx] || `S${idx + 1}`;
    o += `##SECTION_${key}\nHEADING: ${sec.heading}\nTYPE: ${sec.type}\nMARKS_PER_Q: ${sec.mpq}\nOPT_STYLE: ${sec.os}\n`;
    if (sec.answerAny) o += `ANSWER_ANY: ${sec.answerAny}\n`;
    o += '\n';

    sec.questions.forEach((q) => {
      const safeText = (q.text || '').replace(/\r?\n/g, ' [BR] ');
      o += `Q: ${safeText}\n`;
      if (q.isOrNext) o += `OR_NEXT: true\n`;

      if (sec.type === 'mcq') {
        ['OP_K', 'OP_KH', 'OP_G', 'OP_GH'].forEach((opKey, i) => {
          o += `${opKey}: ${q.options[i] || ''}\n`;
        });
        if (q.img) o += `Q_IMAGE_MCQ: ${q.img}\n`;
      }
      (q.extra || []).forEach((ex) => {
        if (ex.type === 'table') {
          const colsCount = ex.rows[0] ? ex.rows[0].length : 0;
          o += `TABLE_START: ${ex.rows.length}x${colsCount}\n`;
          ex.rows.forEach((r) => { o += `${r.join(' | ')}\n`; });
          o += `TABLE_END\n`;
        }
        if (ex.type === 'image' && ex.data) o += `Q_IMAGE_BELOW: ${ex.data}\n`;
        if (ex.type === 'diagram') o += `// DIAGRAM: [embedded PNG]\n`;
        if (ex.type === 'labeled') {
          o += `LABELED_START\n`;
          (ex.pointers || []).forEach((ptr) => {
            o += `POINTER: ${ptr.label ? ptr.label + ' : ___' : 'Part ___ : ___'}\n`;
          });
          o += `LABELED_END\n`;
        }
      });
      o += '\n';
    });
  });
  o += `##END\n`;
  return o;
}
