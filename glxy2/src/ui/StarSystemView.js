// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { CelestialBody } from '../utils/celestialBody.js';
import { CelestialRenderer } from '../renderers/CelestialRenderer.js';
import {
  planetHasAtmosphere,
  getAtmosphereColor
} from './PlanetView.js';
import { generatePlanetUVTexture } from '../utils/proceduralTextures.js';
import * as mat4 from '../utils/mat4.js';

export function renderStarSystem(canvas, star, explorationSystem, onBack, onPlanetClick = () => {}, onMoonClick = () => {}) {
  const debug = !!(gameConfig && gameConfig.debug);
  if (debug) console.log('StarSystemView: Starting render for star:', star);
  
  // Initialize orbital properties for planets if not already set
  if (star.planets && star.planets.planets) {
    star.planets.planets.forEach((planet, index) => {
      if (planet._orbitProgress === undefined) {
        // Use generator-provided initial angle if available
        planet._orbitProgress = (planet.initialOrbitAngle ?? (Math.random() * Math.PI * 2));
      }
      if (planet.orbitSpeed === undefined) {
        // Fallback keeps outer planets slower; generator may already set this
        planet.orbitSpeed = 0.1 / (index + 1);
      }
      if (planet.orbitRadius === undefined) {
        planet.orbitRadius = 50 + (index * 40); // Smaller orbit radii to fit in viewport
      }
      if (planet._rotationOffset === undefined) {
        planet._rotationOffset = 0;
      }
      if (planet.size === undefined) {
        planet.size = 8 + Math.random() * 12; // Random planet size
      }
      
      // Initialize moons if they exist
      if (planet.moons) {
        planet.moons.forEach((moon, moonIndex) => {
          if (moon._orbitProgress === undefined) {
            // Prefer generator's initial angle
            moon._orbitProgress = (moon.initialOrbitAngle ?? (Math.random() * Math.PI * 2));
          }
          if (moon.orbitSpeed === undefined) {
            // Generator-like fallback depends on orbit radius
            const r = moon.orbitRadius ?? (8 + moonIndex * 5);
            moon.orbitSpeed = 0.05 + (0.3 / Math.sqrt(r / 8));
          }
          if (moon.orbitRadius === undefined) {
            // Match generator default spacing
            moon.orbitRadius = 8 + (moonIndex * 5);
          }
          if (moon.size === undefined) {
            moon.size = Math.max(3, Math.min(8, (planet.size / 3) + moonIndex));
          }
        });
      }
    });
  }
  
  // Renderer and controls setup
  const renderer = new WebGLRenderer(canvas);
  const celestialRenderer = new CelestialRenderer(renderer);
  const controls = new CanvasControls(canvas, star, {
    renderer,
    cameraKey: 'starsystemCamera',
    zoomLimits: { min: 0.05, max: 3.0 },
    panBounds: { centerX: 0, centerY: 0, limit: Math.min(canvas.width, canvas.height)/2 },
    // Включаем 3D-aware зум и передаем параметры камеры
    renderMode: '3d',
    cameraParams: {
      fov: Math.PI / 10,
      cameraDistance: 200,
      cameraHeight: 50,
      minDistance: 50,
      maxDistance: 500
    }
  });

  // Apply 5× scale for planet orbit radii in system view
  const orbitScale = 1;
  // Apply 5× scale for planet/moon cluster visuals in system view
  const clusterScale = 1;

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
      // Recenter to keep system centered at world origin
      controls.offsetX = 0;
      controls.offsetY = 0;
      // Expand panning bounds to allow reaching outermost orbit
      controls.panBounds = {
        centerX: 0,
        centerY: 0,
        limit: maxExtent + 20 // small margin beyond visible extent
      };
      // Persist camera state
      gameConfig.ui.starsystemCamera.scale = desiredScale;
      gameConfig.ui.starsystemCamera.offsetX = controls.offsetX;
      gameConfig.ui.starsystemCamera.offsetY = controls.offsetY;
    }
  }

  // Camera settings for 3D perspective
  const cameraDistance = 200; // Distance from center
  const cameraHeight = 50;    // Height above the plane
  const fov = Math.PI / 10;    // 18 degrees field of view
  const aspect = canvas.width / canvas.height;
  const near = 1.0;
  const far = 1000.0;

  // Create perspective projection matrix
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, fov, aspect, near, far);

  // Create view matrix (camera looking down at an angle)
  const viewMatrix = new Float32Array([
    1, 0, 0, 0,
    0, 0.866, -0.5, 0,  // Rotated to look down at 30 degrees
    0, 0.5, 0.866, 0,
    0, -cameraHeight, -cameraDistance, 1
  ]);

  let lastUpdateTime = performance.now();
  let animationId;
  let cachedStaticObjects = null;
  let isStaticElementsDirty = true;

  function hexToRgbArray(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1.0];
  }

  function drawSystem() {
    // Собираем кликабельные области локально, чтобы избежать гонок при очистке
    const actionButtons = [];

    const currentTime = performance.now();
    const scene = { objects: [], textBatches: [] };

    // Static objects cache
    if (isStaticElementsDirty) {
      const staticObjects = [];

      const centerX = 0;
      const centerY = 0;

      // Star orbits and planets' orbital lines
      if (star.planets && star.planets.planets) {
        star.planets.planets.forEach((planet) => {
          const orbitVertices = [];
          const steps = 64;
          for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            orbitVertices.push(
              centerX + Math.cos(angle) * (planet.orbitRadius * orbitScale),
              centerY + Math.sin(angle) * (planet.orbitRadius * orbitScale)
            );
          }
          staticObjects.push({
            type: 'line',
            vertices: orbitVertices,
            color: [0.2, 0.2, 0.2, 0.3],
            drawMode: renderer.gl.LINE_STRIP
          });
        });
      }
      

      
      cachedStaticObjects = staticObjects;
      isStaticElementsDirty = false;
    }
    
    // Push cached static objects
    if (cachedStaticObjects) {
      scene.objects.push(...cachedStaticObjects);
    }
    
    // Update planet positions and rotations
    const timeDelta = (currentTime - lastUpdateTime) / 1000;
    lastUpdateTime = currentTime;
    
    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet, pIndex) => {
        planet._orbitProgress += planet.orbitSpeed * timeDelta;
        planet._rotationOffset += (1 / (planet.dayLength || 24)) * timeDelta;
        planet._rotationOffset %= 1;
        drawPlanet(planet, pIndex, timeDelta, 0, 0, scene, actionButtons);
      });
    }
    
    // Camera matrices from controls with 3D perspective
    const { offsetX, offsetY, scale } = controls.getCameraState();
    
    // Calculate safe camera distance based on zoom level
    const minDistance = 50;  // Minimum distance to prevent going inside objects
    const maxDistance = 500; // Maximum distance for good visibility
    const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / scale));
    
    // Update view matrix with zoom and pan (strictly top-down)
    const viewMatrix3D = new Float32Array([
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      offsetX, offsetY, -zoomDistance - cameraHeight, 1
    ]);

    renderer.setCamera(projectionMatrix, viewMatrix3D);
    
    // Draw star with scale-aware size
    {
      const starColor = hexToRgbArray(getStarColor(star.spectralType, star.owner));
      const centerX = 0;
      const centerY = 0;
      scene.objects.push({
        type: 'glowPoint',
        vertices: [centerX, centerY],
        position: [centerX, centerY],
        pointSize: 750 * scale,
        color: starColor,
        drawMode: renderer.gl.POINTS
      });
    }
    drawBreadcrumb(scene, actionButtons);

    // Обновляем window.actionButtons одним присвоением после построения кадра
    window.actionButtons = actionButtons;

    try { 
      renderer.render(scene); 
    } catch (e) { 
      console.error('StarSystemView render error:', e);
    }
    animationId = requestAnimationFrame(drawSystem);
  }

  function drawPlanet(planet, pIndex, timeDelta, centerX, centerY, scene, actionButtons) {
    const pr = planet.orbitRadius * orbitScale;
    const x = centerX + Math.cos(planet._orbitProgress) * pr;
    const y = centerY + Math.sin(planet._orbitProgress) * pr;

    // Create CelestialBody for planet
    const celestialPlanet = CelestialBody.fromPlanetData(planet);
    celestialPlanet.position = [x, y, 0];
    celestialPlanet.scale = planet.size;
    
    // Create 3D render object for planet
    const planetRenderObj = celestialRenderer.createRenderObject(celestialPlanet);
    scene.objects.push(planetRenderObj);

    // Register click for planet using perspective-correct world→screen
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const width = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const fov = Math.PI / 10;
    const f = 1.0 / Math.tan(fov / 2);
    const minDistance = 50;
    const maxDistance = 500;
    const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / scale));
    const zView = -zoomDistance - cameraHeight;
    const toScreen = (wx, wy) => {
      const xView = wx * scale + offsetX;
      const yView = wy * scale + offsetY;
      const ndcX = (xView * f / aspect) / (-zView);
      const ndcY = (yView * f) / (-zView);
      const sx = (ndcX * 0.5 + 0.5) * width;
      const sy = (1 - (ndcY * 0.5 + 0.5)) * height;
      return { sx, sy };
    };
    const planetScreen = toScreen(x, y);
    actionButtons.push({
      x: planetScreen.sx - 12,
      y: planetScreen.sy - 12,
      width: 24,
      height: 24,
      onClick: () => onPlanetClick(planet, pIndex)
    });

    // Draw moons and clicks (scaled cluster)
    planet.moons?.forEach((moon, mIndex) => {
      moon._orbitProgress += moon.orbitSpeed * timeDelta;
      moon._orbitProgress %= (Math.PI * 2);
      const orbitR = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
      const moonX = x + Math.cos(moon._orbitProgress) * orbitR;
      const moonY = y + Math.sin(moon._orbitProgress) * orbitR;
      
      // Create CelestialBody for moon
      const celestialMoon = CelestialBody.fromMoonData(moon, mIndex);
      celestialMoon.position = [moonX, moonY, 0];
      celestialMoon.scale = moon.size;
      
      // Create 3D render object for moon
      const moonRenderObj = celestialRenderer.createRenderObject(celestialMoon);
      scene.objects.push(moonRenderObj);
      
      const moonScreen = toScreen(moonX, moonY);
      actionButtons.push({
        x: moonScreen.sx - 10,
        y: moonScreen.sy - 10,
        width: 20,
        height: 20,
        onClick: () => onMoonClick(planet, pIndex, moon, mIndex)
      });
    });
  }
  
  function getPlanetColor(planetType) {
    const planetColors = {
      // Generator-aligned types
      'lava': [1.0, 0.2, 0.0, 1.0],
      'rocky': [0.6, 0.45, 0.3, 1.0],
      'terran': [0.2, 0.6, 0.4, 1.0],
      'gas': [0.95, 0.85, 0.6, 1.0],
      'ice': [0.8, 0.9, 1.0, 1.0],
      'desert': [0.9, 0.72, 0.35, 1.0],
      'ocean': [0.0, 0.5, 0.8, 1.0],
      'toxic': [0.4, 0.9, 0.2, 1.0],
      'crystal': [0.8, 0.6, 1.0, 1.0],
      'volcanic': [1.0, 0.4, 0.1, 1.0],
      // Legacy types for compatibility
      'terrestrial': [0.6, 0.4, 0.2, 1.0],
      'ocean_legacy': [0.2, 0.4, 0.8, 1.0],
      'gas_giant': [0.7, 0.5, 0.3, 1.0],
      'barren': [0.5, 0.5, 0.5, 1.0]
    };
    return planetColors[planetType] || planetColors['rocky'];
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

  function drawBreadcrumb(scene, actionButtons) {
    const items = [
      { label: 'Галактика', level: 'galaxy', clickable: true },
      { label: 'Система', level: 'system', clickable: true },
      { label: 'Планета', level: 'planet', clickable: false },
      { label: 'Спутник', level: 'moon', clickable: false }
    ];

    const fontSize = 14;
    const paddingX = 12;
    const paddingY = 6;
    const startX = 20;
    const startY = 12;
    let cursorX = startX;
    const { offsetX, offsetY, scale } = controls.getCameraState();

    // Вспомогательные функции screen↔world для перспективы
    const width = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const fov = Math.PI / 10;
    const f = 1.0 / Math.tan(fov / 2);
    const minDistance = 50;
    const maxDistance = 500;
    const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / scale));
    const zView = -zoomDistance - cameraHeight;

    const screenToWorld = (sx, sy) => {
      const ndcX = (sx / width) * 2 - 1;
      const ndcY = 1 - (sy / height) * 2;
      const xView = ndcX * (-zView) * aspect / f;
      const yView = ndcY * (-zView) / f;
      return {
        x: (xView - offsetX) / scale,
        y: (yView - offsetY) / scale
      };
    };

    items.forEach((item, idx) => {
      const tmpCtx = document.createElement('canvas').getContext('2d');
      tmpCtx.font = `${fontSize}px Arial`;
      const textWidth = Math.ceil(tmpCtx.measureText(item.label).width);
      const boxW = textWidth + paddingX * 2;
      const boxH = fontSize + paddingY * 2;

      // Экранные координаты углов
      const x1 = cursorX;
      const y1 = startY;
      const x2 = cursorX + boxW;
      const y2 = startY + boxH;

      // Преобразование экран→мир для рендеринга через WebGL (с текущим P*V)
      const p1 = screenToWorld(x1, y1);
      const p2 = screenToWorld(x2, y1);
      const p3 = screenToWorld(x1, y2);
      const p4 = screenToWorld(x2, y2);

      // Background
      scene.objects.push({
        type: 'polygon',
        vertices: [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y],
        color: item.clickable ? [0.2, 0.35, 0.6, 0.8] : [0.25, 0.25, 0.25, 0.6],
        drawMode: renderer.gl.TRIANGLE_STRIP
      });
      // Border
      scene.objects.push({
        type: 'line',
        vertices: [p1.x, p1.y, p2.x, p2.y, p4.x, p4.y, p3.x, p3.y],
        color: [1,1,1,0.9],
        drawMode: renderer.gl.LINE_LOOP
      });

      // Текст: центр в экранных координатах
      const textCenterX = cursorX + paddingX + textWidth / 2;
      const textCenterY = startY + paddingY + fontSize / 2;
      const textWorld = screenToWorld(textCenterX, textCenterY);
      scene.objects.push({
        type: 'textBatch',
        texts: [item.label],
        positions: [textWorld.x, textWorld.y],
        colors: [1,1,1,0.95],
        fontSizes: [fontSize]
      });

      // Кликабельная область в экранных координатах
      if (item.clickable) {
        actionButtons.push({
          x: cursorX,
          y: startY,
          width: boxW,
          height: boxH,
          onClick: () => {
            if (item.level === 'galaxy') { cleanup(); onBack(); }
            if (item.level === 'system') { /* already here */ }
          }
        });
      }

      cursorX += boxW;
      if (idx < items.length - 1) {
        // Разделитель '>'
        const sep = '>';
        const sepW = Math.ceil(tmpCtx.measureText(sep).width) + 10;
        const sepTextWidth = Math.ceil(tmpCtx.measureText(sep).width);
        const sepTextCenterX = cursorX + 4 + sepTextWidth / 2;
        const sepTextCenterY = startY + paddingY + fontSize / 2;
        const sepWorld = screenToWorld(sepTextCenterX, sepTextCenterY);
        scene.objects.push({
          type: 'textBatch',
          texts: [sep],
          positions: [sepWorld.x, sepWorld.y],
          colors: [1,1,1,0.7],
          fontSizes: [fontSize]
        });
        cursorX += sepW;
      }
    });
  }
  
  function cleanup() {
    cancelAnimationFrame(animationId);
    celestialRenderer.dispose();
    controls.destroy();
  }
  
  drawSystem();
  return cleanup;
}
