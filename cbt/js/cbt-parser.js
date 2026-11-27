/* Pure .CBT Parser, Generator, Sample Exam & AI Prompts */

const BN_OPT_MAP = { 'ক': 0, 'খ': 1, 'গ': 2, 'ঘ': 3, 'ঙ': 4, 'চ': 5 };

export const SAMPLE_CBT_TEXT = `[EXAM_INFO]
Agency: WBCHSE & NEET Mock
Title: গণিত ও বিজ্ঞান পরীক্ষা (Sample)
Subtitle: Bengali Math + English STEM
Duration: 45
Timer: COUNTDOWN
Font: 'Tiro Bangla', 'Kalpurush', serif
MathMode: LATEX
[FORMAT_WATERMARK: LATEX]

[SECTION:Section A - গণিত (Math)|Marks:2|Neg:0|MaxAtt:0]
QType: MCQ
Q: যদি $x \\neq 0$ এবং $\\frac{৫}{x} + \\sqrt[3]{২৭} = ৮$ হয়, তবে $x$-এর মান কত?
O: $1$
O: $2$
O: $\\frac{5}{2}$
O: কোনটিই নয়
A: ক

QType: MCQ
Q: নির্ণায়ক $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$-এর মান নির্ণয় করো:
O: $-2$
O: $2$
O: $10$
O: $-10$
A: A

[SECTION:Section B - Physics & English|Marks:4|Neg:1|MaxAtt:0]
QType: MCQ
Q: A book costs \\$50 and has a \\$10 discount. What is the final price?
O: \\$40
O: \\$35
O: \\$45
O: \\$30
A: A

QType: NAT
Q: Evaluate $\\int_0^1 5x\\,dx$ (up to two decimals):
A: 2.5
`;

/**
 * Pure parser: converts raw .cbt text into a structured object (testable in Node without DOM).
 */
