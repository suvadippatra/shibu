/* CBT Compiler: Injects Exam Data, Rules, Constants & Selected Math Engine into Last.html */
import { $, esc } from '../../shared/js/dom.js';
import { formatContent } from '../../shared/js/math-pipeline.js';
import { appState, showToast } from './cbt-state.js';
import { openModal } from './cbt-media.js';

let prevCompiledUrl = null;

export async function generateCBTHTML() {
  try {
    const resp = await fetch('./Last.html');
    if (!resp.ok) throw new Error('Cannot load ./Last.html');
    let txt = await resp.text();

    const examTitle = esc(appState.examTitle || 'Exam');
    const agencyName = esc(appState.agencyName || '');
    const subtitle = esc(appState.examSubtitle || '');

    txt = txt.replace(/<title>.*?<\/title>/, () => `<title>${examTitle}</title>`);
    txt = txt.replace(/<h2 style="color:var\(--primary\); margin-bottom: 5px;">.*?<\/h2>/, () => `<h2 style="color:var(--primary); margin-bottom: 5px;">${agencyName}</h2>`);
    // Match both legacy (#666) and dark-mode (var(--text-dark)) login heading
    txt = txt.replace(/<h1[^>]*data-cbt-slot="login-title"[^>]*>.*?<\/h1>|<h1 style="color:(?:#666|var\(--text-dark\)); margin-bottom: 5px;">.*?<\/h1>/i, () => `<h1 data-cbt-slot="login-title" style="color:var(--text-dark); margin-bottom: 5px;">${examTitle}</h1>`);
    txt = txt.replace(/<h2 style="margin:0; color:var\(--text-dark\);">.*?<\/h2>/, () => `<h2 style="margin:0; color:var(--text-dark);">${examTitle}</h2>`);
    txt = txt.replace(/<div class="exam-title">.*?<\/div>/, () => `<div class="exam-title">${examTitle}</div>`);
    txt = txt.replace(/<span class="exam-subtitle">.*?<\/span>/, () => `<span class="exam-subtitle">${subtitle}</span>`);

    txt = txt.replace(/const BACKGROUND_AUDIO_BASE64 = ".*?";/, () => `const BACKGROUND_AUDIO_BASE64 = ${JSON.stringify(appState.audio.bg || '')};`);
    txt = txt.replace(/const START_EXAM_AUDIO_B64 = ".*?";/, () => `const START_EXAM_AUDIO_B64 = ${JSON.stringify(appState.audio.start || '')};`);
    txt = txt.replace(/const SUBMIT_EXAM_AUDIO_B64 = ".*?";/, () => `const SUBMIT_EXAM_AUDIO_B64 = ${JSON.stringify(appState.audio.submit || '')};`);
    if (!appState.audio.bg) {
      txt = txt.replace(/<button class="tool-btn" id="btn-audio".*?<\/button>/i, '<button class="tool-btn hidden" id="btn-audio" style="display:none;"></button>');
    }

    const engineName =
      appState.renderEngine === 'HTML_FALLBACK'
        ? 'html_fallback'
        : appState.renderEngine === 'KATEX_ONLINE'
        ? 'katex_online'
        : appState.renderEngine === 'KATEX_LOCAL'
        ? 'katex_local'
        : 'mathml';
    txt = txt.replace(/window\.mathRenderEngine\s*=\s*['"].*?['"];/i, () => `window.mathRenderEngine = '${engineName}';`);

    const cHtml = appState.constants
      .map((c) => `<div class="const-card"><div class="const-text-line">${esc(c.name)} : <strong>${esc(c.value)}</strong></div></div>`)
      .join('');
    txt = txt.replace(
      /<!-- PARAMETER 5 \(Global\): List of Constants\. -->[\s\S]*?<!-- RESULT GATEWAY -->/i,
      () => `<!-- PARAMETER 5 (Global): List of Constants. -->\n<div class="const-list">\n${cHtml}\n</div>\n</div>\n</div>\n<!-- RESULT GATEWAY -->`
    );

    txt = txt.replace(/<div class="header-exam-title-row">.*?<\/div>/i, () => `<div class="header-exam-title-row">${examTitle}${subtitle ? ' : ' + subtitle : ''}</div>`);
    txt = txt.replace(
      /(<div class="print-secondary-header">\s*<!-- PARAMETER 6 \(Global\): Exam Name & Subtitle for Print Header\. -->\s*<div>).*?(<\/div>)/i,
      (_, p1, p2) => `${p1}${examTitle}${subtitle ? ' - ' + subtitle : ''}${p2}`
    );

    const effectiveDuration = parseInt(appState.duration, 10) || 180;
    txt = txt.replace(/const TIMER_MODE = '[^']*';/i, () => `const TIMER_MODE = '${appState.timerMode}';`);
    txt = txt.replace(/const EXAM_DURATION_MINS = \d+;/i, () => `const EXAM_DURATION_MINS = ${effectiveDuration};`);
    txt = txt.replace(/const Q_FONT_FAMILY = ".*?";/i, () => `const Q_FONT_FAMILY = ${JSON.stringify(appState.fontName)};`);

    let finalRules = [...appState.rules];
    const durText = `Total Duration: ${effectiveDuration} Minutes.`;
    const timerText =
      appState.timerMode === 'COUNTDOWN'
        ? 'Timer is in Countdown mode (time counts down to zero).'
        : 'Timer is in Stopwatch mode (counts up from zero).';

    finalRules = finalRules.map((r) => (r.toLowerCase().includes('duration') ? durText : r));
    if (!finalRules.some((r) => r.toLowerCase().includes('timer') || r.toLowerCase().includes('mode'))) {
      finalRules.push(timerText);
    }

    const rulesStr = finalRules.map((r, i) => `<p>${i + 1}. ${esc(r)}</p>`).join('');
    const instHtml = `<div class="inst-section"><h3>📋 Instructions</h3>${rulesStr}</div><div class="inst-section"><p>Please familiarize yourself with the status indicators used in the Question Palette:<br><span class="inst-status-icon circle status-ans"></span> <strong>Green:</strong> Answered.<br><span class="inst-status-icon square status-not-ans"></span> <strong>Red:</strong> Not Answered.<br><span class="inst-status-icon circle status-rev"></span> <strong>Purple:</strong> Marked for Review.<br><span class="inst-status-icon circle status-rev-ans"></span> <strong>Purple with Tick:</strong> Answered & Marked for Review (will be considered for evaluation).<br><span class="inst-status-icon circle" style="border:1px solid #ccc; color:#333"></span> <strong>White/Grey:</strong> Not Visited.</p><br><p style="color:var(--nta-red);"><strong>Critical Rule:</strong> If you attempt more questions than the maximum allowed in a specific section, only your first valid attempts (chronologically by question number) up to the limit will be evaluated.</p></div><div class="inst-section"><p>The Question Paper is divided into distinct <strong>Sections</strong>. Below is the section-wise distribution and marking schema:</p><h3>Marking Scheme</h3><table class="scheme-table"><thead><tr><th>Section</th><th>Total Qs</th><th>Max Attempt</th><th>Correct</th><th>Incorrect</th><th>Max Marks</th></tr></thead><tbody id="scheme-table-body"></tbody><tfoot id="scheme-table-foot"></tfoot></table></div>`;

    let instRegex = /\/\*<INST_START>\*\/[\s\S]*?\/\*<INST_END>\*\//i;
    if (!instRegex.test(txt)) instRegex = /(?:const|let|var)\s+EXAM_S_HTML\s*=\s*`[\s\S]*?`;/i;
    const escapedInst = instHtml.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/<\/script/gi, '<\\/script');
    txt = txt.replace(instRegex, () => `/*<INST_START>*/\nconst EXAM_S_HTML = \`${escapedInst}\`;\n/*<INST_END>*/`);

    let fontEmbedCss = '';
    if (String(appState.fontName || '').includes('Tiro Bangla')) {
      try {
        const fontResp = await fetch('../fonts/TiroBangla.woff2');
        if (fontResp.ok) {
          const buf = await fontResp.arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i += 8192) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          fontEmbedCss = `<style>@font-face{font-family:'Tiro Bangla';font-style:normal;font-weight:400;font-display:swap;src:url('data:font/woff2;base64,${btoa(bin)}') format('woff2');}</style>\n`;
        }
      } catch (_) {}
    }

    const cdnCssTag = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" onerror="this.onerror=null;this.href=\'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css\';">';
    const cdnJsTag = `\n<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js';"></script>\n<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/contrib/auto-render.min.js';" onload="if(typeof window.triggerMathRender==='function'){window.triggerMathRender();}"></script>\n`;

    let katexCSS = '';
    let katexJS = '';
    if (appState.mathMode === 'LATEX' && appState.renderEngine === 'KATEX_ONLINE') {
      katexCSS = cdnCssTag;
      katexJS = cdnJsTag;
    } else if (appState.mathMode === 'LATEX' && appState.renderEngine === 'KATEX_LOCAL') {
      try {
        const [cssText, jsText, autoText] = await Promise.all([
          fetch('../libs/katex.min.css').then((r) => (r.ok ? r.text() : '')),
          fetch('../libs/katex.min.js').then((r) => (r.ok ? r.text() : '')),
          fetch('../libs/auto-render.min.js').then((r) => (r.ok ? r.text() : ''))
        ]);
        if (!cssText || !jsText) throw new Error('Missing local KaTeX assets');
        const cdnAwareCss = cssText.replace(/(?:\.\.\/cbt\/fonts\/katex\/|fonts\/)/g, 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/fonts/');
        katexCSS = `<style>\n${cdnAwareCss}\n</style>`;
        katexJS = `\n<script>\n${jsText.replace(/<\/script/gi, '<\\/script')}\n${autoText.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
      } catch (_) {
        katexCSS = cdnCssTag;
        katexJS = cdnJsTag;
        showToast('Local KaTeX inline fallback failed; falling back to CDN.', 'warn');
      }
    }

    txt = txt
      .replace(/<!--\s*PARAMETER 11.*?-->/i, () => fontEmbedCss + katexCSS)
      .replace(/<!--\s*PARAMETER 12.*?-->/i, () => katexJS)
      .replace(/<!--\s*PARAMETER 11.*?-->/gi, '')
      .replace(/<!--\s*PARAMETER 12.*?-->/gi, '');

    const qb = [];
    for (const sec of appState.sections) {
      const qs = (appState.questionsBySection[sec.name] || []).map((q, i) => {
        const processedText = formatContent(q.text, appState.renderEngine, appState.mathMode, globalThis.katex);
        const processedTable = q.table ? formatContent(q.table, appState.renderEngine, appState.mathMode, globalThis.katex) : '';

        const finalOptionsHtmlReady = (q.options || []).map((o) => {
          let optText = o || '';
          let optImg = '';
          const imgMatch = optText.match(/\|\|IMG:(.+?)\|\|/);
          if (imgMatch) { optImg = imgMatch[1]; optText = optText.replace(imgMatch[0], ''); }
          let processedOpt = formatContent(optText, appState.renderEngine, appState.mathMode, globalThis.katex);
          if (optImg && optImg !== 'PLACEHOLDER') {
            processedOpt += `<br><img src="${esc(optImg)}" onclick="event.stopPropagation();openLightbox(this.src)" style="max-height:25vh; max-width:100%; object-fit:contain; border-radius:4px; margin-top:5px; border:1px solid #ccc; cursor:pointer; background:white;">`;
          }
          return `<div class="opt-body">${processedOpt}</div>`;
        });

        return {
          id: i + 1,
          type: q.type || 'MCQ',
          text: processedText,
          img: q.image && q.image !== 'PLACEHOLDER' ? q.image : '',
          table: processedTable,
          options: q.type !== 'NAT' ? finalOptionsHtmlReady : [],
          correct: q.type === 'NAT' ? q.correctNat || '' : q.correct,
          marksCorrect: sec.marks,
          marksWrong: q.type === 'NAT' ? 0 : sec.negative
        };
      });
      qb.push({
        sectionTitle: sec.name,
        marksCorrect: sec.marks,
        marksWrong: sec.negative,
        maxAttempts: sec.maxAttempts,
        questions: qs
      });
    }

    let qbRegex = /\/\*<QB_START>\*\/[\s\S]*?\/\*<\/?QB_END>\*\//i;
    if (!qbRegex.test(txt)) {
      qbRegex = /(?:const|let|var)\s+QUESTION_BANK\s*=\s*\[[\s\S]*?(?=\s*\/\/ ==========================================================)/i;
    }
    const safeQBJson = JSON.stringify(qb, null, 2).replace(/<\/script/gi, '<\\/script');
    const safeQBInject = `/*<QB_START>*/\nconst QUESTION_BANK = ${safeQBJson};\n/*</QB_END>*/`;
    txt = txt.replace(qbRegex, () => safeQBInject);

    const blob = new Blob([txt], { type: 'text/html; charset=utf-8' });
    if (prevCompiledUrl) URL.revokeObjectURL(prevCompiledUrl);
    prevCompiledUrl = URL.createObjectURL(blob);
    const link = $('downloadLinkHTML');
    link.href = prevCompiledUrl;
    link.download = `${appState.examTitle ? appState.examTitle.replace(/\s+/g, '_') : 'Exam'}_Final.html`;
    openModal('compileModal');
  } catch (e) {
    showToast('Error: ' + e.message + ' (Ensure Last.html is present)', 'error');
  }
}
