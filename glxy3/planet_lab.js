import WebGLRenderer from './src/renderers/WebGLRenderer.js';
import { ProceduralPlanetTexture } from './src/utils/proceduralTextures.js';
// import { getPlanetColor } from './src/ui/StarSystemView.js';

// Types available in generator
const PLANET_TYPES = ['lava','rocky','terran','gas','ice','desert','ocean','toxic','crystal','volcanic'];

// Слайдеры, актуализированные под параметры ProceduralPlanetTexture
// Поддерживаются: waterLevel, polarCapSize и relief.*
const PARAM_CONFIG = [
  { key: 'waterLevel', label: 'Уровень воды', min: -1.0, max: 1.0, step: 0.01, path: ['waterLevel'] },
  { key: 'polarCapSize', label: 'Размер полярных шапок', min: 0.0, max: 0.5, step: 0.01, path: ['polarCapSize'] },
  { group: 'Континенты' },
  { key: 'continentsFreq', label: 'Частота континентов', min: 0.3, max: 1.2, step: 0.05, path: ['relief','continentsFreq'] },
  { key: 'continentsGain', label: 'Затухание континентов', min: 0.3, max: 0.8, step: 0.01, path: ['relief','continentsGain'] },
  { key: 'continentsOctaves', label: 'Октавы континентов', min: 1, max: 6, step: 1, integer: true, path: ['relief','continentsOctaves'] },
  { group: 'Горы' },
  { key: 'mountainFreq', label: 'Частота гор', min: 1.0, max: 4.0, step: 0.1, path: ['relief','mountainFreq'] },
  { key: 'mountainGain', label: 'Затухание гор', min: 0.4, max: 0.8, step: 0.01, path: ['relief','mountainGain'] },
  { key: 'mountainOctaves', label: 'Октавы гор', min: 1, max: 5, step: 1, integer: true, path: ['relief','mountainOctaves'] },
  { group: 'Развитие' },
  { key: 'developmentLevel', label: 'Уровень урбанизации', min: 0.0, max: 1.0, step: 0.01, path: ['developmentLevel'] },
];

// DOM refs
const canvas = document.getElementById('labCanvas');
const typeButtonsEl = document.getElementById('typeButtons');
const paramSlidersEl = document.getElementById('paramSliders');
const textureSizeEl = document.getElementById('textureSize');
const rotationSpeedEl = document.getElementById('rotationSpeed');
const rotationSpeedInputEl = document.getElementById('rotationSpeedInput');
const atmosphereHueEl = document.getElementById('atmosphereHue');
const atmosphereHueInputEl = document.getElementById('atmosphereHueInput');

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
let atmosphereHue = parseFloat(atmosphereHueEl.value);
let atmosphereColor = [...hueToRGB(atmosphereHue), 1];
let textureCanvas = null;
let developmentLevel = 0.0;

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
      // Set atmosphere color based on mapped planet color
      const mapped = getPlanetColor(planetType);
      atmosphereColor = [...mapped, 1];
      // Sync hue slider display to mapped color
      const mappedHue = rgbToHue(mapped[0], mapped[1], mapped[2]);
      atmosphereHue = mappedHue;
      atmosphereHueEl.value = Math.round(mappedHue);
      atmosphereHueInputEl.value = Math.round(mappedHue);
      buildParamSliders();
      regenerateTexture();
    });
    typeButtonsEl.appendChild(btn);
  });
}

// Build sliders for current params
function buildParamSliders() {
  paramSlidersEl.innerHTML = '';
  PARAM_CONFIG.forEach(cfg => {
    if (cfg.group) {
      const title = document.createElement('div');
      title.className = 'param-group-title';
      title.textContent = cfg.group;
      paramSlidersEl.appendChild(title);
      return;
    }

    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('label');
    label.textContent = cfg.label || cfg.key;
    label.setAttribute('for', `param-${cfg.key}`);

    const input = document.createElement('input');
    input.type = 'range';
    input.id = `param-${cfg.key}`;
    input.min = cfg.min;
    input.max = cfg.max;
    input.step = cfg.step;
    const initial = getParamByPath(cfg.path);
    input.value = initial;

    const num = document.createElement('input');
    num.type = 'number';
    num.min = cfg.min;
    num.max = cfg.max;
    num.step = cfg.step;
    num.value = formatValue(initial, cfg);

    input.addEventListener('input', () => {
      const v = cfg.integer ? parseInt(input.value, 10) : parseFloat(input.value);
      setParamByPath(cfg.path, v);
      num.value = formatValue(v, cfg);
      regenerateTexture();
    });

    num.addEventListener('input', () => {
      const v = cfg.integer ? parseInt(num.value, 10) : parseFloat(num.value);
      setParamByPath(cfg.path, v);
      input.value = String(v);
      regenerateTexture();
    });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(num);
    paramSlidersEl.appendChild(row);
  });
}