export function parseCBTData(rawText) {
  let txt = String(rawText || '').replace(/^\uFEFF/, '');
  txt = txt.replace(/\[span_[^\]]*\](?:\(start_span\)|\(end_span\))?/gi, '');
  // Preserve LaTeX commands starting with \n (\neq, \nabla, \nu, \notin, \natural) and matrix line breaks (\\n)
  txt = txt.replace(/(?<!\\)\\n(?![a-zA-Z])/g, '\n');
  txt = txt.replace(/(Statement|Assertion|List|Reason|বিবৃতি|কারণ)[\s\n]+(I{1,3}|A|B|R|১|২)[\s\n]*:/gi, '$1 $2:');
  txt = txt.replace(/\n([QOAI]\s*:)/gi, '\n$1');

  const parsed = {
    agencyName: '',
    examTitle: '',
    examSubtitle: '',
    duration: '',
    timerMode: 'STOPWATCH',
    fontName: '',
    mathMode: 'LATEX',
    rules: [],
    audio: { bg: '', start: '', submit: '' },
    constants: [],
    sections: [],
    questionsBySection: {}
  };

  const lines = txt.split('\n');
  let mode = null, curSec = null, curQ = null, lastField = null;

  lines.forEach((line) => {
    const tr = line.trim();
    if (!tr && lastField !== 'T' && lastField !== 'Q' && lastField !== 'O') return;
    if (tr.startsWith('#')) return;

    if (tr.startsWith('[EXAM_INFO]')) { mode = 'exam'; lastField = null; }
    else if (tr.startsWith('[CONSTANTS]')) { mode = 'constants'; lastField = null; }
    else if (tr.startsWith('[SECTION:')) {
      mode = 'questions'; lastField = null;
      const m = tr.match(/\[SECTION:(.*?)(?:\|Marks:([\d.]+))?(?:\|Neg:([\d.]+))?(?:\|MaxAtt:(\d+))?\]/);
      if (m) {
        curSec = m[1].trim();
        parsed.sections.push({
          name: curSec,
          marks: m[2] !== undefined ? parseFloat(m[2]) : 4,
          negative: m[3] !== undefined ? parseFloat(m[3]) : 1,
          maxAttempts: m[4] !== undefined ? parseInt(m[4], 10) : 0
        });
        parsed.questionsBySection[curSec] = [];
        curQ = null;
      }
    } else if (mode === 'exam') {
      if (tr.startsWith('Agency:')) parsed.agencyName = tr.substring(7).trim();
      else if (tr.startsWith('Title:')) parsed.examTitle = tr.substring(6).trim();
      else if (tr.startsWith('Subtitle:')) parsed.examSubtitle = tr.substring(9).trim();
      else if (tr.toLowerCase().startsWith('duration:')) parsed.duration = parseInt(tr.substring(9), 10) || '';
      else if (tr.toLowerCase().startsWith('timer:')) parsed.timerMode = tr.substring(6).trim().toUpperCase();
      else if (tr.startsWith('Font:')) parsed.fontName = tr.substring(5).trim();
      else if (tr.startsWith('MathMode:')) parsed.mathMode = tr.substring(9).trim().toUpperCase();
      else if (tr.startsWith('[FORMAT_WATERMARK:')) {
        const wm = tr.replace('[FORMAT_WATERMARK:', '').replace(']', '').trim();
        if (wm === 'PURE_HTML') parsed.mathMode = 'HTML';
        else if (wm === 'LATEX') parsed.mathMode = 'LATEX';
      } else if (tr.startsWith('Rules:')) parsed.rules = tr.substring(6).trim().split('|').filter(Boolean);
      else if (tr.startsWith('AudioBg:')) parsed.audio.bg = tr.substring(8).trim();
      else if (tr.startsWith('AudioStart:')) parsed.audio.start = tr.substring(11).trim();
      else if (tr.startsWith('AudioSubmit:')) parsed.audio.submit = tr.substring(12).trim();
    } else if (mode === 'constants') {
      const idx = tr.indexOf(':');
      if (idx > 0) parsed.constants.push({ name: tr.substring(0, idx).trim(), value: tr.substring(idx + 1).trim() });
    } else if (mode === 'questions' && curSec) {
      if (/^QType\s*:/i.test(tr)) {
        curQ = {
          type: tr.replace(/^QType\s*:/i, '').trim().toUpperCase(),
          text: '', options: [], correct: 0, correctNat: '', image: '', table: ''
        };
        parsed.questionsBySection[curSec].push(curQ);
        lastField = 'type';
      } else if (/^Q\s*:/i.test(tr)) {
        if (!curQ || curQ.text !== '') {
          curQ = { type: 'MCQ', text: '', options: [], correct: 0, correctNat: '', image: '', table: '' };
          parsed.questionsBySection[curSec].push(curQ);
        }
        curQ.text = tr.replace(/^Q\s*:/i, '').trim();
        lastField = 'Q';
      } else if (/^O\s*:/i.test(tr) && curQ && curQ.type !== 'NAT') {
        curQ.options.push(tr.replace(/^O\s*:/i, '').trim());
        lastField = 'O';
      } else if (/^A\s*:/i.test(tr) && curQ) {
        const val = tr.replace(/^A\s*:/i, '').trim();
        if (curQ.type === 'NAT') {
          curQ.correctNat = val;
          lastField = 'A';
        } else {
          const singleBn = BN_OPT_MAP[val];
          const singleNum = /^[1-9]$/.test(val) ? parseInt(val, 10) - 1 : -1;
          const singleEn = val.replace(/[^a-zA-Z]/g, '');
          if (singleBn !== undefined) {
            curQ.correct = singleBn;
            lastField = 'A';
          } else if (singleNum >= 0) {
            curQ.correct = singleNum;
            lastField = 'A';
          } else if (val.length <= 3 && singleEn.length === 1) {
            curQ.correct = singleEn.toUpperCase().charCodeAt(0) - 65;
            lastField = 'A';
          } else {
            if (lastField === 'Q') curQ.text += '\n' + tr;
            else if (lastField === 'O' && curQ.options.length > 0) curQ.options[curQ.options.length - 1] += '\n' + tr;
          }
        }
      } else if (/^T\s*:/i.test(tr) && curQ) {
        curQ.table = tr.replace(/^T\s*:/i, '').trim();
        lastField = 'T';
      } else if (/^I\s*:/i.test(tr) && curQ) {
        const imgUrl = tr.replace(/^I\s*:/i, '').trim();
        if (imgUrl === '[IMAGE]' || imgUrl === '[IMAGE_PLACEHOLDER]') curQ.image = 'PLACEHOLDER';
        else if (/^(http|data:|\.?\.\/)/i.test(imgUrl)) { curQ.image = imgUrl; lastField = 'I'; }
        else {
          if (lastField === 'Q') curQ.text += '\n' + tr;
          else if (lastField === 'O' && curQ.options.length > 0) curQ.options[curQ.options.length - 1] += '\n' + tr;
        }
      } else if (curQ && tr) {
        if (lastField === 'Q') curQ.text += '\n' + tr;
        else if (lastField === 'O' && curQ.options.length > 0) curQ.options[curQ.options.length - 1] += '\n' + tr;
        else if (lastField === 'T') curQ.table += ' ' + tr;
      }
    }
  });

  parsed.sections.forEach((sec) => {
    (parsed.questionsBySection[sec.name] || []).forEach((q) => {
      if (q.text.includes('[IMAGE]') || q.text.includes('[IMAGE_PLACEHOLDER]')) {
        q.image = 'PLACEHOLDER';
        q.text = q.text.replace(/\[IMAGE\]/gi, '').replace(/\[IMAGE_PLACEHOLDER\]/gi, '').trim();
      }
      q.options = q.options.map((opt) => {
        if (opt.includes('[IMAGE]') || opt.includes('[IMAGE_PLACEHOLDER]')) {
          return opt.replace(/\[IMAGE\]/gi, '').replace(/\[IMAGE_PLACEHOLDER\]/gi, '').trim() + '||IMG:PLACEHOLDER||';
        }
        return opt;
      });
    });
  });

  return parsed;
}

