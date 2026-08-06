# প্রশ্নপত্র Maker — Question Paper Maker (stable version 1.1)

A browser-based tool for creating Bengali exam question papers.  
Two identical sets print on one A4 landscape sheet — cut the centre line and distribute.  
**No server. No login. Fully offline after first load.**

---

## Repository Structure

```
/
├── index.html              — Main application (single page)
├── app.js                  — All application logic
├── style.css               — Styling, print CSS, CSS variables
├── fonts/
│   ├── TiroBangla-Regular.woff2     — Bengali body font (REQUIRED)
│   ├── TiroBangla-Italic.woff2
│   ├── DMSerifText-Regular.woff2    — Title font
│   ├── Spectral-Regular.woff2       — Subtitle font
│   └── Outfit-Variable.woff2        — UI font
├── watermark/
│   └── default.png         — Default watermark image (replace with your own)
├── libs/
│   └── jszip.min.js        — JSZip library for ODT export (optional, CDN fallback)
└── README.md               — This file
```

### Getting the Fonts

Download these from Google Fonts and place in `/fonts/`:

| File | Google Fonts URL |
|------|-----------------|
| TiroBangla-Regular.woff2 | fonts.google.com/specimen/Tiro+Bangla |
| DMSerifText-Regular.woff2 | fonts.google.com/specimen/DM+Serif+Text |
| Spectral-Regular.woff2 | fonts.google.com/specimen/Spectral |
| Outfit-Variable.woff2 | fonts.google.com/specimen/Outfit |

> If fonts are missing, Google Fonts CDN is used as fallback (requires internet).

---

## How to Use

### Method 1 — Fill the Form

1. Open `index.html` in Chrome or Edge
2. Fill in **Exam Information** (class, subject, time)
3. Click **Add Section** to add each বিভাগ
4. Choose question type (MCQ or others) and add questions
5. Watch the **live preview** on the right update
6. Click **Print / PDF** — set paper to A4 Landscape, No margins

### Method 2 — OCR + QPF Paste (Fast)

1. Take a photo of an existing question paper
2. Use the **Gemini / ChatGPT prompt** below
3. Copy the AI output, click **Paste QPF** in the tool header
4. Paste and click **Apply & Fill Form**
5. Review and export

### Method 3 — Upload .qpf Backup

1. Click **Upload .qpf** in the header
2. Select a previously exported `.qpf` file
3. All fields auto-fill — edit and re-export

---

## Printing Instructions

In Chrome's print dialog:
- **Paper**: A4
- **Orientation**: Landscape
- **Margins**: None
- **Background graphics**: ✅ Enabled (for watermark)
- **Scale**: 100%

After printing, cut along the dotted centre line.  
For 2-page papers: print both pages, lay sheets side by side, then cut each.

---

## .qpf Format Specification

`.qpf` is a plain UTF-8 text file. Human-readable, OCR-friendly.  
Structural markers use English. Question content uses Bengali Unicode.

### Full Format

