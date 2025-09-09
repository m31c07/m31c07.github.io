// src/ui/StarSystemView.js
import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';

export function renderStarSystem(canvas, star, explorationSystem, onBack) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  // console.log("kek renderStarSystem", gameConfig.ui.currentView);
  const ctx = canvas.getContext('2d');
  let animationId = null;

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
      }
    }
  });
  
  let selectedPlanet = null;
  let planetPositions = []; // Store current planet positions for click detection
  let showingPlanetDetail = false;
  let detailPlanet = null;
  
  // Handle back to galaxy function (defined early to avoid reference errors)
  const handleBack = () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', handleKeyDown);
    controls.destroy?.();
    onBack();
  };
  
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
      } else {
        // First click: select planet
        selectedPlanet = clickedPlanet;
      }
      return true;
    }
    
    // Call original handler for empty space clicks
    return originalHandleInteraction.call(this, x, y);
  };

  function drawSystem(time = 0) {
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
    
    // === Применяем трансформации камеры ===
    ctx.save();
    const cameraState = controls.getCameraState();
    ctx.translate(cameraState.offsetX, cameraState.offsetY);
    ctx.scale(cameraState.scale, cameraState.scale);
    
    // === Центр системы (в "мире") ===
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // === Рисуем звезду (в трансформированном пространстве) ===
    ctx.save(); // для изоляции shadowBlur
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.fillStyle = getStarColor(star.spectralType, star.owner);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.restore(); // отключаем тень
    
    // === Рисуем планеты ===
    star.planets.planets.forEach(planet => {
      drawPlanet(planet, time, centerX, centerY);
    });
    
    // === Рисуем астероидные пояса ===
    if (star.planets.asteroidBelts) {
      star.planets.asteroidBelts.forEach(belt => {
        drawAsteroidBelt(belt, time, centerX, centerY);
      });
    }
    
    ctx.restore(); // откатываем трансформации
    
    // Draw planet information panel (outside camera transformations)
    drawPlanetInfoPanel();
    
    // Draw celestial bodies menu
    drawCelestialBodiesMenu();
    
    // Draw instructions
    drawInstructions();
    
    // Draw return to galaxy button (only in system view, not planet detail)
    drawReturnButton();

    animationId = requestAnimationFrame(drawSystem);
  }
  
  function drawUnexploredSystem() {
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

  function drawPlanet(planet, time, centerX, centerY) {
    const angle = time * planet.orbitSpeed * 0.0001;
    const x = centerX + Math.cos(angle) * planet.orbitRadius;
    const y = centerY + Math.sin(angle) * planet.orbitRadius;
    
    // Store planet position for click detection
    planetPositions.push({ planet, x, y });

    // Орбита
    ctx.beginPath();
    ctx.arc(centerX, centerY, planet.orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.stroke();

    if (planet.rings) drawRings(planet, x, y, true);

    // Планета
    ctx.beginPath();
    ctx.arc(x, y, planet.size, 0, Math.PI * 2);
    ctx.fillStyle = planet.color;
    ctx.fill();
    
    // Selection highlight
    if (selectedPlanet === planet) {
      ctx.beginPath();
      ctx.arc(x, y, planet.size + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Pulsing effect
      const pulseRadius = planet.size + 6 + Math.sin(time * 0.005) * 2;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    planet.moons.forEach(moon => {
      drawMoon(moon, time, x, y);
    });

    if (planet.rings) drawRings(planet, x, y, false);

    // Название планеты
    ctx.fillStyle = selectedPlanet === planet ? '#4a90e2' : 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, x, y - planet.size - 8);
  }

  function drawRings(planet, x, y, isBackPart) {
    const { innerRadius, outerRadius, tilt } = planet.rings;
    const steps = 12;
    const ringWidth = outerRadius - innerRadius;
    const color = 'rgb(200, 180, 150)';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const radius = innerRadius + ringWidth * progress;
      const alpha = 0.7 * (1 - progress * 0.5);

      ctx.beginPath();
      if (isBackPart) {
        ctx.ellipse(0, 0, radius * planet.size, radius * planet.size * 0.3, 0, Math.PI, Math.PI * 2);
      } else {
        ctx.ellipse(0, 0, radius * planet.size, radius * planet.size * 0.3, 0, 0, Math.PI);
      }
      ctx.strokeStyle = color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMoon(moon, time, planetX, planetY) {
    const angle = time * moon.orbitSpeed * 0.0002;
    const x = planetX + Math.cos(angle) * moon.orbitRadius;
    const y = planetY + Math.sin(angle) * moon.orbitRadius;

    ctx.beginPath();
    ctx.arc(x, y, moon.size, 0, Math.PI * 2);
    ctx.fillStyle = moon.color;
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
      ice: 'Frozen world in the outer system'
    };
    
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    const description = typeDescriptions[selectedPlanet.type] || 'Unknown planet type';
    ctx.fillText(description, panelX + 15, panelY + panelHeight - 15);
  }
  
  function drawAsteroidBelt(belt, time, centerX, centerY) {
    // Generate stable asteroid positions based on belt ID
    const asteroidCount = 30;
    const seed = belt.id * 12345; // Stable seed based on belt ID
    
    for (let i = 0; i < asteroidCount; i++) {
      // Use seeded random for stable positions
      const seedValue = (seed + i) * 0.00001;
      const angle = (i / asteroidCount) * Math.PI * 2 + seedValue + time * 0.0001;
      const radiusVariation = Math.sin(seedValue * 1000) * 0.5 + 0.5; // 0-1
      const radius = belt.innerRadius + radiusVariation * (belt.outerRadius - belt.innerRadius);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      const asteroidSize = 1 + (Math.sin(seedValue * 2000) * 0.5 + 0.5) * 2;
      
      ctx.beginPath();
      ctx.arc(x, y, asteroidSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
      ctx.fill();
    }
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
    ctx.fillText('Celestial Bodies', menuX + 15, menuY + 45);
    
    // Scrollable content area
    const contentY = menuY + 55;
    const contentHeight = menuHeight - 75;
    const itemHeight = 45;
    const maxVisibleItems = Math.floor(contentHeight / itemHeight);
    
    // Combine planets and asteroid belts
    const celestialBodies = [
      ...star.planets.planets.map(planet => ({ ...planet, type: 'planet' })),
      ...(star.planets.asteroidBelts || []).map(belt => ({ ...belt, type: 'asteroid_belt' }))
    ];
    
    // Draw celestial bodies list
    celestialBodies.forEach((body, index) => {
      if (index >= maxVisibleItems) return; // Simple limit for now
      
      const itemY = contentY + index * itemHeight;
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
      } else {
        // Asteroid belt icon
        ctx.fillStyle = '#999';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(iconX - 3 + i * 3, iconY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Body name
      ctx.fillStyle = isSelected ? '#4a90e2' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(body.name, iconX + 20, itemY + 12);
      
      // Body details
      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
      
      if (body.type === 'planet') {
        const details = [
          `Type: ${body.type}`,
          `${body.moons.length} moons`,
          body.habitable ? 'Habitable' : 'Not habitable'
        ].join(' • ');
        ctx.fillText(details, iconX + 20, itemY + 28);
      } else {
        ctx.fillText(`Asteroid Belt • Density: ${(body.density * 100).toFixed(0)}%`, iconX + 20, itemY + 28);
      }
      
      // Make item clickable (only for planets)
      if (body.type === 'planet') {
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
          text: `celestial-body-${index}`
        });
      }
    });
    
    // Scroll indicator if needed
    if (celestialBodies.length > maxVisibleItems) {
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${maxVisibleItems}/${celestialBodies.length} shown`, menuX + menuWidth/2, menuY + menuHeight - 10);
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
    const planetSize = 150;
    
    // Planet rings if present (draw back part behind planet)
    if (planet.rings) {
      drawDetailRings(planet, centerX, centerY, planetSize, true);
    }
    
    // Planet sphere with gradient
    const gradient = ctx.createRadialGradient(
      centerX - 50, centerY - 50, 0,
      centerX, centerY, planetSize
    );
    gradient.addColorStop(0, planet.color);
    gradient.addColorStop(1, '#000');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, planetSize, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Planet highlight
    ctx.beginPath();
    ctx.arc(centerX - 30, centerY - 30, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
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
      `Day length: ${(24 + Math.random() * 48).toFixed(1)} hours`
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
      `Ring system: ${planet.rings ? 'Present' : 'None'}`,
      `Habitable: ${planet.habitable ? 'Yes' : 'No'}`,
      `Atmosphere: ${getAtmosphereType(planet.type)}`,
      `Surface temp: ${getSurfaceTemp(planet.type, planet.orbitRadius)}°C`
    ], canvas.width - 350, 150);
    
    // Moon orbits around detailed planet
    if (planet.moons.length > 0) {
      const time = Date.now();
      planet.moons.forEach((moon, index) => {
        const moonAngle = time * moon.orbitSpeed * 0.0001 + index * Math.PI / 2;
        const moonDistance = planetSize + 30 + moon.orbitRadius * 5;
        const moonX = centerX + Math.cos(moonAngle) * moonDistance;
        const moonY = centerY + Math.sin(moonAngle) * moonDistance;
        
        // Moon orbit
        ctx.beginPath();
        ctx.arc(centerX, centerY, moonDistance, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Moon
        ctx.beginPath();
        ctx.arc(moonX, moonY, moon.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = moon.color;
        ctx.fill();
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
  
  function drawDetailRings(planet, centerX, centerY, planetSize, isBackPart) {
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
  }
  
  function getAtmosphereType(planetType) {
    switch (planetType) {
      case 'terran': return 'Nitrogen-Oxygen';
      case 'gas': return 'Hydrogen-Helium';
      case 'lava': return 'Carbon dioxide';
      case 'ice': return 'Thin methane';
      case 'rocky': return 'None';
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

  function getStarColor(spectralType, owner) {
    if (owner !== null) return gameConfig.empireColors[owner];
    const colors = {
      'O': '#9bb0ff', 'B': '#aabfff', 'A': '#cad7ff',
      'F': '#f8f7ff', 'G': '#fff4ea', 'K': '#ffd2a1',
      'M': '#ffcc6f'
    };
    return colors[spectralType] || '#ffff66';
  }

  // Запуск анимации
  drawSystem();
  

  
  // Keyboard event handler
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (showingPlanetDetail) {
        // Close planet detail view
        showingPlanetDetail = false;
        detailPlanet = null;
      } else {
        // Return to galaxy view
        handleBack();
      }
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);

  // Возвращаем функцию очистки
  return () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('keydown', handleKeyDown);
    controls.destroy?.();
  };
}
