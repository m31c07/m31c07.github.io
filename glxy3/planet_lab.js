import WebGLRenderer from './src/renderers/WebGLRenderer.js';
import { ProceduralPlanetTexture } from './src/utils/proceduralTextures.js';
// import { getPlanetColor } from './src/ui/StarSystemView.js';

// Types available in generator
const PLANET_TYPES = ['lava','rocky','terran','gas','ice','desert','ocean','toxic','crystal','volcanic'];

// Слайдеры только для поддерживаемых параметров генератора
const PARAM_CONFIG = {
  waterLevel: { label: 'Уровень воды', min: -1.0, max: 1.0, step: 0.01 },
  polarCapSize: { label: 'Размер полярных шапок', min: 0.0, max: 0.4, step: 0.01 },
  overallNoiseScale: { label: 'Масштаб шума', min: 0.5, max: 6.0, step: 0.1 }
};

// DOM refs
const canvas = document.getElementById('labCanvas');
const typeButtonsEl = document.getElementById('typeButtons');
const paramSlidersEl = document.getElementById('paramSliders');
const textureSizeEl = document.getElementById('textureSize');
const rotationSpeedEl = document.getElementById('rotationSpeed');
const rotationSpeedInputEl = document.getElementById('rotationSpeedInput');
const devLevelEl = document.getElementById('developmentLevel');
const devLevelInputEl = document.getElementById('developmentLevelInput');

// Renderer setup
const renderer = new WebGLRenderer(canvas);
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Set identity camera (NDC space)
const identity = new Float32Array(16);
identity[0] = identity[5] = identity[10] = identity[15] = 1;
renderer.setCamera(identity, identity);

// State
let planetType = 'terran';
let params = null;
let textureSize = parseInt(textureSizeEl.value, 10);
let rotationOffset = 0;
let rotationSpeed = parseFloat(rotationSpeedEl.value);
let developmentLevel = devLevelEl ? parseFloat(devLevelEl.value) : 0.0;
let atmosphereColor = hexToRgbArray(getPlanetColor(planetType));
let textureCanvas = null;

// Utility to get default params for type
function getDefaultParams(type, size) {
  const tmp = new ProceduralPlanetTexture(0.123, 0.456, 0, type, size);
  return { ...tmp.typeParams };
}

// Build type buttons
function buildTypeButtons() {
  typeButtonsEl.innerHTML = '';
  PLANET_TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t;
    btn.dataset.type = t;
    if (t === planetType) btn.classList.add('active');
    btn.addEventListener('click', () => {
      planetType = t;
      [...typeButtonsEl.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      params = getDefaultParams(planetType, textureSize);
      // Цвет ореола атмосферы на основе типа планеты
      atmosphereColor = hexToRgbArray(getPlanetColor(planetType));
      buildParamSliders();
      regenerateTexture();
    });
    typeButtonsEl.appendChild(btn);
  });
}

