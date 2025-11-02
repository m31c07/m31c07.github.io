// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray } from '../utils/utils.js';
import {
  planetHasAtmosphere,
  getAtmosphereColor
} from './PlanetView.js';
import { generatePlanetUVTexture, generatePlanetTexture } from '../utils/proceduralTextures.js';
// import * as mat4 from '../utils/mat4.js';

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
        planet.orbitRadius = 100 + (index * 80); // Increasing radius for each planet
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
          if (moon._rotationOffset === undefined) {
            moon._rotationOffset = 0;
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
  const controls = new CanvasControls(canvas, star, {
    renderer,
    cameraKey: 'starsystemCamera',
    zoomLimits: { min: 0.05, max: 3.0 },
    panBounds: { centerX: canvas.width/2, centerY: canvas.height/2, limit: Math.min(canvas.width, canvas.height)/2 }
  });

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



  function drawSystem() {
    // Clear clickable areas each frame
    window.actionButtons = [];

    const currentTime = performance.now();
    const scene = { objects: [], textBatches: [] };

    // Static objects cache
    if (isStaticElementsDirty) {
      const staticObjects = [];

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

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
        
        drawPlanet(planet, pIndex, timeDelta, canvas.width/2, canvas.height/2, scene);
      });
    }
    
    // Camera matrices from controls
    const { offsetX, offsetY, scale } = controls.getCameraState();
    viewMatrix[0] = scale; viewMatrix[1] = 0; viewMatrix[2] = 0; viewMatrix[3] = 0;
    viewMatrix[4] = 0; viewMatrix[5] = scale; viewMatrix[6] = 0; viewMatrix[7] = 0;
    viewMatrix[8] = 0; viewMatrix[9] = 0; viewMatrix[10] = 1; viewMatrix[11] = 0;
    viewMatrix[12] = offsetX; viewMatrix[13] = offsetY; viewMatrix[14] = 0; viewMatrix[15] = 1;

    renderer.setCamera(projectionMatrix, viewMatrix);
    
    // Draw star with scale-aware size
    {
      const starColor = hexToRgbArray(getStarColor(star.spectralType, star.owner));
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
    drawBreadcrumb(scene);
    try { renderer.render(scene); } catch (e) { console.error(e); }
    animationId = requestAnimationFrame(drawSystem);
  }

  function drawPlanet(planet, pIndex, timeDelta, centerX, centerY, scene) {
    const pr = planet.orbitRadius * orbitScale;
    const x = centerX + Math.cos(planet._orbitProgress) * pr;
    const y = centerY + Math.sin(planet._orbitProgress) * pr;

    // Generate procedural texture for the planet
    const planetTexture = generatePlanetTexture(
      star.x, 
      star.y, 
      pIndex, 
      planet.type, 
      128, // texture size - smaller for 2D view
      0    // moonIndex = 0 for planets
    );

    const planetColor = getPlanetColor(planet.type);
    scene.objects.push({
      type: 'planet2D',
      vertices: [x, y],
      position: [x, y],
      starPosition: [centerX, centerY], // Add star position for lighting
      pointSize: (planet.size * clusterScale) * controls.getCameraState().scale,
      color: planetColor,
      texture: planetTexture, // Add the procedural texture
      rotationOffset: planet._rotationOffset || 0, // Add rotation offset
      drawMode: renderer.gl.POINTS
    });

    // Register click for planet (convert to screen coords)
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const sx = x * scale + offsetX;
    const sy = y * scale + offsetY;
    window.actionButtons.push({
      x: sx - 12,
      y: sy - 12,
      width: 24,
      height: 24,
      onClick: () => onPlanetClick(planet, pIndex)
    });

    // Draw moons and clicks (scaled cluster)
    planet.moons?.forEach((moon, mIndex) => {
      moon._orbitProgress += moon.orbitSpeed * timeDelta;
      moon._orbitProgress %= (Math.PI * 2);
      moon._rotationOffset += (1 / (moon.dayLength || 12)) * timeDelta;
      moon._rotationOffset %= 1;
      const orbitR = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
      const moonX = x + Math.cos(moon._orbitProgress) * orbitR;
      const moonY = y + Math.sin(moon._orbitProgress) * orbitR;
      
      // Generate procedural texture for the moon
      const moonTexture = generatePlanetTexture(
        star.x, 
        star.y, 
        pIndex, 
        moon.type, 
        64, // smaller texture size for moons
        mIndex + 1 // moonIndex for unique textures
      );
      
      const moonColor = getPlanetColor(moon.type) || [0.7, 0.7, 0.7, 1.0];
      scene.objects.push({
        type: 'moon2D',
        vertices: [moonX, moonY],
        position: [moonX, moonY],
        starPosition: [centerX, centerY], // Add star position for lighting
        pointSize: (moon.size * clusterScale) * controls.getCameraState().scale,
        color: moonColor,
        texture: moonTexture, // Add the procedural texture
        rotationOffset: moon._rotationOffset || 0, // Add rotation offset
        drawMode: renderer.gl.POINTS
      });
      const msx = moonX * scale + offsetX;
      const msy = moonY * scale + offsetY;
      window.actionButtons.push({
        x: msx - 10,
        y: msy - 10,
        width: 20,
        height: 20,
        onClick: () => onMoonClick(planet, pIndex, moon, mIndex)
      });
    });
  }

  // getPlanetColor moved outside renderStarSystem function

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

    items.forEach((item, idx) => {
      const tmpCtx = document.createElement('canvas').getContext('2d');
      tmpCtx.font = `${fontSize}px Arial`;
      const textWidth = Math.ceil(tmpCtx.measureText(item.label).width);
      const boxW = textWidth + paddingX * 2;
      const boxH = fontSize + paddingY * 2;

      // Convert screen-space box to world-space for WebGL rendering
      const x1w = (cursorX - offsetX) / scale;
      const y1w = (startY - offsetY) / scale;
      const x2w = ((cursorX + boxW) - offsetX) / scale;
      const y2w = ((startY + boxH) - offsetY) / scale;

      // Background
      scene.objects.push({
        type: 'polygon',
        vertices: [x1w, y1w, x2w, y1w, x1w, y2w, x2w, y2w],
        color: item.clickable ? [0.2, 0.35, 0.6, 0.8] : [0.25, 0.25, 0.25, 0.6],
        drawMode: renderer.gl.TRIANGLE_STRIP
      });
      // Border
      scene.objects.push({
        type: 'line',
        vertices: [x1w, y1w, x2w, y1w, x2w, y2w, x1w, y2w],
        color: [1,1,1,0.9],
        drawMode: renderer.gl.LINE_LOOP
      });

      // Text
      const textXw = ((cursorX + paddingX + textWidth / 2) - offsetX) / scale;
      const textYw = ((startY + paddingY + fontSize / 2) - offsetY) / scale;
      scene.objects.push({
        type: 'textBatch',
        texts: [item.label],
        positions: [textXw, textYw],
        colors: [1,1,1,0.95],
        fontSizes: [fontSize]
      });

      // Register click area in screen-space
      if (item.clickable) {
        window.actionButtons.push({
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
        // Add separator '>'
        const sep = '>';
        const sepW = Math.ceil(tmpCtx.measureText(sep).width) + 10;
        const sepTextWidth = Math.ceil(tmpCtx.measureText(sep).width);
        const sepTextXw = ((cursorX + 4 + sepTextWidth / 2) - offsetX) / scale;
        const sepTextYw = ((startY + paddingY + fontSize / 2) - offsetY) / scale;
        scene.objects.push({
          type: 'textBatch',
          texts: [sep],
          positions: [sepTextXw, sepTextYw],
          colors: [1,1,1,0.7],
          fontSizes: [fontSize]
        });
        cursorX += sepW;
      }
    });
  }
  
  function cleanup() {
    cancelAnimationFrame(animationId);
    controls.destroy();
  }
  
  drawSystem();
  return cleanup;
}

// Planet color mapping function - exported for use in other views
export function getPlanetColor(planetType) {
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
