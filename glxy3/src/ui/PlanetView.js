// src/ui/PlanetView.js
import { generatePlanetTexture } from '../utils/proceduralTextures.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CanvasControls } from './CanvasControls.js';
import { gameConfig } from '../config/gameConfig.js';
import { hexToRgbArray } from '../utils/utils.js';


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
    zoomLimits: { min: 0.05, max: 5.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 }
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
  const onResizePlanet = () => syncLabelsCanvasSize();
  window.addEventListener('resize', onResizePlanet);

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

  // Планетный масштаб: увеличиваем визуальный размер в 10 раз
  const planetScale = 10;

  // Инициализация вращения планеты и лун
  if (planet._rotationOffset === undefined) {
    planet._rotationOffset = 0;
  }
  if (planet.moons) {
    planet.moons.forEach((moon) => {
      if (moon._rotationOffset === undefined) {
        moon._rotationOffset = 0;
      }
    });
  }

  // Расширяем границы панорамирования с учётом увеличенных орбит
  {
    const baseMult = Math.max(30 / planet.size, 3);
    const planetMultForBounds = planetScale * baseMult;
    let maxMoonOrbit = 0;
    planet.moons?.forEach((moon, mIndex) => {
      const mrBase = moon.orbitRadius ?? (8 + mIndex * 5);
      const mr = mrBase * planetMultForBounds;
      if (mr > maxMoonOrbit) maxMoonOrbit = mr;
    });
    const currentLimit = Math.min(canvas.width, canvas.height) / 2;
    controls.panBounds = {
      centerX: canvas.width/2,
      centerY: canvas.height/2,
      limit: Math.max(currentLimit, maxMoonOrbit + 20)
    };
  }

  let lastUpdateTime = performance.now();
  let animationId;

  function draw() {
    window.actionButtons = [];
    const scene = { objects: [], textBatches: [] };
    const now = performance.now();
    const dt = (now - lastUpdateTime)/1000;
    lastUpdateTime = now;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = (dt * speed) / secondsPerGameHour;
    const sdt = dt * speed;
    gameConfig.ui.simulationPaused = speed === 0;

    const cx = canvas.width/2;
    const cy = canvas.height/2;

    // Обновляем вращение планеты с множителем скорости
    planet._rotationOffset += (hoursDelta / (planet.dayLength || 24));
    planet._rotationOffset %= 1;

    // Генерируем процедурную текстуру для планеты
    // Используем planetIndex для консистентности с системным видом
    const planetTexture = generatePlanetTexture(
      star.x || (star.id * 1000), 
      star.y || (star.id * 1000), 
      planetIndex, // Используем переданный planetIndex вместо planet.id
      planet.type, 
      256,
      0 // moonIndex = 0 для планеты
    );

    // Planet center с процедурной текстурой
    const planetColor = hexToRgbArray(planet.color);
    const planetMult = planetScale * Math.max(30 / planet.size, 3);
    
    // В детальном виде планеты звезда находится далеко, поэтому используем направленный свет
    // Позиционируем "звезду" слева от планеты для создания эффекта освещения
    const starDirection = [-canvas.width * 0.3, cy]; // Звезда слева от планеты
    
    scene.objects.push({
      type: 'planet2D',
      vertices: [cx, cy],
      position: [cx, cy],
      starPosition: starDirection, // Add star position for lighting
      pointSize: (planet.size * planetMult) * controls.getCameraState().scale,
      color: planetColor,
      texture: planetTexture,
      rotationOffset: planet._rotationOffset,
      drawMode: renderer.gl.POINTS
    });

    // Moons orbiting с процедурными текстурами и вращением
    planet.moons?.forEach((moon, mIndex) => {
      if (moon._orbitProgress === undefined) moon._orbitProgress = (moon.initialOrbitAngle ?? (Math.random()*Math.PI*2));
      if (moon.orbitSpeed === undefined) {
        const r = moon.orbitRadius ?? (8 + mIndex * 5);
        moon.orbitSpeed = 0.05 + (0.3 / Math.sqrt(r / 8));
      }
      if (moon.orbitRadius === undefined) moon.orbitRadius = 8 + mIndex*5;
      if (moon.size === undefined) moon.size = Math.max(4, Math.min(12, (planet.size/3) + mIndex));
      
      // Обновляем орбиту и вращение луны с множителем скорости
      moon._orbitProgress += moon.orbitSpeed * sdt;
      moon._rotationOffset += (1 / (moon.dayLength || 12)) * sdt;
      moon._rotationOffset %= 1;
      
      const orbitR = moon.orbitRadius * planetMult;
      const mx = cx + Math.cos(moon._orbitProgress) * orbitR;
      const my = cy + Math.sin(moon._orbitProgress) * orbitR;
      
      // Генерируем процедурную текстуру для луны
      const moonTexture = generatePlanetTexture(
        star.x || (star.id * 1000), 
        star.y || (star.id * 1000), 
        planetIndex, // Используем planetIndex для консистентности
        moon.type, 
        128, 
        mIndex + 1 // moonIndex начинается с 1 для лун
      );
      
      const moonColor = hexToRgbArray(moon.color);
      
      // orbit line
      const orbitVerts = [];
      const steps = 64;
      for (let i=0;i<=steps;i++) {
        const a = (i/steps)*Math.PI*2;
        orbitVerts.push(cx + Math.cos(a)*orbitR, cy + Math.sin(a)*orbitR);
      }
      scene.objects.push({ 
        type: 'line', 
        vertices: orbitVerts, 
        color: [0.3,0.3,0.3,0.35], 
        drawMode: renderer.gl.LINE_STRIP 
      });
      
      // moon с процедурной текстурой и вращением
      scene.objects.push({ 
        type: 'moon2D', 
        vertices: [mx,my], 
        position: [mx,my], 
        starPosition: starDirection, // Add star position for lighting
        pointSize: (moon.size * planetScale) * controls.getCameraState().scale, 
        color: moonColor, 
        texture: moonTexture,
        rotationOffset: moon._rotationOffset,
        drawMode: renderer.gl.POINTS 
      });
      
      const { offsetX, offsetY, scale } = controls.getCameraState();
      const msx = mx*scale + offsetX; 
      const msy = my*scale + offsetY;
      window.actionButtons.push({ 
        x: msx-12, 
        y: msy-12, 
        width: 24, 
        height: 24, 
        onClick: () => onMoonClick(moon, mIndex) 
      });
    });

    // Breadcrumb
    // Text rendering removed

    const { offsetX, offsetY, scale } = controls.getCameraState();
    viewMatrix[0] = scale; viewMatrix[5] = scale; viewMatrix[12] = offsetX; viewMatrix[13] = offsetY;
    renderer.setCamera(projectionMatrix, viewMatrix);

    try { renderer.render(scene); } catch (e) { console.error(e); }
    // Подписи для планеты и её лун
    drawPlanetLabels();
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

    // Подписи лун
    const planetMult = planetScale * Math.max(30 / planet.size, 3);
    planet.moons?.forEach((moon, mIndex) => {
      const orbitR = (moon.orbitRadius ?? (8 + mIndex * 5)) * planetMult;
      const mx = cx + Math.cos(moon._orbitProgress ?? 0) * orbitR;
      const my = cy + Math.sin(moon._orbitProgress ?? 0) * orbitR;
      const msx = mx * scale + offsetX;
      const msy = my * scale + offsetY;
      labelsCtx.fillStyle = '#cfd3d6';
      const mtext = moon.name || `Луна ${mIndex + 1}`;
    labelsCtx.fillText(mtext, (msx + 12), (msy - 4));
    });
  }

  function cleanup() { 
    cancelAnimationFrame(animationId); 
    controls.destroy(); 
    // Clear interactive areas to avoid stale click targets after teardown
    window.actionButtons = [];
    if (renderer) { 
      try { renderer.cleanup(); } catch (e) { console.error('Renderer cleanup error (planet):', e); } 
    }
    window.removeEventListener('resize', onResizePlanet);
    try {
      if (labelsCanvas && labelsCanvas.parentNode) labelsCanvas.parentNode.removeChild(labelsCanvas);
    } catch (e) { console.error('Labels overlay cleanup error (planet):', e); }
  }
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
  const onResizeMoon = () => syncLabelsCanvasMoonSize();
  window.addEventListener('resize', onResizeMoon);

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

  // Инициализация вращения планеты и луны
  if (planet._rotationOffset === undefined) {
    planet._rotationOffset = 0;
  }
  if (moon._rotationOffset === undefined) {
    moon._rotationOffset = 0;
  }

  let lastUpdateTime = performance.now();
  let animationId;

  function draw() {
    window.actionButtons = [];
    const scene = { objects: [], textBatches: [] };
    const now = performance.now();
    const dt = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const sdt = dt * speed;
    gameConfig.ui.simulationPaused = speed === 0; // keep compatibility

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Обновляем вращение планеты и луны с множителем скорости
    planet._rotationOffset += (1 / (planet.dayLength || 24)) * sdt;
    planet._rotationOffset %= 1;
    
    moon._rotationOffset += (1 / (moon.dayLength || 12)) * sdt;
    moon._rotationOffset %= 1;

    // Генерируем процедурные текстуры
    // Для фоновой планеты используем тот же moonIndex = 0, что и в системном виде
    const planetTexture = generatePlanetTexture(
      star.x || (star.id * 1000), 
      star.y || (star.id * 1000), 
      planetIndex, // Используем planetIndex для консистентности с системным видом
      planet.type, 
      256,
      0 // Явно указываем moonIndex = 0 для консистентности с системным видом
    );

    const moonTexture = generatePlanetTexture(
      star.x || (star.id * 1000), 
      star.y || (star.id * 1000), 
      planetIndex, // Используем planetIndex для консистентности
      moon.type, 
      256, 
      moonIndex + 1 // Используем переданный moonIndex + 1
    );

    // Massive blurred planet in background (covering most of the screen)
    const planetColor = hexToRgbArray(planet.color);
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
    const moonColor = hexToRgbArray(moon.color);
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
    window.removeEventListener('resize', onResizeMoon);
    try {
      if (labelsCanvasMoon && labelsCanvasMoon.parentNode) labelsCanvasMoon.parentNode.removeChild(labelsCanvasMoon);
    } catch (e) { console.error('Labels overlay cleanup error (moon):', e); }
  }
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
