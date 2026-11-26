/* ODT Document Exporter with Readable Math/Chem Conversion & Embedded Images */
import { uid, safeDownload, toast } from '../shared/js/dom.js';
import { SYM, findClosingBracket } from '../shared/js/math-pipeline.js';
import { S, BN_O, EN_O, bn, sl, exFname, getActiveOrient } from './state.js';

function xmlEsc(s) {
  if (!s && s !== 0) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, '<text:line-break/>');
}

function latexToReadableUnicode(eq) {
  let s = String(eq || '').trim();
  const map = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\Delta': 'Δ',
    '\\epsilon': 'ε', '\\theta': 'θ', '\\Theta': 'Θ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\pi': 'π', '\\sigma': 'σ', '\\Sigma': 'Σ', '\\phi': 'φ', '\\psi': 'ψ',
    '\\omega': 'ω', '\\Omega': 'Ω', '\\times': '×', '\\cdot': '·', '\\div': '÷',
    '\\pm': '±', '\\mp': '∓', '\\neq': '≠', '\\ne': '≠', '\\leq': '≤', '\\geq': '≥',
    '\\approx': '≈', '\\equiv': '≡', '\\infty': '∞', '\\rightarrow': '→', '\\to': '→',
    '\\leftarrow': '←', '\\rightleftharpoons': '⇌', '\\triangle': '△', '\\angle': '∠',
    '\\perp': '⊥', '\\parallel': '∥', '\\degree': '°', '\\circ': '°', '\\in': '∈',
    '\\notin': '∉', '\\therefore': '∴', '\\because': '∵', '\\int': '∫', '\\sum': '∑'
  };
  for (const k in map) s = s.replace(new RegExp(k.replace(/\\/g, '\\\\') + '\\b', 'g'), map[k]);
  s = s.replace(/\\text\{([^{}]+)\}/g, '$1').replace(/\\mathrm\{([^{}]+)\}/g, '$1');
  let prev = '';
  let g = 0;
  while (prev !== s && g++ < 10) {
    prev = s;
    s = s.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
    s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '$1√($2)');
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  }
  return s.replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '');
}

/**
 * Converts QP tokens ([EQ:], [CHEM:], [SYM:], [SUB:], [SUP:]) into ODT XML spans.
 */
function textToOdtXml(rawText) {
  if (!rawText && rawText !== 0) return '';
  const str = String(rawText);
  let out = '';
  let i = 0;
  const prefixes = ['[EQ:', '[CHEM:', '[SYM:', '[SUB:', '[SUP:'];

  while (i < str.length) {
    let matched = null;
    for (const p of prefixes) {
      if (str.slice(i, i + p.length).toUpperCase() === p) {
        matched = p;
        break;
      }
    }
    if (matched) {
      const start = i + matched.length;
      const close = findClosingBracket(str, start);
      if (close !== -1) {
        const val = str.slice(start, close);
        const type = matched.slice(1, -1);
        if (type === 'EQ') out += xmlEsc(latexToReadableUnicode(val));
        else if (type === 'SYM') out += xmlEsc(SYM[val.trim().toLowerCase()] || val);
        else if (type === 'SUB') out += `<text:span text:style-name="SubSpan">${xmlEsc(val)}</text:span>`;
        else if (type === 'SUP') out += `<text:span text:style-name="SupSpan">${xmlEsc(val)}</text:span>`;
        else if (type === 'CHEM') {
          const chemXml = xmlEsc(val.replace(/->/g, '→').replace(/<->/g, '⇌')).replace(
            /([A-Za-z)\]])(\d+)/g,
            '$1<text:span text:style-name="SubSpan">$2</text:span>'
          );
          out += chemXml;
        }
        i = close + 1;
        continue;
      }
    }
    out += xmlEsc(str[i]);
    i++;
  }
  return out;
}

function dataUrlToZipEntry(dataUrl, picIdx) {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const path = `Pictures/img_${picIdx}.${ext}`;
  return { path, mime, b64: m[2] };
}