```
// Question Paper Format v1.0
// Lines starting with // are comments — ignored by parser

##META
TEACHER: Shibanjan Bera
TEST_NO: 28
CLASS: VII(WBBSE)
SUBJECT: Science
FULL_MARKS: 20
TIME: 30
FONT_SIZE: 11
MARGIN: 1.0
DIVIDER: dotted
SEC_LANG: bn
WATERMARK: default

##SECTION_KA
HEADING: সঠিক উত্তরটি নির্বাচন করো:
TYPE: mcq
MARKS_PER_Q: 1
OPT_STYLE: bn

Q: নিচের কোনটি লিপিড জাতীয় খাদ্যের উৎস?
OP_K: চিনি
OP_KH: মাছের তেল
OP_G: গম
OP_GH: সয়াবিন
Q_IMAGE: (optional — filename or omit)

Q: কোন ভিটামিনের অভাবে কুঁজো হয়ে যাওয়া বা হাড়ের বিকৃতি ঘটে?
OP_K: ভিটামিন A
OP_KH: ভিটামিন C
OP_G: ভিটামিন D
OP_GH: ভিটামিন K

##SECTION_KHA
HEADING: সংক্ষিপ্ত উত্তর দাও:
TYPE: short
MARKS_PER_Q: 1

Q: শূন্যস্থান পূরণ করো: গাজর ও পাকা আমে প্রচুর পরিমাণে ভিটামিন ______ থাকে।
Q: চিপস বা কুড়কুড়ে জাতীয় খাবারে প্রচুর পরিমাণে কৃত্রিম ক্ষতিকারক রং ও স্বাদ থাকে। (ঠিক না ভুল লেখো)

##SECTION_GA
HEADING: নীচের প্রশ্নগুলির উত্তর দাও:
TYPE: descriptive
MARKS_PER_Q: 2

Q: খাদ্যতন্তু বা রাফেজ (Roughage) আমাদের শরীরে কী কী কাজ করে?
Q_IMAGE_BELOW: (optional base64 or filename)

Q: রাতকানা ও স্কার্ভি রোগের লক্ষণগুলি কী কী?
TABLE_START: 2x3
রোগ | কারণ | লক্ষণ
রাতকানা | ভিটামিন A | রাতে দেখতে না পাওয়া
স্কার্ভি | ভিটামিন C | মাড়ি থেকে রক্ত পড়া
TABLE_END

##SECTION_GHA
HEADING: দীর্ঘ উত্তরধর্মী প্রশ্ন:
TYPE: long
MARKS_PER_Q: 3

Q: কোয়াশিওরকর ও ম্যারাসমাস রোগের মধ্যে দুটি প্রধান পার্থক্য লেখো।
Q: আমাদের শরীরে জলের তিনটি গুরুত্বপূর্ণ ভূমিকা আলোচনা করো।
DIAGRAM_SVG: (optional — base64 encoded SVG string)

##END
```

---

### Token Reference (Special Content in Question Text)

Use these tokens inside any `Q:` line:

| Token | Output | Example |
|-------|--------|---------|
| `[SUB:2]` | Subscript | H[SUB:2]O → H₂O |
| `[SUP:2]` | Superscript | x[SUP:2] → x² |
| `[CHEM:H2SO4]` | Chemical formula (auto-subscript) | H₂SO₄ |
| `[EQ:F=ma]` | Equation (italic) | *F=ma* |
| `[SYM:alpha]` | Greek/special symbol | α |
| `[SYM:ohm]` | Ohm symbol | Ω |
| `[SYM:degree]` | Degree symbol | ° |
| `[SYM:arrow]` | Arrow | → |
| `[SYM:darrow]` | Double arrow | ⇌ |
| `[SYM:pm]` | Plus-minus | ± |
| `[SYM:sqrt]` | Square root | √ |

**All symbol names:** alpha, beta, gamma, delta, epsilon, theta, lambda, mu, pi, sigma, omega, ohm, degree, infinity, arrow, darrow, times, div, approx, pm, neq, leq, geq, sqrt, micro

---

### Section Names in QPF

Section block headers use Bengali letter names spelled in English:

| Bengali | QPF block name |
|---------|---------------|
| ক | `##SECTION_KA` |
| খ | `##SECTION_KHA` |
| গ | `##SECTION_GA` |
| ঘ | `##SECTION_GHA` |
| ঙ | `##SECTION_UMA` |
| চ | `##SECTION_CHA` |

---

### Type Values

| Type | Meaning |
|------|---------|
| `mcq` | Multiple choice — requires `OP_K`, `OP_KH`, `OP_G`, `OP_GH` |
| `short` | Short answer (1–2 lines) |
| `descriptive` | Medium answer (3–5 lines) |
| `long` | Long/essay answer |

---

### Divider Options

`DIVIDER:` can be: `dotted` · `dashed` · `solid` · `text`

---

## OCR Prompts

### Gemini / ChatGPT Prompt (Photo → QPF)

Copy this prompt exactly. Upload the question paper photo and send with this text:

