// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray, advanceCalendarByHours, computeTotalHours } from '../utils/utils.js';
import { generatePlanetTexture, generatePlanetTextureAsync } from '../utils/proceduralTextures.js';

export function renderStarSystem(canvas, star, explorationSystem, onBack, onPlanetClick = () => {}, onMoonClick = () => {}) {
  const debug = !!(gameConfig && gameConfig.debug);
  if (debug) console.log('StarSystemView: Starting render for star:', star);
  
  if (star.planets && star.planets.planets) {
    const cal = gameConfig.calendar;
    const totalHours = ((cal.year * cal.monthsPerYear + cal.month) * cal.daysPerMonth + cal.day) * cal.hoursPerDay;
    star.planets.planets.forEach((planet, index) => {
      planet._orbitProgress = (planet.initialOrbitAngle ?? 0) + ((planet.orbitSpeed ?? (0.1 / (index + 1))) * totalHours);
      if (planet.orbitRadius === undefined) {
        planet.orbitRadius = 100 + (index * 80);
      }
      planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : 0;
      if (planet.size === undefined) {
        planet.size = 8 + 12;
      }
      if (planet.moons) {
        planet.moons.forEach((moon, moonIndex) => {
          const r = moon.orbitRadius ?? (8 + moonIndex * 5);
          moon.orbitSpeed = moon.orbitSpeed ?? (0.05 + (0.3 / Math.sqrt(r / 8)));
          moon.orbitRadius = r;
          moon._orbitProgress = (moon.initialOrbitAngle ?? 0) + ((moon.orbitSpeed ?? 0) * totalHours);
          moon._rotationOffset = moon.dayLength ? ((totalHours / moon.dayLength) % 1) : 0;
          if (moon.size === undefined) {
            moon.size = Math.max(3, Math.min(8, (planet.size / 3) + moonIndex));
          }
        });
      }
    });
  }
  const highResSizes = gameConfig.ui?.textureSizes?.starsystem ?? { planet: 512, moon: 128 };
  const lowResSize = 128;
  let textureUpgradeQueue = [];
  let textureUpgradePtr = 0;
  let textureUpgradeIdleId = null;
  let textureInitQueue = [];
  let textureInitPtr = 0;
  let textureInitIdleId = null;
  let isTextureGenRunning = false;
  if (star.planets && star.planets.planets) {
    star.planets.planets.forEach((planet, pIndex) => {
      planet._texSize = lowResSize;
      textureInitQueue.push({ t: 'p', pIndex });
      textureUpgradeQueue.push({ t: 'p', pIndex });
      if (planet.moons) {
        planet.moons.forEach((moon, mIndex) => {
          moon._texSize = lowResSize;
          textureInitQueue.push({ t: 'm', pIndex, mIndex });
          textureUpgradeQueue.push({ t: 'm', pIndex, mIndex });
        });
      }
    });
  }

  function scheduleTextureInitializations() {
    function processNext() {
      if (isTextureGenRunning) return;
      if (textureInitPtr >= textureInitQueue.length) return;
      isTextureGenRunning = true;
      const item = textureInitQueue[textureInitPtr++];
      try {
        if (item.t === 'p') {
          const p = star.planets?.planets?.[item.pIndex];
          if (p && !p._texCanvasLow && !p._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              item.pIndex,
              p.type,
              lowResSize,
              0,
              p.developmentLevel ?? 0
            );
            p._texCanvasLow = tex;
          }
        } else {
          const p = star.planets?.planets?.[item.pIndex];
          const m = p?.moons?.[item.mIndex];
          if (m && !m._texCanvasLow && !m._texCanvasHigh) {
            const tex = generatePlanetTexture(
              star.systemSeed,
              item.pIndex,
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
      const isPlanet = item.t === 'p';
      const p = star.planets?.planets?.[item.pIndex];
      const targetType = isPlanet ? p?.type : p?.moons?.[item.mIndex]?.type;
      const devLevel = isPlanet ? (p?.developmentLevel ?? 0) : (p?.moons?.[item.mIndex]?.developmentLevel ?? 0);
      const size = isPlanet ? highResSizes.planet : highResSizes.moon;
      const texIndex = isPlanet ? 0 : (item.mIndex + 1);
      if (!p || !targetType) { isTextureGenRunning = false; if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext(); return; }
      generatePlanetTextureAsync(
        star.systemSeed,
        item.pIndex,
        targetType,
        size,
        texIndex,
        devLevel,
        { chunkRows: 12 }
      ).then((tex) => {
        if (isPlanet) {
          p._texCanvasHigh = tex;
          if (p._texCanvasLow && p._texCanvasLow !== tex) {
            try { renderer.deleteTextureForCanvas(p._texCanvasLow); } catch (_) {}
            p._texCanvasLow = null;
          }
        } else {
          const m = p.moons?.[item.mIndex];
          if (m) {
            m._texCanvasHigh = tex;
            if (m._texCanvasLow && m._texCanvasLow !== tex) {
              try { renderer.deleteTextureForCanvas(m._texCanvasLow); } catch (_) {}
              m._texCanvasLow = null;
            }
          }
        }
      }).finally(() => {
        isTextureGenRunning = false;
        if (textureUpgradePtr < textureUpgradeQueue.length) scheduleNext();
      });
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
  
  // Renderer and controls setup
  const renderer = new WebGLRenderer(canvas);
  const controls = new CanvasControls(canvas, star, {
    renderer,
    cameraKey: 'starsystemCamera',
    zoomLimits: { min: 0.05, max: 3.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 }
  });

  // Оверлей-канвас для подписей планет и лун
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
  const onResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setSize(canvas.width, canvas.height);
    syncLabelsCanvasSize();
    projectionMatrix[0] = 2 / canvas.width;
    projectionMatrix[5] = -2 / canvas.height;
    controls.panBounds = { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 };
    isStaticElementsDirty = true;
    try { drawSystem(); } catch (_) {}
  };
  window.addEventListener('resize', onResize);

  // Apply 5× scale for planet orbit radii in system view
  const orbitScale = 5;
  // Apply 5× scale for planet/moon cluster visuals in system view
  const clusterScale = 5;

  // Auto-fit system to viewport and expand panning bounds to full extent
  {
    const planets = star?.planets?.planets || [];
    let maxPlanetOrbit = 0;
    let maxMoonOrbit = 0;
    for (let pIndex = 0; pIndex < planets.length; pIndex++) {
      const p = planets[pIndex];
      const pr = (p.orbitRadius || 0) * orbitScale;
      if (pr > maxPlanetOrbit) maxPlanetOrbit = pr;
      if (p.moons && p.moons.length) {
        for (let mIndex = 0; mIndex < p.moons.length; mIndex++) {
          const m = p.moons[mIndex];
          const mrBase = (m.orbitRadius ?? (8 + mIndex * 5));
          const mr = mrBase * clusterScale;
          if (mr > maxMoonOrbit) maxMoonOrbit = mr;
        }
      }
    }
    const maxExtent = maxPlanetOrbit + maxMoonOrbit;
    const viewportRadius = Math.min(canvas.width, canvas.height) / 2 * 0.9;
    if (maxExtent > 0) {
      const desiredScale = Math.min(controls.zoomLimits.max, Math.max(controls.zoomLimits.min, viewportRadius / maxExtent));
      controls.scale = desiredScale;
      // Recenter to keep system centered
      controls.offsetX = window.innerWidth/2 - canvas.width/2 * desiredScale;
      controls.offsetY = window.innerHeight/2 - canvas.height/2 * desiredScale;
      // Expand panning bounds to allow reaching outermost orbit
      controls.panBounds = {
        centerX: canvas.width/2,
        centerY: canvas.height/2,
        limit: maxExtent + 20 // small margin beyond visible extent
      };
      // Persist camera state
      gameConfig.ui.starsystemCamera.scale = desiredScale;
      gameConfig.ui.starsystemCamera.offsetX = controls.offsetX;
      gameConfig.ui.starsystemCamera.offsetY = controls.offsetY;
    }
  }

  // Matrices
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

  let lastUpdateTime = performance.now();
  let animationId;
  let cachedStaticObjects = null;
  let isStaticElementsDirty = true;
  let lastFrameTime = 0;
  let lastCameraState = null;
  let lastLabelsTime = 0;
  let cachedMoonOrbitTemplates = null;



  function drawSystem() {
    
    const currentTime = performance.now();
    const scene = { objects: [], textBatches: [] };
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const cameraChanged = !lastCameraState || Math.abs(lastCameraState.offsetX - offsetX) > 0.1 || Math.abs(lastCameraState.offsetY - offsetY) > 0.1 || Math.abs(lastCameraState.scale - scale) > 0.001;

    // Static objects cache
  if (isStaticElementsDirty) {
    const staticObjects = [];

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Star orbits and planets' orbital lines
      if (star.planets && star.planets.planets) {
      cachedMoonOrbitTemplates = [];
      star.planets.planets.forEach((planet, pIndex) => {
        const orbitVertices = [];
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          orbitVertices.push(
            centerX + Math.cos(angle) * (planet.orbitRadius * orbitScale),
            centerY + Math.sin(angle) * (planet.orbitRadius * orbitScale * 0.5)
          );
        }
        staticObjects.push({
          type: 'line',
          vertices: orbitVertices,
          color: [0.2, 0.2, 0.2, 0.3],
          drawMode: renderer.gl.LINE_STRIP
        });
        const planetTemplates = [];
        if (planet.moons && planet.moons.length > 0) {
          planet.moons.forEach((moon, mIndex) => {
            const moonSteps = 24;
            const moonOrbitRadius = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
            const verts = new Float32Array((moonSteps + 1) * 2);
            for (let i = 0; i <= moonSteps; i++) {
              const angle = (i / moonSteps) * Math.PI * 2;
              const x = Math.cos(angle) * moonOrbitRadius;
              const y = Math.sin(angle) * moonOrbitRadius * 0.5;
              const idx = i * 2;
              verts[idx] = x;
              verts[idx + 1] = y;
            }
            planetTemplates[mIndex] = verts;
          });
        }
        cachedMoonOrbitTemplates[pIndex] = planetTemplates;
      });
    }
      
      cachedStaticObjects = staticObjects;
      isStaticElementsDirty = false;
    }
    
    // Push cached static objects
    if (cachedStaticObjects) {
      scene.objects.push(...cachedStaticObjects);
    }
    
    const moonOrbitZoomThreshold = Number(gameConfig?.ui?.systemMoonOrbitZoomThreshold ?? 0.3);
    const drawMoonOrbits = scale >= moonOrbitZoomThreshold;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet, pIndex) => {
        const pr = planet.orbitRadius * orbitScale;
        const planetX = centerX + Math.cos(planet._orbitProgress) * pr;
        const planetY = centerY + Math.sin(planet._orbitProgress) * pr * 0.5;
        if (drawMoonOrbits && planet.moons && planet.moons.length > 0) {
          const templates = cachedMoonOrbitTemplates ? cachedMoonOrbitTemplates[pIndex] : null;
          planet.moons.forEach((moon, mIndex) => {
            const verts = templates ? templates[mIndex] : null;
            if (verts) {
              scene.objects.push({
                type: 'line',
                vertices: verts,
                color: [0.3, 0.3, 0.3, 0.2],
                drawMode: renderer.gl.LINE_STRIP,
                offset: [planetX, planetY],
                staticVertices: true
              });
            }
          });
        }
      });
    }
    
    // Update planet positions and rotations with speed multiplier
    const timeDelta = (currentTime - lastUpdateTime) / 1000;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const targetFps = Number(gameConfig?.ui?.targetFps ?? 60);
    const minFrameMs = 1000 / targetFps;
    if (speed > 0) {
      if (currentTime - lastFrameTime < minFrameMs) { animationId = requestAnimationFrame(drawSystem); return; }
      lastFrameTime = currentTime;
    } else {
      if (!cameraChanged) { animationId = requestAnimationFrame(drawSystem); return; }
    }
    lastUpdateTime = currentTime;
    const effectiveDelta = timeDelta * speed;
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = effectiveDelta / secondsPerGameHour;
    const totalHours = advanceCalendarByHours(hoursDelta);
    gameConfig.ui.simulationPaused = speed === 0;
    window.actionButtons = [];
    
    let behindPlanets = [];
    let frontPlanets = [];
    if (star.planets && star.planets.planets) {
      const cx = canvas.width/2;
      const cy = canvas.height/2;
      star.planets.planets.forEach((planet, pIndex) => {
        planet._orbitProgress = (planet.initialOrbitAngle ?? 0) + ((planet.orbitSpeed ?? 0) * totalHours);
        planet._rotationOffset = planet.dayLength ? ((totalHours / planet.dayLength) % 1) : 0;
        const pr = planet.orbitRadius * orbitScale;
        const y = cy + Math.sin(planet._orbitProgress) * pr * 0.5;
        if (y < cy) {
          behindPlanets.push({ planet, pIndex });
        } else {
          frontPlanets.push({ planet, pIndex });
        }
      });
    }
    
    // Camera matrices from controls
    lastCameraState = { offsetX, offsetY, scale };
    viewMatrix[0] = scale; viewMatrix[1] = 0; viewMatrix[2] = 0; viewMatrix[3] = 0;
    viewMatrix[4] = 0; viewMatrix[5] = scale; viewMatrix[6] = 0; viewMatrix[7] = 0;
    viewMatrix[8] = 0; viewMatrix[9] = 0; viewMatrix[10] = 1; viewMatrix[11] = 0;
    viewMatrix[12] = offsetX; viewMatrix[13] = offsetY; viewMatrix[14] = 0; viewMatrix[15] = 1;

    renderer.setCamera(projectionMatrix, viewMatrix);
    
    // Draw planets behind the star
    if (behindPlanets.length) {
      const cx = canvas.width/2;
      const cy = canvas.height/2;
      behindPlanets.forEach(({ planet, pIndex }) => {
        drawPlanet(planet, pIndex, totalHours, cx, cy, scene);
      });
    }

    // Draw star with scale-aware size
    {
      if (!star._rgbColor) { star._rgbColor = hexToRgbArray(getStarColor(star.spectralType, star.owner)); }
      const starColor = star._rgbColor;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      scene.objects.push({
        type: 'glowPoint',
        vertices: [centerX, centerY],
        position: [centerX, centerY],
        pointSize: 750 * scale,
        color: starColor,
        drawMode: renderer.gl.POINTS
      });
    }

    // Draw planets in front of the star
    if (frontPlanets.length) {
      const cx = canvas.width/2;
      const cy = canvas.height/2;
      frontPlanets.forEach(({ planet, pIndex }) => {
        drawPlanet(planet, pIndex, totalHours, cx, cy, scene);
      });
    }
    if (debug) console.log('StarSystemView: actionButtons count', window.actionButtons.length);
    try { renderer.render(scene); } catch (e) { console.error(e); }
    if (cameraChanged || (currentTime - lastLabelsTime > 100)) { drawSystemLabels(); lastLabelsTime = currentTime; }
    animationId = requestAnimationFrame(drawSystem);
  }

  function drawPlanet(planet, pIndex, totalHours, centerX, centerY, scene) {
    const pr = planet.orbitRadius * orbitScale;
    const x = centerX + Math.cos(planet._orbitProgress) * pr;
    const y = centerY + Math.sin(planet._orbitProgress) * pr * 0.5;

    let planetTexture = planet._texCanvasHigh || planet._texCanvasLow;

    const planetColor = planet._rgbColor || hexToRgbArray(planet.color);
    if (!planet._rgbColor) planet._rgbColor = planetColor;
    const phase = Math.sin(planet._orbitProgress);
    const frontness = -phase; // top -> 1, bottom -> -1, left/right -> 0
    const depthFactor = 0.925 + 0.075 * frontness;
    const lightZ = frontness;
    scene.objects.push({
      type: 'planet2D',
      vertices: [x, y],
      position: [x, y],
      starPosition: [centerX, centerY], // Add star position for lighting
      pointSize: (planet.size * clusterScale) * controls.getCameraState().scale,
      color: planetColor,
      texture: planetTexture,
      rotationOffset: planet._rotationOffset || 0,
      depthFactor,
      lightZ,
      drawMode: renderer.gl.POINTS
    });
    
    // Название планеты рисуется на оверлее в drawSystemLabels()

    // Register click for planet (convert to screen coords)
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const sx = x * scale + offsetX;
    const sy = y * scale + offsetY;
    
    // Scale the click area with the planet's visual size
    const planetVisualSize = (planet.size * clusterScale) * scale;
    const clickAreaSize = Math.max(24, planetVisualSize); // Minimum 24px for usability
    
    window.actionButtons.push({
      x: sx - clickAreaSize/2,
      y: sy - clickAreaSize/2,
      width: clickAreaSize,
      height: clickAreaSize,
      onClick: () => onPlanetClick(planet, pIndex)
    });
    if (debug) console.log('StarSystemView: planet click area', pIndex, sx, sy, clickAreaSize);

    // Draw moons and clicks (scaled cluster)
    planet.moons?.forEach((moon, mIndex) => {
      moon._orbitProgress = (moon.initialOrbitAngle ?? 0) + ((moon.orbitSpeed ?? 0) * totalHours);
      moon._rotationOffset = moon.dayLength ? ((totalHours / moon.dayLength) % 1) : 0;
      const orbitR = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
      const moonX = x + Math.cos(moon._orbitProgress) * orbitR;
      const moonY = y + Math.sin(moon._orbitProgress) * orbitR * 0.5;
      
      let moonTexture = moon._texCanvasHigh || moon._texCanvasLow;
      
      const moonColor = moon._rgbColor || hexToRgbArray(moon.color);
      if (!moon._rgbColor) moon._rgbColor = moonColor;
      scene.objects.push({
        type: 'moon2D',
        vertices: [moonX, moonY],
        position: [moonX, moonY],
        starPosition: [centerX, centerY], // Add star position for lighting
        pointSize: (moon.size * clusterScale) * controls.getCameraState().scale,
        color: moonColor,
        texture: moonTexture,
        rotationOffset: moon._rotationOffset || 0,
        depthFactor,
        lightZ,
        drawMode: renderer.gl.POINTS
      });
      const msx = moonX * scale + offsetX;
      const msy = moonY * scale + offsetY;
      
      // Scale the click area with the moon's visual size
      const moonVisualSize = (moon.size * clusterScale) * scale;
      const moonClickAreaSize = Math.max(20, moonVisualSize); // Minimum 20px for usability
      
      window.actionButtons.push({
        x: msx - moonClickAreaSize/2,
        y: msy - moonClickAreaSize/2,
        width: moonClickAreaSize,
        height: moonClickAreaSize,
        onClick: () => onMoonClick(planet, pIndex, moon, mIndex)
      });
    });
  }

  function getStarColor(spectralType, owner) {
    const spectralColors = {
      'O': '#9bb0ff',
      'B': '#aabfff',
      'A': '#cad7ff',
      'F': '#f8f7ff',
      'G': '#fff4ea',
      'K': '#ffd2a1',
      'M': '#ffad51'
    };
    return spectralColors[spectralType] || spectralColors['G'];
  }

  function drawBreadcrumb(scene) {

  }

  function drawSystemLabels() {
    const { showSystemPlanetLabels, showSystemMoonLabels, systemLabelZoomThreshold } = gameConfig.ui;
    const { offsetX, offsetY, scale } = controls.getCameraState();
    labelsCtx.clearRect(0, 0, labelsCanvas.width, labelsCanvas.height);
    if (scale < (systemLabelZoomThreshold ?? 0)) return;

    labelsCtx.font = '13px Arial';
    labelsCtx.textAlign = 'left';
    labelsCtx.textBaseline = 'middle';
    labelsCtx.shadowColor = 'rgba(0,0,0,0.55)';
    labelsCtx.shadowBlur = 3;
    labelsCtx.shadowOffsetX = 1;
    labelsCtx.shadowOffsetY = 1;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const lerp = (a, b, t) => a + (b - a) * t; // плавное приближение

    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet, pIndex) => {
        const pr = planet.orbitRadius * orbitScale;
        const x = centerX + Math.cos(planet._orbitProgress) * pr;
        const y = centerY + Math.sin(planet._orbitProgress) * pr * 0.5;

        // Позиция планеты на экране
        const sx = Math.round(x * scale + offsetX);
        const sy = Math.round(y * scale + offsetY);

        // Сглаженные позиции меток
        planet._labelX = planet._labelX ?? sx;
        planet._labelY = planet._labelY ?? sy;
        planet._labelX = lerp(planet._labelX, sx, 0.15);
        planet._labelY = lerp(planet._labelY, sy, 0.15);

        if (showSystemPlanetLabels) {
          labelsCtx.fillStyle = '#ffffff';
          const text = planet.name || `Планета ${pIndex + 1}`;
          labelsCtx.fillText(text, planet._labelX, planet._labelY - (planet.size+3)*scale*3);
        }

        if (showSystemMoonLabels && planet.moons && planet.moons.length) {
          planet.moons.forEach((moon, mIndex) => {
            const orbitR = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
            const mx = x + Math.cos(moon._orbitProgress) * orbitR;
            const my = y + Math.sin(moon._orbitProgress) * orbitR * 0.5;
            const msx = Math.round(mx * scale + offsetX);
            const msy = Math.round(my * scale + offsetY);

            // Сглаженные координаты для лун
            moon._labelX = moon._labelX ?? msx;
            moon._labelY = moon._labelY ?? msy;
            moon._labelX = lerp(moon._labelX, msx, 0.25);
            moon._labelY = lerp(moon._labelY, msy, 0.25);

            labelsCtx.fillStyle = '#cfd3d6';
            const mtext = moon.name || `Луна ${mIndex + 1}`;
            labelsCtx.fillText(mtext, moon._labelX, moon._labelY - (moon.size + 3)*scale*3);
          });
        }
      });
    }
  }

  
  function cleanup() {
    cancelAnimationFrame(animationId);
    controls.destroy();
    if (renderer) {
      try { renderer.cleanup(); } catch (e) { console.error('Renderer cleanup error:', e); }
    }
    try {
      if (textureUpgradeIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureUpgradeIdleId);
        } else {
          clearTimeout(textureUpgradeIdleId);
        }
        textureUpgradeIdleId = null;
      }
      if (textureInitIdleId != null) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(textureInitIdleId);
        } else {
          clearTimeout(textureInitIdleId);
        }
        textureInitIdleId = null;
      }
    } catch (_) {}
    window.removeEventListener('resize', onResize);
    try {
      if (labelsCanvas && labelsCanvas.parentNode) labelsCanvas.parentNode.removeChild(labelsCanvas);
    } catch (e) { console.error('Labels overlay cleanup error (system):', e); }
  }
  
  scheduleTextureInitializations();
  scheduleTextureUpgrades();
  drawSystem();
  return cleanup;
}

