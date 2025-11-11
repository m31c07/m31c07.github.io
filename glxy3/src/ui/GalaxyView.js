import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray } from '../utils/utils.js';

// Cache for text batch optimization (static variables)
// Text rendering removed

export function renderGalaxy(canvas, stars, explorationSystem, fleetManager, onStarClick) {
  const { width, height } = gameConfig.galaxy.mapSize;
  
  // Initialize WebGL renderer with better error handling
  let renderer;
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
      onPan: () => { /* рендер-петля сама отработает изменения камеры */ },
      onZoom: () => { /* рендер-петля сама отработает изменения камеры */ },
      onStarClick: (star) => handleStarClick(star),
      onEmptySpaceClick: () => handleEmptySpaceClick(),
      cameraKey: 'galaxyCamera',
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
  
  // Static elements cache
  let cachedStaticElements = null;
  let staticElementsDirty = true;
  
  // Animation state
  const blinkingStars = new Set();
  let blinkTimer = 0;
  let animationFrameId;
  let selectedStar = null;
  let lastFrameTime = 0;
  let starsLookupMap = new Map();
  let lastCameraState = null;
  
  // Build lookup map for performance
  stars.forEach(star => {
    starsLookupMap.set(star.id, star);
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
    
    // Frame limiting (60 FPS) - improved to reduce resource usage
    if (currentTime - lastFrameTime < 16.66) {
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
    if (!cameraChanged) {
      return;
    }
    if (cameraChanged) {
      lastCameraState = { offsetX, offsetY, scale };
      staticElementsDirty = true;
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

        // Determine star color
        let color;
        if (star.owner != null) {
          const baseColor = hexToRgbArray(gameConfig.empireColors[star.owner]);
          color = [
            baseColor[0] * brightness,
            baseColor[1] * brightness,
            baseColor[2] * brightness,
            1.0
          ];
        } else if (star.explored) {
          // const alpha = Math.min(brightness / 1.5, 1);
          color = [1.0, 1.0, 1.0, 1];
        } else {
          // const alpha = Math.min(brightness / 3, 0.6);
          color = [0.4, 0.4, 0.4, 1];
        }
        
        // Add star to batch
        starVertices.push(star.x, star.y);
        starColors.push(...color);
        starSizes.push(5 * scale); // scale-dependent star size
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

  // Подписи звёзд на 2D-оверлее
  function drawStarLabels() {
    if (!labelsCtx) return;
    // Очищаем оверлей
    labelsCtx.clearRect(0, 0, labelsCanvas.width, labelsCanvas.height);
    const { offsetX, offsetY, scale } = controls.getCameraState();
    // Порог видимости подписей
    if (!gameConfig.ui.showStarLabels || scale < gameConfig.ui.starLabelZoomThreshold) {
      return;
    }
    // Рассчитываем видимую область в мировых координатах
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const viewLeft = -offsetX / scale;
    const viewTop = -offsetY / scale;
    const viewRight = viewLeft + viewWidth;
    const viewBottom = viewTop + viewHeight;
    const margin = 80;

    // Настройки текста
    labelsCtx.font = '12px Arial';
    labelsCtx.textAlign = 'left';
    // Обходим только видимые звёзды
    for (const star of stars) {
      if (star.x >= viewLeft - margin && star.x <= viewRight + margin &&
          star.y >= viewTop - margin && star.y <= viewBottom + margin) {
        const sx = star.x * scale + offsetX;
        const sy = star.y * scale + offsetY;
        const label = star.name || gameConfig.exploration.unexploredSystemName;
        // Цвет текста: белый для исследованных, серый для неизвестных, цвет империи если есть владелец
        let color = '#FFFFFF';
        if (star.owner != null) {
          color = gameConfig.empireColors[star.owner] || '#FFFFFF';
        } else if (!star.explored) {
          color = 'rgba(200,200,200,0.85)';
        }
        // Лёгкая тень для читаемости
        labelsCtx.fillStyle = 'rgba(0,0,0,0.6)';
        labelsCtx.fillText(label, sx + 8 + 1, sy - 10 + 1);
        labelsCtx.fillStyle = color;
        labelsCtx.fillText(label, sx + 8, sy - 10);
      }
    }
  }

  // Запуск анимации - OPTIMIZED with frame limiting
  function renderLoop() {
    draw(); // draw() now handles its own frame limiting
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