export function generateCBTString(appState) {
  let out = `[EXAM_INFO]\n`;
  if (appState.agencyName) out += `Agency: ${appState.agencyName}\n`;
  if (appState.examTitle) out += `Title: ${appState.examTitle}\n`;
  if (appState.examSubtitle) out += `Subtitle: ${appState.examSubtitle}\n`;
  if (appState.duration) out += `Duration: ${appState.duration}\n`;
  out += `Timer: ${appState.timerMode}\nFont: ${appState.fontName}\nMathMode: ${appState.mathMode}\n`;
  out += `${appState.mathMode === 'LATEX' ? '[FORMAT_WATERMARK: LATEX]' : '[FORMAT_WATERMARK: PURE_HTML]'}\n`;

  if (appState.rules.length) out += `Rules: ${appState.rules.join('|')}\n`;
  if (appState.audio.bg) out += `AudioBg: ${appState.audio.bg}\n`;
  if (appState.audio.start) out += `AudioStart: ${appState.audio.start}\n`;
  if (appState.audio.submit) out += `AudioSubmit: ${appState.audio.submit}\n`;
  if (appState.constants.length) {
    out += `\n[CONSTANTS]\n`;
    appState.constants.forEach((c) => { out += `${c.name}: ${c.value}\n`; });
  }

  appState.sections.forEach((s) => {
    out += `\n[SECTION:${s.name}|Marks:${s.marks}|Neg:${s.negative}|MaxAtt:${s.maxAttempts}]\n`;
    (appState.questionsBySection[s.name] || []).forEach((q) => {
      out += `QType: ${q.type || 'MCQ'}\n`;
      let cleanQText = (q.text || '').replace(/\r?\n/g, '\\n');
      if (q.image === 'PLACEHOLDER') cleanQText += `\n[IMAGE]`;
      out += `Q: ${cleanQText}\n`;

      if (q.type === 'NAT') {
        out += `A: ${q.correctNat || ''}\n`;
      } else {
        q.options.forEach((o) => {
          let cleanOpt = (o || '').replace(/\r?\n/g, '\\n');
          if (cleanOpt.includes('||IMG:PLACEHOLDER||')) {
            cleanOpt = cleanOpt.replace('||IMG:PLACEHOLDER||', '') + ' [IMAGE]';
          }
          out += `O: ${cleanOpt.trim()}\n`;
        });
        out += `A: ${String.fromCharCode(65 + (q.correct || 0))}\n`;
      }
      if (q.table) out += `T: ${q.table.replace(/\r?\n/g, '')}\n`;
      if (q.image && q.image !== 'PLACEHOLDER') out += `I: ${q.image}\n`;
    });
  });
  return out;
}

