# প্রশ্নপত্র Maker — CBT/QP Suite

A fully offline-capable, single-file web toolset for Bengali academic question paper authoring and NTA-style computer-based test generation. No backend, no database, no installation — just open in a browser.

**Version:** v4.4.1 · **Updated:** August 2026 · **Status:** Production Ready

---

## What's in This Repository

```
shibu/
├── index.html                   # QP Maker — main question paper authoring tool
├── add-watermark.html           # PDF watermark adder
├── pdf-colour-invert.html       # PDF colour inverter (dark mode for print)
├── pdf-merge.html               # PDF merger tool
├── pdf-watermark-detect.html    # PDF watermark detector/analyser
│
├── cbt/
│   ├── cbt_index.html           # CBT Maker — NTA-style exam builder
│   ├── Last.html                # CBT exam output template (used at runtime)
│   └── vendor/
│       └── cropper/             # Bundled image cropper (offline)
│           ├── cropper.min.css
│           └── cropper.min.js
│
├── libs/                        # Bundled JS libraries (offline)
│   ├── fontkit.umd.min.js       # Font embedding for DOCX export
│   ├── jszip.min.js             # ZIP/DOCX file generation
│   ├── katex.min.js             # Math rendering (offline fallback)
│   └── pdf-lib.min.js           # PDF manipulation engine
│
├── fonts/                       # Embedded Bengali/Latin fonts
│   ├── TiroBangla.woff2         # Bengali body font
│   └── DMSerifText.woff2        # Latin heading font
│
├── logo.png                     # App logo
├── watermark.svg                # Default watermark graphic
└── watermark/
    └── default.png              # Alternative watermark image
```

---

## Tools Overview

### 1. QP Maker — `index.html`

The primary question paper authoring environment for Bengali-medium academic content.

**Core capabilities:**
- Author MCQ, NAT (Numerical Answer Type), and Labeled-Diagram questions in Bengali and English
- Full LaTeX math support via KaTeX (local or CDN) and MathML
- Multiple print/view modes: 0-mirror portrait, 2-mirror landscape, 4-mirror landscape, continuous portrait
- Export to DOCX (with embedded fonts), printable HTML, and QPF (custom format)
- OCR integration and QPF import for digitising printed question papers
- Answer space controls and size sliders for layout customisation
- Watermark support with custom SVG or PNG overlays
- **New in v4.4.1:** Real-time Bengali scientific notation validator — warns when Bengali words like `জি সমান` are used instead of LaTeX (`$g = 9.8\text{ m/s}^2$`), with inline tooltip suggestions and red border feedback

**Navigation links from QP Maker:**
- → PDF Merge
- → CBT Maker (`cbt/cbt_index.html`)

---

### 2. CBT Maker — `cbt/cbt_index.html`

Builds NTA/TCS-style Computer-Based Test HTML files with a full exam UI.

**Core capabilities:**
- Multi-section exam builder (Section A, B, C with configurable marks and negative marking)
- MCQ and NAT question types with image support and Cropper.js integration
- Math rendering: Native MathML, KaTeX (local), KaTeX (CDN/online), Pure HTML fallback
- AI-assisted question extraction with a customisable prompt (sends to any LLM)
- Generates a self-contained single HTML exam file (`Last.html`-based output)
- Timer, calculator, physical constants panel, and question palette in generated exam

**New in v4.4.1 (9 bug fixes applied):**

| Fix | Description |
|-----|-------------|
| **1A** | KaTeX Online engine now renders correctly (was returning raw `\frac{}{}` text) |
| **1B** | MCQ correct-answer changes sync instantly to preview (no compile needed) |
| **1C** | NAT answer field changes sync instantly to preview |
| **1D** | Preview engine now uses the actual `appState.renderEngine` (was hardcoded) |
| **1E** | Preview section headers match output — true WYSIWYG authoring |
| **1F** | MCQ options layout responsively: 3–4 per row (short), 2 per row (medium), 1 per row (long) |
| **1G** | Enhanced AI extraction prompt explicitly forbids Bengali scientific notation; new "✏️ Corrections" modal with Bengali→LaTeX lookup table |

---

### 3. CBT Output Template — `cbt/Last.html`

This file is used at runtime by `cbt_index.html` as the base for generated exam HTML. Do not delete it.

**New in v4.4.1:**
- **2A:** `Q_FONT_FAMILY` parameter now respected by the template renderer
- **2B:** Math engine detection framework — output now adapts KaTeX/MathML injection based on what was selected in CBT Maker

---

### 4. PDF Tools

