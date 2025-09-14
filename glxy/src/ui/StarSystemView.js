// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';
import { generatePlanetTexture, generatePlanetUVTexture } from '../utils/proceduralTextures.js';
import { 
  createPlanetBitmap, 
  renderPlanetWithRotation, 
  createMoonBitmap, 
  renderMoonWithRotation, 
  createFallbackMoonTexture, 
  renderDetailMoonWithRotation, 
  getSurfaceHeight, 
  planetHasAtmosphere, 
  getAtmosphereColor, 
  hexToRgb 
} from './PlanetView.js';

export function renderStarSystem(canvas, star, explorationSystem, onBack) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const ctx = canvas.getContext('2d');
  let animationId = null;

  // TRUE BITMAP CACHE - Pre-rendered planet/moon images + aggressive optimizations
  const bitmapCache = new Map();
  const orbitCache = new Map();
  const uiCache = new Map();
  let lastFrameTime = 0;
  let isStaticElementsDirty = true;
  let staticCanvas = null;
  
  // Store reference to draw function for external access
  window.drawSystem = drawSystem;
  
  // Reset celestial menu scroll state when entering a new system
  if (gameConfig.ui.celestialMenu) {
    gameConfig.ui.celestialMenu.scrollTop = 0;
  }
  
  // Функции отрисовки планет и спутников перенесены в PlanetView.js
  
  // Функция hexToRgb перенесена в PlanetView.js
  
  // Pre-render orbit lines to avoid drawing circles every frame
  function createOrbitBitmap(radius) {
    const size = radius * 2 + 20;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    const center = size / 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    return canvas;
  }
  
  // Pre-render static UI elements
  function createStaticUILayer() {
    if (!staticCanvas) {
      staticCanvas = document.createElement('canvas');
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
    }
    
    const ctx = staticCanvas.getContext('2d');
    ctx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
    
    // Pre-render static UI here (when not moving/zooming)
    return staticCanvas;
  }
  
  // Pre-render all planet and moon bitmaps + orbits
  function initializeBitmaps() {
    if (!star.explored) return;
    
    // Clear existing system view bitmaps but preserve detail view moon textures
    const detailMoonKeys = [];
    for (const [key] of bitmapCache) {
      if (key.startsWith('detail_moon_')) {
        detailMoonKeys.push(key);
      }
    }
    
    bitmapCache.clear();
    orbitCache.clear();
    
    // Restore detail view moon textures
    // (Note: This is a simplified approach; in production you'd want better cache management)
    
    star.planets.planets.forEach(planet => {
      // Cache planet bitmap используя функцию из PlanetView.js
      bitmapCache.set(`planet_${planet.id}`, createPlanetBitmap(planet, star));
      
      // Cache orbit bitmap
      const orbitKey = `orbit_${planet.orbitRadius}`;
      if (!orbitCache.has(orbitKey)) {
        orbitCache.set(orbitKey, createOrbitBitmap(planet.orbitRadius));
      }
      
      // Cache moon bitmaps with rotation support используя функцию из PlanetView.js
      planet.moons.forEach((moon, index) => {
        bitmapCache.set(`moon_${planet.id}_${index}`, createMoonBitmap(moon, planet.id, index, star));
      });
      
      // Cache ring bitmaps for both front and back parts
      if (planet.rings) {
        // Create separate cache entries for front and back ring parts
        if (!bitmapCache.has(`rings_back_${planet.id}`)) {
        bitmapCache.set(`rings_back_${planet.id}`, createRingBitmap(planet, true));
        }
        if (!bitmapCache.has(`rings_front_${planet.id}`)) {
          bitmapCache.set(`rings_front_${planet.id}`, createRingBitmap(planet, false));
        }
      }
    });
  }

  // Инициализация CanvasControls с начальным состоянием камеры (если есть)
  const controls = new CanvasControls(canvas, [], {
    cameraKey: 'starsystemCamera',
    onPan: () => {
      if (!animationId) {
        drawSystem();
      }
    },
    onZoom: () => {
      if (!animationId) {
        drawSystem();
      }
    },
    onEmptySpaceClick: () => {
      // Handle empty space clicks differently based on current view
      if (showingPlanetDetail) {
        // Don't close planet detail on empty space click
        return;
      }
      
      // Deselect planet when clicking empty space in system view
      if (selectedPlanet) {
        selectedPlanet = null;
        markUIDirty();
      }
    }
  });
  
  let selectedPlanet = null;
  let planetPositions = []; // Store current planet positions for click detection
  let showingPlanetDetail = false;
  let detailPlanet = null;
  
  // Update camera change handlers to mark UI as dirty
  const originalOnPan = controls.onPan;
  const originalOnZoom = controls.onZoom;
  
  controls.onPan = () => {
    isStaticElementsDirty = true;
    if (originalOnPan) originalOnPan();
    if (!animationId) drawSystem();
  };
  
  controls.onZoom = () => {
    isStaticElementsDirty = true;
    if (originalOnZoom) originalOnZoom();
    if (!animationId) drawSystem();
  };
  
  // Mark UI dirty when selection changes
  function markUIDirty() {
    isStaticElementsDirty = true;
  }
  
  // Handle back to galaxy function (defined early to avoid reference errors)
  const handleBack = () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', handleKeyDown);
    controls.destroy?.();
    onBack();
  };
  
  // Keyboard controls
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      handleBack();
    } 
    // Handle celestial menu navigation
    else if (gameConfig.ui.celestialMenu && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const menuState = gameConfig.ui.celestialMenu;
      if (e.key === 'ArrowUp') {
        menuState.scrollTop = Math.max(0, menuState.scrollTop - 1);
      } else if (e.key === 'ArrowDown') {
        menuState.scrollTop = Math.min(menuState.maxScroll, menuState.scrollTop + 1);
      }
      // Redraw the scene to update the menu
      if (typeof window.drawSystem === 'function') {
        window.drawSystem();
      }
    }
  }
  
  document.addEventListener('keydown', handleKeyDown);

  // Add click detection for planets
  function checkPlanetClick(worldX, worldY) {
    for (const pos of planetPositions) {
      const distance = Math.hypot(pos.x - worldX, pos.y - worldY);
      if (distance < pos.planet.size + 5) { // Add 5px tolerance
        return pos.planet;
      }
    }
    return null;
  }
  
  // Override the CanvasControls _handleInteraction to add planet click detection
  const originalHandleInteraction = controls._handleInteraction;
  controls._handleInteraction = function(x, y) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;
    
    // Transform screen coordinates to world coordinates
    const cameraState = this.getCameraState();
    const worldX = (canvasX - cameraState.offsetX) / cameraState.scale;
    const worldY = (canvasY - cameraState.offsetY) / cameraState.scale;
    
    // Check for planet click
    const clickedPlanet = checkPlanetClick(worldX, worldY);
    if (clickedPlanet) {
      if (selectedPlanet === clickedPlanet) {
        // Second click on selected planet: show detail view
        showingPlanetDetail = true;
        detailPlanet = clickedPlanet;
        selectedPlanet = null;
        markUIDirty();
      } else {
        // First click: select planet
        selectedPlanet = clickedPlanet;
        markUIDirty();
      }
      return true;
    }
    
    // Call original handler for empty space clicks
    return originalHandleInteraction.call(this, x, y);
  };

  function drawSystem(time = 0) {
    const currentTime = performance.now();
    
    // AGGRESSIVE FRAME LIMITING - only draw when needed (60 FPS max)
    if (currentTime - lastFrameTime < 16.66) { // ~60 FPS (1000ms / 60 ≈ 16.66ms)
      animationId = requestAnimationFrame(drawSystem);
      return;
    }
    lastFrameTime = currentTime;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear action buttons for this frame
    window.actionButtons = [];
    
    // Show planet detail view if activated
    if (showingPlanetDetail && detailPlanet) {
      drawPlanetDetailView();
      animationId = requestAnimationFrame(drawSystem);
      return;
    }
    
    // Clear planet positions for this frame
    planetPositions = [];
    
    // Check if system is explored
    if (!star.explored) {
      drawUnexploredSystem();
      return;
    }
    
    // Initialize bitmaps on first draw
    if (bitmapCache.size === 0) {
      initializeBitmaps();
    }
    
    // OPTIMIZED CAMERA TRANSFORMS - only when needed
    ctx.save();
    const cameraState = controls.getCameraState();
    ctx.translate(cameraState.offsetX, cameraState.offsetY);
    ctx.scale(cameraState.scale, cameraState.scale);
    
    // === Центр системы (в "мире") ===
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // PRE-RENDERED ORBITS - no circle calculations!
    star.planets.planets.forEach(planet => {
      const orbitBitmap = orbitCache.get(`orbit_${planet.orbitRadius}`);
      if (orbitBitmap) {
        const size = planet.orbitRadius * 2 + 20;
        ctx.drawImage(orbitBitmap, centerX - size/2, centerY - size/2);
      }
    });
    
    // === Рисуем звезду (кэшировать можно тоже) ===
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = getStarColor(star.spectralType, star.owner);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.restore();
    
    // === SUPER OPTIMIZED PLANET RENDERING ===
    star.planets.planets.forEach(planet => {
      drawPlanetUltraOptimized(planet, currentTime, centerX, centerY);
    });
    
    ctx.restore();
    
    // CONDITIONAL UI RENDERING - only redraw when changed
    if (isStaticElementsDirty) {
      drawStaticUI();
      isStaticElementsDirty = false;
    }
    
    // Only dynamic UI elements
    drawDynamicUI();

    animationId = requestAnimationFrame(drawSystem);
  }
  
  function drawUnexploredSystem() {
    const currentTime = performance.now();
    
    // FRAME LIMITING - only draw when needed (60 FPS max)
    if (currentTime - lastFrameTime < 16.66) { // ~60 FPS (1000ms / 60 ≈ 16.66ms)
      animationId = requestAnimationFrame(drawUnexploredSystem);
      return;
    }
    lastFrameTime = currentTime;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Темный фон
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Неизвестная звезда (тусклая точка)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Текст "Unknown System"
    ctx.fillStyle = '#888';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UNKNOWN SYSTEM', centerX, centerY - 80);
    
    ctx.font = '18px sans-serif';
    ctx.fillText('Requires exploration to reveal details', centerX, centerY + 80);
    
    // Пульсирующие скан-линии
    const time = Date.now() * 0.001;
    for (let i = 0; i < 3; i++) {
      const radius = 50 + i * 30 + Math.sin(time + i) * 10;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 150, 200, ${0.3 - i * 0.1})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    animationId = requestAnimationFrame(drawUnexploredSystem);
  }

  // ULTRA-OPTIMIZED PLANET RENDERING with rotation animation and initial positioning
  function drawPlanetUltraOptimized(planet, currentTime, centerX, centerY) {
    // Initialize time tracking if not already done
    if (!planet._lastUpdateTime) {
      planet._lastUpdateTime = currentTime;
      planet._orbitProgress = planet.initialOrbitAngle || 0;
      planet._rotationProgress = 0;
    }
    
    // Calculate time delta in seconds
    const deltaTime = (currentTime - planet._lastUpdateTime) / 1000;
    planet._lastUpdateTime = currentTime;
    
    // Update orbit position (revolution around star)
    // Orbit speed is in radians per second
    planet._orbitProgress += planet.orbitSpeed * deltaTime;
    
    // Calculate position
    const x = centerX + Math.cos(planet._orbitProgress) * planet.orbitRadius;
    const y = centerY + Math.sin(planet._orbitProgress) * planet.orbitRadius;
    
    // Store position for click detection
    planetPositions.push({ planet, x, y });

    // Rings behind planet (if any)
    // if (planet.rings) drawRings(planet, x, y, true);
    if (planet.rings) drawDetailRings(planet, x, y, planet.size, true);

    // Calculate planet rotation (day length) - 1 hour of game time = 2 seconds of animation
    // planet.dayLength is in hours, so we convert to rotation speed in radians per second
    const dayLength = planet.dayLength || 24; // Default to 24 hours if not set
    const rotationSpeed = (2 * Math.PI) / (dayLength * 2); // 2 seconds per hour
    planet._rotationProgress += rotationSpeed * deltaTime;
    
    // Normalize rotation progress
    planet._rotationProgress = planet._rotationProgress % (2 * Math.PI);
    
    // Convert to rotation offset (0-1)
    planet._rotationOffset = planet._rotationProgress / (2 * Math.PI);
    
    // Update planet bitmap with rotation if UV texture is available
    // Update more frequently for smoother animation
    if (planet._uvTexture) {
      const size = Math.ceil(planet.size * 2.5);
      const textureSize = Math.ceil(size); // диаметр планеты
      const rotationWidth = 1.5; // То же значение, что и в детальном виде

      if (!planet._systemUVTexture) {
        planet._systemUVTexture = generatePlanetUVTexture(
          star.x, 
          star.y, 
          planet.id, 
          planet.type, 
          textureSize,
          rotationWidth
        );
      }
      
      const updatedBitmap = renderPlanetWithRotation(
        planet, 
        size / 2,
        size / 2,
        planet.size,
        planet._rotationOffset
      );
      bitmapCache.set(`planet_${planet.id}`, updatedBitmap);
    }

    // FASTEST POSSIBLE BITMAP DRAW - no calculations, just pixel copy
    const planetBitmap = bitmapCache.get(`planet_${planet.id}`);
    if (planetBitmap) {
      const size = Math.ceil(planet.size * 2.5);
      ctx.drawImage(planetBitmap, x - size / 2, y - size / 2);
    }
    
    // Only draw selection effects when actually selected (avoid unnecessary draws)
    if (selectedPlanet === planet) {
      const radius1 = planet.size + 3;
      // Use current time for pulsing effect, not the passed time parameter
      const pulseTime = performance.now() * 0.005;
      const radius2 = planet.size + 6 + Math.sin(pulseTime) * 2;
      
      ctx.beginPath();
      ctx.arc(x, y, radius1, 0, Math.PI * 2);
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x, y, radius2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // MOON ORBITAL RENDERING with initial positioning and rotation
    if (planet.moons.length > 0) {
      planet.moons.forEach((moon, index) => {
        // Initialize time tracking for moon if not already done
        if (!moon._lastUpdateTime) {
          moon._lastUpdateTime = currentTime;
          moon._orbitProgress = moon.initialOrbitAngle || 0;
          moon._rotationProgress = 0;
        }
        
        // Calculate time delta in seconds
        const moonDeltaTime = (currentTime - moon._lastUpdateTime) / 1000;
        moon._lastUpdateTime = currentTime;
        
        // Update moon orbit position (revolution around planet)
        moon._orbitProgress += moon.orbitSpeed * moonDeltaTime;
        
        // Calculate moon position
        const moonX = x + Math.cos(moon._orbitProgress) * moon.orbitRadius;
        const moonY = y + Math.sin(moon._orbitProgress) * moon.orbitRadius;
        
        // Calculate moon rotation (day length) - 1 hour of game time = 2 seconds of animation
        const moonDayLength = moon.dayLength || 24; // Default to 24 hours if not set
        const moonRotationSpeed = (2 * Math.PI) / (moonDayLength * 2); // 2 seconds per hour
        moon._rotationProgress += moonRotationSpeed * moonDeltaTime;
        
        // Normalize rotation progress
        moon._rotationProgress = moon._rotationProgress % (2 * Math.PI);
        
        // Convert to rotation offset (0-1)
        moon._rotationOffset = moon._rotationProgress / (2 * Math.PI);
        
        // Update moon bitmap with rotation if UV texture is available
        if (moon._uvTexture) {
          const moonSize = moon.size;
          const size = Math.ceil(moonSize * 2.5);
          const updatedMoonBitmap = renderMoonWithRotation(
            moon, 
            size / 2, // centerX - должен быть в середине битмапа
            size / 2, // centerY - должен быть в середине битмапа
            moon.size, // moonSize
            moon._rotationOffset
          );
          bitmapCache.set(`moon_${planet.id}_${index}`, updatedMoonBitmap);
        }
        
        // Draw moon at proper scale with orbital motion and rotation
        const moonBitmap = bitmapCache.get(`moon_${planet.id}_${index}`);
        if (moonBitmap) {
          const moonSize = Math.ceil(moon.size * 2.5);
          ctx.drawImage(moonBitmap, moonX - moonSize / 2, moonY - moonSize / 2);
        }
      });
    }


    // Rings in front of planet
    // if (planet.rings) drawRings(planet, x, y, false);
    if (planet.rings) {
      const ringBitmap = bitmapCache.get(`rings_front_${planet.id}`);
      if (ringBitmap) {
        // Position the ring bitmap centered on the planet
        ctx.drawImage(
          ringBitmap, 
          x - ringBitmap.width / 2, 
          y - ringBitmap.height / 2
        );
      } else {
        // Fallback to direct rendering if cache miss
        drawDetailRings(planet, x, y, planet.size, false);
      }
    }

    // Text only when selected or nearby (viewport culling)
    if (selectedPlanet === planet || true) { // Could add distance check here
      ctx.fillStyle = selectedPlanet === planet ? '#4a90e2' : 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(planet.name, x, y - planet.size - 8);
    }
  }
  
  // Split UI into static and dynamic parts
  function drawStaticUI() {
    // Pre-render celestial bodies menu to static layer
    // This only needs to update when selection changes
  }
  
  function drawDynamicUI() {
    // Only dynamic elements that change every frame
    drawPlanetInfoPanel();
    drawCelestialBodiesMenu();
    drawInstructions();
    drawReturnButton();
  }

  function drawPlanet(planet, time, centerX, centerY) {
    // Initialize time tracking if not already done
    if (!planet._lastDrawTime) {
      planet._lastDrawTime = time;
      planet._orbitProgress = planet.initialOrbitAngle || 0;
      planet._rotationProgress = 0;
    }
    
    // Calculate time delta in seconds
    const deltaTime = (time - planet._lastDrawTime) / 1000;
    planet._lastDrawTime = time;
    
    // Update orbit position (revolution around star)
    planet._orbitProgress += planet.orbitSpeed * deltaTime;
    
    // Calculate position
    const x = centerX + Math.cos(planet._orbitProgress) * planet.orbitRadius;
    const y = centerY + Math.sin(planet._orbitProgress) * planet.orbitRadius;
    
    // Store planet position for click detection
    planetPositions.push({ planet, x, y });

    // Орбита
    ctx.beginPath();
    ctx.arc(centerX, centerY, planet.orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.stroke();

    // if (planet.rings) drawRings(planet, x, y, true);
    if (planet.rings) drawDetailRings (planet, centerX, centerY, planet.size, false);
    

    // Calculate planet rotation (day length) - 1 hour of game time = 2 seconds of animation
    const dayLength = planet.dayLength || 24; // Default to 24 hours if not set
    const rotationSpeed = (2 * Math.PI) / (dayLength * 2); // 2 seconds per hour
    planet._rotationProgress += rotationSpeed * deltaTime;
    
    // Normalize rotation progress
    planet._rotationProgress = planet._rotationProgress % (2 * Math.PI);
    
    // Convert to rotation offset (0-1)
    planet._rotationOffset = planet._rotationProgress / (2 * Math.PI);

    // Планета с улучшенным освещением
    const planetGradient = ctx.createRadialGradient(
      x - planet.size * 0.3, y - planet.size * 0.3, 0,
      x, y, planet.size
    );
    
    // Создаем реалистичный эффект освещения
    const lightColor = lightenColor(planet.color, 0.4);
    const shadowColor = darkenColor(planet.color, 0.2);
    
    planetGradient.addColorStop(0, lightColor);    // Яркая освещенная сторона
    planetGradient.addColorStop(0.4, planet.color); // Базовый цвет планеты
    planetGradient.addColorStop(1, shadowColor);    // Темная сторона, но не черная
    
    ctx.beginPath();
    ctx.arc(x, y, planet.size, 0, Math.PI * 2);
    ctx.fillStyle = planetGradient;
    ctx.fill();
    
    // Selection highlight
    if (selectedPlanet === planet) {
      ctx.beginPath();
      ctx.arc(x, y, planet.size + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Pulsing effect
      const pulseTime = performance.now() * 0.005;
      const pulseRadius = planet.size + 6 + Math.sin(pulseTime) * 2;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    planet.moons.forEach(moon => {
      drawMoon(moon, time, x, y);
    });

    // if (planet.rings) drawRings(planet, x, y, false);
    if (planet.rings) drawDetailRings (planet, centerX, centerY, planet.size, false);

    // Название планеты
    ctx.fillStyle = selectedPlanet === planet ? '#4a90e2' : 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, x, y - planet.size - 8);
  }

  // function drawRings(planet, x, y, isBackPart) {
  //   const { innerRadius, outerRadius, tilt } = planet.rings;
  //   const steps = 12;

  // }

  function drawMoon(moon, time, planetX, planetY) {
    // Initialize time tracking for moon if not already done
    if (!moon._lastDrawTime) {
      moon._lastDrawTime = time;
      moon._orbitProgress = moon.initialOrbitAngle || 0;
      moon._rotationProgress = 0;
    }
    
    // Calculate time delta in seconds
    const deltaTime = (time - moon._lastDrawTime) / 1000;
    moon._lastDrawTime = time;
    
    // Update moon orbit position (revolution around planet)
    moon._orbitProgress += moon.orbitSpeed * deltaTime;
    
    // Calculate moon position
    const x = planetX + Math.cos(moon._orbitProgress) * moon.orbitRadius;
    const y = planetY + Math.sin(moon._orbitProgress) * moon.orbitRadius;

    // Calculate moon rotation (day length) - 1 hour of game time = 2 seconds of animation
    const dayLength = moon.dayLength || 24; // Default to 24 hours if not set
    const rotationSpeed = (2 * Math.PI) / (dayLength * 2); // 2 seconds per hour
    moon._rotationProgress += rotationSpeed * deltaTime;
    
    // Normalize rotation progress
    moon._rotationProgress = moon._rotationProgress % (2 * Math.PI);
    
    // Convert to rotation offset (0-1)
    moon._rotationOffset = moon._rotationProgress / (2 * Math.PI);

    // Луна с улучшенным освещением
    const moonGradient = ctx.createRadialGradient(
      x - moon.size * 0.3, y - moon.size * 0.3, 0,
      x, y, moon.size
    );
    
    const lightColor = lightenColor(moon.color, 0.3);
    const shadowColor = darkenColor(moon.color, 0.2);
    
    moonGradient.addColorStop(0, lightColor);
    moonGradient.addColorStop(0.5, moon.color);
    moonGradient.addColorStop(1, shadowColor);
    
    ctx.beginPath();
    ctx.arc(x, y, moon.size, 0, Math.PI * 2);
    ctx.fillStyle = moonGradient;
    ctx.fill();
  }
  
  function drawPlanetInfoPanel() {
    if (!selectedPlanet) return;
    
    const panelWidth = 300;
    const panelHeight = 200;
    const panelX = canvas.width - panelWidth - 20; // Move to right side
    const panelY = 20;
    
    // Panel background
    ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Panel border
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Planet name
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(selectedPlanet.name, panelX + 15, panelY + 30);
    
    // Planet details
    const details = [
      `Type: ${selectedPlanet.type}`,
      `Size: ${selectedPlanet.size.toFixed(1)} units`,
      `Orbit: ${selectedPlanet.orbitRadius.toFixed(0)} AU`,
      `Axial tilt: ${((selectedPlanet.axialTilt || 0) * 180 / Math.PI).toFixed(1)}°`,
      `Day length: ${selectedPlanet.dayLength.toFixed(1)} hours`,
      `Moons: ${selectedPlanet.moons.length}`,
      `Rings: ${selectedPlanet.rings ? 'Yes' : 'No'}`,
      `Habitable: ${selectedPlanet.habitable ? 'Yes' : 'No'}`
    ];
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    
    details.forEach((detail, index) => {
      ctx.fillText(detail, panelX + 15, panelY + 60 + index * 20);
    });
    
    // Planet type description
    const typeDescriptions = {
      lava: 'Molten surface with volcanic activity',
      rocky: 'Solid surface with minimal atmosphere',
      terran: 'Earth-like with suitable conditions',
      gas: 'Large gas giant with no solid surface',
      ice: 'Frozen world in the outer system',
      desert: 'Arid world with sandy terrain',
      ocean: 'Water world with scattered landmasses',
      toxic: 'Poisonous atmosphere and hostile surface',
      crystal: 'Crystalline formations and mineral deposits',
      volcanic: 'Active volcanic system with lava flows'
    };
    
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    const description = typeDescriptions[selectedPlanet.type] || 'Unknown planet type';
    ctx.fillText(description, panelX + 15, panelY + panelHeight - 15);
  }
  

  
  function drawCelestialBodiesMenu() {
    // Menu panel setup
    const menuWidth = 280;
    const menuHeight = Math.min(400, canvas.height - 100);
    const menuX = 20;
    const menuY = 20;
    
    // Menu background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.95)';
    ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
    
    // Menu border
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
    
    // Menu title
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${star.name} System`, menuX + 15, menuY + 25);
    
    // Subtitle
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Planets', menuX + 15, menuY + 45);
    
    // Scrollable content area
    const contentY = menuY + 55;
    const contentHeight = menuHeight - 75;
    const itemHeight = 45;
    const maxVisibleItems = Math.floor(contentHeight / itemHeight);
    
    // All celestial bodies are planets
    const celestialBodies = star.planets.planets.map(planet => ({ ...planet, type: 'planet' }));
    
    // Add scroll handling
    if (!gameConfig.ui.celestialMenu) {
      gameConfig.ui.celestialMenu = {
        scrollTop: 0,
        maxScroll: Math.max(0, celestialBodies.length - maxVisibleItems)
      };
    }
    
    const menuState = gameConfig.ui.celestialMenu;
    // Update maxScroll in case the window was resized or bodies were added
    menuState.maxScroll = Math.max(0, celestialBodies.length - maxVisibleItems);
    // Ensure scrollTop is within valid bounds
    menuState.scrollTop = Math.max(0, Math.min(menuState.scrollTop, menuState.maxScroll));
    const startIndex = Math.max(0, Math.min(menuState.scrollTop, celestialBodies.length - maxVisibleItems));
    const endIndex = Math.min(startIndex + maxVisibleItems, celestialBodies.length);
    
    // Draw celestial bodies list
    for (let i = startIndex; i < endIndex; i++) {
      const body = celestialBodies[i];
      const displayIndex = i - startIndex;
      const itemY = contentY + displayIndex * itemHeight;
      // Compare by ID instead of object reference for proper selection detection
      const isSelected = selectedPlanet && body.type === 'planet' && selectedPlanet.id === body.id;
      
      // Item background
      if (isSelected) {
        ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
        ctx.fillRect(menuX + 5, itemY, menuWidth - 10, itemHeight - 2);
      }
      
      // Body type icon
      const iconX = menuX + 15;
      const iconY = itemY + 15;
      
      if (body.type === 'planet') {
        // Planet icon
        ctx.beginPath();
        ctx.arc(iconX, iconY, 8, 0, Math.PI * 2);
        ctx.fillStyle = body.color;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#4a90e2' : '#666';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Body name
      ctx.fillStyle = isSelected ? '#4a90e2' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(body.name, iconX + 20, itemY + 12);
      
      // Body details
      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
      
      const details = [
        `Type: ${body.type}`,
        `${body.moons.length} moons`,
        body.habitable ? 'Habitable' : 'Not habitable'
      ].join(' • ');
      ctx.fillText(details, iconX + 20, itemY + 28);
      
      // Make item clickable
      if (!window.actionButtons) window.actionButtons = [];
      window.actionButtons.push({
          x: menuX + 5,
          y: itemY,
          width: menuWidth - 10,
          height: itemHeight - 2,
          onClick: () => {
            // Find the original planet object from star.planets.planets array
            const originalPlanet = star.planets.planets.find(p => p.id === body.id);
            if (selectedPlanet && selectedPlanet.id === body.id) {
              // Second click: show detail view
              showingPlanetDetail = true;
              detailPlanet = originalPlanet;
              selectedPlanet = null;
            } else {
              // First click: select planet
              selectedPlanet = originalPlanet;
            }
          },
          text: `celestial-body-${i}`
        });
    }
    
    // Draw scrollbar if needed
    if (celestialBodies.length > maxVisibleItems) {
      const scrollbarX = menuX + menuWidth - 15;
      const scrollbarY = contentY;
      const scrollbarHeight = contentHeight;
      const thumbHeight = Math.max(20, (maxVisibleItems / celestialBodies.length) * scrollbarHeight);
      const thumbY = scrollbarY + (menuState.scrollTop / menuState.maxScroll) * (scrollbarHeight - thumbHeight);
      
      // Scrollbar background
      ctx.fillStyle = 'rgba(50, 50, 60, 0.8)';
      ctx.fillRect(scrollbarX, scrollbarY, 10, scrollbarHeight);
      
      // Scrollbar thumb
      ctx.fillStyle = '#666';
      ctx.fillRect(scrollbarX, thumbY, 10, thumbHeight);
      
      // Store scrollbar for interaction
      if (!window.actionButtons) window.actionButtons = [];
      window.actionButtons.push({
        x: scrollbarX,
        y: scrollbarY,
        width: 10,
        height: scrollbarHeight,
        onClick: (e) => {
          // Calculate scroll position based on click position
          const rect = canvas.getBoundingClientRect();
          const relativeY = e.clientY - (scrollbarY + menuY + rect.top);
          const scrollRatio = Math.max(0, Math.min(1, relativeY / scrollbarHeight));
          menuState.scrollTop = Math.floor(scrollRatio * menuState.maxScroll);
          // Redraw the scene to update the menu
          if (typeof window.drawSystem === 'function') {
            window.drawSystem();
          }
        },
        text: 'scrollbar'
      });
    }
    
    // Scroll indicators
    if (menuState.scrollTop > 0) {
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲ Scroll up', menuX + menuWidth/2, contentY - 5);
    }
    
    if (menuState.scrollTop < menuState.maxScroll) {
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ Scroll down', menuX + menuWidth/2, contentY + contentHeight + 15);
    }
  }
  
  function drawInstructions() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const instructions = selectedPlanet ? 
      'Click selected planet (menu or animation) for detailed view • Click elsewhere to deselect • ESC to return to galaxy' :
      'Click planets to select (menu or animation) • Click selected planet for detailed view • ESC to return to galaxy';
    ctx.fillText(instructions, 320, canvas.height - 60);
  }
  
  function drawReturnButton() {
    // Draw return to galaxy button
    const buttonWidth = 200;
    const buttonHeight = 40;
    const buttonX = (canvas.width - buttonWidth) / 2;
    const buttonY = canvas.height - 60;
    
    // Button background (consistent with drawDetailButton)
    ctx.fillStyle = 'rgba(70, 130, 200, 0.8)';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button border (consistent with drawDetailButton)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('← Return to Galaxy (ESC)', buttonX + buttonWidth/2, buttonY + buttonHeight/2 + 6);
    
    // Store for click detection
    if (!window.actionButtons) window.actionButtons = [];
    window.actionButtons.push({
      x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight,
      onClick: handleBack,
      text: 'return-to-galaxy'
    });
  }
  
  function drawPlanetDetailView() {
    const planet = detailPlanet;
    
    // Dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Planet image (large centered)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const planetSize = 350;
    
    // Planet rings if present (draw back part behind planet)
    if (planet.rings) {
      drawDetailRings(planet, centerX, centerY, planetSize, true);
    }
    
    // Generate high-resolution UV texture for detail view with rotation
    if (!planet._detailUVTexture) {
      // Используем те же параметры, что и в системном виде
      const textureSize = Math.ceil(planetSize * 2); // диаметр планеты
      const rotationWidth = 1.5; // То же значение, что и в системном виде

      planet._detailUVTexture = generatePlanetUVTexture(
        star.x, 
        star.y, 
        planet.id, 
        planet.type, 
        textureSize,
        rotationWidth
      );
    }
    
    const detailTexture = planet._detailUVTexture;
    
    // Initialize time tracking for detail view if not already done
    if (!planet._lastDetailUpdate) {
      planet._lastDetailUpdate = performance.now();
      planet._detailRotationProgress = 0;
    }
    
    // Animate rotation for detail view using time-based animation
    const currentTime = performance.now();
    const deltaTime = (currentTime - planet._lastDetailUpdate) / 1000;
    planet._lastDetailUpdate = currentTime;
    
    // Calculate planet rotation (day length) - 1 hour of game time = 2 seconds of animation
    const dayLength = planet.dayLength || 24; // Default to 24 hours if not set
    const rotationSpeed = (2 * Math.PI) / (dayLength * 2); // 2 seconds per hour
    planet._detailRotationProgress += rotationSpeed * deltaTime;
    
    // Normalize rotation progress
    planet._detailRotationProgress = planet._detailRotationProgress % (2 * Math.PI);
    
    // Convert to rotation offset (0-1)
    planet._detailRotationOffset = planet._detailRotationProgress / (2 * Math.PI);
    
    // Create a circular mask for the planet
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, planetSize, 0, Math.PI * 2);
    ctx.clip();
    
    // Apply axial tilt transformation for detail view
    ctx.save();
    ctx.translate(centerX, centerY);
    if (planet.axialTilt) {
      ctx.rotate(planet.axialTilt);
    }
    ctx.translate(-centerX, -centerY);
    
    // Improved texture offset calculation with sub-pixel precision
    const preciseOffsetX = (planet._detailRotationOffset * detailTexture.width);
    const offsetX = Math.floor(preciseOffsetX) % detailTexture.width;
    const drawWidth = planetSize * 2;
    const drawHeight = planetSize * 2;
    
    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;
    
    // Draw the UV texture with rotation offset (wrapping)
    if (offsetX + drawWidth <= detailTexture.width) {
      // No wrapping needed - single draw
      ctx.drawImage(
        detailTexture,
        offsetX, 0, drawWidth, drawHeight, // Source region
        centerX - planetSize, centerY - planetSize, drawWidth, drawHeight // Destination - здесь всё правильно, т.к. маска создается отдельно
      );
    } else {
      // Wrapping needed - draw in two parts with improved precision
      const firstPartWidth = detailTexture.width - offsetX;
      const secondPartWidth = drawWidth - firstPartWidth;
      
      // First part (right side of texture)
      ctx.drawImage(
        detailTexture,
        offsetX, 0, firstPartWidth, drawHeight, // Source region
        centerX - planetSize, centerY - planetSize, firstPartWidth, drawHeight // Destination
      );
      
      // Second part (left side of texture) - seamlessly connected
      ctx.drawImage(
        detailTexture,
        0, 0, secondPartWidth, drawHeight, // Source region (wrapped part)
        centerX - planetSize + firstPartWidth, centerY - planetSize, secondPartWidth, drawHeight // Destination
      );
    }
    
    // Re-enable smoothing for other elements
    ctx.imageSmoothingEnabled = true;
    
    ctx.restore(); // Restore axial tilt transformation
    ctx.restore(); // Restore clip
    
    // Add realistic 3D lighting effect
    const lightingGradient = ctx.createRadialGradient(
      centerX - 60, centerY - 60, 0,
      centerX, centerY, planetSize
    );
    
    lightingGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');   // Bright highlight
    lightingGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)'); // Gradual fade
    lightingGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');         // Neutral
    lightingGradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');         // Deep shadow
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, planetSize, 0, Math.PI * 2);
    ctx.fillStyle = lightingGradient;
    ctx.fill();
    
    // Add consistent atmospheric glow (same as system view)
    if (planetHasAtmosphere(planet.type)) {
      // Scale atmospheric halo based on planet size for consistent appearance
      // Use a proportional offset that scales with planet size, with minimum and maximum limits
      const atmosphereOffset = Math.max(3, Math.min(15, planetSize * 0.3));
      
      const atmosphereGradient = ctx.createRadialGradient(
        centerX, centerY, planetSize,
        centerX, centerY, planetSize + atmosphereOffset
      );
      
      const atmosphereColor = getAtmosphereColor(planet.type);
      
      atmosphereGradient.addColorStop(0, atmosphereColor);
      atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, planetSize + atmosphereOffset, 0, Math.PI * 2);
      ctx.fillStyle = atmosphereGradient;
      ctx.fill();
    }
    
    // Planet rings if present (draw front part in front of planet)
    if (planet.rings) {
      drawDetailRings(planet, centerX, centerY, planetSize, false);
    }
    
    // Planet title
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, centerX, 80);
    
    // Planet information panels
    drawDetailPanel('Physical Properties', [
      `Type: ${planet.type}`,
      `Diameter: ${(planet.size * 1000).toFixed(0)} km`,
      `Mass: ${(planet.size * planet.size * 0.8).toFixed(1)} Earth masses`,
      `Gravity: ${(planet.size / 10).toFixed(1)}g`,
      `Axial tilt: ${((planet.axialTilt || 0) * 180 / Math.PI).toFixed(1)}°`,
      `Day length: ${planet.dayLength.toFixed(1)} hours`
    ], 50, 150);
    
    drawDetailPanel('Orbital Data', [
      `Distance: ${planet.orbitRadius.toFixed(1)} AU`,
      `Period: ${(planet.orbitRadius * 0.5).toFixed(1)} Earth years`,
      `Orbital speed: ${(30 / Math.sqrt(planet.orbitRadius)).toFixed(1)} km/s`,
      `Eccentricity: ${(Math.random() * 0.3).toFixed(3)}`,
      `Inclination: ${(planet.tilt * 180 / Math.PI).toFixed(1)}°`
    ], 50, 350);
    
    drawDetailPanel('Satellites & Features', [
      `Moons: ${planet.moons.length}`,
      planet.moons.length > 0 ? `Moon types: ${[...new Set(planet.moons.map(m => m.type || 'rocky'))].join(', ')}` : '',
      `Ring system: ${planet.rings ? 'Present' : 'None'}`,
      `Habitable: ${planet.habitable ? 'Yes' : 'No'}`,
      `Atmosphere: ${getAtmosphereType(planet.type)}`,
      `Surface temp: ${getSurfaceTemp(planet.type, planet.orbitRadius)}°C`
    ].filter(Boolean), canvas.width - 350, 150);
    
    // Static moon display next to planet in detail view
    if (planet.moons.length > 0) {
      console.log(`Rendering ${planet.moons.length} moons for planet ${planet.name}`);
      const moonDisplayRadius = planetSize + 100; // Increased distance to avoid overlap
      const moonStartAngle = Math.PI * 0.15; // Start position around planet
      const moonAngleStep = planet.moons.length > 1 ? (Math.PI * 1.7) / (planet.moons.length - 1) : 0; // Wider arc spread
      
      planet.moons.forEach((moon, index) => {
        const moonAngle = moonStartAngle + index * moonAngleStep;
        const moonX = centerX + Math.cos(moonAngle) * moonDisplayRadius;
        const moonY = centerY + Math.sin(moonAngle) * moonDisplayRadius;
        
        // Increased moon size for detail view
        const moonSize = Math.max(15, moon.size * 8); // Much larger moons
        
        console.log(`Moon ${index}: Original size ${moon.size}, Display size ${moonSize}`);
        
        // Generate procedural moon texture if not cached - ensure unique cache key including type
        const moonCacheKey = `detail_moon_v7_${star.x.toFixed(3)}_${star.y.toFixed(3)}_${planet.id}_${index}_${moon.type || 'rocky'}`;
        if (!bitmapCache.has(moonCacheKey)) {
          console.log(`Generating moon texture for moon ${index} with key: ${moonCacheKey}`);
          try {
            // Generate high-resolution UV texture for detail view moon with rotation
            if (!moon._detailUVTexture) {
              moon._detailUVTexture = generatePlanetUVTexture(
                star.x, 
                star.y, 
                planet.id * 100 + index, // Unique moon ID
                moon.type, 
                Math.max(128, moonSize), // High resolution for detail view
                1.5  // Wider for detail view rotation
              );
            }
            
            // Initialize time tracking for moon detail view if not already done
            if (!moon._lastDetailUpdate) {
              moon._lastDetailUpdate = performance.now();
              moon._detailRotationProgress = 0;
            }
            
            // Animate rotation for detail view moons using time-based animation
            const moonCurrentTime = performance.now();
            const moonDeltaTime = (moonCurrentTime - moon._lastDetailUpdate) / 1000;
            moon._lastDetailUpdate = moonCurrentTime;
            
            // Calculate moon rotation (day length) - 1 hour of game time = 2 seconds of animation
            const moonDayLength = moon.dayLength || 24; // Default to 24 hours if not set
            const detailRotationSpeed = (2 * Math.PI) / (moonDayLength * 2); // 2 seconds per hour
            moon._detailRotationProgress += detailRotationSpeed * moonDeltaTime;
            
            // Normalize rotation progress
            moon._detailRotationProgress = moon._detailRotationProgress % (2 * Math.PI);
            
            // Convert to rotation offset (0-1)
            moon._detailRotationOffset = moon._detailRotationProgress / (2 * Math.PI);
            
            const moonTexture = renderDetailMoonWithRotation(moon, moonSize, index, planet.id, moon._detailRotationOffset);
            
            // Verify the texture was created successfully
            if (!moonTexture || moonTexture.width === 0 || moonTexture.height === 0) {
              console.error(`Generated invalid texture for moon ${index}`);
              // Create a simple solid colored circle as fallback
              const fallbackTexture = createFallbackMoonTexture(moonSize, moon.color);
              bitmapCache.set(moonCacheKey, fallbackTexture);
            } else {
              bitmapCache.set(moonCacheKey, moonTexture);
              console.log(`Successfully cached moon texture for key: ${moonCacheKey}`);
            }
          } catch (error) {
            console.error(`Error generating moon texture for ${moonCacheKey}:`, error);
            // Create a simple solid colored circle as fallback
            const fallbackTexture = createFallbackMoonTexture(moonSize, moon.color);
            bitmapCache.set(moonCacheKey, fallbackTexture);
          }
        } else {
          // Update existing rotating moon using time-based animation
          // Initialize time tracking for moon detail view if not already done
          if (!moon._lastDetailUpdate) {
            moon._lastDetailUpdate = performance.now();
            moon._detailRotationProgress = 0;
          }
          
          // Animate rotation for detail view moons using time-based animation
          const moonCurrentTime = performance.now();
          const moonDeltaTime = (moonCurrentTime - moon._lastDetailUpdate) / 1000;
          moon._lastDetailUpdate = moonCurrentTime;
          
          // Calculate moon rotation (day length) - 1 hour of game time = 2 seconds of animation
          const moonDayLength = moon.dayLength || 24; // Default to 24 hours if not set
          const detailRotationSpeed = (2 * Math.PI) / (moonDayLength * 2); // 2 seconds per hour
          moon._detailRotationProgress += detailRotationSpeed * moonDeltaTime;
          
          // Normalize rotation progress
          moon._detailRotationProgress = moon._detailRotationProgress % (2 * Math.PI);
          
          // Convert to rotation offset (0-1)
          moon._detailRotationOffset = moon._detailRotationProgress / (2 * Math.PI);
          
          try {
            const moonTexture = renderDetailMoonWithRotation(moon, moonSize, index, planet.id, moon._detailRotationOffset);
            bitmapCache.set(moonCacheKey, moonTexture);
          } catch (error) {
            console.error(`Error updating rotating moon texture:`, error);
          }
        }
        
        // Draw textured moon
        const moonBitmap = bitmapCache.get(moonCacheKey);
        if (moonBitmap) {
          
          const drawX = moonX - moonSize / 2;
          const drawY = moonY - moonSize / 2;
          
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.imageSmoothingEnabled = true;
          ctx.globalCompositeOperation = 'source-over';
          
          // Draw procedural moon texture
          ctx.drawImage(moonBitmap, drawX, drawY);
          
          ctx.restore();
        } else {
          console.error(`Failed to get moon bitmap for ${moonCacheKey}`);
          // Fallback: draw simple colored circle
          ctx.fillStyle = moon.color;
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Moon name and type label
        ctx.fillStyle = '#ddd';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${moon.name || `Moon ${index + 1}`}`, moonX, moonY + moonSize + 20);
        
        // Moon type label
        ctx.fillStyle = '#bbb';
        ctx.font = '12px sans-serif';
        const moonTypeLabel = moon.type ? moon.type.charAt(0).toUpperCase() + moon.type.slice(1) : 'Rocky';
        ctx.fillText(`(${moonTypeLabel})`, moonX, moonY + moonSize + 35);
      });
    }
    
    // Back button
    drawDetailButton('← Back to System View', centerX - 100, canvas.height - 60, 200, 40, () => {
      showingPlanetDetail = false;
      detailPlanet = null;
    });
  }
  
  function drawDetailPanel(title, items, x, y) {
    const panelWidth = 300;
    const panelHeight = 150;
    
    // Panel background
    ctx.fillStyle = 'rgba(30, 30, 40, 0.9)';
    ctx.fillRect(x, y, panelWidth, panelHeight);
    
    // Panel border
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, panelWidth, panelHeight);
    
    // Title
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 15, y + 25);
    
    // Items
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    items.forEach((item, index) => {
      ctx.fillText(item, x + 15, y + 50 + index * 18);
    });
  }
  
  function drawDetailButton(text, x, y, width, height, onClick) {
    // Button background
    ctx.fillStyle = 'rgba(70, 130, 200, 0.8)';
    ctx.fillRect(x, y, width, height);
    
    // Button border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + width/2, y + height/2 + 6);
    
    // Store for click detection
    if (!window.actionButtons) window.actionButtons = [];
    window.actionButtons.push({
      x, y, width, height,
      onClick: onClick,
      text: 'back-to-system'
    });
  }
  
  /* function drawDetailRings(planet, centerX, centerY, planetSize, isBackPart) {
    const { innerRadius, outerRadius, tilt } = planet.rings;
    const steps = 42;
    const ringWidth = outerRadius - innerRadius;
    const color = 'rgb(200, 180, 150)';
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(tilt);
    
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const radius = innerRadius + ringWidth * progress;
      const alpha = 0.7 * (1 - progress * 0.5);
      
      ctx.beginPath();
      if (isBackPart) {
        ctx.ellipse(0, 0, radius * planetSize, radius * planetSize * 0.3, 0, Math.PI, Math.PI * 2);
      } else {
        ctx.ellipse(0, 0, radius * planetSize, radius * planetSize * 0.3, 0, 0, Math.PI);
      }
      ctx.strokeStyle = color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      ctx.lineWidth = 2; // Same thickness as system view
      ctx.stroke();
    }
    
    ctx.restore();
  } */
