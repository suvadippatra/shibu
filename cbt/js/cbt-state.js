/* CBT Maker Shared State, Rules, Constants & Memory Monitor */
import { $ } from '../../shared/js/dom.js';

export const defaultRules = [
  'The examination will consist of Objective Type Questions (MCQs) and Numerical Answer Types (NATs).',
  'Total Duration: 180 Minutes.',
  'The examination console is equipped with specific tools to aid your performance. A Zoom Slider is located in the top toolbar. An On-Screen Scientific Calculator is available for mathematical computations.',
  'For Fill-in-the-blank or NAT type questions, an on-screen Virtual Keyboard will automatically appear to facilitate entering text or decimal numbers.'
];

export const defaultConstants = [
  { name: 'The speed of light in vacuum (c)', value: '3 × 10⁸ m/s' },
  { name: "Planck's constant (h)", value: '6.626 × 10⁻³⁴ J·s' },
  { name: 'Universal gravitational constant (G)', value: '6.67 × 10⁻¹¹ N·m²/kg²' },
  { name: 'Elementary charge (e)', value: '1.602 × 10⁻¹⁹ C' }
];

export const appState = {
  agencyName: '',
  examTitle: '',
  examSubtitle: '',
  duration: '',
  timerMode: 'STOPWATCH',
  fontName: "system-ui, -apple-system, Roboto, 'Tiro Bangla', Arial, sans-serif",
  mathMode: 'LATEX',
  renderEngine: 'MATHML',
  rules: [...defaultRules],
  constants: JSON.parse(JSON.stringify(defaultConstants)),
  audio: { bg: '', start: '', submit: '' },
  sections: [],
  questionsBySection: {}
};

export const uiState = {
  activePreviewSection: '',
  activeQuestionIndex: 0,
  previewIsVisible: false,
  imageTimers: {}
};

export function showToast(msg, type = 'info') {
  const cont = $('toast-container');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.background = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--info)';
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : type === 'error' ? '🚨' : 'ℹ️';
  const body = document.createElement('span');
  body.textContent = String(msg);
  t.append(icon, body);
  cont.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.5s';
    setTimeout(() => t.remove(), 500);
  }, 3000);
}

export function startMemoryTracker() {
  setInterval(() => {
    const nodeCount = document.querySelectorAll('*').length;
    const bar = $('memStatusBar');
    const text = $('memStatusText');
    const badge = $('memStatusBadge');
    const percentage = Math.min((nodeCount / 15000) * 100, 100);
    if (bar && text && badge) {
      bar.style.width = `${percentage}%`;
      text.innerText = `${Math.round(percentage)}%`;
      if (percentage < 50) {
        bar.style.background = 'var(--success)'; text.style.color = 'var(--success)'; badge.innerText = 'Stable';
      } else if (percentage < 85) {
        bar.style.background = 'var(--warning)'; text.style.color = 'var(--warning)'; badge.innerText = 'Moderate Load';
      } else {
        bar.style.background = 'var(--danger)'; text.style.color = 'var(--danger)'; badge.innerText = 'High Memory Usage';
      }
    }
  }, 3000);
}