export async function exportODT() {
  if (typeof globalThis.JSZip === 'undefined') {
    toast('JSZip loading...', 'warn');
    return;
  }
  toast('Building ODT…', 'info', 6000);

  const TAB1 = '3.00cm', TAB2 = '6.50cm', TAB3 = '10.00cm';
  const isBn = S.paperLang !== 'full-en';
  const numF = (n) => (isBn ? bn(n) : String(n));

  const z = new globalThis.JSZip();
  z.file('mimetype', 'application/vnd.oasis.opendocument.text');
  const manifestEntries = [
    `<manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>`,
    `<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>`,
    `<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>`
  ];

  let picIdx = 1;
  const embedImageXml = (dataUrl, widthCm = 6) => {
    const entry = dataUrlToZipEntry(dataUrl, picIdx++);
    if (!entry) return '';
    z.file(entry.path, entry.b64, { base64: true });
    manifestEntries.push(`<manifest:file-entry manifest:media-type="${entry.mime}" manifest:full-path="${entry.path}"/>`);
    return `<text:p text:style-name="Center"><draw:frame draw:name="Pic${picIdx}" text:anchor-type="as-char" svg:width="${widthCm}cm" svg:height="4cm"><draw:image xlink:href="${entry.path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p>\n`;
  };

  const isPortrait = getActiveOrient() === 'portrait';
  const pagePropStr = isPortrait
    ? `fo:page-width="21cm" fo:page-height="29.7cm" style:print-orientation="portrait"`
    : `fo:page-width="29.7cm" fo:page-height="21cm" style:print-orientation="landscape"`;

  z.file(
    'styles.xml',
    `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties ${pagePropStr} fo:margin-top="${S.margin}cm" fo:margin-bottom="${S.margin}cm" fo:margin-left="${S.margin}cm" fo:margin-right="${S.margin}cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`
  );

  let body = '';
  const p = (txt, styleName) => `<text:p text:style-name="${styleName}">${txt}</text:p>\n`;
  const para = (xmlTxt) => p(xmlTxt, 'Body');
  const center = (txt) => p(xmlEsc(txt), 'Center');

  body += center(S.topTitle);
  const fmLabel = isBn ? 'পূর্ণমান' : 'Full Marks';
  const timeLabel = isBn ? 'সময়' : 'Time';
  const timeUnit = isBn ? 'মিনিট' : 'min';

  body += p(
    `<text:span text:style-name="InfoLeft">${xmlEsc(fmLabel)}: ${xmlEsc(numF(S.fullMarks))}</text:span><text:tab/>${xmlEsc(S.klass ? 'শ্রেণি: ' + S.klass : '')} — ${xmlEsc(S.subject)}<text:tab/>${xmlEsc(timeLabel)}: ${xmlEsc(numF(S.time))} ${xmlEsc(timeUnit)}`,
    'InfoRow'
  );
  if (S.inst) body += p(`<text:span text:style-name="Italic">${xmlEsc(S.inst)}</text:span>`, 'Body');

  S.sections.forEach((sec, idx) => {
    const L = sl(idx);
    let actualCount = 0;
    for (let i = 0; i < sec.questions.length; i++) {
      actualCount++;
      if (sec.questions[i].isOrNext) i++;
    }
    const countedQ = sec.answerAny && sec.answerAny < actualCount ? sec.answerAny : actualCount;
    const tot = (sec.mpq || 0) * countedQ;
    const prefix = isBn ? `বিভাগ '${L}'` : `Section '${L}'`;
    const mf = isBn ? `${numF(sec.mpq)} × ${numF(countedQ)} = ${numF(tot)}` : `${sec.mpq} × ${countedQ} = ${tot}`;

    body += center(prefix);
    body += p(`<text:span text:style-name="BoldSpan">${xmlEsc(sec.heading)}</text:span><text:tab/>${xmlEsc(mf)}`, 'SecRow');

    let qCounter = 1;
    sec.questions.forEach((q, qi) => {
      const isOrChild = qi > 0 && sec.questions[qi - 1].isOrNext;
      const numStr = isBn ? `${numF(idx + 1)}.${numF(qCounter)})` : `${idx + 1}.${qCounter})`;
      const prefixStr = isOrChild ? '   ' : `${numStr} `;
      body += para(xmlEsc(prefixStr) + textToOdtXml(q.text));

      if (sec.type === 'mcq') {
        const ls = sec.os === 'en' ? EN_O : BN_O;
        const opts = q.options.slice(0, 4);
        const maxLen = Math.max(0, ...opts.map((o) => o.length));
        if (maxLen <= 25) {
          body += p(opts.map((o, i) => `(${xmlEsc(ls[i])}) ${textToOdtXml(o)}`).join('<text:tab/>'), 'MCQOpts');
        } else {
          body += p(`(${xmlEsc(ls[0])}) ${textToOdtXml(opts[0])}<text:tab/>(${xmlEsc(ls[1])}) ${textToOdtXml(opts[1])}`, 'MCQOpts');
          body += p(`(${xmlEsc(ls[2])}) ${textToOdtXml(opts[2])}<text:tab/>(${xmlEsc(ls[3])}) ${textToOdtXml(opts[3])}`, 'MCQOpts');
        }
        if (q.img) body += embedImageXml(q.img, 5);
      }

      if (q.isOrNext && qi < sec.questions.length - 1) {
        body += center(isBn ? 'অথবা' : 'OR');
      }
      if (!q.isOrNext) qCounter++;

      (q.extra || []).forEach((ex) => {
        if (ex.type === 'table') {
          body += `<table:table table:name="T${uid()}">`;
          const colsCount = ex.rows[0] ? ex.rows[0].length : 1;
          body += `<table:table-column table:number-columns-repeated="${colsCount}"/>`;
          ex.rows.forEach((row) => {
            body += `<table:table-row>`;
            row.forEach((cell) => {
              body += `<table:table-cell office:value-type="string"><text:p>${textToOdtXml(cell)}</text:p></table:table-cell>`;
            });
            body += `</table:table-row>`;
          });
          body += `</table:table>`;
        } else if (ex.type === 'image' && ex.data) {
          body += embedImageXml(ex.data, 6);
        } else if (ex.type === 'diagram' && ex.png) {
          body += embedImageXml(ex.png, 6);
        } else if (ex.type === 'labeled') {
          if (ex.data) body += embedImageXml(ex.data, 6);
          if (ex.pointers?.length) {
            body += para(ex.pointers.map((pt) => `${xmlEsc(pt.label || '?')}) ________`).join('   '));
          }
        }
      });
    });
  });

  z.folder('META-INF').file(
    'manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">${manifestEntries.join('')}</manifest:manifest>`
  );

  const TAB_STYLE = `<style:tab-stops><style:tab-stop style:position="${TAB1}" style:type="left"/><style:tab-stop style:position="${TAB2}" style:type="left"/><style:tab-stop style:position="${TAB3}" style:type="left"/></style:tab-stops>`;
  z.file(
    'content.xml',
    `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.3"><office:automatic-styles><style:style style:name="Center" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.08cm"/><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-weight="bold" fo:font-family="DM Serif Text,serif"/></style:style><style:style style:name="InfoRow" style:family="paragraph"><style:paragraph-properties fo:text-align="justify" fo:margin-bottom="0.08cm">${TAB_STYLE}</style:paragraph-properties><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-family="DM Serif Text,serif"/></style:style><style:style style:name="SecHeading" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-top="0.12cm" fo:margin-bottom="0.04cm"/><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-weight="bold" fo:font-family="Tiro Bangla,serif"/></style:style><style:style style:name="SecRow" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.04cm">${TAB_STYLE}</style:paragraph-properties><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-weight="bold" fo:font-family="Tiro Bangla,serif"/></style:style><style:style style:name="Body" style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.06cm" fo:text-align="justify" fo:line-height="${Math.round(S.lineHeight * 100)}%"/><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-family="Tiro Bangla,serif"/></style:style><style:style style:name="MCQOpts" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.05cm">${TAB_STYLE}</style:paragraph-properties><style:text-properties fo:font-size="${S.fontSize}pt" fo:font-family="Tiro Bangla,serif"/></style:style><style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="BoldSpan" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="InfoLeft" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="SubSpan" style:family="text"><style:text-properties style:text-position="sub 58%"/></style:style><style:style style:name="SupSpan" style:family="text"><style:text-properties style:text-position="super 58%"/></style:style></office:automatic-styles><office:body><office:text>\n${body}</office:text></office:body></office:document-content>`
  );

  const blob = await z.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text', compression: 'DEFLATE' });
  safeDownload(blob, exFname('odt'));
  toast('ODT exported! Open with LibreOffice.', 'success', 5000);
}