// function drawDetailRings(planet, centerX, centerY, planetSize, isBackPart) {
//   if (!planet.rings || !planet.rings.ringData) return;

//   const { innerRadius, outerRadius, tilt, ringData } = planet.rings;
//   const inner = innerRadius * planetSize;
//   const outer = outerRadius * planetSize;

//   ctx.save();
//   ctx.translate(centerX, centerY);
//   ctx.rotate(tilt);

//   for (let i = 0; i < ringData.length; i++) {
//     const data = ringData[i];
//     const radius = inner + data.t * (outer - inner);

//     let alpha = data.alpha;
//     if (data.lightStripe) alpha *= 1.3;
//     if (data.darkStripe) alpha *= 0.5;

//     ctx.beginPath();
//     ctx.ellipse(
//       0, 0,
//       radius,
//       radius * 0.3,
//       0,
//       isBackPart ? Math.PI : 0,
//       isBackPart ? 2 * Math.PI : Math.PI
//     );

//     ctx.strokeStyle = `rgba(200,180,150,${Math.min(alpha, 1)})`;
//     ctx.lineWidth = data.lineWidth;
//     ctx.stroke();
//   }

//   ctx.restore();
// }
function drawDetailRings(planet, centerX, centerY, planetSize, isBackPart) {
  if (!planet.rings || !planet.rings.ringData) return;

  const { innerRadius, outerRadius, tilt, ringData } = planet.rings;
  
  // Определяем, это системный вид или детальный
  const isSystemView = planetSize === planet.size;
  
  // Для системного вида уменьшаем толщину линий и прозрачность
  const lineWidthMultiplier = isSystemView ? 0.3 : 1;
  const alphaMultiplier = isSystemView ? 0.3 : 1;
  
  const inner = innerRadius * planetSize;
  const outer = outerRadius * planetSize;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(tilt);

  for (let i = 0; i < ringData.length; i++) {
    const data = ringData[i];
    const radius = inner + data.t * (outer - inner);

    let alpha = data.alpha * alphaMultiplier;
    if (data.lightStripe) alpha *= 1.3;
    if (data.darkStripe) alpha *= 0.5;

    ctx.beginPath();
    ctx.ellipse(
      0, 0,
      radius,
      radius * 0.3,
      0,
      isBackPart ? Math.PI : 0,
      isBackPart ? 2 * Math.PI : Math.PI
    );

    ctx.strokeStyle = `rgba(200,180,150,${Math.min(alpha, 1)})`;
    ctx.lineWidth = data.lineWidth * lineWidthMultiplier;
    ctx.stroke();
  }

  ctx.restore();
}