```
You are a question paper digitizer. Analyze this image of a printed question paper and extract ALL content into the .qpf format below. Follow every rule strictly.

RULES:
1. Start with ##META. Extract: TEACHER (look for "by [name]" near the title), TEST_NO (the number near "Test no."), CLASS, SUBJECT, FULL_MARKS (the number after "Full Marks:"), TIME (number only, in minutes).
2. Set FONT_SIZE: 11, MARGIN: 1.0, DIVIDER: dotted, SEC_LANG: bn, WATERMARK: default.
3. For each section (বিভাগ ক / খ / গ / ঘ etc.), create a ##SECTION_[NAME] block. Map: ক→KA, খ→KHA, গ→GA, ঘ→GHA, ঙ→UMA.
4. Inside each section: HEADING (exact Bengali instruction text), TYPE (mcq if options ক/খ/গ/ঘ or a/b/c/d appear; short if 1 mark without options; descriptive if 2 marks; long if 3+ marks), MARKS_PER_Q (the first number in the marks formula like "১ × ৪ = ৪"), OPT_STYLE (bn if Bengali options ক/খ/গ/ঘ, else en).
5. For each question write Q: followed by the EXACT Bengali text. Preserve all Bengali Unicode exactly.
6. For MCQ questions, immediately after Q: write OP_K, OP_KH, OP_G, OP_GH with option text only (no ক/খ prefix).
7. For subscripts use [SUB:x], superscripts use [SUP:x], chemical formulas use [CHEM:formula], equations use [EQ:text], Greek letters use [SYM:name].
8. If a question contains a table, write TABLE_START:rows×cols, then each row with pipe | separating cells, then TABLE_END.
9. End with ##END.
10. Output ONLY the .qpf content. No explanation. No markdown fences. No extra text. Start directly with // Question Paper Format v1.0.
```

---

### Shorter Prompt (if AI truncates long output)

```
Extract this question paper image to .qpf format v1.0. Rules: ##META block with TEACHER/TEST_NO/CLASS/SUBJECT/FULL_MARKS/TIME/FONT_SIZE:11/MARGIN:1.0/DIVIDER:dotted/SEC_LANG:bn/WATERMARK:default. Then ##SECTION_KA/KHA/GA/GHA blocks with HEADING/TYPE/MARKS_PER_Q/OPT_STYLE. Q: lines for each question, OP_K/OP_KH/OP_G/OP_GH for MCQ options. Use [SUB:x][SUP:x][CHEM:x][EQ:x][SYM:name] for special content. TABLE_START:rows×cols...TABLE_END for tables. End with ##END. Output only the raw text, no fences.
```

---

## Development Notes

### Build Steps

| Step | File | Description |
|------|------|-------------|
| ✅ Step 1 | index.html, style.css, app.js | Foundation, layout, info panel, settings |
| 🔲 Step 2 | app.js | QPF format lock + CSS variable system |
| 🔲 Step 3 | app.js | Section & question builders (MCQ + non-MCQ) |
| 🔲 Step 4 | app.js | Table editor, diagram canvas, image insertion |
| 🔲 Step 5 | app.js | Full QPF parser |
| 🔲 Step 6 | app.js | Preview renderer + overflow/fit logic |
| 🔲 Step 7 | style.css | Print CSS refinement |
| 🔲 Step 8 | app.js | ODT exporter (via JSZip) |
| 🔲 Step 9 | app.js | QPF exporter + filename logic |
| 🔲 Step 10 | README.md | Final documentation |

### Performance Design

- **50–80ms debounce** on all preview updates — no lag while typing
- **State-driven rendering** — all UI reads from `STATE` object
- **No framework** — vanilla JS only, zero build step
- **Image caching** — images stored as base64 in STATE, not re-read from disk
- **ResizeObserver** — diagram and image heights measured reactively

### Browser Support

Tested in: Chrome 120+, Edge 120+  
PDF export: Chrome/Edge only (best print engine)  
ODT export: All modern browsers  
Fonts: Requires Google Fonts CDN OR local font files in `/fonts/`

---

## License

MIT — Free to use, modify, and host.  
Fonts are subject to their respective licenses (SIL Open Font License for all Google Fonts used).
