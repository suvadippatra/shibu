# Shibu's — প্রশ্নপত্র & CBT Suite

> A browser-based toolkit for creating Bengali and English question papers, building computer-based exams, and working with PDFs. No account or backend is required; your work is processed in the browser.

[![Status](https://img.shields.io/badge/status-Active-success)](https://suvadippatra.github.io/shibu/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🌐 What You Can Do

### 📝 Create Question Papers

Use the QP Maker to prepare Bengali or English papers for print or digital use:

- Create MCQ, short-answer, descriptive, and long-answer questions
- Add labelled diagrams, tables, and images
- Typeset mathematics and chemistry, including LaTeX-style equations, formulas, symbols, subscripts, and superscripts
- Choose Mono, Double, Quad, or Booklet Flow layouts
- Adjust pagination and answer space, and preview the paper while editing
- Validate math delimiters and use undo/redo while editing
- Print or save as PDF, export to ODT, save/import `.qpf`, or convert to CBT format

**Open:** [QP Maker](https://suvadippatra.github.io/shibu/qp/)

### 💻 Build CBT Exams

Create portable, single-file computer-based exams, including NTA/JEE/NEET-style assessments:

- Organize questions into sections with configurable marks, negative marking, and attempt limits
- Create MCQ and numerical-answer (NAT) questions
- Include images, cropped question images, tables, and math
- Choose from available math rendering modes, including MathML, KaTeX, and HTML fallback
- Compile a standalone `_Final.html` exam for use online or offline
- Use the exam timer, scientific calculator, virtual keyboard, dark mode, and printable scorecard
- Import and export `.cbt` files and start from a sample exam

**Open:** [CBT Builder](https://suvadippatra.github.io/shibu/cbt/cbt_index.html)

### 📄 Work with PDFs

The PDF utilities run locally in your browser:

- Add Bengali text, image, or SVG watermarks
- Merge PDFs and reorder documents
- Invert PDF colours for dark/night reading
- Mask selected areas such as headers, footers, or watermark boxes

**Open:** [Shibu Suite](https://suvadippatra.github.io/shibu/)

### 🌍 Use the Suite

- Switch the landing page between Bengali and English
- Import `.qpf` and `.cbt` files by dropping them on the landing page; paste supported file text as an alternative
- Resume a recent question-paper draft and optionally reopen the last-used tool
- Try math and chemistry notation in the live playground
- Switch between light and dark themes
- Install the site as a PWA and opt in to caching the suite for offline use

## 🚀 Getting Started

Open the [Shibu Suite](https://suvadippatra.github.io/shibu/) and choose a tool. Offline use is available after the required site assets have been cached; see [Known Limitations](#known-limitations).

To run a local copy, serve the repository over HTTP (for example, with Python):

```bash
python3 -m http.server 8080
```

Then open **http://localhost:8080/**. Serving over HTTP is recommended instead of opening the files directly, since the suite uses JavaScript modules and browser features that require a secure context or localhost.

## 📦 Dependencies

The application libraries are bundled in `libs/` and `cbt/vendor/`:

| Library | Used for |
|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | PDF editing, merging, and watermark operations |
| [fontkit](https://github.com/foliojs/fontkit) | Embedding Bengali fonts in PDF output |
| [JSZip](https://stuk.github.io/jszip/) | Creating ODT exports |
| [KaTeX](https://katex.org/) and auto-render | Typesetting mathematics |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | Cropping images in the CBT editor |

Bengali and Latin fonts are provided in `fonts/`. The QP/CBT editors and PDF tools also use browser-native APIs and project modules; a package manager or build step is not required to use the hosted application.

## ⚠️ Known Limitations

- **Browser-based processing:** Files are handled in your browser and are not sent to a Shibu backend. Large PDFs or image-heavy exams can use significant memory and may run slowly on lower-powered devices.
- **Offline access is opt-in:** The landing page's **Enable Offline** control caches the listed suite assets. Offline use requires the site to have been opened online first and the cache operation to finish successfully.
- **Secure context required for PWA features:** Service workers and installation require HTTPS, or localhost for local use. Opening pages directly with `file://` does not provide the same support.
- **Export and rendering differences:** Printing, PDF output, fonts, and math layout may vary between browsers. Check the generated output before distributing or printing a paper.
- **Exam delivery:** The CBT builder creates a browser-based exam file; it does not provide hosted exam administration, candidate accounts, or server-side result collection.

## 🧪 Tests

Run the repository's automated tests with Node.js 18 or newer:

```bash
node --test tests/*.mjs
```

## Bugs & Feature Request

For this you have to [create an issue or request](https://github.com/suvadippatra/shibu/issues/new/choose). Or you can fork this repo if you want to use.

## 📁 Repository Contents

- `index.html` — bilingual landing hub, quick import, and math playground
- `qp/` — question-paper editor, renderer, and export modules
- `cbt/` — CBT editor, parser, compiler, and exam runtime
- `pdf/` — PDF utility modules
- `shared/` — shared styles and browser modules
- `libs/` — bundled third-party browser libraries
- `fonts/` — Bengali and Latin font files
- `tests/` — automated tests

## 📄 License

This project is released under the [MIT License](LICENSE).

---

<div align="center">

Made for Bengali and English texts. This website is vive coded: ideas are taken from real life problems, UI is designed manually.

**[Open QSuite](https://suvadippatra.github.io/shibu/)**

*Last updated: November 26, 2026*

</div>
