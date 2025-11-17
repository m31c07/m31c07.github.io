import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray, advanceCalendarByHours } from '../utils/utils.js';

// Cache for text batch optimization (static variables)
// Text rendering removed

export function renderGalaxy(canvas, stars, explorationSystem, fleetManager, onStarClick) {
  const { width, height } = gameConfig.galaxy.mapSize;
  
  // Initialize WebGL renderer with better error handling
  let renderer;
  let cachedStaticElements = null;
  let staticElementsDirty = true;
  const blinkingStars = new Set();
  let blinkTimer = 0;
  let animationFrameId;
  let selectedStar = null;
  let lastFrameTime = 0;
  let starsLookupMap = new Map();
  let lastCameraState = null;
  let lastUpdateTime = performance.now();
  let labelsRenderList = null;
  let labelsRenderPtr = 0;
  let labelsNeedsRebuild = true;
  // Canvas для подписей звёзд (оверлей 2D поверх WebGL)
  let labelsCanvas = null;
  let labelsCtx = null;
  try {
    // Ensure canvas is visible and has size
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
      console.warn('Canvas has zero size, forcing resize');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    renderer = new WebGLRenderer(canvas);
    console.log('WebGL renderer initialized');
  } catch (error) {
    console.error('WebGL initialization failed:', error);
    throw error;
  }
  // Установка размеров canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setSize(canvas.width, canvas.height);
    // Синхронизируем размер оверлея с основным канвасом
    if (labelsCanvas) {
      labelsCanvas.width = canvas.width;
      labelsCanvas.height = canvas.height;
    }
    staticElementsDirty = true;
    lastCameraState = null;
    try { draw(); } catch (_) {}
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Создаём оверлей для 2D-текста
  labelsCanvas = document.createElement('canvas');
  labelsCanvas.id = 'labels-overlay';
  labelsCanvas.style.position = 'fixed';
  labelsCanvas.style.top = '0';
  labelsCanvas.style.left = '0';
  labelsCanvas.style.pointerEvents = 'none';
  labelsCanvas.width = canvas.width;
  labelsCanvas.height = canvas.height;
  document.body.appendChild(labelsCanvas);
  labelsCtx = labelsCanvas.getContext('2d');
  labelsCtx.textBaseline = 'middle';
  labelsCtx.font = '12px Arial';

    // Create controls after ensuring canvas is ready
    const controls = new CanvasControls(canvas, stars, {
      renderer,
      width, height,
      onPan: () => {},
      onZoom: () => {},
      onStarClick: (star) => handleStarClick(star),
      onEmptySpaceClick: () => handleEmptySpaceClick(),
      cameraKey: 'galaxyCamera',
      panBounds: {
        centerX: width / 2,
        centerY: height / 2,
        limit: Math.max(0, Number(gameConfig?.galaxy?.outerRadius ?? 0) * 1.0)
      },
      zoomLimits: gameConfig?.ui?.zoomLimits || { min: 0.01, max: 2.0 },
      initialState: {
        offsetX: gameConfig.ui.galaxyCamera.offsetX,
        offsetY: gameConfig.ui.galaxyCamera.offsetY,
        scale: gameConfig.ui.galaxyCamera.scale
      }
    });

  // Simple text cache - only for text rendering
  // Text rendering removed
  
  // Simple function to get text cache key
  // Text rendering removed
  
  // Get exploration hash for cache invalidation
  // Text rendering removed
  
  
  
  // Build lookup map for performance
  stars.forEach(star => {
    starsLookupMap.set(star.id, star);
    if (!star._spectralColor) {
      const c = hexToRgbArray(getStarColor(star.spectralType));
      star._spectralColor = c;
    }
  });
  
  // Handle star clicks with exploration logic
  function handleStarClick(star) {
    // If star is explored, immediately open the star system view
    if (star.explored && typeof onStarClick === 'function') {
      onStarClick(star);
    } else {
      // For unexplored stars, just select them
      selectedStar = star;
    }
  }
  
  function handleEmptySpaceClick() {
    // Deselect star when clicking on empty space
    if (selectedStar) {
      selectedStar = null;
    }
  }

  // Main optimized draw function
  function draw() {
    const currentTime = performance.now();
    const targetFps = Number(gameConfig?.ui?.targetFps ?? 60);
    const minFrameMs = 1000 / targetFps;
    if (currentTime - lastFrameTime < minFrameMs) {
      return;
    }
    lastFrameTime = currentTime;
    
    const { offsetX, offsetY, scale } = controls.getCameraState();
    
    // Check if camera moved
    const cameraChanged = !lastCameraState ||
      Math.abs(lastCameraState.offsetX - offsetX) > 0.1 ||
      Math.abs(lastCameraState.offsetY - offsetY) > 0.1 ||
      Math.abs(lastCameraState.scale - scale) > 0.001;
    
    // Only render if camera changed
    if (!cameraChanged && labelsRenderList && labelsRenderPtr < (labelsRenderList?.length || 0)) {
      drawStarLabels();
      return;
    }
    if (cameraChanged) {
      lastCameraState = { offsetX, offsetY, scale };
      staticElementsDirty = true;
      labelsNeedsRebuild = true;
    }
    
    // Clear action buttons
    window.actionButtons = [];
    
    // Prepare projection matrix
    const projectionMatrix = new Float32Array([
      2 / canvas.width, 0, 0, 0,
      0, -2 / canvas.height, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1
    ]);
    
    // Prepare view matrix for WebGL
    const viewMatrix = new Float32Array([
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, 1, 0,
      offsetX, offsetY, 0, 1
    ]);
    
    renderer.setCamera(projectionMatrix, viewMatrix);
    
    // Prepare scene objects
    const scene = { objects: [] };
    
    // Draw static elements (stars, hyperlanes)
    if (staticElementsDirty) {
      drawStaticElements(scene);
      staticElementsDirty = false;
    } else {
      drawStaticFromCache(scene);
    }
    
    // Draw dynamic elements
    drawDynamicElements(scene);
    
    // Render entire scene
    renderer.render(scene);

    // Рисуем названия звёзд поверх WebGL
    drawStarLabels();
  }

  function drawStaticElements(scene) {
    updateBlinkingStarsOptimized();
    drawHyperlanesOptimized(scene);
    drawStarsOptimized(scene);
    
    // Cache static elements for reuse
    cachedStaticElements = [...scene.objects];
  }
  
  function drawStaticFromCache(scene) {
    // Use cached static elements - NO redundant recalculation
    if (cachedStaticElements) {
      scene.objects.push(...cachedStaticElements);
    } else {
      drawStaticElements(scene);
    }
  }
  
  function drawDynamicElements(scene) {
    // Draw selected star highlight
    if (selectedStar) {
      const currentTime = performance.now();
      const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
      const freq = 0.003 * speed; // lowered base frequency; scales with global speed
      // Main highlight
      scene.objects.push({
         vertices: [selectedStar.x, selectedStar.y],
         vertexCount: 1,
         drawMode: renderer.gl.POINTS,
         color: [0.29, 0.56, 0.89, 1.0], // #4a90e2

        pointSize: 8 * controls.getCameraState().scale
       });
      
      // Pulsing effect
      const basePulse = 10;
      const pulseRadius = (basePulse + (speed > 0 ? Math.sin(currentTime * freq) * 2 : 0)) * controls.getCameraState().scale;
      scene.objects.push({
         vertices: [selectedStar.x, selectedStar.y],
         vertexCount: 1,
         drawMode: renderer.gl.POINTS,
         color: [0.29, 0.56, 0.89, 0.4], // #4a90e2 with alpha
         pointSize: pulseRadius
       });
    }
  }
  
  function updateBlinkingStarsOptimized() {
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    if (speed === 0) {
      // Pause blinking animation progression when speed is 0
      return;
    }
    blinkTimer--;
    const now = performance.now();
    if (blinkTimer <= 0) {
      // Reduce blinking frequency overall
      blinkTimer = 900 + Math.floor(Math.random() * 1200);
      
      // Simple approach - just pick random stars from all stars
      const count = Math.min(1 + Math.floor(Math.random() * 3), stars.length);
      for (let i = 0; i < count; i++) {
        const star = stars[Math.floor(Math.random() * stars.length)];
        if (!blinkingStars.has(star.id)) {
          blinkingStars.add(star.id);
          star._blinkStartTime = now;
          star.blinkProgress = 0;
        }
      }
    }
    
    // Advance progress and prune invisible/expired blinking stars
    for (const id of Array.from(blinkingStars)) {
      const s = starsLookupMap.get(id);
      if (!s || s._blinkStartTime == null) {
        blinkingStars.delete(id);
        continue;
      }
      const blinkDurationSec = 1.5 / Math.max(speed, 0.25); // slower, scales with speed
      const progress = (now - s._blinkStartTime) / 1000;
      s.blinkProgress = progress;
      if (progress >= blinkDurationSec) {
        blinkingStars.delete(id);
        s._blinkStartTime = null;
      }
    }
  }

  // Restored: draw hyperlanes with simple frustum culling
  function drawHyperlanesOptimized(scene) {
    const { offsetX, offsetY, scale } = controls.getCameraState();
    const minScale = Number(gameConfig?.ui?.hyperlaneZoomHideThreshold ?? 0.3);
    if (scale <= minScale) return;

    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const viewLeft = -offsetX / scale;
    const viewTop = -offsetY / scale;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;
    const margin = 200;

    const hyperlaneVertices = [];
    stars.forEach(star => {
      if (star.connections && star.connections.length > 0) {
        star.connections.forEach(connectedId => {
          if (star.id < connectedId) { // Avoid duplicate lines
            const connectedStar = starsLookupMap.get(connectedId);
            if (connectedStar) {
              const star1Visible = star.x >= viewLeft - margin && star.x <= viewRight + margin &&
                                   star.y >= viewTop - margin && star.y <= viewBottom + margin;
              const star2Visible = connectedStar.x >= viewLeft - margin && connectedStar.x <= viewRight + margin &&
                                   connectedStar.y >= viewTop - margin && connectedStar.y <= viewBottom + margin;
              if (star1Visible || star2Visible) {
                hyperlaneVertices.push(star.x, star.y, connectedStar.x, connectedStar.y);
              }
            }
          }
        });
      }
    });

    if (hyperlaneVertices.length > 0) {
      scene.objects.push({
        type: 'lineBatch',
        vertices: hyperlaneVertices,
        vertexCount: hyperlaneVertices.length / 2,
        drawMode: renderer.gl.LINES,
        color: [0.2, 0.2, 0.2, 1]
      });
    }
  }
  
  function drawStarsOptimized(scene) {
    const currentTime = performance.now();
    const { offsetX, offsetY, scale } = controls.getCameraState();
    
    // Simple approach - calculate visible area once
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const viewLeft = -offsetX / scale;
    const viewTop = -offsetY / scale;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;
    const margin = 100;
    
    const starVertices = [];
    const starColors = [];
    const starSizes = [];
    
    // Simple frustum culling - no complex caching
    stars.forEach(star => {
      if (star.x >= viewLeft - margin && star.x <= viewRight + margin &&
          star.y >= viewTop - margin && star.y <= viewBottom + margin) {
        
        let brightness = 1;
        if (blinkingStars.has(star.id)) {
          const progress = star.blinkProgress || 0;
          if (progress >= 1) {
            blinkingStars.delete(star.id);
          } else {
            brightness = 1 + Math.sin(progress * Math.PI) * 2;
          }
        }

        let color;
        if (star.explored) {
          const baseColor = star._spectralColor || hexToRgbArray(getStarColor(star.spectralType));
          const t = scale < 1 ? 0.5 : Math.min(1, (scale - 1) / 1);
          const spectral = [
            baseColor[0] * brightness,
            baseColor[1] * brightness,
            baseColor[2] * brightness,
            1.0
          ];
          const white = [1.0, 1.0, 1.0, 1.0];
          color = [
            white[0] + (spectral[0] - white[0]) * t,
            white[1] + (spectral[1] - white[1]) * t,
            white[2] + (spectral[2] - white[2]) * t,
            1.0
          ];
        } else {
          color = [0.4, 0.4, 0.4, 1];
        }
        
        // Add star to batch
        starVertices.push(star.x, star.y);
        starColors.push(...color);
        const starSizePx = 5 * scale;
        starSizes.push(starSizePx); // scale-dependent star size

        // Ownership ring around owned stars (empire color)
        if (star.owner != null) {
          const segments = 24;
          const empireColor = hexToRgbArray(gameConfig.empireColors[star.owner]);
          const starRadiusPx = starSizePx ;
          const ringRadiusPx = (starRadiusPx) ;
          const ringRadiusWorld = starSizePx / scale;
          const ringVerts = [];
          for (let i = 0; i < segments; i++) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            const x1 = star.x + Math.cos(a1) * ringRadiusWorld;
            const y1 = star.y + Math.sin(a1) * ringRadiusWorld;
            const x2 = star.x + Math.cos(a2) * ringRadiusWorld;
            const y2 = star.y + Math.sin(a2) * ringRadiusWorld;
            ringVerts.push(x1, y1, x2, y2);
          }
          scene.objects.push({
            type: 'lineBatch',
            vertices: ringVerts,
            vertexCount: ringVerts.length / 2,
            drawMode: renderer.gl.LINES,
            color: empireColor
          });
        }
      }
    });
    
    // Add batch to scene only if we have visible stars
    if (starVertices.length > 0) {
      scene.objects.push({
        type: 'pointBatch',
        vertices: starVertices,
        colors: starColors,
        sizes: starSizes,
        vertexCount: starVertices.length / 2
      });
    }
    
    // Add selected stars separately
    if (selectedStar) {
      // Main highlight
      scene.objects.push({
         vertices: [selectedStar.x, selectedStar.y],
         vertexCount: 1,
         drawMode: renderer.gl.POINTS,
         color: [0.29, 0.56, 0.89, 1.0], // #4a90e2

        pointSize: 8 * scale
       });
      
      // Pulsing effect
      const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
      const freq = 0.003 * speed; // lowered base frequency; scales with global speed
      const basePulse = 10;
      const pulseRadius = (basePulse + (speed > 0 ? Math.sin(currentTime * freq) * 2 : 0)) * scale;
      scene.objects.push({
         vertices: [selectedStar.x, selectedStar.y],
         vertexCount: 1,
         drawMode: renderer.gl.POINTS,
         color: [0.29, 0.56, 0.89, 0.4], // #4a90e2 with alpha
         pointSize: pulseRadius
       });
    }
  }

  function getStarColor(spectralType) {
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

  // Подписи звёзд на 2D-оверлее
  function drawStarLabels() {
    if (!labelsCtx) return;
    const firstChunk = labelsNeedsRebuild;
    if (firstChunk) {
      labelsCtx.clearRect(0, 0, labelsCanvas.width, labelsCanvas.height);
    }
    const { offsetX, offsetY, scale } = controls.getCameraState();
    {
      const levels = Array.isArray(gameConfig?.ui?.zoomLevels) && gameConfig.ui.zoomLevels.length > 0
        ? gameConfig.ui.zoomLevels
        : [0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1.0, 1.3, 1.6, 2.0];
      let closest = levels[0];
      let diff = Math.abs(scale - closest);
      for (let i = 1; i < levels.length; i++) {
        const d = Math.abs(scale - levels[i]);
        if (d < diff) { diff = d; closest = levels[i]; }
      }
      const idx = Math.max(0, levels.indexOf(closest));
      const pct = Math.round(scale * 100);
      const text = `Zoom L${idx + 1} (${pct}%)`;
      const fontSize = 12;
      const padding = 8;
      labelsCtx.font = `${fontSize}px Arial`;
      const w = Math.ceil(labelsCtx.measureText(text).width) + padding * 2;
      const h = fontSize + padding * 2;
      const x = labelsCanvas.width - w - 16;
      const y = labelsCanvas.height - h - 16;
      labelsCtx.fillStyle = 'rgba(0,0,0,0.55)';
      labelsCtx.fillRect(x, y, w, h);
      labelsCtx.fillStyle = '#FFFFFF';
      labelsCtx.fillText(text, x + padding, y + h / 2);
    }
    if (!gameConfig.ui.showStarLabels || scale < gameConfig.ui.starLabelZoomThreshold) {
      labelsRenderList = null;
      labelsRenderPtr = 0;
      labelsNeedsRebuild = true;
      return;
    }
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const viewLeft = -offsetX / scale;
    const viewTop = -offsetY / scale;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;
    const margin = 80;
    labelsCtx.font = '12px Arial';
    labelsCtx.textAlign = 'left';
    if (labelsNeedsRebuild) {
      const list = [];
      for (const star of stars) {
        if (star.x >= viewLeft - margin && star.x <= viewRight + margin &&
            star.y >= viewTop - margin && star.y <= viewBottom + margin) {
          list.push(star);
        }
      }
      labelsRenderList = list;
      labelsRenderPtr = 0;
      labelsNeedsRebuild = false;
    }
    if (!labelsRenderList || labelsRenderList.length === 0) return;
    const maxPerFrame = 150;
    const end = Math.min(labelsRenderList.length, labelsRenderPtr + maxPerFrame);
    for (let i = labelsRenderPtr; i < end; i++) {
      const star = labelsRenderList[i];
      const sx = star.x * scale + offsetX;
      const sy = star.y * scale + offsetY;
      const label = star.name || gameConfig.exploration.unexploredSystemName;
      let color = '#FFFFFF';
      if (star.owner != null) {
        color = gameConfig.empireColors[star.owner] || '#FFFFFF';
      } else if (!star.explored) {
        color = 'rgba(200,200,200,0.85)';
      }
      labelsCtx.fillStyle = 'rgba(0,0,0,0.6)';
      labelsCtx.fillText(label, sx + 9, sy - 9);
      labelsCtx.fillStyle = color;
      labelsCtx.fillText(label, sx + 8, sy - 10);
    }
    labelsRenderPtr = end;
  }

  // Запуск анимации - OPTIMIZED with frame limiting
  function renderLoop() {
    const now = performance.now();
    const dt = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    const speed = Math.max(0, Number(gameConfig?.ui?.simulationSpeed ?? 1));
    const secondsPerGameHour = Math.max(0.001, Number(gameConfig?.ui?.secondsPerGameHour ?? 1));
    const hoursDelta = (dt * speed) / secondsPerGameHour;
    advanceCalendarByHours(hoursDelta);
    gameConfig.ui.simulationPaused = speed === 0;
    draw();
    animationFrameId = requestAnimationFrame(renderLoop);
  }
  
  animationFrameId = requestAnimationFrame(renderLoop);
  
  // Keyboard controls
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      // Deselect star when clicking on empty space
      if (selectedStar) {
        selectedStar = null;
      }
    }
  }
  
  document.addEventListener('keydown', handleKeyDown);

  // Cleanup function to prevent memory leaks
  function cleanup() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener('resize', resizeCanvas);
    // Remove keyboard listener added in this view
    document.removeEventListener('keydown', handleKeyDown);
    // Destroy interaction controls to detach mouse/touch/wheel listeners
    if (controls && typeof controls.destroy === 'function') {
      try { controls.destroy(); } catch (e) { console.error('Controls destroy error (galaxy):', e); }
    }
    // Clear global UI interaction arrays to avoid stale references
    window.actionButtons = [];
    if (renderer) {
      renderer.cleanup();
    }
    // Удаляем оверлей
    if (labelsCanvas && labelsCanvas.parentNode) {
      labelsCanvas.parentNode.removeChild(labelsCanvas);
      labelsCanvas = null;
      labelsCtx = null;
    }
  }

  // Return the draw function and cleanup
  return { draw, cleanup };
}