| Tool | File | Description |
|------|------|-------------|
| PDF Merge | `pdf-merge.html` | Combine multiple PDFs into one, with drag-reorder |
| PDF Colour Invert | `pdf-colour-invert.html` | Invert PDF colours for dark-mode-friendly print |
| PDF Watermark Detect | `pdf-watermark-detect.html` | Analyse PDF structure to identify and locate watermarks |
| Add Watermark | `add-watermark.html` | Apply a custom SVG or PNG watermark to a PDF |

All PDF tools use `pdf-lib.min.js` from the local `libs/` folder and work fully offline.

---

## Hosting on GitHub Pages

This repository is designed to be hosted directly on GitHub Pages with zero configuration.

1. Push to your repository's `main` branch
2. Enable GitHub Pages: **Settings → Pages → Source: Deploy from branch → main / root**
3. Access at `https://<username>.github.io/<repo-name>/`

**Entry point:** `index.html` (QP Maker)  
**CBT entry:** `cbt/cbt_index.html`

### CDN dependencies (requires internet)

The following are loaded from CDN when internet is available:

| Resource | Used by | Purpose |
|----------|---------|---------|
| KaTeX CSS v0.16.8 (jsDelivr) | `index.html`, `cbt/cbt_index.html` | Math equation styling |
| Plus Jakarta Sans (Google Fonts) | `index.html` | UI font (falls back to system sans-serif offline) |
| KaTeX JS v0.16.8 (jsDelivr) | `cbt/cbt_index.html` | Online math fallback if local fails |

All other assets (PDF-lib, JSZip, fontkit, KaTeX JS for QP Maker, Bengali fonts) are bundled in `libs/` and `fonts/` for full offline use.

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome / Chromium 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Mobile Chrome / Firefox | ✅ Responsive |

**Minimum requirement:** ES2020 support (optional chaining, nullish coalescing, etc.)

---

## Known Limitations

- **No server-side processing.** Everything runs in the browser. PDF operations on very large files (>50 MB) may be slow on low-end hardware.
- **TiroBangla italic:** Only one `TiroBangla.woff2` file is bundled (no separate italic variant). Both regular and italic `@font-face` declarations point to the same file — text renders correctly, but italic styling may not appear visually distinct.
- **Plus Jakarta Sans offline:** The UI font loads from Google Fonts CDN. Offline, the browser falls back to `Inter` or system UI fonts — layout is unaffected.
- **Image cropping in CBT Maker** requires `vendor/cropper/` to exist relative to `cbt/cbt_index.html`.
- **KaTeX CSS is CDN-only.** The `katex.min.css` file is not bundled locally. Without internet, math equation styling will be absent (equations still render but may look unstyled).

---

## Local Development

No build step required. Open any HTML file directly in a browser, or use a local server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then open `http://localhost:8080/`.

> **Note:** Serve from `localhost` rather than `file://` — some browser security restrictions block font loading and WASM from `file://` origins.

---

## Changelog

### v4.4.1 — August 2026
- Fixed: KaTeX Online rendering in CBT Maker (equations were displayed as raw LaTeX text)
- Fixed: Preview now updates instantly when MCQ/NAT answers are changed (no compile required)
- Fixed: Preview render engine was hardcoded; now uses the user's actual engine selection
- Fixed: MCQ option layout is now responsive (1–4 per row based on content length)
- Fixed: WYSIWYG section headers added to preview panel
- Fixed: `index.html` was missing `</body></html>` closing tags
- Fixed: Font filenames in `index.html` corrected to match bundled files (`TiroBangla.woff2`, `DMSerifText.woff2`)
- Fixed: `katex.min.css` now loaded from CDN (file was not bundled in `libs/`)
- Added: Bengali scientific notation validator in QP Maker with real-time red-border feedback and LaTeX tooltip suggestions
- Added: `renderFraction()` LaTeX fraction rendering helper in QP Maker
- Added: "✏️ Corrections" modal in CBT Maker with Bengali→LaTeX conversion lookup table and SI units reference
- Added: Enhanced AI extraction prompt that explicitly forbids Bengali notation for scientific units and Greek letters
- Added: Font type parameter (`Q_FONT_FAMILY`) support in `Last.html` output template
- Added: Math engine detection in `Last.html` (output adapts to KaTeX/MathML based on CBT Maker selection)

### v4.4.0 — May 2026
- Initial CBT/QP Maker release with multi-section support, LaTeX math, DOCX export, QPF format, and PDF tools

---

## Credits

Developed by [Suvadip Patra](https://github.com/suvadippatra)  
Built for Indian academic contexts — Bengali-medium question paper authoring and NTA-style CBT generation.

Libraries used: [pdf-lib](https://pdf-lib.js.org/) · [KaTeX](https://katex.org/) · [JSZip](https://stuk.github.io/jszip/) · [fontkit](https://github.com/foliojs/fontkit) · [Cropper.js](https://fengyuanchen.github.io/cropperjs/)

---

*Last updated: August 8, 2026*
