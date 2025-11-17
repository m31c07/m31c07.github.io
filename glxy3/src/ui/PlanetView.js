// src/ui/PlanetView.js
import { generatePlanetTexture, generatePlanetTextureAsync } from '../utils/proceduralTextures.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CanvasControls } from './CanvasControls.js';
import { gameConfig } from '../config/gameConfig.js';
import { hexToRgbArray, advanceCalendarByHours, computeTotalHours } from '../utils/utils.js';


// getPlanetColor is imported from StarSystemView.js


// Рендерит планету с определенным смещением вращения и наклоном оси
// Функция для определения цвета планеты (перенесена из StarSystemView.js)



// Генерирует детализированную текстурированную битмап-луну, используя ту же систему, что и планеты, с вращением
// Deprecated: renderDetailMoonWithRotation - replaced by procedural textures in WebGL renderer


// src/ui/PlanetView.js
export function renderPlanetScreen(canvas, star, planet, planetIndex, onGalaxy, onSystem, onPlanet, onMoonClick = () => {}) {
  const renderer = new WebGLRenderer(canvas);
  const controls = new CanvasControls(canvas, planet, {
    renderer,
    cameraKey: 'planetCamera',
    zoomLimits: { min: 1.0, max: 1.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: 0 },
    disablePan: true,
    disableZoom: true
  });

  // Оверлей-канвас для подписей планеты и её лун
  const labelsCanvas = document.createElement('canvas');
  const labelsCtx = labelsCanvas.getContext('2d');
  function syncLabelsCanvasSize() {
    labelsCanvas.width = window.innerWidth;
    labelsCanvas.height = window.innerHeight;
  }
  syncLabelsCanvasSize();
  labelsCanvas.style.position = 'fixed';
  labelsCanvas.style.left = '0';
  labelsCanvas.style.top = '0';
  labelsCanvas.style.width = '100vw';
  labelsCanvas.style.height = '100vh';
  labelsCanvas.style.pointerEvents = 'none';
  labelsCanvas.style.zIndex = '100';
  document.body.appendChild(labelsCanvas);
  const onResizePlanet = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setSize(canvas.width, canvas.height);
    syncLabelsCanvasSize();
    projectionMatrix[0] = 2 / canvas.width;
    projectionMatrix[5] = -2 / canvas.height;
    controls.panBounds = { centerX: canvas.width/2, centerY: canvas.height/2, limit: 0 };
    controls.offsetX = window.innerWidth/2 - canvas.width/2 * controls.scale;
    controls.offsetY = window.innerHeight/2 - canvas.height/2 * controls.scale;
    try { draw(); } catch (_) {}
  };
  

  const projectionMatrix = new Float32Array([
    2 / canvas.width, 0, 0, 0,
    0, -2 / canvas.height, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1
  ]);
  const viewMatrix = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
  window.addEventListener('resize', onResizePlanet);

  // Планетный масштаб: увеличиваем визуальный размер в 10 раз
  const planetScale = 10;

  const pvTexSizes = gameConfig.ui?.textureSizes?.planet ?? { planet: 1024, moon: 512 };
  const lowResSize = 128;
  let textureInitQueue = [];
  let textureUpgradeQueue = [];
  let textureInitPtr = 0;
  let textureUpgradePtr = 0;
  let textureInitIdleId = null;
  let textureUpgradeIdleId = null;
  let isTextureGenRunning = false;

  // Инициализация вращения планеты
  {
    const totalHours = computeTotalHours();
    planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : 0;
  }

  if (planet) {
    textureInitQueue.push({ t: 'p' });
    textureUpgradeQueue.push({ t: 'p' });
  }

  function scheduleTextureInitializations() {
    function processNext() {
      if (isTextureGenRunning) return;
      if (textureInitPtr >= textureInitQueue.length) return;
      isTextureGenRunning = true;
      const item = textureInitQueue[textureInitPtr++];
      try {
        if (item.t === 'p') {
          if (!planet._texCanvasLow && !planet._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              planetIndex,
              planet.type,
              lowResSize,
              0,
              planet.developmentLevel ?? 0
            );
            planet._texCanvasLow = tex;
          }
        } else {
          const m = planet.moons?.[item.mIndex];
          if (m && !m._texCanvasLow && !m._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              planetIndex,
              m.type,
              lowResSize,
              item.mIndex + 1,
              m.developmentLevel ?? 0
            );
            m._texCanvasLow = tex;
          }
        }
      } finally {
        isTextureGenRunning = false;
        if (textureInitPtr < textureInitQueue.length) scheduleNext();
      }
    }
    function scheduleNext() {
      if (textureInitPtr >= textureInitQueue.length) return;
      if (typeof window.requestIdleCallback === 'function') {
        textureInitIdleId = window.requestIdleCallback(() => processNext(), { timeout: 100 });
      } else {
        textureInitIdleId = setTimeout(() => processNext(), 16);
      }
    }
    scheduleNext();
  }

  function scheduleTextureUpgrades() {
    function processNext() {
      if (isTextureGenRunning) return;
      if (textureUpgradePtr >= textureUpgradeQueue.length) return;
      isTextureGenRunning = true;
      const item = textureUpgradeQueue[textureUpgradePtr++];
      if (item.t === 'p') {
        generatePlanetTextureAsync(
          star.systemSeed,
          planetIndex,
          planet.type,
          pvTexSizes.planet,
          0,
          planet.developmentLevel ?? 0,
          { chunkRows: 12 }
        ).then((tex) => {
          planet._texCanvasHigh = tex;
          if (planet._texCanvasLow && planet._texCanvasLow !== tex) {
            try { renderer.deleteTextureForCanvas(planet._texCanvasLow); } catch (_) {}
            planet._texCanvasLow = null;
          }
        }).finally(() => {
          isTextureGenRunning = false;
          if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
        });
      } else {
        const m = planet.moons?.[item.mIndex];
        if (m) {
          generatePlanetTextureAsync(
            star.systemSeed,
            planetIndex,
            m.type,
            pvTexSizes.moon,
            item.mIndex + 1,
            m.developmentLevel ?? 0,
            { chunkRows: 12 }
          ).then((tex) => {
            m._texCanvasHigh = tex;
            if (m._texCanvasLow && m._texCanvasLow !== tex) {
              try { renderer.deleteTextureForCanvas(m._texCanvasLow); } catch (_) {}
              m._texCanvasLow = null;
            }
          }).finally(() => {
            isTextureGenRunning = false;
            if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
          });
        } else {
          isTextureGenRunning = false;
          if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
        }
      }
    }
    function scheduleNext() {
      if (textureUpgradePtr >= textureUpgradeQueue.length) return;
      if (typeof window.requestIdleCallback === 'function') {
        textureUpgradeIdleId = window.requestIdleCallback(() => processNext(), { timeout: 100 });
      } else {
        textureUpgradeIdleId = setTimeout(() => processNext(), 16);
      }
    }
    scheduleNext();
  }

  
  controls.scale = 1.0;
  controls.offsetX = window.innerWidth/2 - canvas.width/2 * controls.scale;
  controls.offsetY = window.innerHeight/2 - canvas.height/2 * controls.scale;

  const planetColorCached = hexToRgbArray(planet.color);

  let lastUpdateTime = performance.now();
  let lastFrameTime = 0;
  let lastCameraState = { offsetX: controls.offsetX, offsetY: controls.offsetY, scale: controls.scale };
  let animationId;
  

  function draw() {
    const scene = { objects: [], textBatches: [] };
    const now = performance.now();
    const dt = (now - lastUpdateTime)/1000;
    lastUpdateTime = now;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = (dt * speed) / secondsPerGameHour;
    const totalHours = advanceCalendarByHours(hoursDelta);
    gameConfig.ui.simulationPaused = speed === 0;
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const cameraChanged = !lastCameraState || Math.abs(lastCameraState.offsetX - offsetX) > 0.1 || Math.abs(lastCameraState.offsetY - offsetY) > 0.1 || Math.abs(lastCameraState.scale - scale) > 0.001;
    const targetFps = Number(gameConfig?.ui?.targetFps ?? 60);
    const minFrameMs = 1000 / targetFps;
    if (speed > 0) {
      if (now - lastFrameTime < minFrameMs) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = now;
    } else {
      if (!cameraChanged) {
        animationId = requestAnimationFrame(draw);
        return;
      }
    }
    window.actionButtons = [];
    lastCameraState = { offsetX, offsetY, scale };

    const cx = canvas.width/2;
    const cy = canvas.height/2;

    // Обновляем вращение планеты на основе календаря
    planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : planet._rotationOffset;
    planet._orbitProgress = (planet.initialOrbitAngle ?? 0) + ((planet.orbitSpeed ?? 0) * totalHours);

    const planetTexture = planet._texCanvasHigh || planet._texCanvasLow;

    // Planet center
    const planetColor = planetColorCached;
    const planetMult = planetScale * Math.max(30 / planet.size, 3);
    const phase = Math.sin(planet._orbitProgress ?? 0);
    const frontness = -phase;
    const depthFactor = 0.925 + 0.075 * frontness;
    const lightZ = frontness;
    const dirScale = 100;
    const starX = cx - Math.cos(planet._orbitProgress ?? 0) * dirScale;
    const starY = cy - Math.sin(planet._orbitProgress ?? 0) * dirScale * 0.5;
    
    scene.objects.push({
      type: 'planet2D',
      vertices: [cx, cy],
      position: [cx, cy],
      starPosition: [starX, starY],
      pointSize: (planet.size * planetMult) * controls.getCameraState().scale,
      color: planetColor,
      texture: planetTexture,
      rotationOffset: planet._rotationOffset,
      depthFactor,
      lightZ,
      drawMode: renderer.gl.POINTS
    });

    

    // Breadcrumb
    // Text rendering removed

    viewMatrix[0] = scale; viewMatrix[5] = scale; viewMatrix[12] = offsetX; viewMatrix[13] = offsetY;
    renderer.setCamera(projectionMatrix, viewMatrix);

    try { renderer.render(scene); } catch (e) { console.error(e); }
    if (cameraChanged) { drawPlanetLabels(); }
    animationId = requestAnimationFrame(draw);
  }

  function drawPlanetLabels() {
    const { showPlanetScreenLabels, planetScreenLabelZoomThreshold } = gameConfig.ui;
    const { offsetX, offsetY, scale } = controls.getCameraState();
    labelsCtx.clearRect(0, 0, labelsCanvas.width, labelsCanvas.height);
    if (!showPlanetScreenLabels || scale < (planetScreenLabelZoomThreshold ?? 0)) return;
    labelsCtx.font = '14px Arial';
    labelsCtx.textAlign = 'left';
    labelsCtx.textBaseline = 'middle';
    labelsCtx.shadowColor = 'rgba(0,0,0,0.55)';
    labelsCtx.shadowBlur = 3;
    labelsCtx.shadowOffsetX = 1;
    labelsCtx.shadowOffsetY = 1;

    const cx = canvas.width/2;
    const cy = canvas.height/2;
    const psx = cx * scale + offsetX;
    const psy = cy * scale + offsetY;

    // Подпись планеты
    labelsCtx.fillStyle = '#ffffff';
    const planetText = planet.name || `Планета ${planetIndex + 1}`;
    labelsCtx.fillText(planetText, (psx + 14), (psy - 6));

    
  }

  function cleanup() { 
    cancelAnimationFrame(animationId); 
    controls.destroy(); 
    // Clear interactive areas to avoid stale click targets after teardown
    window.actionButtons = [];
    if (renderer) { 
      try { renderer.cleanup(); } catch (e) { console.error('Renderer cleanup error (planet):', e); } 
    }
    try {
      if (textureInitIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureInitIdleId);
        } else {
          clearTimeout(textureInitIdleId);
        }
        textureInitIdleId = null;
      }
      if (textureUpgradeIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureUpgradeIdleId);
        } else {
          clearTimeout(textureUpgradeIdleId);
        }
        textureUpgradeIdleId = null;
      }
    } catch (_) {}
    window.removeEventListener('resize', onResizePlanet);
    try {
      if (labelsCanvas && labelsCanvas.parentNode) labelsCanvas.parentNode.removeChild(labelsCanvas);
    } catch (e) { console.error('Labels overlay cleanup error (planet):', e); }
  }
  scheduleTextureInitializations();
  scheduleTextureUpgrades();
  draw();
  return cleanup;
}

