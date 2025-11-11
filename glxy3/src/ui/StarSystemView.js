// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray } from '../utils/utils.js';
import { generatePlanetTexture } from '../utils/proceduralTextures.js';

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
  const onResize = () => syncLabelsCanvasSize();
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
    
    // Draw moon orbits (dynamic, as they move with their planets)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet) => {
        const pr = planet.orbitRadius * orbitScale;
        const planetX = centerX + Math.cos(planet._orbitProgress) * pr;
        const planetY = centerY + Math.sin(planet._orbitProgress) * pr;
        
        // Draw moon orbits around each planet
        if (planet.moons && planet.moons.length > 0) {
          planet.moons.forEach((moon) => {
            const moonOrbitVertices = [];
            const moonSteps = 32; // Fewer steps for moon orbits
            const moonOrbitRadius = (moon.orbitRadius || (8 + 5)) * clusterScale; // Default if not set
            
            for (let i = 0; i <= moonSteps; i++) {
              const angle = (i / moonSteps) * Math.PI * 2;
              moonOrbitVertices.push(
                planetX + Math.cos(angle) * moonOrbitRadius,
                planetY + Math.sin(angle) * moonOrbitRadius
              );
            }
            
            scene.objects.push({
              type: 'line',
              vertices: moonOrbitVertices,
              color: [0.3, 0.3, 0.3, 0.2],
              drawMode: renderer.gl.LINE_STRIP
            });
          });
        }
      });
    }
    
    // Update planet positions and rotations with speed multiplier
    const timeDelta = (currentTime - lastUpdateTime) / 1000;
    lastUpdateTime = currentTime;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const effectiveDelta = timeDelta * speed;
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = effectiveDelta / secondsPerGameHour;
    gameConfig.ui.simulationPaused = speed === 0;
    
    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet, pIndex) => {
        planet._orbitProgress += (planet.orbitSpeed ?? 0) * hoursDelta;
        planet._rotationOffset += (hoursDelta / (planet.dayLength || 24));
        planet._rotationOffset %= 1;
        drawPlanet(planet, pIndex, hoursDelta, canvas.width/2, canvas.height/2, scene);
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
    try { renderer.render(scene); } catch (e) { console.error(e); }
    // Подписи планет и лун поверх WebGL
    drawSystemLabels();
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

    const planetColor = hexToRgbArray(planet.color);
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
      
      const moonColor = hexToRgbArray(moon.color);
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

    if (star.planets && star.planets.planets) {
      star.planets.planets.forEach((planet, pIndex) => {
        const pr = planet.orbitRadius * orbitScale;
        const x = centerX + Math.cos(planet._orbitProgress) * pr;
        const y = centerY + Math.sin(planet._orbitProgress) * pr;
        const sx = x * scale + offsetX;
        const sy = y * scale + offsetY;
        if (showSystemPlanetLabels) {
          labelsCtx.fillStyle = '#ffffff';
          const text = planet.name || `Планета ${pIndex + 1}`;
          labelsCtx.fillText(text, (sx + 12), (sy - 4));
        }

        if (showSystemMoonLabels && planet.moons && planet.moons.length) {
          planet.moons.forEach((moon, mIndex) => {
            const orbitR = (moon.orbitRadius || (8 + mIndex * 5)) * clusterScale;
            const mx = x + Math.cos(moon._orbitProgress) * orbitR;
            const my = y + Math.sin(moon._orbitProgress) * orbitR;
            const msx = mx * scale + offsetX;
            const msy = my * scale + offsetY;
            labelsCtx.fillStyle = '#cfd3d6';
            const mtext = moon.name || `Луна ${mIndex + 1}`;
            labelsCtx.fillText(mtext, (msx + 10), (msy - 3));
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
    window.removeEventListener('resize', onResize);
    try {
      if (labelsCanvas && labelsCanvas.parentNode) labelsCanvas.parentNode.removeChild(labelsCanvas);
    } catch (e) { console.error('Labels overlay cleanup error (system):', e); }
  }
  
  drawSystem();
  return cleanup;
}