export function buildAIPrompt(appState) {
  let sectionStr = '';
  appState.sections.forEach((s) => {
    sectionStr += `[SECTION:${s.name}|Marks:${s.marks}|Neg:${s.negative}|MaxAtt:${s.maxAttempts}]\n`;
  });

  const modeSpecificRules =
    appState.mathMode === 'LATEX'
      ? `CRITICAL MATH & IMAGE RULES:
- You MUST extract ALL mathematical equations, variables, and scientific notation using ONLY standard LaTeX wrapped EXACTLY in $ (inline) or $$ (display block).
- DO NOT use \\( ... \\) or \\[ ... \\]. Use ONLY $ and $$.
- MULTIPLICATION RULE: NEVER use the asterisk '*' for multiplication in math (e.g. $2 * 3$ breaks formatting). Always use \\times ($2 \\times 3$) or \\cdot ($2 \\cdot 3$).
- FORBIDDEN: NEVER write scientific units or constants in Bengali. Use standard LaTeX (e.g., $m/s^2$, $C$).
- REQUIRED: Always use LaTeX for Greek letters (\\alpha, \\beta, \\gamma) and arrows (\\rightarrow, \\rightleftharpoons).
- COMPLEX MATRICES: If a question contains a complex matrix, diagram, or chart, output EXACTLY \`[IMAGE]\` on a new line. NEVER use a single dot '.'.`
      : `CRITICAL HTML & IMAGE RULES:
- ABSOLUTELY NO LATEX. Do not use $ or \\frac or any backslashes like \\rightarrow.
- MULTIPLICATION RULE: Use standard multiplication sign '×' or '·'.
- ARROWS & SEQUENCES: In biological pathways, reactions, or developmental sequences, use the literal Unicode arrow '→' or '⇌'. NEVER write '\\rightarrow' or '$' in HTML mode.
- Use standard Unicode for symbols (π, α, β, ∑, ∫, √, →, ←, ⇌, ±, °, μ).
- Use raw HTML <sup>2</sup> for exponents and <sub>2</sub> for subscripts (e.g., H<sub>2</sub>O, Ca<sup>2+</sup>, 10<sup>5</sup>).
- COMPLEX DIAGRAMS: If a question contains a diagram, complex structure, or chart, output EXACTLY \`[IMAGE]\` on a new line. NEVER use a single dot '.'.`;

  return `SYSTEM INSTRUCTION: You are an expert Data Extraction AI. Extract EVERY SINGLE question from the provided document and format them EXACTLY into the strict line-by-line .CBT plain-text format specified below.

STRICT LINE-BREAK & FORMATTING CONTRACT (ALL LLMs — ChatGPT, Claude, Gemini, DeepSeek — MUST OBEY):
1. ONE TAG PER LINE (NEVER FLATTEN): Every directive and key ([EXAM_INFO], Agency:, Title:, Subtitle:, Duration:, Timer:, [FORMAT_WATERMARK: ...], [SECTION:...], QType:, Q:, T:, O:, A:, [IMAGE]) MUST start at column 0 on its OWN NEW LINE.
   - NEVER collapse multiple tags or options onto a single paragraph or line (NEVER write "Q: ... O: ... O: ...").
   - NEVER use markdown bullets (- O:) or bold keys (**Q:**).
   - Leave a blank line between consecutive questions for readability.
2. NEVER SKIP: Extract every single question in order. Strip leading question numbers (e.g. "1.", "Q2)") from Q: text.
3. MCQ FORMAT: Always emit 4 separate 'O:' lines (one per option). The 'A:' line must be a single letter (A, B, C, or D; use <§> if answer key is missing).
4. NAT FORMAT: DO NOT output any 'O:' lines. The 'A:' line must be the exact number, text, or range.
5. INTERNAL PARAGRAPH / LIST BREAKS:
   - Inside a 'Q:' value ONLY, use the literal two-character escape \\n whenever the question has multiple paragraphs or an internal list (1., 2., 3. or I., II., III. or A., B., C., D.).
   - Keep "Statement I:", "Statement II:", "Assertion A:", "Reason R:", "List-I:" and their text on the same line after \\n.
6. TEXT EMPHASIS: Preserve italics with *italic* (CRITICAL for scientific names like *Mangifera indica*) and bold with **bold**.
7. TABLES: Convert tables into a single-line minified HTML <table> starting with 'T: ' (consistent column count across rows).
8. HANDWRITING & ILLEGIBLE INPUT GUARD: NEVER hallucinate or guess unreadable handwriting, blurred numbers, or corrupted table cells. Output <§> for illegible words, <§_NUM> for illegible numbers, and <§_TBL> for ambiguous table cells.

${modeSpecificRules}

FORMAT BLUEPRINT & CONCRETE EXAMPLE (FOLLOW THIS EXACT LINE-BY-LINE STRUCTURE):
[EXAM_INFO]
Agency: NTA
Title: Mock Test - 01
Subtitle: Physics & Chemistry
Duration: 60
Timer: STOPWATCH
[FORMAT_WATERMARK: ${appState.mathMode === 'LATEX' ? 'LATEX' : 'PURE_HTML'}]

${sectionStr}QType: MCQ
Q: Read the statements:\\n**Statement I:** Force is a vector quantity.\\n**Statement II:** Speed is a scalar quantity.
O: Both Statement I and Statement II are correct
O: Both Statement I and Statement II are incorrect
O: Statement I is correct but Statement II is incorrect
O: Statement I is incorrect but Statement II is correct
A: A

QType: MCQ
Q: Match List-I with List-II:
T: <table><tr><th>List-I</th><th>List-II</th></tr><tr><td>A. Work</td><td>I. Joule</td></tr><tr><td>B. Power</td><td>II. Watt</td></tr></table>
O: A-I, B-II
O: A-II, B-I
O: A-I, B-I
O: A-II, B-II
A: A

QType: NAT
Q: The value of the charge is ____________ C.
A: 2.5-2.6

Now parse the attached document and output ONLY the raw .CBT code inside a \`\`\`text code block (with NO conversational intro or outro).`;
}