function getParamByPath(path) {
  if (!path || !path.length) return undefined;
  if (path[0] === 'developmentLevel') return developmentLevel;
  let obj = params;
  for (const key of path) {
    obj = obj?.[key];
    if (obj === undefined) break;
  }
  return obj;
}

function setParamByPath(path, value) {
  if (!path || !path.length) return;
  if (path[0] === 'developmentLevel') {
    developmentLevel = value;
    return;
  }
  let obj = params;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {};
    obj = obj[key];
  }
  obj[path[path.length - 1]] = value;
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
  // Hint to WebGLRenderer: texture content is static between regenerations
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
    rotationOffset,
    // City lights appearance
    cityLightsColor: [1.0, 0.85, 0.6],      // warm night lights
    cityLightIntensity: 1.0,                // emissive power at night
    cityDayColor: [0.75, 0.75, 0.78],       // metallic gray tint for day side
    cityDayIntensity: 0.25                  // subtle tint strength on day side
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

atmosphereHueEl.addEventListener('input', () => {
  atmosphereHue = parseFloat(atmosphereHueEl.value);
  atmosphereColor = [...hueToRGB(atmosphereHue), 1];
  atmosphereHueInputEl.value = Math.round(atmosphereHue);
  renderScene();
});

atmosphereHueInputEl.addEventListener('input', () => {
  atmosphereHue = parseFloat(atmosphereHueInputEl.value);
  atmosphereColor = [...hueToRGB(atmosphereHue), 1];
  atmosphereHueEl.value = atmosphereHue;
  renderScene();
});

// Init
params = getDefaultParams(planetType, textureSize);
buildTypeButtons();
buildParamSliders();
// Initialize atmosphere color from planet type mapping and sync hue slider
{
  const mapped = getPlanetColor(planetType);
  atmosphereColor = [...mapped, 1];
  const mappedHue = rgbToHue(mapped[0], mapped[1], mapped[2]);
  atmosphereHue = mappedHue;
  const mappedHueRounded = Math.round(mappedHue);
  atmosphereHueEl.value = mappedHueRounded;
  atmosphereHueInputEl.value = mappedHueRounded;
}
regenerateTexture();
requestAnimationFrame(tick);

// Utils
function hueToRGB(h) {
  const s = 0.85; // saturation
  const v = 0.9;  // value
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs(hh % 2 - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= hh && hh < 1) { r1 = c; g1 = x; b1 = 0; }
  else if (1 <= hh && hh < 2) { r1 = x; g1 = c; b1 = 0; }
  else if (2 <= hh && hh < 3) { r1 = 0; g1 = c; b1 = x; }
  else if (3 <= hh && hh < 4) { r1 = 0; g1 = x; b1 = c; }
  else if (4 <= hh && hh < 5) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  const m = v - c;
  return [r1 + m, g1 + m, b1 + m];
}

function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hexToRgb01(hex) {
  const h = hex.replace('#','');
  if (h.length !== 6) return [1,1,1];
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return [r/255, g/255, b/255];
}

function getPlanetColor(type) {
  const colors = {
    lava: ['#ff3300', '#ff5500', '#cc2200'],
    rocky: ['#996633', '#887755', '#aa8866'],
    terran: ['#0066cc', '#0088ee', '#0055aa'],
    gas: ['#ffdd88', '#eecc99', '#ffcc66'],
    ice: ['#aaddff', '#cceeff', '#ddeeff'],
    desert: ['#e6b84d', '#d4a24a', '#c49247'],
    ocean: ['#0066cc', '#0088ee', '#0055aa'],
    toxic: ['#66ff33', '#88ee44', '#55cc22'],
    crystal: ['#cc88ff', '#aa66dd', '#9955cc'],
    volcanic: ['#ff6600', '#ee5500', '#dd4400']
  };
  const palette = colors[type] || colors.rocky;
  const hex = palette[Math.floor(Math.random() * palette.length)];
  return hexToRgb01(hex);
}