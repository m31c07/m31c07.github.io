// src/ui/PlanetView.js
import { generatePlanetTexture, generatePlanetUVTexture, makeSeedKey } from '../utils/proceduralTextures.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CanvasControls } from './CanvasControls.js';
import { gameConfig } from '../config/gameConfig.js';
import { hexToRgbArray } from '../utils/utils.js';
import { getPlanetColor } from './StarSystemView.js';


// getPlanetColor is imported from StarSystemView.js
export function planetHasAtmosphere(planetType) {
  return ['terran', 'ocean', 'jungle', 'arctic', 'desert', 'volcanic', 'gas', 'ice', 'toxic'].includes(planetType);
}

// Возвращает цвет атмосферы для разных типов планет
export function getAtmosphereColor(planetType) {
  const atmosphereColors = {
    terran: 'rgba(120, 180, 255, 0.3)',   // Голубая атмосфера
    ocean: 'rgba(100, 170, 255, 0.3)',    // Голубая атмосфера
    jungle: 'rgba(120, 200, 120, 0.3)',   // Зеленоватая атмосфера
    arctic: 'rgba(200, 230, 255, 0.3)',   // Светло-голубая атмосфера
    desert: 'rgba(255, 210, 120, 0.3)',   // Желтоватая атмосфера
    volcanic: 'rgba(255, 100, 50, 0.3)',  // Красноватая атмосфера
    gas: 'rgba(200, 180, 255, 0.3)',      // Фиолетовая атмосфера
    ice: 'rgba(180, 220, 255, 0.2)',      // Светло-голубая атмосфера
    toxic: 'rgba(100, 255, 50, 0.3)'      // Ядовито-зеленая атмосфера
  };
  
  return atmosphereColors[planetType] || 'rgba(150, 150, 150, 0.2)';
}

// Создает битмап планеты с текстурой
export function createPlanetBitmap(planet, star) {
  const size = Math.ceil(planet.size * 2.5);
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  const centerX = size;
  const centerY = size;
  
  // Используем id звезды вместо координат, если координаты не предоставлены
  const starX = star.x || (star.id * 1000);
  const starY = star.y || (star.id * 1000);
  
  // Генерация процедурной UV-текстуры для анимации вращения
  const uvTexture = generatePlanetUVTexture(
    starX, 
    starY, 
    planet.id, 
    planet.type, 
    Math.max(128, size), // Минимальное разрешение текстуры
    1.5 // Множитель ширины вращения
  );
  
  // Сохраняем ссылку на UV-текстуру для анимации вращения
  planet._uvTexture = uvTexture;
  planet._rotationOffset = 0; // Текущее смещение вращения
  
  // Создаем начальный рендер планеты с текстурой при вращении 0
  return renderPlanetWithRotation(planet, centerX, centerY, size, 0);
}

// Рендерит планету с определенным смещением вращения и наклоном оси
// Функция для определения цвета планеты (перенесена из StarSystemView.js)

// Создает битмап луны с текстурой (устаревшая функция - заменена на процедурные текстуры)
export function createMoonBitmap(moon, planetId, moonIndex, star) {
  // Эта функция больше не используется - заменена на процедурные текстуры
  return null;
}

// Создает резервную текстуру луны (используется, если основная текстура не может быть создана)
export function createFallbackMoonTexture(moonSize, color) {
  const actualMoonSize = Math.floor(moonSize);
  const canvasSize = actualMoonSize * 2 + 1; // Всегда нечетный размер
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Центр теперь находится в целочисленных координатах
  const centerX = actualMoonSize;
  const centerY = actualMoonSize;
  
  // Создаем простую градиентную луну
  const gradient = ctx.createRadialGradient(
    centerX - actualMoonSize * 0.3, centerY - actualMoonSize * 0.3, 0,
    centerX, centerY, actualMoonSize
  );
  
  const baseColor = hexToRgbArray(color);
  const lightColor = `rgb(${Math.min(255, baseColor.r + 50)}, ${Math.min(255, baseColor.g + 50)}, ${Math.min(255, baseColor.b + 50)})`;
  const shadowColor = `rgb(${Math.max(0, baseColor.r - 30)}, ${Math.max(0, baseColor.g - 30)}, ${Math.max(0, baseColor.b - 30)})`;
  
  gradient.addColorStop(0, lightColor);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, shadowColor);
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, actualMoonSize, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Добавляем согласованное атмосферное свечение для лун с атмосферой (fallback version)
  // For fallback textures, we'll use a simpler approach with less detailed atmospheric effect
  // This is just for consistency - the main rendering should use the full-featured version
  /*
  if (planetHasAtmosphere(moon.type)) {
    // Scale atmospheric halo based on moon size for consistent appearance
    // Use a proportional offset that scales with moon size, with minimum and maximum limits
    const atmosphereOffset = Math.max(2, Math.min(10, actualMoonSize * 0.3));
    
    const atmosphereGradient = ctx.createRadialGradient(
      centerX, centerY, actualMoonSize,
      centerX, centerY, actualMoonSize + atmosphereOffset
    );
    
    const atmosphereColor = getAtmosphereColor(moon.type);
    
    atmosphereGradient.addColorStop(0, atmosphereColor);
    atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, actualMoonSize + atmosphereOffset, 0, Math.PI * 2);
    ctx.fillStyle = atmosphereGradient;
    ctx.fill();
  }
  */
  
  console.log(`Created fallback texture for moon size ${moonSize}, canvas ${canvasSize}x${canvasSize}`);
  return canvas;
}

