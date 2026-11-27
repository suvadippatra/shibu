/* Pure QPF v1.1 Parser, Serializer, Sample Paper & AI OCR Prompts */
import { uid } from '../shared/js/dom.js';
import { HDGS_BN, getDefaultHeading, stripLeadingQNum } from './state.js';

export const SEC_QPF = ['KA', 'KHA', 'GA', 'GHA', 'UMA', 'CHA', 'CHHA', 'JA', 'JHA', 'NYA'];

const KNOWN_SEC_KEYS = new Set([
  'HEADING', 'TYPE', 'MARKS_PER_Q', 'MARKS', 'OPT_STYLE', 'ANSWER_ANY', 'ANSWERANY',
  'Q', 'OR_NEXT', 'Q_IMAGE', 'Q_IMAGE_MCQ', 'Q_IMAGE_BELOW',
  'OP_K', 'OPT_K', 'OP_KH', 'OPT_KH', 'OP_G', 'OPT_G', 'OP_GH', 'OPT_GH',
  'TABLE_START', 'TABLE_END', 'POINTER'
]);

export const PROMPT_IMG = `You are a precision exam-paper OCR & QPF v1.1 extraction engine. Extract EVERY header, section, question, option, table, and diagram from the provided image(s) into strict QPF v1.1 format.

CRITICAL LINE-BREAK & FORMATTING CONTRACT (ALL LLMs MUST OBEY):
1. RAW PLAIN TEXT ONLY: Output ONLY raw QPF v1.1 lines. Do NOT wrap in markdown code fences (\`\`\`), do NOT add any intro/outro text, and do NOT bold keys (never write **Q:** or - Q:). Start line 1 with: // Question Paper Format v1.1
2. STRICT ONE-TAG-PER-LINE (NEVER FLATTEN): Every directive and key (##META, TOP_TITLE:, CLASS:, SUBJECT:, TIME:, ##SECTION_KA, HEADING:, TYPE:, MARKS_PER_Q:, OPT_STYLE:, ANSWER_ANY:, Q:, OR_NEXT:, OP_K:, OP_KH:, OP_G:, OP_GH:, TABLE_START:, TABLE_END, LABELED_START, POINTER:, LABELED_END, ##END) MUST start at column 0 on its OWN NEW LINE. NEVER join multiple tags or questions into a flat paragraph!
3. MULTI-LINE QUESTIONS & SUB-PARTS:
   - Do NOT include main question numbers (1., 2., Q1, ১।, ২)) in Q: values — the app numbers them automatically.
   - If a question has sub-parts ((a)/(b), (i)/(ii), (ক)/(খ)) or multiple paragraphs, keep the stem on the Q: line and start each sub-part on a NEW indented line (2 spaces) OR separate with [BR].
   - If sub-parts have individual marks written in the paper, set MARKS_PER_Q to the total and append the breakdown like (1+3+1) at the end of the Q: block.
4. TWO-PASS ZERO-HALLUCINATION GUARD:
   - Pass 1: Segment Header, Sections, Questions, Options, Tables, and Diagrams. Never merge two distinct questions when numbering is faint or missing.
   - Pass 2: Transcribe exact Bengali and English wording. If any word is illegible write <§>; if a number/mark is illegible write <§_NUM>; if a table cell/alignment is ambiguous write <§_TBL>. NEVER guess or invent missing text.
5. FULL MARKS: Omit FULL_MARKS (auto-calculated).
6. DITTO MARKS: Replace any standalone ditto mark (") with the exact word(s) from the line immediately above.
7. BLANKS & TRUE/FALSE:
   - Transcribe blanks as "________।" (Bengali) or "________." (English).
   - For True/False: write the full sentence + "।" or "." + " (সত্য/মিথ্যা)" for Bengali or " (T/F)" for English.
8. INSTRUCTIONS & OR QUESTIONS:
   - If a section says "answer any N" / "যেকোনো N টি", add ANSWER_ANY: N.
   - If a question has an alternative OR / অথবা question right after it, add OR_NEXT: true on its own line immediately after the first question's Q: block, then write the alternative Q: block.
9. LABELED DIAGRAMS: If there is a diagram with pointer blanks, emit:
LABELED_START
POINTER: A : ___
LABELED_END
10. AUTO-HEADINGS (use exact phrasing if section has no explicit heading):
    - TYPE mcq → সঠিক উত্তরটি নির্বাচন করো:
    - TYPE short, MARKS_PER_Q 1 → সংক্ষিপ্ত উত্তর দাও:
    - TYPE short, MARKS_PER_Q 2 → নীচের প্রশ্নগুলির উত্তর দাও:
    - TYPE descriptive or long, MARKS_PER_Q 3+ → দীর্ঘ উত্তরধর্মী প্রশ্ন:
11. MATH, CHEMISTRY & TABLES:
    - Wrap all LaTeX math in [EQ:...] (e.g. [EQ:\\frac{1}{x} + \\sqrt[3]{27}]). Always wrap |x| or matrices inside [EQ:...] so '|' never breaks table parsing.
    - Chemical formulas: [CHEM:2H2 + O2 -> 2H2O]
    - Subscripts/superscripts: C[SUB:3], H[SUB:2]O, x[SUP:2] (NEVER wrap the base letter like [SUB:C][SUB:3]).
    - Symbols: [SYM:alpha], [SYM:degree], [SYM:theta].
    - Tables:
TABLE_START: RowsxCols
Col1 | Col2
Val1 | Val2
TABLE_END
12. End the entire output with ##END on its own line.

CONCRETE EXAMPLE OUTPUT (FOLLOW THIS EXACT LINE-BY-LINE STRUCTURE):
// Question Paper Format v1.1
##META
TOP_TITLE: Unit Test - I
CLASS: X
SUBJECT: গণিত (Mathematics)
TIME: 45
FONT_SIZE: 11
LINE_HEIGHT: 1.45
MARGIN: 1.0
DIVIDER: dotted

##SECTION_KA
HEADING: সঠিক উত্তরটি নির্বাচন করো:
TYPE: mcq
MARKS_PER_Q: 1
OPT_STYLE: bn
Q: যদি [EQ:x \\neq 0] এবং [EQ:\\frac{1}{x} + x = 2] হয়, তবে [EQ:x^{2026} + \\frac{1}{x^{2026}}]-এর মান কত?
OP_K: 0
OP_KH: 1
OP_G: 2
OP_GH: [EQ:\\sqrt[3]{27}]

##SECTION_KHA
HEADING: নীচের প্রশ্নগুলির উত্তর দাও:
TYPE: short
MARKS_PER_Q: 3
OPT_STYLE: bn
Q: সমাধান করো:
  (i) [EQ:\\sqrt[3]{x + 1} = 3] এবং অনুপাত a : b = 2 : 3
  (ii) নির্ণায়ক [EQ:\\begin{vmatrix} 1 & 2 \\\\ 3 & x \\end{vmatrix} = 0] হলে x-এর মান কত?
OR_NEXT: true
Q: জলের সংকেত [CHEM:2H2 + O2 -> 2H2O] অনুযায়ী সমীকরণটির ভারসাম্য দেখাও।
Q: একটি গোলকের ব্যাসার্ধ [EQ:r = 7] cm হলে সমগ্রতলের ক্ষেত্রফল কত?
TABLE_START: 2x3
ব্যাসার্ধ (r) | ক্ষেত্রফল | আয়তন
7 cm | 616 | 1437.33
TABLE_END
##END`;

