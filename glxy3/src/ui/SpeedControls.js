// src/ui/SpeedControls.js
import { gameConfig } from '../config/gameConfig.js';
import { computeTotalHours } from '../utils/utils.js';

function ensurePanel() {
  let el = document.getElementById('sim-speed-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sim-speed-panel';
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.right = '12px';
    el.style.padding = '6px 8px';
    el.style.borderRadius = '10px';
    el.style.background = 'rgba(18, 20, 24, 0.6)';
    el.style.color = '#fff';
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1.2';
    el.style.backdropFilter = 'blur(3px)';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
    el.style.zIndex = '10001';
    el.style.pointerEvents = 'auto';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'stretch';
    el.style.gap = '4px';
    document.body.appendChild(el);
  } else {
    // Clear previous buttons if any were removed by clearUI()
    el.innerHTML = '';
  }
  return el;
}

function makeButton(label, title, value) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute('data-value', String(value));
  btn.style.cursor = 'pointer';
  btn.style.padding = '2px 2px';
  btn.style.borderRadius = '5px';
  btn.style.border = '1px solid rgba(255,255,255,0.25)';
  btn.style.background = 'rgba(36, 64, 100, 0.65)';
  btn.style.color = '#fff';
  btn.style.fontSize = '14px';
  btn.style.lineHeight = '1';
  btn.style.width = '20px';
  btn.style.userSelect = 'none';
  btn.style.outline = 'none';
  btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.25)';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const val = Number(btn.getAttribute('data-value'));
    gameConfig.ui.simulationSpeed = val;
    gameConfig.ui.simulationPaused = val === 0; // compatibility
    updateActive(btn.parentElement, val);
  });
  return btn;
}

function updateActive(container, speedVal) {
  [...container.querySelectorAll('button')].forEach(b => {
    const isActive = Number(b.getAttribute('data-value')) === speedVal;
    b.style.background = isActive ? 'rgba(72, 110, 160, 0.9)' : 'rgba(36, 64, 100, 0.65)';
    b.style.borderColor = isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)';
  });
}

export function initSpeedControls() {
  const panel = ensurePanel();
  if (panel._dateTimerId) { try { clearInterval(panel._dateTimerId); } catch (e) {} panel._dateTimerId = null; }
  const current = Number(gameConfig.ui.simulationSpeed ?? 1);

  const dateLine = document.createElement('div');
  dateLine.id = 'sim-speed-date';
  dateLine.style.display = 'flex';
  dateLine.style.alignItems = 'center';
  dateLine.style.justifyContent = 'flex-start';
  dateLine.style.color = '#fff';
  dateLine.style.opacity = '0.95';
  dateLine.style.whiteSpace = 'nowrap';
  dateLine.style.userSelect = 'none';

  function formatCalendar() {
    const cal = gameConfig.calendar;
    const y = Number(cal.year ?? 0);
    const m = Number(cal.month ?? 0);
    const d = Number(cal.day ?? 0);
    const h = Number(cal.hour ?? 0);
    const mpY = Number(cal.monthsPerYear ?? 12);
    const dpM = Number(cal.daysPerMonth ?? 30);
    const hpD = Number(cal.hoursPerDay ?? 24);
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d + 1).padStart(2, '0');
    const hh = String(Math.floor(h % hpD)).padStart(2, '0');
    const yy = String(y + 1);
    return `Дата: ${yy}.${mm}.${dd}, ${hh}:00`;
  }

  function updateDateLine() {
    void computeTotalHours();
    dateLine.textContent = formatCalendar();
  }

  const pauseBtn = makeButton('⏸', 'Пауза', 0);
  const slowBtn = makeButton('⏪︎', 'Медленно (0.3×)', 0.3);
  const normalBtn = makeButton('▶', 'Нормально (1×)', 1);
  const fastBtn = makeButton('⏩︎', 'Быстро (2×)', 2);
  const vfastBtn = makeButton('⏭', 'Очень быстро (5×)', 5);

  const buttonsRow = document.createElement('div');
  buttonsRow.style.display = 'inline-flex';
  buttonsRow.style.alignItems = 'center';
  buttonsRow.style.gap = '6px';

  buttonsRow.appendChild(pauseBtn);
  buttonsRow.appendChild(slowBtn);
  buttonsRow.appendChild(normalBtn);
  buttonsRow.appendChild(fastBtn);
  buttonsRow.appendChild(vfastBtn);

  panel.appendChild(dateLine);
  panel.appendChild(buttonsRow);

  updateActive(buttonsRow, current);
  updateDateLine();
  panel._dateTimerId = setInterval(updateDateLine, 250);
}