// Build sliders for current params
function buildParamSliders() {
  paramSlidersEl.innerHTML = '';
  Object.keys(PARAM_CONFIG).forEach(key => {
    const cfg = PARAM_CONFIG[key];
    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('label');
    label.textContent = cfg.label || key;
    label.setAttribute('for', `param-${key}`);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = `param-${key}`;
    input.min = cfg.min;
    input.max = cfg.max;
    input.step = cfg.step;
    const initial = params[key];
    input.value = initial;

    const num = document.createElement('input');
    num.type = 'number';
    num.min = cfg.min;
    num.max = cfg.max;
    num.step = cfg.step;
    num.value = formatValue(initial, cfg);

    input.addEventListener('input', () => {
      const v = cfg.integer ? parseInt(input.value, 10) : parseFloat(input.value);
      params[key] = v;
      num.value = formatValue(v, cfg);
      regenerateTexture();
    });

    num.addEventListener('input', () => {
      const v = cfg.integer ? parseInt(num.value, 10) : parseFloat(num.value);
      params[key] = v;
      input.value = String(v);
      regenerateTexture();
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(num);
    paramSlidersEl.appendChild(row);
  });
}

function formatValue(v, cfg) {
  if (cfg.integer) return String(v);
  return Number(v).toFixed(2);
}

// Texture generation using current params
function regenerateTexture() {
  const gen = new ProceduralPlanetTexture(0.123, 0.456, 0, planetType, textureSize, 0, developmentLevel);
  gen.typeParams = { ...params };
  textureCanvas = gen.generateTexture();
  // Текстура статична между регенерациями
  textureCanvas._isStaticTexture = true;
  renderScene();
}

// Render planet in center of screen (NDC space)
function renderScene() {
  const scene = { objects: [] };

  // Light from the left
  const starPos = [-0.7, 0];
  const planetPos = [0, 0];
  const pointSize = Math.min(canvas.width, canvas.height) * 0.7;

  scene.objects.push({
    type: 'planet2D',
    vertices: planetPos,
    position: planetPos,
    starPosition: starPos,
    pointSize,
    color: atmosphereColor,
    texture: textureCanvas,
    rotationOffset
  });

  renderer.render(scene);
}

// Animate rotation only (no re-generation)
let lastTime = performance.now();
function tick(now) {
  const dt = (now - lastTime) / 1000; // seconds
  lastTime = now;
  rotationOffset = (rotationOffset + rotationSpeed * dt) % 1;
  renderScene();
  requestAnimationFrame(tick);
}

// Wire global controls
textureSizeEl.addEventListener('change', () => {
  textureSize = parseInt(textureSizeEl.value, 10);
  params = getDefaultParams(planetType, textureSize);
  buildParamSliders();
  regenerateTexture();
});

rotationSpeedEl.addEventListener('input', () => {
  rotationSpeed = parseFloat(rotationSpeedEl.value);
  rotationSpeedInputEl.value = rotationSpeed.toFixed(3);
});

rotationSpeedInputEl.addEventListener('input', () => {
  rotationSpeed = parseFloat(rotationSpeedInputEl.value);
  rotationSpeedEl.value = rotationSpeed;
});

if (devLevelEl && devLevelInputEl) {
  devLevelEl.addEventListener('input', () => {
    developmentLevel = parseFloat(devLevelEl.value);
    devLevelInputEl.value = developmentLevel.toFixed(2);
    regenerateTexture();
  });
  devLevelInputEl.addEventListener('input', () => {
    developmentLevel = parseFloat(devLevelInputEl.value);
    devLevelEl.value = developmentLevel;
    regenerateTexture();
  });
}

// Init
params = getDefaultParams(planetType, textureSize);
buildTypeButtons();
buildParamSliders();
// Инициализация цвета атмосферы по типу планеты
atmosphereColor = hexToRgbArray(getPlanetColor(planetType));
regenerateTexture();
requestAnimationFrame(tick);

// Utils
function hexToRgbArray(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b, 1];
}

function getPlanetColor(type) {
  const colors = {
    lava: ['#ff3300', '#ff5500', '#cc2200'],
    rocky: ['#996633', '#887755', '#aa8866'],
    terran: ['#0066cc', '#0088ee', '#0055aa'],
    gas: ['#ffdd88', '#eecc99', '#ffcc66'],
    ice: ['#aaddff', '#cceeff', '#ddeeff'],
    desert: ['#e6b84d', '#d4a24a', '#c49247'], // Песочные оттенки
    ocean: ['#0066cc', '#0088ee', '#0055aa'], // Глубокие синие тона
    toxic: ['#66ff33', '#88ee44', '#55cc22'], // Ядовито-зеленые цвета
    crystal: ['#cc88ff', '#aa66dd', '#9955cc'], // Кристаллические фиолетовые
    volcanic: ['#ff6600', '#ee5500', '#dd4400'] // Оранжево-красные вулканы
  };
  const palette = colors[type] || colors.rocky;
  return palette[Math.floor(Math.random() * palette.length)];
}