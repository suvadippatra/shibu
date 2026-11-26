# প্রশ্নপত্র Maker — CBT/QP Suite

> **Offline-first, all-in-one web toolkit** for Bengali academic question papers & NTA-style computer-based exams. No backend, no installation—just open and create.

[![Version](https://img.shields.io/badge/version-v4.4.1-blue)](#changelog) 
[![Status](https://img.shields.io/badge/status-Production%20Ready-success)](/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## 🚀 Quick Start

| Tool | Purpose | URL |
|------|---------|-----|
| **Landing Hub** | Unified bilingual launcher, `.qpf`/`.cbt` quick dropzone, PWA install | [`index.html`](https://suvadippatra.github.io/shibu/) |
| **QP Maker** | Author question papers with LaTeX math, Undo/Redo, ODT & `.cbt` export | [`qp/index.html`](https://suvadippatra.github.io/shibu/qp/) |
| **CBT Maker** | Build NTA/TCS-style single-file offline exams with timer & calculator | [`cbt/cbt_index.html`](https://suvadippatra.github.io/shibu/cbt/cbt_index.html) |
| **PDF Tools** | Merge, Bengali watermark, night reader invert, redact/mask box | [`add-watermark.html`](https://suvadippatra.github.io/shibu/add-watermark.html) |

**Works offline (PWA).** Serve over `localhost` or GitHub Pages.

---

## ✨ What You Can Do

### 📝 QP Maker (`qp/`)
- **Multi-format authoring:** MCQ, Short Answer, Descriptive, Long Answer, Labeled Diagrams & Tables in Bengali & English
- **Math rendering:** Balanced `[EQ:...]`, `[CHEM:...]`, `[SUB:...]`, `[SUP:...]`, `[SYM:...]` and `$...$` via KaTeX + HTML fallback
- **Smart layouts:** 4 view modes (Mono, Double, Quad, Booklet Flow) with Auto-Fit pagination & answer space controls
- **Undo / Redo & Live Validator:** 40-step history (`Ctrl+Z`/`Ctrl+Y`) plus live delimiter and Bengali scientific unit checks
- **Export formats:** Print/PDF, `.qpf` v1.1, `.odt` (with embedded images), and direct `.cbt` conversion

### 💻 CBT Maker (`cbt/`)
- **Flexible exam structure:** Multi-section builder with custom marks, negative marking, and max-attempt limits
- **Question types:** MCQ & NAT with image cropping (Cropper.js), tables, and math validation warnings
- **Math engines:** Native MathML, KaTeX (Offline Embedded), KaTeX (CDN), pure HTML fallback
- **Single-file output (`*_Final.html`):** Self-contained portable exam runtime with scientific calculator, virtual keyboard, dark mode, and printable report

### 🔧 PDF Tools (`pdf/`)
| Tool | What It Does |
|------|-------------|
| **Add Watermark** | Stamp Bengali (`Tiro Bangla` via Fontkit), image, or SVG watermarks across PDFs |
| **PDF Merge** | Combine & reorder multiple PDFs with ↑ / ↓ controls |
| **PDF Dark Reader** | Instant color-inverted night reading for bright PDFs |
| **PDF Redact / Mask** | Mask headers, footers, or watermark boxes with solid fills |

---

## 📁 Project Structure

```
shibu/
├── 📄 index.html                    # Unified Landing Hub + Quick Dropzone
├── 📄 manifest.webmanifest          # PWA manifest
├── 📄 sw.js                         # Offline Service Worker cache
├── 📄 add-watermark.html            # PDF tools (slim shells -> ./pdf/*.js)
├── 📄 pdf-merge.html
├── 📄 pdf-colour-invert.html
├── 📄 pdf-watermark-detect.html
│
├── 📁 shared/
│   ├── css/ (fonts.css, tokens.css)
│   └── js/  (dom.js, math-pipeline.js)
│
├── 📁 qp/                           # Modular QP Maker
│   ├── index.html, qp.css, main.js
│   └── state.js, qpf-parser.js, renderer.js, editor-ui.js, export-odt.js
│
├── 📁 cbt/                          # Modular CBT Builder + Exam Runtime
│   ├── cbt_index.html, Last.html
│   ├── css/cbt-editor.css
│   └── js/ (cbt-state.js, cbt-parser.js, cbt-preview.js, cbt-media.js, cbt-editor.js, cbt-compiler.js, main.js)
│
├── 📁 pdf/                          # Modular PDF Utilities
│   └── pdf-tools.css, watermark.js, merge.js, invert.js, redact.js
│
├── 📁 tests/                        # Zero-dependency Node unit tests
│   └── test-math-pipeline.mjs, test-cbt-parser.mjs, test-qpf-parser.mjs
│
├── 📁 libs/                         # Bundled JS/CSS libraries (offline)
├── 📁 fonts/                        # Canonical UI & Bengali fonts
└── 📁 watermark/                    # Watermark assets
```

---

## 🧪 Automated Tests

Run the built-in Node test suite (requires Node.js ≥ 18, zero external dependencies):

```bash
node --test tests/*.mjs
```

---

## 🌐 Deployment

### GitHub Pages (Recommended)

1. **Enable Pages:** Settings → Pages → Source: Deploy from branch → `main` / root
2. **Access:** `https://<your-username>.github.io/shibu/`
3. ✅ **Auto-update:** Changes to `main` deploy instantly

### Local Server

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```

Then open `http://localhost:8080/`

> ⚠️ **Note:** Use `localhost` instead of `file://`—ES Modules and local fonts require HTTP/HTTPS.

---

## 🔌 Dependencies

**Everything is bundled locally.** Internet is optional for:

| Resource | Purpose | Source | Fallback |
|----------|---------|--------|----------|
| KaTeX CSS v0.16.8 | Math styling | jsDelivr (CDN) | Unstyled but renders |
| Plus Jakarta Sans | UI font | Google Fonts | System sans-serif |
| KaTeX JS v0.16.8 | Online math engine | jsDelivr (CDN) | Local fallback |

**Bundled (offline):** pdf-lib, JSZip, fontkit, KaTeX JS (QP Maker), Bengali fonts, Cropper.js

---

## 🔧 What's New in v4.4.1

**9 Critical Bug Fixes:**
- ✅ KaTeX Online engine now renders equations (was showing raw LaTeX)
- ✅ Live preview sync for MCQ/NAT changes (instant, no compile)
- ✅ Preview uses actual render engine selection (was hardcoded)
- ✅ Responsive MCQ option layout (1–4 per row, adaptive)
- ✅ Section headers in preview match final output (true WYSIWYG)
- ✅ Missing `</body></html>` closing tags added
- ✅ Font filenames corrected to match bundled files
- ✅ KaTeX CSS loaded from CDN (was missing locally)
- ✅ Font parameter `Q_FONT_FAMILY` support in output template

**New Features:**
- ⭐ Real-time Bengali scientific notation validator with inline tooltips
- ⭐ "✏️ Corrections" modal with Bengali↔LaTeX conversion table
- ⭐ Enhanced AI extraction prompt (forbids Bengali notation)
- ⭐ Math engine detection in output (adapts KaTeX/MathML rendering)

---

## ✅ Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome / Chromium | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Mobile (Chrome/Firefox) | Latest | ✅ Responsive |

**Minimum requirement:** ES2020 support (optional chaining, nullish coalescing)

---

## ⚠️ Known Limitations

- **Client-side only:** All processing runs in browser. Large PDFs (>50 MB) may be slow on low-end hardware.
- **TiroBangla italic:** Single font file (no separate italic variant)—both italic & regular `@font-face` declarations use the same file.
- **UI font offline:** Plus Jakarta Sans loads from CDN; offline fallback is system sans-serif (layout unaffected).
- **Cropper location:** Image cropper requires `vendor/cropper/` to exist relative to `cbt/cbt_index.html`.
- **KaTeX CSS CDN-only:** Not bundled locally. Without internet, equations render unstyled (but functional).

---

## 💻 Development

**No build step required.** All tools are single HTML files.

```bash
# Clone & open
git clone https://github.com/suvadippatra/shibu.git
cd shibu

# Serve locally
python3 -m http.server 8080

# Open browser
# http://localhost:8080
```

### File Organization Tips
- All dependencies are already bundled in `libs/` and `fonts/`
- Don't delete `cbt/Last.html`—it's used at runtime as the exam template
- CDN resources are optional; local versions work offline

---

## 📋 Changelog

### v4.4.1 — August 2026
**Fixes (9):**
- KaTeX Online rendering (was raw LaTeX text)
- Live MCQ/NAT preview sync
- Preview render engine selection
- Responsive MCQ option layout
- WYSIWYG section headers
- Missing closing tags in `index.html`
- Font filename corrections
- KaTeX CSS CDN loading

**Features (4):**
- Bengali scientific notation validator
- `renderFraction()` LaTeX helper
- "✏️ Corrections" modal with Bengali→LaTeX table
- Math engine detection in output template

### v4.4.0 — May 2026
- Initial release: QP Maker + CBT Maker, LaTeX math, DOCX export, QPF format, PDF tools

---

## 🎓 Built For

Indian academic contexts—specifically:
- **State/CBSE/ICSE** question paper authoring in Bengali
- **NTA exams** (JEE, NEET, UGC NET)
- **School assessments** with flexible layouts and watermarking

---

## 👤 Credits

**Author:** [Suvadip Patra](https://github.com/suvadippatra)

**Built with:**
- [pdf-lib](https://pdf-lib.js.org/) — PDF manipulation
- [KaTeX](https://katex.org/) — Math rendering
- [JSZip](https://stuk.github.io/jszip/) — DOCX generation
- [fontkit](https://github.com/foliojs/fontkit) — Font embedding
- [Cropper.js](https://fengyuanchen.github.io/cropperjs/) — Image cropping
- [TiroBangla](https://fonts.google.com/specimen/Tiro+Bangla) — Bengali typography
- [DM Serif Text](https://fonts.google.com/specimen/DM+Serif+Text) — Latin typography

---

<div align="center">

Made with 💙 for Bengali education

**[Open QP Maker](https://suvadippatra.github.io/shibu/)** · **[Open CBT Maker](https://suvadippatra.github.io/shibu/cbt/cbt_index.html)**

*Last updated: September 12, 2026*

</div>