export const PROMPT_TXT = `You are a precision QPF v1.1 conversion engine. The user will provide rough text, handwritten OCR dumps, messy tables, or uncategorized notes. Convert it into strict QPF v1.1 format.

CRITICAL LINE-BREAK & FORMATTING CONTRACT (ALL LLMs MUST OBEY):
1. RAW PLAIN TEXT ONLY: Output ONLY raw QPF v1.1 lines. Do NOT use markdown code fences (\`\`\`), do NOT add explanations/preambles, and do NOT bold keys (never write **Q:** or - Q:). Start line 1 with: // Question Paper Format v1.1
2. STRICT ONE-TAG-PER-LINE (NEVER FLATTEN): Every tag (##META, TOP_TITLE:, CLASS:, SUBJECT:, TIME:, ##SECTION_KA, HEADING:, TYPE:, MARKS_PER_Q:, OPT_STYLE:, ANSWER_ANY:, Q:, OR_NEXT:, OP_K:, OP_KH:, OP_G:, OP_GH:, TABLE_START:, TABLE_END, ##END) MUST be on its OWN NEW LINE. Never merge multiple tags or questions into one flat paragraph.
3. TWO-PASS STRUCTURE & ILLEGIBILITY GUARD:
   - Pass 1: Identify Header, Sections, Individual Questions, Sub-parts, OR-alternatives, Options, and Tables. Never merge two separate questions when numbering is missing or messy.
   - Pass 2: Preserve original Bengali/English wording strictly. If any word is unreadable write <§>; if a number/mark is unreadable write <§_NUM>; if a table cell/alignment is ambiguous write <§_TBL>. NEVER guess or invent missing text.
4. NUMBERING & SUB-PARTS:
   - Strip all leading main question numbers (1., 2., Q1, ১।, ২)) from Q: values.
   - If a question has sub-parts ((a)/(b), (i)/(ii)), keep the main stem on Q: and place each sub-part on a NEW indented line (2 spaces) or separated by [BR].
5. INFER SECTIONS & AUTO-HEADINGS: Group similar questions into ##SECTION_KA, ##SECTION_KHA, etc.:
   - TYPE mcq → সঠিক উত্তরটি নির্বাচন করো:
   - TYPE short (1 mark) → সংক্ষিপ্ত উত্তর দাও:
   - TYPE short (2 marks) → নীচের প্রশ্নগুলির উত্তর দাও:
   - TYPE descriptive/long (3+ marks) → দীর্ঘ উত্তরধর্মী প্রশ্ন:
6. TOKENS & TABLES:
   - Math: [EQ:\\frac{a}{b}] (always wrap |x| or matrices inside [EQ:...]).
   - Chemistry: [CHEM:H2O]. Sub/Super: C[SUB:3], x[SUP:2]. Symbols: [SYM:alpha].
   - Tables: TABLE_START: RxC ... rows separated by | ... TABLE_END.
   - Diagrams: LABELED_START ... POINTER: A : ___ ... LABELED_END.
7. End with ##END on its own line.

CONCRETE EXAMPLE OUTPUT:
// Question Paper Format v1.1
##META
TOP_TITLE: Test No. 1
CLASS: X
SUBJECT: Physical Science
TIME: 30
FONT_SIZE: 11
LINE_HEIGHT: 1.45
MARGIN: 1.0
DIVIDER: dotted

##SECTION_KA
HEADING: সঠিক উত্তরটি নির্বাচন করো:
TYPE: mcq
MARKS_PER_Q: 1
OPT_STYLE: bn
Q: জলের রাসায়নিক সংকেত কোনটি?
OP_K: [CHEM:H2O]
OP_KH: [CHEM:CO2]
OP_G: [CHEM:O2]
OP_GH: [CHEM:H2O2]

##SECTION_KHA
HEADING: নীচের প্রশ্নগুলির উত্তর দাও:
TYPE: short
MARKS_PER_Q: 2
OPT_STYLE: bn
Q: প্রমাণ করো [EQ:\\frac{1}{a} + \\frac{1}{b} = \\frac{a+b}{ab}]।
OR_NEXT: true
Q: সংক্ষেপে লেখো:
  (i) ওহমের সূত্রটি বিবৃত করো।
  (ii) রোধের SI একক কী?
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
    .replace(/\[SUB:([A-Za-z])\]\s*\[SUB:(\d+)\]/gi, '$1[SUB:$2]')
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
      if (!curSec._explicitHeading) {
        curSec.heading = getDefaultHeading(curSec.type, curSec.mpq, newState.paperLang);
      }
      delete curSec._explicitHeading;
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
        _explicitHeading: false,
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

      if (k === 'HEADING') {
        const isPlaceholder = !v || /^(?:[A-Za-zক-ঞ]|(?:Section|বিভাগ)\s*['"]?[A-Za-zক-ঞ]['"]?)$/i.test(v);
        if (!isPlaceholder) {
          curSec.heading = v;
          curSec._explicitHeading = true;
        }
      } else if (k === 'TYPE') {
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
        curQ = { id: uid(), text: stripLeadingQNum(v), options: ['', '', '', ''], img: null, imgSize: 60, imgAlign: 'right', extra: [], isOrNext: false };
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
