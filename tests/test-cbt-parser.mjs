import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCBTData, generateCBTString, SAMPLE_CBT_TEXT } from '../cbt/js/cbt-parser.js';

test('parseCBTData preserves \\neq / \\nabla / \\nu and matrix \\\\n', () => {
  const raw = `[EXAM_INFO]
Title: Math Test
[SECTION:Sec A|Marks:2|Neg:0|MaxAtt:0]
QType: MCQ
Q: যদি $x \\neq 0$ এবং $\\nabla f = 0$ এবং $\\nu = 5$ হয়\\nএবং $\\begin{pmatrix} a & b \\\\n & d \\end{pmatrix}$:
O: ১
O: ২
O: ৩
O: ৪
A: খ`;

  const parsed = parseCBTData(raw);
  const q = parsed.questionsBySection['Sec A'][0];
  assert.match(q.text, /\\neq 0/);
  assert.match(q.text, /\\nabla f/);
  assert.match(q.text, /\\nu = 5/);
  assert.match(q.text, /\\\\n & d/);
  assert.match(q.text, /হয়\nএবং/);
  assert.equal(q.correct, 1); // খ -> index 1
  assert.equal(parsed.sections[0].negative, 0);
});

test('parseCBTData handles multi-line Q, O, T, and NAT ranges', () => {
  const raw = `[EXAM_INFO]
Title: Physics
Duration: 60
Timer: COUNTDOWN
[SECTION:NAT Sec|Marks:4|Neg:1|MaxAtt:2]
QType: NAT
Q: Line one
Line two with A: inside text
T: <table><tr>
<td>1</td></tr></table>
A: 2.5-3.5`;

  const parsed = parseCBTData(raw);
  assert.equal(parsed.duration, 60);
  assert.equal(parsed.timerMode, 'COUNTDOWN');
  const sec = parsed.sections[0];
  assert.equal(sec.maxAttempts, 2);
  const q = parsed.questionsBySection['NAT Sec'][0];
  assert.equal(q.type, 'NAT');
  assert.match(q.text, /Line one\nLine two with A: inside text/);
  assert.equal(q.table, '<table><tr> <td>1</td></tr></table>');
  assert.equal(q.correctNat, '2.5-3.5');
});

test('SAMPLE_CBT_TEXT round-trips through parseCBTData and generateCBTString', () => {
  const parsed = parseCBTData(SAMPLE_CBT_TEXT);
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.sections[0].negative, 0);
  const regenerated = generateCBTString(parsed);
  const reparsed = parseCBTData(regenerated);
  assert.equal(reparsed.examTitle, parsed.examTitle);
  assert.equal(reparsed.sections.length, 2);
  assert.equal(reparsed.questionsBySection[reparsed.sections[0].name].length, 2);
});