export function renderMoonScreen(canvas, star, planet, planetIndex, moon, moonIndex, onGalaxy, onSystem, onPlanet) {
  const renderer = new WebGLRenderer(canvas);
  const controls = new CanvasControls(canvas, moon, {
    renderer,
    cameraKey: 'satelliteCamera',
    zoomLimits: { min: 0.5, max: 3.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 }
  });

  // Оверлей-канвас для подписей луны и фоновой планеты
  const labelsCanvasMoon = document.createElement('canvas');
  const labelsCtxMoon = labelsCanvasMoon.getContext('2d');
  function syncLabelsCanvasMoonSize() {
    labelsCanvasMoon.width = window.innerWidth;
    labelsCanvasMoon.height = window.innerHeight;
  }
  syncLabelsCanvasMoonSize();
  labelsCanvasMoon.style.position = 'fixed';
  labelsCanvasMoon.style.left = '0';
  labelsCanvasMoon.style.top = '0';
  labelsCanvasMoon.style.width = '100vw';
  labelsCanvasMoon.style.height = '100vh';
  labelsCanvasMoon.style.pointerEvents = 'none';
  labelsCanvasMoon.style.zIndex = '100';
  document.body.appendChild(labelsCanvasMoon);
  const onResizeMoon = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setSize(canvas.width, canvas.height);
    syncLabelsCanvasMoonSize();
    projectionMatrix[0] = 2 / canvas.width;
    projectionMatrix[5] = -2 / canvas.height;
    controls.panBounds = { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 };
    try { draw(); } catch (_) {}
  };
  

  const projectionMatrix = new Float32Array([
    2 / canvas.width, 0, 0, 0,
    0, -2 / canvas.height, 0, 0,
    0, 0, 1, 0,
    -1, 1, 0, 1
  ]);
  const viewMatrix = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
  window.addEventListener('resize', onResizeMoon);

  // Инициализация вращения планеты и луны
  {
    const totalHours = computeTotalHours();
    planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : (planet._rotationOffset ?? 0);
    moon._rotationOffset = moon.dayLength ? ((totalHours / moon.dayLength) % 1) : (moon._rotationOffset ?? 0);
  }

  let lastUpdateTime = performance.now();
  let lastFrameTime = 0;
  let animationId;

  const satTexSizes = gameConfig.ui?.textureSizes?.satellite ?? { planet: 512, moon: 1024 };
  const lowResSize = 128;
  let textureInitQueue = [];
  let textureUpgradeQueue = [];
  let textureInitPtr = 0;
  let textureUpgradePtr = 0;
  let textureInitIdleId = null;
  let textureUpgradeIdleId = null;
  let isTextureGenRunning = false;
  const planetColorCachedMoonView = hexToRgbArray(planet.color);
  const moonColorCachedMoonView = hexToRgbArray(moon.color);

  textureInitQueue.push({ t: 'p' });
  textureUpgradeQueue.push({ t: 'p' });
  textureInitQueue.push({ t: 'm' });
  textureUpgradeQueue.push({ t: 'm' });

  function scheduleTextureInitializations() {
    function processNext() {
      if (isTextureGenRunning) return;
      if (textureInitPtr >= textureInitQueue.length) return;
      isTextureGenRunning = true;
      const item = textureInitQueue[textureInitPtr++];
      try {
        if (item.t === 'p') {
          if (!planet._texCanvasLow && !planet._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              planetIndex,
              planet.type,
              lowResSize,
              0,
              planet.developmentLevel ?? 0
            );
            planet._texCanvasLow = tex;
          }
        } else {
          if (!moon._texCanvasLow && !moon._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              planetIndex,
              moon.type,
              lowResSize,
              moonIndex + 1,
              moon.developmentLevel ?? 0
            );
            moon._texCanvasLow = tex;
          }
        }
      } finally {
        isTextureGenRunning = false;
        if (textureInitPtr < textureInitQueue.length) scheduleNext();
      }
    }
    function scheduleNext() {
      if (textureInitPtr >= textureInitQueue.length) return;
      if (typeof window.requestIdleCallback === 'function') {
        textureInitIdleId = window.requestIdleCallback(() => processNext(), { timeout: 100 });
      } else {
        textureInitIdleId = setTimeout(() => processNext(), 16);
      }
    }
    scheduleNext();
  }

  function scheduleTextureUpgrades() {
    function processNext() {
      if (isTextureGenRunning) return;
      if (textureUpgradePtr >= textureUpgradeQueue.length) return;
      isTextureGenRunning = true;
      const item = textureUpgradeQueue[textureUpgradePtr++];
      if (item.t === 'p') {
        generatePlanetTextureAsync(
          star.systemSeed,
          planetIndex,
          planet.type,
          satTexSizes.planet,
          0,
          planet.developmentLevel ?? 0,
          { chunkRows: 12 }
        ).then((tex) => {
          planet._texCanvasHigh = tex;
          if (planet._texCanvasLow && planet._texCanvasLow !== tex) {
            try { renderer.deleteTextureForCanvas(planet._texCanvasLow); } catch (_) {}
            planet._texCanvasLow = null;
          }
        }).finally(() => {
          isTextureGenRunning = false;
          if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
        });
      } else {
        generatePlanetTextureAsync(
          star.systemSeed,
          planetIndex,
          moon.type,
          satTexSizes.moon,
          moonIndex + 1,
          moon.developmentLevel ?? 0,
          { chunkRows: 12 }
        ).then((tex) => {
          moon._texCanvasHigh = tex;
          if (moon._texCanvasLow && moon._texCanvasLow !== tex) {
            try { renderer.deleteTextureForCanvas(moon._texCanvasLow); } catch (_) {}
            moon._texCanvasLow = null;
          }
        }).finally(() => {
          isTextureGenRunning = false;
          if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
        });
      }
    }
    function scheduleNext() {
      if (textureUpgradePtr >= textureUpgradeQueue.length) return;
      if (typeof window.requestIdleCallback === 'function') {
        textureUpgradeIdleId = window.requestIdleCallback(() => processNext(), { timeout: 100 });
      } else {
        textureUpgradeIdleId = setTimeout(() => processNext(), 16);
      }
    }
    scheduleNext();
  }

  function draw() {
    const scene = { objects: [], textBatches: [] };
    const now = performance.now();
    const dt = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = (dt * speed) / secondsPerGameHour;
    const totalHours = advanceCalendarByHours(hoursDelta);
    gameConfig.ui.simulationPaused = speed === 0; // keep compatibility

    const targetFps = Number(gameConfig?.ui?.targetFps ?? 60);
    const minFrameMs = 1000 / targetFps;
    if (speed > 0) {
      if (now - lastFrameTime < minFrameMs) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = now;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Обновляем вращение планеты и луны на основе календаря
    planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : planet._rotationOffset;
    
    moon._rotationOffset = moon.dayLength ? ((totalHours / moon.dayLength) % 1) : moon._rotationOffset;

    const planetTexture = planet._texCanvasHigh || planet._texCanvasLow;
    const moonTexture = moon._texCanvasHigh || moon._texCanvasLow;

    // Massive blurred planet in background (covering most of the screen)
    const planetColor = planetColorCachedMoonView;
    const planetSize = Math.min(canvas.width, canvas.height) * 1.5; // Massive size covering screen
    
    // В детальном виде луны звезда находится далеко, поэтому используем направленный свет
    // Позиционируем "звезду" слева от луны для создания эффекта освещения
    const starDirection = [-canvas.width * 0.3, cy]; // Звезда слева от луны
    
    // blurredPlanet
    scene.objects.push({
      type: 'planet2D',
      vertices: [cx + 200, cy - 100], // Offset to show orbital perspective
      position: [cx + 200, cy - 100],
      starPosition: starDirection, // Add star position for lighting
      pointSize: planetSize * controls.getCameraState().scale,
      color: planetColor,
      texture: planetTexture,
      rotationOffset: planet._rotationOffset,
      blurAmount: 1.0, // Strong blur effect
      drawMode: renderer.gl.POINTS
    });

    // Moon в центре (увеличенного размера)
    const moonColor = moonColorCachedMoonView;
    const moonSize = Math.max(50, moon.size * 8);
    scene.objects.push({
      type: 'moon2D',
      vertices: [cx, cy],
      position: [cx, cy],
      starPosition: starDirection, // Add star position for lighting
      pointSize: moonSize * controls.getCameraState().scale,
      color: moonColor,
      texture: moonTexture,
      rotationOffset: moon._rotationOffset,
      drawMode: renderer.gl.POINTS
    });

    // Breadcrumb
    // Text rendering removed

    const { offsetX, offsetY, scale } = controls.getCameraState();
    viewMatrix[0] = scale; viewMatrix[5] = scale; viewMatrix[12] = offsetX; viewMatrix[13] = offsetY;
    renderer.setCamera(projectionMatrix, viewMatrix);

    try { renderer.render(scene); } catch (e) { console.error(e); }
    // Подписи для луны и фоновой планеты
    drawMoonLabels();
    animationId = requestAnimationFrame(draw);
  }

  function drawMoonLabels() {
    const { showMoonScreenLabels, moonScreenLabelZoomThreshold } = gameConfig.ui;
    const { offsetX, offsetY, scale } = controls.getCameraState();
    labelsCtxMoon.clearRect(0, 0, labelsCanvasMoon.width, labelsCanvasMoon.height);
    if (!showMoonScreenLabels || scale < (moonScreenLabelZoomThreshold ?? 0)) return;
    labelsCtxMoon.font = '14px Arial';
    labelsCtxMoon.textAlign = 'left';
    labelsCtxMoon.textBaseline = 'middle';
    labelsCtxMoon.shadowColor = 'rgba(0,0,0,0.55)';
    labelsCtxMoon.shadowBlur = 3;
    labelsCtxMoon.shadowOffsetX = 1;
    labelsCtxMoon.shadowOffsetY = 1;

    const cx = canvas.width/2;
    const cy = canvas.height/2;
    const msx = cx * scale + offsetX;
    const msy = cy * scale + offsetY;
    // Подпись луны (в центре)
    labelsCtxMoon.fillStyle = '#ffffff';
    const moonText = moon.name || `Луна ${moonIndex + 1}`;
    labelsCtxMoon.fillText(moonText, (msx + 14), (msy - 6));

    // Подпись фоновой планеты, отрисованной со смещением
    const psx = (cx + 200) * scale + offsetX;
    const psy = (cy - 100) * scale + offsetY;
    labelsCtxMoon.fillStyle = '#cfd3d6';
    const planetText = planet.name || `Планета ${planetIndex + 1}`;
    labelsCtxMoon.fillText(planetText, (psx + 12), (psy - 4));
  }

  function cleanup() { 
    cancelAnimationFrame(animationId); 
    controls.destroy(); 
    // Clear interactive areas to avoid stale click targets after teardown
    window.actionButtons = [];
    if (renderer) { 
      try { renderer.cleanup(); } catch (e) { console.error('Renderer cleanup error (moon):', e); } 
    }
    try {
      if (textureInitIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureInitIdleId);
        } else {
          clearTimeout(textureInitIdleId);
        }
        textureInitIdleId = null;
      }
      if (textureUpgradeIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureUpgradeIdleId);
        } else {
          clearTimeout(textureUpgradeIdleId);
        }
        textureUpgradeIdleId = null;
      }
    } catch (_) {}
    window.removeEventListener('resize', onResizeMoon);
    try {
      if (labelsCanvasMoon && labelsCanvasMoon.parentNode) labelsCanvasMoon.parentNode.removeChild(labelsCanvasMoon);
    } catch (e) { console.error('Labels overlay cleanup error (moon):', e); }
  }
  scheduleTextureInitializations();
  scheduleTextureUpgrades();
  draw();
  return cleanup;
}