// Pre-render orbit lines to avoid drawing circles every frame
function createOrbitBitmap(radius) {
  const size = radius * 2 + 20;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  return canvas;
}
  
// Pre-render ring systems to avoid drawing ellipses every frame
function createRingBitmap(planet, isBackPart) {
  if (!planet.rings || !planet.rings.ringData) return null;
  
  const { innerRadius, outerRadius, tilt, ringData } = planet.rings;
  // Use a fixed size for ring bitmaps to ensure consistent rendering
  const bitmapSize = Math.max(planet.size * 3, 200);
  const canvas = document.createElement('canvas');
  canvas.width = bitmapSize;
  canvas.height = bitmapSize;
  const ctx = canvas.getContext('2d');
  
  const centerX = bitmapSize / 2;
  const centerY = bitmapSize / 2;
  
  // Определяем, это системный вид (planet.size) или детальный
  const isSystemView = true; // Always system view for cached rings
  
  // Для системного вида уменьшаем толщину линий и прозрачность
  const lineWidthMultiplier = isSystemView ? 0.3 : 1;
  const alphaMultiplier = isSystemView ? 0.3 : 1;
  
  const inner = innerRadius * planet.size;
  const outer = outerRadius * planet.size;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(tilt);

  for (let i = 0; i < ringData.length; i++) {
    const data = ringData[i];
    const radius = inner + data.t * (outer - inner);

    let alpha = data.alpha * alphaMultiplier;
    if (data.lightStripe) alpha *= 1.3;
    if (data.darkStripe) alpha *= 0.5;

    ctx.beginPath();
    ctx.ellipse(
      0, 0,
      radius,
      radius * 0.3,
      0,
      isBackPart ? Math.PI : 0,
      isBackPart ? 2 * Math.PI : Math.PI
    );

    ctx.strokeStyle = `rgba(200,180,150,${Math.min(alpha, 1)})`;
    ctx.lineWidth = data.lineWidth * lineWidthMultiplier;
    ctx.stroke();
  }

  ctx.restore();
  
  return canvas;
}

  function getAtmosphereType(planetType) {
    switch (planetType) {
      case 'terran': return 'Nitrogen-Oxygen';
      case 'gas': return 'Hydrogen-Helium';
      case 'lava': return 'Carbon dioxide';
      case 'ice': return 'Thin methane';
      case 'rocky': return 'None';
      case 'desert': return 'Thin carbon dioxide';
      case 'ocean': return 'Nitrogen-Oxygen (humid)';
      case 'toxic': return 'Sulfur compounds';
      case 'crystal': return 'None';
      case 'volcanic': return 'Sulfur dioxide';
      default: return 'Unknown';
    }
  }
  
  function getSurfaceTemp(planetType, orbitRadius) {
    const baseTemp = 5778 / Math.sqrt(orbitRadius); // Simplified calculation
    switch (planetType) {
      case 'lava': return (baseTemp + 500).toFixed(0);
      case 'terran': return (baseTemp - 273 + 15).toFixed(0);
      case 'ice': return (baseTemp - 273 - 100).toFixed(0);
      case 'gas': return (baseTemp - 273 - 50).toFixed(0);
      case 'rocky': return (baseTemp - 273).toFixed(0);
      default: return '?';
    }
  }

  // Helper functions for atmospheric effects перенесены в PlanetView.js

  function getStarColor(spectralType, owner) {
    if (owner !== null) return gameConfig.empireColors[owner];
    const colors = {
      'O': '#9bb0ff', 'B': '#aabfff', 'A': '#cad7ff',
      'F': '#f8f7ff', 'G': '#fff4ea', 'K': '#ffd2a1',
      'M': '#ffcc6f'
    };
    return colors[spectralType] || '#fff4ea';
  }
  
  // Вспомогательные функции для манипуляции с цветом
  function lightenColor(color, amount) {
    // Преобразуем hex или rgb в rgb значения
    const rgb = parseColor(color);
    return `rgb(${
      Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount))
    }, ${
      Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount))
    }, ${
      Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount))
    })`;
  }
  
  function darkenColor(color, amount) {
    const rgb = parseColor(color);
    return `rgb(${
      Math.max(0, Math.round(rgb.r * (1 - amount)))
    }, ${
      Math.max(0, Math.round(rgb.g * (1 - amount)))
    }, ${
      Math.max(0, Math.round(rgb.b * (1 - amount)))
    })`;
  }
  
  function parseColor(color) {
    // Обрабатываем hex цвета
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return { r, g, b };
    }
    // Обрабатываем rgb цвета
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      return {
        r: parseInt(matches[0]),
        g: parseInt(matches[1]),
        b: parseInt(matches[2])
      };
    }
    // Запасной вариант по умолчанию
    return { r: 128, g: 128, b: 128 };
  }

  // Запуск анимации
  drawSystem();
  

  
  // Keyboard event handler
  
  document.addEventListener('keydown', handleKeyDown);

  // Возвращаем функцию очистки
  return () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', handleKeyDown);
    controls.destroy?.();
  };
}