// Генерирует детализированную текстурированную битмап-луну, используя ту же систему, что и планеты, с вращением
// Deprecated: renderDetailMoonWithRotation - replaced by procedural textures in WebGL renderer

// Вспомогательная функция для получения высоты поверхности в любой точке
export function getSurfaceHeight(x, y, centerX, centerY, moonRadius, craters, seed) {
  const dx = x - centerX;
  const dy = y - centerY;
  const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  if (distanceFromCenter > moonRadius) return 0;
  
  // Базовый шум с использованием сидированного рандома для согласованности
  let pixelSeed = seed + x * 1000 + y;
  
  // Базовая высота поверхности
  let height = 0.8;
  
  // Добавляем кратеры, если они есть
  if (craters && craters.length > 0) {
    for (const crater of craters) {
      const craterDx = x - crater.x;
      const craterDy = y - crater.y;
      const distToCrater = Math.sqrt(craterDx * craterDx + craterDy * craterDy);
      
      // Если точка находится внутри кратера
      if (distToCrater < crater.radius) {
        // Нормализованное расстояние от центра кратера (0 в центре, 1 на краю)
        const normalizedDist = distToCrater / crater.radius;
        
        // Форма кратера: глубже в центре, приподнятые края
        const craterDepth = (1 - Math.pow(normalizedDist, 0.5)) * crater.depth;
        
        // Вычитаем глубину кратера из высоты поверхности
        height -= craterDepth;
      }
    }
  }
  
  return Math.max(0, Math.min(1, height));
}

// src/ui/PlanetView.js
export function renderPlanetScreen(canvas, star, planet, planetIndex, onGalaxy, onSystem, onPlanet, onMoonClick = () => {}) {
  const renderer = new WebGLRenderer(canvas);
  const controls = new CanvasControls(canvas, planet, {
    renderer,
    cameraKey: 'planetCamera',
    zoomLimits: { min: 0.05, max: 5.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 }
  });

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

    const cx = canvas.width/2;
    const cy = canvas.height/2;

    // Обновляем вращение планеты
    planet._rotationOffset += (1 / (planet.dayLength || 24)) * dt;
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
    const planetColor = getPlanetColor(planet.type);
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
      
      // Обновляем орбиту и вращение луны
      moon._orbitProgress += moon.orbitSpeed * dt;
      moon._rotationOffset += (1 / (moon.dayLength || 12)) * dt;
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
      
      const moonColor = getPlanetColor(moon.type) || [0.7,0.7,0.7,1];
      
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
    drawBreadcrumb(scene, controls, [
      { label: 'Галактика', onClick: onGalaxy },
      { label: 'Система', onClick: onSystem },
      { label: 'Планета', onClick: onPlanet, active: true },
      { label: 'Спутник' }
    ]);

    const { offsetX, offsetY, scale } = controls.getCameraState();
    viewMatrix[0] = scale; viewMatrix[5] = scale; viewMatrix[12] = offsetX; viewMatrix[13] = offsetY;
    renderer.setCamera(projectionMatrix, viewMatrix);

    try { renderer.render(scene); } catch (e) { console.error(e); }
    animationId = requestAnimationFrame(draw);
  }

  function cleanup() { cancelAnimationFrame(animationId); controls.destroy(); }
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

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Обновляем вращение планеты и луны
    planet._rotationOffset += (1 / (planet.dayLength || 24)) * dt;
    planet._rotationOffset %= 1;
    
    moon._rotationOffset += (1 / (moon.dayLength || 12)) * dt;
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
    const planetColor = getPlanetColor(planet.type);
    const planetSize = Math.min(canvas.width, canvas.height) * 1.5; // Massive size covering screen
    
    // В детальном виде луны звезда находится далеко, поэтому используем направленный свет
    // Позиционируем "звезду" слева от луны для создания эффекта освещения
    const starDirection = [-canvas.width * 0.3, cy]; // Звезда слева от луны
    
    scene.objects.push({
      type: 'blurredPlanet',
      vertices: [cx + 200, cy - 100], // Offset to show orbital perspective
      position: [cx + 200, cy - 100],
      starPosition: starDirection, // Add star position for lighting
      pointSize: planetSize * controls.getCameraState().scale,
      color: [...planetColor.slice(0, 3), 0.2], // Reduced opacity for background effect
      texture: planetTexture,
      rotationOffset: planet._rotationOffset,
      blurAmount: 1.0, // Strong blur effect
      drawMode: renderer.gl.POINTS
    });

    // Moon в центре (увеличенного размера)
    const moonColor = getPlanetColor(moon.type) || [0.7, 0.7, 0.7, 1];
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
    drawBreadcrumb(scene, controls, [
      { label: 'Галактика', onClick: onGalaxy },
      { label: 'Система', onClick: onSystem },
      { label: 'Планета', onClick: onPlanet },
      { label: 'Спутник', active: true }
    ]);

    const { offsetX, offsetY, scale } = controls.getCameraState();
    viewMatrix[0] = scale; viewMatrix[5] = scale; viewMatrix[12] = offsetX; viewMatrix[13] = offsetY;
    renderer.setCamera(projectionMatrix, viewMatrix);

    try { renderer.render(scene); } catch (e) { console.error(e); }
    animationId = requestAnimationFrame(draw);
  }

  function cleanup() { cancelAnimationFrame(animationId); controls.destroy(); }
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