function drawBreadcrumb(scene, controls, items) {
  const fontSize = 14;
  const paddingX = 12;
  const paddingY = 6;
  const startX = 20;
  const startY = 12;
  let cursorX = startX;
  const { offsetX, offsetY, scale } = controls.getCameraState();

  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${fontSize}px Arial`;

  items.forEach((item, idx) => {
    const textWidth = Math.ceil(ctx.measureText(item.label).width);
    const boxW = textWidth + paddingX * 2;
    const boxH = fontSize + paddingY * 2;

    const x1w = (cursorX - offsetX)/scale;
    const y1w = (startY - offsetY)/scale;
    const x2w = ((cursorX + boxW) - offsetX)/scale;
    const y2w = ((startY + boxH) - offsetY)/scale;

    scene.objects.push({ type:'polygon', vertices:[x1w,y1w,x2w,y1w,x1w,y2w,x2w,y2w], color: (item.active || item.onClick) ? [0.2,0.35,0.6,0.8] : [0.25,0.25,0.25,0.6], drawMode: WebGLRenderingContext.TRIANGLE_STRIP });
    scene.objects.push({ type:'line', vertices:[x1w,y1w,x2w,y1w,x2w,y2w,x1w,y2w], color:[1,1,1,0.9], drawMode: WebGLRenderingContext.LINE_LOOP });

    const textXw = ((cursorX + paddingX + textWidth / 2) - offsetX)/scale;
    const textYw = ((startY + paddingY + fontSize / 2) - offsetY)/scale;
    scene.objects.push({ type:'textBatch', texts:[item.label], positions:[textXw,textYw], colors:[1,1,1,0.95], fontSizes:[fontSize] });

    if (item.onClick) {
      if (!window.actionButtons) window.actionButtons = [];
      window.actionButtons.push({ x: cursorX, y: startY, width: boxW, height: boxH, onClick: item.onClick });
    }

    cursorX += boxW;
    if (idx < items.length - 1) {
      const sep = '>';
      const sepW = Math.ceil(ctx.measureText(sep).width) + 10;
      const sepTextWidth = Math.ceil(ctx.measureText(sep).width);
      const sepTextXw = ((cursorX + 4 + sepTextWidth / 2) - offsetX)/scale;
      const sepTextYw = ((startY + paddingY + fontSize / 2) - offsetY)/scale;
      scene.objects.push({ type:'textBatch', texts:[sep], positions:[sepTextXw, sepTextYw], colors:[1,1,1,0.7], fontSizes:[fontSize] });
      cursorX += sepW;
    }
  });
}
    window.actionButtons = [];
