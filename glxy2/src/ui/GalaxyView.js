import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import WebGLRenderer from '../renderers/WebGLRenderer.js';
import { hexToRgbArray } from '../utils/utils.js';

// Cache for text batch optimization (static variables)
let lastVisibleStarsKey = null;
let lastTextBatch = null;

export function renderGalaxy(canvas, stars, explorationSystem, fleetManager, onStarClick) {
  const { width, height } = gameConfig.galaxy.mapSize;
  
  // Initialize WebGL renderer with better error handling
  let renderer;
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
    
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.backgroundColor = 'rgba(200,0,0,0.8)';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '10000';
    errorDiv.innerHTML = `
      <h2>Ошибка инициализации WebGL</h2>
      <p>${error.message}</p>
      <p>Попробуйте обновить страницу или использовать другой браузер.</p>
      <p><a href="https://get.webgl.org/" target="_blank" style="color: white; text-decoration: underline;">Проверить поддержку WebGL</a></p>
    `;
    document.body.appendChild(errorDiv);
    
    throw error;
  }
  // Установка размеров canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderer.setSize(canvas.width, canvas.height);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

    // Create controls after ensuring canvas is ready
    const controls = new CanvasControls(canvas, stars, {
      renderer,
      width, height,
      onPan: () => { /* рендер-петля сама отработает изменения камеры */ },
      onZoom: () => { /* рендер-петля сама отработает изменения камеры */ },
      onStarClick: (star) => handleStarClick(star),
      onFleetClick: (systemId, x, y) => handleFleetClick(systemId, x, y),
      onEmptySpaceClick: () => handleEmptySpaceClick(),
      cameraKey: 'galaxyCamera',
      initialState: {
        offsetX: gameConfig.ui.galaxyCamera.offsetX,
        offsetY: gameConfig.ui.galaxyCamera.offsetY,
        scale: gameConfig.ui.galaxyCamera.scale
      }
    });



  // Simple text cache - only for text rendering
  let textCache = null;
  let lastTextCacheKey = null;
  
  // Simple function to get text cache key
  function getTextCacheKey(offsetX, offsetY, scale) {
    // Only update when camera moves significantly or scale changes
    return `${Math.floor(offsetX / 100)}_${Math.floor(offsetY / 100)}_${Math.floor(scale * 10)}`;
  }
  
  // Get exploration hash for cache invalidation
  function getExplorationHash() {
    let hash = 0;
    stars.forEach(star => {
      hash += star.explored ? star.id * 2 : star.id;
    });
    return hash;
  }
  
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
  
  // Create static canvas for galaxy background
  function createStaticCanvas() {
    if (!staticCanvas) {
      staticCanvas = document.createElement('canvas');
    }
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    return staticCanvas;
  }

  // Handle star clicks with exploration logic
  function handleStarClick(star) {
    const selectedShip = fleetManager.getSelectedShip();
    
    if (selectedShip) {
      // If ship is selected, try to move to clicked star
      moveSelectedShipToStar(selectedShip, star);
    } else {
      // No ship selected - handle star selection
      if (selectedStar === star) {
        // Second click on selected star: view system if explored
        if (star.explored) {
          onStarClick(star);
        }
        selectedStar = null;
      } else {
        // First click: select star
        selectedStar = star;
      }
    }
  }
  
  function moveSelectedShipToStar(ship, targetStar) {
    if (!ship || ship.isMoving) return;
    
    const path = fleetManager.findPath(
      ship.currentSystemId, 
      targetStar.id, 
      ship.capabilities.canEnterUnexplored
    );
    
    if (path && path.length > 1) {
      fleetManager.moveShipAlongPath(ship, path);
    }
  }
  
  function handleFleetClick(systemId, mouseX, mouseY) {
    const fleet = fleetManager.getFleetAtSystem(systemId);
    if (fleet.length === 0) return;
    
    if (fleet.length === 1) {
      // Single ship - select it
      const ship = fleet[0];
      if (fleetManager.selectShip(ship)) {
        gameConfig.ui.selectedShip = ship.id;
      }
    } else {
      // Multiple ships - show dropdown
      gameConfig.ui.fleetDropdownOpen = true;
      gameConfig.ui.fleetDropdownSystemId = systemId;
      gameConfig.ui.fleetDropdownX = mouseX;
      gameConfig.ui.fleetDropdownY = mouseY;
    }
  }
  
  function handleEmptySpaceClick() {
    // Deselect ship when clicking on empty space
    if (fleetManager.getSelectedShip()) {
      fleetManager.deselectShip();
      gameConfig.ui.selectedShip = null;
    }
    
    // Deselect star when clicking on empty space
    if (selectedStar) {
      selectedStar = null;
    }
    
    // Close fleet dropdown if open
    if (gameConfig.ui.fleetDropdownOpen) {
      gameConfig.ui.fleetDropdownOpen = false;
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
    
    // Only render if camera changed or dynamic elements need updating
    if (!cameraChanged && !fleetManager.hasMovingFleets()) {
      return;
    }
    if (cameraChanged) {
      lastCameraState = { offsetX, offsetY, scale };
      staticElementsDirty = true;
    }
    
    // Clear action buttons
    window.actionButtons = [];
    
    // Update fleet manager
    fleetManager.update();
    
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
    
    // Draw dynamic elements (fleets, UI)
    drawDynamicElements(scene);
    
    // Render entire scene
    renderer.render(scene);
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
    drawFleets(scene);
    drawExplorationTimers(scene);
    drawExplorationUI(scene);
  }
  
  function updateBlinkingStarsOptimized() {
    blinkTimer--;
    const now = performance.now();
    if (blinkTimer <= 0) {
      blinkTimer = 300 + Math.floor(Math.random() * 900);
      
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
      const progress = (now - s._blinkStartTime) / 1000;
      s.blinkProgress = progress;
      if (progress >= 1) {
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
        color: [0.2, 0.2, 0.2, 0.3]
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
            baseColor.r / 255 * brightness,
            baseColor.g / 255 * brightness,
            baseColor.b / 255 * brightness,
            1.0
          ];
        } else if (star.explored) {
          const alpha = Math.min(brightness / 1.5, 1);
          color = [1.0, 1.0, 1.0, alpha];
        } else {
          const alpha = Math.min(brightness / 3, 0.6);
          color = [0.4, 0.4, 0.4, alpha];
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

      const pulseRadius = (10 + Math.sin(currentTime * 0.005) * 2) * scale;
      scene.objects.push({
         vertices: [selectedStar.x, selectedStar.y],
         vertexCount: 1,
         drawMode: renderer.gl.POINTS,
         color: [0.29, 0.56, 0.89, 0.4], // #4a90e2 with alpha
         pointSize: pulseRadius
       });
    }
    
    // Draw star names only for visible and nearby stars (PERFORMANCE OPTIMIZATION)
    // Use simplified caching approach
    if (scale > 0.8) { // Reduced from 1.0 to 0.8 to show names earlier
      const currentCacheKey = getTextCacheKey(offsetX, offsetY, scale);
      const currentExplorationHash = getExplorationHash();
      
      // Only rebuild if camera moved significantly or exploration changed
      if (!textCache || 
          lastTextCacheKey !== currentCacheKey || 
          textCache.explorationHash !== currentExplorationHash) {
        
        // Calculate visible area
        const textViewWidth = canvas.width / scale;
        const textViewHeight = canvas.height / scale;
        const textViewLeft = -offsetX / scale;
        const textViewTop = -offsetY / scale;
        const textViewRight = textViewLeft + textViewWidth;
        const textViewBottom = textViewTop + textViewHeight;
        const margin = 100;
        
        const textBatch = {
          type: 'textBatch',
          texts: [],
          positions: [],
          colors: [],
          fontSizes: []
        };
        
        const optimalFontSize = getOptimalFontSize(scale);
        
        // Simple frustum culling - no complex caching
        stars.forEach(star => {
          if (star.x >= textViewLeft - margin && star.x <= textViewRight + margin &&
              star.y >= textViewTop - margin && star.y <= textViewBottom + margin) {
            
            const displayName = star.explored ? star.name : '...';
            const textColor = star.explored ? [1.0, 1.0, 1.0, 0.9] : [0.7, 0.7, 0.7, 0.7];
            
            textBatch.texts.push(displayName);
            textBatch.positions.push(star.x, star.y - 15);
            textBatch.colors.push(...textColor);
            textBatch.fontSizes.push(optimalFontSize);
          }
        });
        
        textCache = textBatch;
        textCache.explorationHash = currentExplorationHash;
        lastTextCacheKey = currentCacheKey;
      }
      
      // Use cached text batch
      if (textCache && textCache.texts.length > 0) {
        scene.objects.push(textCache);
      }
    }
  }

  // LOD (Level of Detail) system
  function getLODLevel(scale) {
    if (scale >= 1.0) return 1; // High detail
    if (scale >= 0.5) return 2; // Medium detail
    if (scale >= 0.2) return 3; // Low detail
    return 4; // Very low detail
  }

  // Calculate optimal font size based on zoom level
  function getOptimalFontSize(scale) {
    // Base font size is 12px (100%), calculate proportionally
    const baseFontSize = 20;
    
    // Direct mathematical relationship: fontScale = scale^0.3 * 0.8 + 0.2
    // This gives smooth scaling from ~6px at scale=0.5 to ~16px at scale=2.0
    const fontScale = Math.pow(scale, 0.3) * 0.8 + 0.2;
    
    // return Math.round(baseFontSize * fontScale);
    return Math.round(baseFontSize * fontScale);
  }

  // Create hexagon object with position and geometry
  function createHexagonObject(systemId, star, fleet) {
    return {
      systemId: systemId,
      x: star.x - 15,
      y: star.y + 15,
      size: 12,
      shipCount: fleet.length,
      star: star,
      fleet: fleet
    };
  }
  
  // Get all hexagon objects for current frame
  function getHexagonObjects() {
    const hexagons = [];
    for (const [systemId, fleet] of fleetManager.fleets) {
      if (fleet.length === 0) continue;
      
      const star = stars[systemId];
      if (!star) continue;
      
      hexagons.push(createHexagonObject(systemId, star, fleet));
    }
    return hexagons;
  }
  
  function drawFleets(scene) {
    const { scale } = controls.getCameraState();
    // Get all hexagon objects for this frame
    const hexagons = getHexagonObjects();
    window.currentHexagons = hexagons;
    
    // Draw hexagons
    hexagons.forEach(hex => {
      // Generate hexagon vertices centered at (0,0)
      const localVertices = generateHexagonVertices(0, 0, hex.size);
      
      // Transform vertices to world coordinates (star position)
      const worldVertices = [];
      for (let i = 0; i < localVertices.length; i += 2) {
        worldVertices.push(localVertices[i] + hex.star.x);     // x coordinate
        worldVertices.push(localVertices[i + 1] + hex.star.y); // y coordinate
      }
      
      const hexIndices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5];
      
      scene.objects.push({
        type: 'polygon',
        vertices: worldVertices,
        indices: hexIndices,
        drawMode: renderer.gl.TRIANGLES,
        color: hex.isSelected ? [0.4, 0.8, 1.0, 0.8] : [0.0, 0.4, 0.8, 0.7]
      });
      
      // Ship count text
      scene.objects.push({
         type: 'point',
         vertices: [hex.star.x, hex.star.y],
         drawMode: renderer.gl.POINTS,
         color: [1.0, 1.0, 1.0, 1.0],

        pointSize: 12 * scale
       });
    });
    
    // Draw moving ships
    for (const fleet of fleetManager.fleets.values()) {
      for (const ship of fleet) {
        if (ship.isMoving) {
          drawMovingShip(ship, scene);
        }
      }
    }
  }
  
  function generateHexagonVertices(x, y, size) {
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      vertices.push(x + size * Math.cos(angle));
      vertices.push(y + size * Math.sin(angle));
    }
    return vertices;
  }
  
  // function drawHexagon(x, y, size, shipCount, systemId) {
    // const selectedShip = fleetManager.getSelectedShip();
    // const isSelected = selectedShip && selectedShip.currentSystemId === parseInt(systemId);
    
    // // Основной шестиугольник
    // ctx.beginPath();
    // for (let i = 0; i < 6; i++) {
      // const angle = (Math.PI / 3) * i;
      // const pointX = x + size * Math.cos(angle);
      // const pointY = y + size * Math.sin(angle);
      
      // if (i === 0) {
        // ctx.moveTo(pointX, pointY);
      // } else {
        // ctx.lineTo(pointX, pointY);
      // }
    // }
    // ctx.closePath();
    
    // // Цвет в зависимости от выделения
    // if (isSelected) {
      // ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
      // ctx.strokeStyle = '#fff';
      // ctx.lineWidth = 2;
    // } else {
      // ctx.fillStyle = 'rgba(0, 100, 200, 0.7)';
      // ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      // ctx.lineWidth = 1;
    // }
    
    // ctx.fill();
    // ctx.stroke();
    
    // // Количество кораблей
    // ctx.fillStyle = '#fff';
    // ctx.font = 'bold 12px sans-serif';
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'middle';
    // ctx.fillText(shipCount.toString(), x, y);
  // }
  

  // function drawMovingShip(ship, scene) {
    // const position = fleetManager.getShipPosition(ship);
    // const currentStar = starsLookupMap.get(ship.currentSystemId);
    // const targetStar = starsLookupMap.get(ship.targetSystemId);
    
    // if (!currentStar || !targetStar) return;
    
    // Draw ship path
    // if (ship.path && ship.path.length > 1) {
      // for (let i = 1; i < ship.path.length - 1; i++) {
        // const fromStar = starsLookupMap.get(ship.path[i]);
        // const toStar = starsLookupMap.get(ship.path[i + 1]);
        
        // if (fromStar && toStar) {
          // scene.objects.push({
            // type: 'line',
            // vertices: [fromStar.x, fromStar.y, toStar.x, toStar.y],
            // vertexCount: 2,
            // drawMode: renderer.gl.LINES,
            // color: [0.0, 0.5, 0.8, 0.4]
          // });
        // }
      // }
      
      // Current segment
      // scene.objects.push({
        // type: 'line',
        // vertices: [currentStar.x, currentStar.y, targetStar.x, targetStar.y],
        // vertexCount: 2,
        // drawMode: renderer.gl.LINES,
        // color: [0.0, 0.67, 1.0, 0.8]
      // });
    // } else {
      // Single segment
      // scene.objects.push({
        // type: 'line',
        // vertices: [currentStar.x, currentStar.y, targetStar.x, targetStar.y],
        // vertexCount: 2,
        // drawMode: renderer.gl.LINES,
        // color: [0.0, 0.67, 1.0, 0.8]
      // });
    // }
    
    // Draw ship
    // const shipVertices = [
      // -8, -4,
       // 8,  0,
      // -8,  4
    // ];
    
    // scene.objects.push({
      // type: 'polygon',
      // vertices: shipVertices,
      // drawMode: renderer.gl.TRIANGLES,
      // color: [0.0, 0.67, 1.0, 0.9]
    // });
  // }
  
  function drawExplorationTimers() {
    // Отрисовка кольца исследования вокруг целевой системы
    // Поиск скаутов, которые в процессе исследования
    for (const fleet of fleetManager.fleets.values()) {
      for (const ship of fleet) {
        if (ship.isExploring && ship.currentSystemId !== null) {
          const targetStar = starsLookupMap.get(ship.currentSystemId); // Fast lookup
          if (targetStar) {
            // Рассчитываем прогресс исследования на основе времени using milliseconds
            const scout = gameConfig.player.scout;
            let progress = 0;
            if (scout.isExploring && scout.explorationStartTime && scout.explorationDuration > 0) {
              const elapsed = Date.now() - scout.explorationStartTime;
              progress = Math.min(elapsed / scout.explorationDuration, 1);
            }
            
            ctx.save();
            ctx.translate(targetStar.x, targetStar.y);
            
            // Основное кольцо (без анимации размера)
            const radius = 22; // Фиксированный радиус
            const lineWidth = 3;
            
            // Фоновое кольцо
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            
            // Прогресс-кольцо
            const startAngle = -Math.PI / 2; // Начинаем с верха
            const endAngle = startAngle + (progress * Math.PI * 2);
            
            ctx.beginPath();
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.strokeStyle = '#4a90e2';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Подсчитываем изученные/всего объекты
            const totalObjects = explorationSystem.calculateSystemComplexity(targetStar);
            const studiedObjects = Math.floor(progress * totalObjects);
            
            // Отображаем текст "изученные/всего" в центре
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${studiedObjects}/${totalObjects}`, 0, 0);
            
            ctx.restore();
          }
        }
      }
    }
  }
  
  function drawExplorationUI(scene) {

  }
  
  function drawFleetDropdown() {
    if (!gameConfig.ui.fleetDropdownOpen) return;
    
    const systemId = gameConfig.ui.fleetDropdownSystemId;
    const fleet = fleetManager.getFleetAtSystem(systemId);
    if (!fleet || fleet.length === 0) {
      gameConfig.ui.fleetDropdownOpen = false;
      return;
    }
    
    const dropdownX = gameConfig.ui.fleetDropdownX || 100;
    const dropdownY = gameConfig.ui.fleetDropdownY || 100;
    const itemHeight = 30;
    const dropdownWidth = 200;
    const maxVisibleItems = 5;
    const visibleItems = Math.min(fleet.length, maxVisibleItems);
    const dropdownHeight = visibleItems * itemHeight;
    
    // Фон выпадающего списка
    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    ctx.fillRect(dropdownX, dropdownY, dropdownWidth, dropdownHeight);
    
    // Обводка
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(dropdownX, dropdownY, dropdownWidth, dropdownHeight);
    
    // Отрисовка кораблей
    for (let i = 0; i < visibleItems; i++) {
      const ship = fleet[i];
      const itemY = dropdownY + i * itemHeight;
      
      // Подсветка при наведении (TODO: реализовать отслеживание мыши)
      const isHovered = false;
      if (isHovered) {
        ctx.fillStyle = 'rgba(70, 70, 90, 0.8)';
        ctx.fillRect(dropdownX, itemY, dropdownWidth, itemHeight);
      }
      
      // Иконка корабля
      ctx.fillStyle = ship.isMoving ? 'rgba(0, 170, 255, 0.5)' : getShipColor(ship);
      ctx.fillRect(dropdownX + 5, itemY + 8, 14, 14);
      
      // Название корабля
      ctx.fillStyle = ship.isMoving ? '#999' : '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ship.name, dropdownX + 25, itemY + 20);
      
      // Статус
      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.fillText(ship.status, dropdownX + 25, itemY + 35);
      
      // Make dropdown item clickable (only if ship can be selected)
      if (!ship.isMoving) {
        drawActionButton(dropdownX, itemY, dropdownWidth, itemHeight, '', () => {
          // Select this ship
          if (fleetManager.selectShip(ship)) {
            gameConfig.ui.selectedShip = ship.id;
          }
          // Close dropdown
          gameConfig.ui.fleetDropdownOpen = false;
        });
      }
    }
    
    // Скроллбар (если нужен)
    if (fleet.length > maxVisibleItems) {
      const scrollbarX = dropdownX + dropdownWidth - 10;
      const scrollbarHeight = dropdownHeight;
      const thumbHeight = (visibleItems / fleet.length) * scrollbarHeight;
      
      // Фон скроллбара
      ctx.fillStyle = '#333';
      ctx.fillRect(scrollbarX, dropdownY, 10, scrollbarHeight);
      
      // Ползунок
      ctx.fillStyle = '#666';
      ctx.fillRect(scrollbarX + 1, dropdownY, 8, thumbHeight);
    }
  }
  
  function drawSelectedShipPanel() {
    const selectedShip = fleetManager.getSelectedShip();
    if (!selectedShip) return;
    
    const panelWidth = 250;
    const panelHeight = 150;
    const panelX = canvas.width - panelWidth - 20;
    const panelY = 20;
    
    // Фон панели
    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Обводка
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Заголовок
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(selectedShip.name, panelX + 10, panelY + 25);
    
    // Тип корабля
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Type: ${selectedShip.type}`, panelX + 10, panelY + 45);
    
    // Статус
    ctx.fillText(`Status: ${selectedShip.status}`, panelX + 10, panelY + 65);
    
    // Местоположение
    const currentStar = stars[selectedShip.currentSystemId];
    if (currentStar) {
      ctx.fillText(`Location: ${currentStar.name}`, panelX + 10, panelY + 85);
    }
    
    // Кнопки действий
    if (selectedShip.capabilities.canExplore && currentStar && !currentStar.explored) {
      drawActionButton(panelX + 10, panelY + 105, 80, 25, 'Explore', () => {
        if (selectedShip.status === 'idle') {
          fleetManager.startScoutExploration(selectedShip);
        }
      });
    }
    
    // Кнопка отмены выбора
    drawActionButton(panelX + panelWidth - 90, panelY + 105, 80, 25, 'Deselect', () => {
      fleetManager.deselectShip();
      gameConfig.ui.selectedShip = null;
    });
  }
  
  function drawActionButton(x, y, width, height, text, onClickCallback) {
    // Only draw visible button if text is provided
    if (text) {
      // Кнопка
      ctx.fillStyle = 'rgba(70, 130, 200, 0.8)';
      ctx.fillRect(x, y, width, height);
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      
      // Текст
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, x + width/2, y + height/2 + 4);
    }
    
    // Store button info for click detection (always, even for invisible buttons)
    if (!window.actionButtons) window.actionButtons = [];
    window.actionButtons.push({
      x, y, width, height, 
      onClick: onClickCallback,
      text: text || 'invisible'
    });
  }
  
  function getShipColor(ship) {
    switch (ship.type) {
      case 'scout': return '#0af';
      case 'corvette': return '#f84';
      default: return '#888';
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
      // Cancel fleet dropdown or deselect ship/star
      if (gameConfig.ui.fleetDropdownOpen) {
        gameConfig.ui.fleetDropdownOpen = false;
      } else if (fleetManager.getSelectedShip()) {
        fleetManager.deselectShip();
        gameConfig.ui.selectedShip = null;
      } else if (selectedStar) {
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
    if (renderer) {
      renderer.cleanup();
    }
  }

  // Return the draw function and cleanup
  return { draw, cleanup };
}