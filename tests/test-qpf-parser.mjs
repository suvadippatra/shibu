import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQPF, serializeQPF, SAMPLE_BN_MATH_QPF } from '../qp/qpf-parser.js';

test('parseQPF preserves geometry AB // CD and strips fenced markers without dropping content', () => {
  const raw = `\`\`\`text
##META
TOP_TITLE: জ্যামিতি পরীক্ষা
CLASS: X
SUBJECT: গণিত
TIME: 45
PAPER_LANG: full-bn

##SECTION_A
HEADING: সঠিক উত্তর নির্বাচন করো:
TYPE: short
MARKS_PER_Q: 2.5

Q: প্রদত্ত চিত্রে AB // CD এবং EF ভেদক।
অনুপাত 3:4 হলে কোণ নির্ণয় করো।
##END
\`\`\``;

  const st = parseQPF(raw);
  assert.equal(st.topTitle, 'জ্যামিতি পরীক্ষা');
  assert.equal(st.sections.length, 1);
  assert.equal(st.fullMarks, 2.5);
  const q = st.sections[0].questions[0];
  assert.match(q.text, /AB \/\/ CD/);
  assert.match(q.text, /অনুপাত 3:4 হলে/);
});

test('parseQPF handles TABLE_START, LABELED_START, OR_NEXT, and OPT_STYLE case-insensitivity', () => {
  const raw = `##META
TOP_TITLE: Sample Test
##SECTION_A
TYPE: mcq
MARKS_PER_Q: 1
OPT_STYLE: EN
Q: First Q
OP_K: a
OP_KH: b
OP_G: c
OP_GH: d
OR_NEXT: true
Q: Alternate Q
OP_K: w
OP_KH: x
OP_G: y
OP_GH: z
##SECTION_B
TYPE: long
MARKS_PER_Q: 5
Q: Draw diagram and table
TABLE_START: 2x2
A | B
1 | 2
TABLE_END
LABELED_START
POINTER: A : ___
POINTER: B : ___
LABELED_END
##END`;

  const st = parseQPF(raw);
  assert.equal(st.sections[0].os, 'en');
  assert.equal(st.fullMarks, 6); // 1 MCQ pair (counted once) + 5 long = 6
  const longQ = st.sections[1].questions[0];
  assert.equal(longQ.extra[0].type, 'table');
  assert.deepEqual(longQ.extra[0].rows, [['A', 'B'], ['1', '2']]);
  assert.equal(longQ.extra[1].type, 'labeled');
  assert.equal(longQ.extra[1].pointers.length, 2);
});

test('SAMPLE_BN_MATH_QPF round-trips cleanly through serializeQPF and parseQPF', () => {
  const parsed = parseQPF(SAMPLE_BN_MATH_QPF);
  const serialized = serializeQPF(parsed);
  const reparsed = parseQPF(serialized);
  assert.equal(reparsed.sections.length, parsed.sections.length);
  assert.equal(reparsed.fullMarks, parsed.fullMarks);
  assert.equal(reparsed.sections[0].questions[0].text, parsed.sections[0].questions[0].text);
});

test('parseQPF safety guards handle math pipes in tables, overflow rows, unclosed tables, and missing sections', () => {
  const raw = `Q: Solve table
TABLE_START: 1x2
[EQ:|x|] | <§>
2 | 3
Q: Next question without TABLE_END`;

  const st = parseQPF(raw);
  assert.equal(st.sections.length, 1);
  assert.equal(st.sections[0].questions.length, 2);
  assert.deepEqual(st.sections[0].questions[0].extra[0].rows, [
    ['[EQ:|x|]', '<§>'],
    ['2', '3']
  ]);
  assert.equal(st.sections[0].questions[1].text, 'Next question without TABLE_END');
});
