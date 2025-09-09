import { gameConfig } from '../config/gameConfig.js';
import { CanvasControls } from './CanvasControls.js';

export function renderGalaxy(canvas, stars, explorationSystem, fleetManager, onStarClick) {
  const ctx = canvas.getContext('2d');
  const { width, height } = gameConfig.galaxy.mapSize;
  // console.log("kek renderGalaxy", gameConfig.ui.currentView);
  // Установка размеров canvas
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Инициализация контролов камеры
  // console.log('makekara', onStarClick);
  // const controls = new CanvasControls(canvas, {
    // width, height, // Добавляем размеры галактики
    // stars,
    // onPan: () => requestAnimationFrame(draw),
    // onZoom: () => requestAnimationFrame(draw),
    // onStarClick
  // });
    const controls = new CanvasControls(canvas, stars, {
      width, height,
      onPan: () => requestAnimationFrame(draw),
      onZoom: () => requestAnimationFrame(draw),
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



  // Состояние анимации
  const blinkingStars = new Set();
  let blinkTimer = 0;
  let animationFrameId;
  let selectedStar = null; // Track selected star

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

  // Основная функция отрисовки
  function draw() {
    const { offsetX, offsetY, scale } = controls.getCameraState();
    
    // Clear action buttons array for this frame
    window.actionButtons = [];
    
    // Update fleet manager
    fleetManager.update();
    
    // Очистка canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Настройка трансформаций камеры
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Обновление анимации блинка
    updateBlinkingStars();

    // Отрисовка гиперкоридоров (соединений между звездами)
    drawHyperlanes();

    // Отрисовка звезд
    drawStars();
    
    // Отрисовка флотов
    drawFleets();
    
    // Отрисовка кольцевых таймеров исследования
    drawExplorationTimers();
    
    // Отрисовка UI элементов
    drawExplorationUI();

    ctx.restore();
  }

  function updateBlinkingStars() {
    blinkTimer--;
    if (blinkTimer <= 0) {
      blinkTimer = 300 + Math.floor(Math.random() * 900);
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const star = stars[Math.floor(Math.random() * stars.length)];
        if (!blinkingStars.has(star.id)) {
          blinkingStars.add(star.id);
          star.blinkProgress = 0;
        }
      }
    }
  }

  function drawHyperlanes() {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    
    stars.forEach(star => {
      star.connections.forEach(connectedId => {
        const connectedStar = stars.find(s => s.id === connectedId);
        if (connectedStar) {
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(connectedStar.x, connectedStar.y);
          ctx.stroke();
        }
      });
    });
  }

  function drawStars() {
    stars.forEach(star => {
      // Обновление прогресса блинка
      if (blinkingStars.has(star.id)) {
        star.blinkProgress += 1 / 60;
        if (star.blinkProgress >= 1) {
          blinkingStars.delete(star.id);
        }
      }

      // Расчет яркости
      const brightness = blinkingStars.has(star.id)
        ? 1 + Math.sin(star.blinkProgress * Math.PI) * 2
        : 1;

      // Отрисовка звезды
      ctx.beginPath();
      ctx.arc(star.x, star.y, 5, 0, Math.PI * 2);
      
      // Цвет зависит от состояния исследования
      if (star.owner != null) {
        ctx.fillStyle = adjustColorBrightness(
          gameConfig.empireColors[star.owner], 
          brightness
        );
      } else if (star.explored) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(brightness / 1.5, 1)})`;
      } else {
        // Неисследованные звезды - тусклые
        ctx.fillStyle = `rgba(100, 100, 100, ${Math.min(brightness / 3, 0.6)})`;
      }
      
      ctx.fill();
      
      // Selection highlight for stars
      if (selectedStar === star) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Pulsing effect
        const pulseRadius = 10 + Math.sin(Date.now() * 0.005) * 2;
        ctx.beginPath();
        ctx.arc(star.x, star.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Отрисовка названия (только для исследованных и при достаточном приближении)
      if (controls.getCameraState().scale > 0.6) {
        ctx.font = "14px sans-serif";
        if (selectedStar === star) {
          ctx.fillStyle = "#4a90e2";
        } else {
          ctx.fillStyle = star.explored ? "white" : "#666";
        }
        ctx.textBaseline = "bottom";
        const displayName = explorationSystem.getStarDisplayName(star);
        ctx.fillText(displayName, star.x + 8, star.y - 8);
      }
    });
  }

  function adjustColorBrightness(hex, factor) {
    const r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * factor));
    const g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * factor));
    const b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * factor));
    return `rgb(${r}, ${g}, ${b})`;
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
  
  function drawFleets() {
    // Debug: Log fleet information only once
    if (!window.debugFleetLogged) {
      if (fleetManager.fleets.size === 0) {
        console.log('No fleets found!');
      } else {
        console.log('Fleet status:', {
          fleetsCount: fleetManager.fleets.size,
          fleetsEntries: Array.from(fleetManager.fleets.entries())
        });
      }
      window.debugFleetLogged = true;
    }
    
    // Get all hexagon objects for this frame
    const hexagons = getHexagonObjects();
    
    // Store hexagons globally for click detection
    window.currentHexagons = hexagons;
    
    // Draw hexagons
    hexagons.forEach(hex => {
      ctx.save();
      ctx.translate(hex.x, hex.y);
      
      drawHexagon(0, 0, hex.size, hex.shipCount, hex.systemId);
      
      ctx.restore();
    });
    
    // Отрисовка кораблей в полете
    for (const fleet of fleetManager.fleets.values()) {
      for (const ship of fleet) {
        if (ship.isMoving) {
          drawMovingShip(ship);
        }
      }
    }
  }
  
  function drawHexagon(x, y, size, shipCount, systemId) {
    const selectedShip = fleetManager.getSelectedShip();
    const isSelected = selectedShip && selectedShip.currentSystemId === parseInt(systemId);
    
    // Основной шестиугольник
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const pointX = x + size * Math.cos(angle);
      const pointY = y + size * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
    ctx.closePath();
    
    // Цвет в зависимости от выделения
    if (isSelected) {
      ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = 'rgba(0, 100, 200, 0.7)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
    }
    
    ctx.fill();
    ctx.stroke();
    
    // Количество кораблей
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shipCount.toString(), x, y);
  }
  

  function drawMovingShip(ship) {
    const position = fleetManager.getShipPosition(ship);
    const currentStar = stars[ship.currentSystemId];
    const targetStar = stars[ship.targetSystemId];
    
    if (!currentStar || !targetStar) return;
    
    // Draw complete route path if ship has a multi-step path
    if (ship.path && ship.path.length > 1) {
      ctx.save();
      
      // Draw future path segments (dimmer)
      ctx.strokeStyle = 'rgba(0, 120, 200, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      
      for (let i = 1; i < ship.path.length - 1; i++) {
        const fromStar = stars[ship.path[i]];
        const toStar = stars[ship.path[i + 1]];
        
        if (fromStar && toStar) {
          ctx.beginPath();
          ctx.moveTo(fromStar.x, fromStar.y);
          ctx.lineTo(toStar.x, toStar.y);
          ctx.stroke();
        }
      }
      
      // Draw current segment (brighter)
      ctx.strokeStyle = 'rgba(0, 170, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(currentStar.x, currentStar.y);
      ctx.lineTo(targetStar.x, targetStar.y);
      ctx.stroke();
      
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      // Single segment route (original behavior)
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 170, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(currentStar.x, currentStar.y);
      ctx.lineTo(targetStar.x, targetStar.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    
    // Draw ship icon
    ctx.save();
    ctx.translate(position.x, position.y);
    
    // Rotate towards target
    const angle = Math.atan2(targetStar.y - currentStar.y, targetStar.x - currentStar.x);
    ctx.rotate(angle);
    
    // Ship hull
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(8, 0);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    
    ctx.fillStyle = '#0af';
    ctx.shadowColor = '#0af';
    ctx.shadowBlur = 10;
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }
  
  function drawExplorationTimers() {
    // Отрисовка кольца исследования вокруг целевой системы
    // Поиск скаутов, которые в процессе исследования
    for (const fleet of fleetManager.fleets.values()) {
      for (const ship of fleet) {
        if (ship.isExploring && ship.currentSystemId !== null) {
          const targetStar = stars[ship.currentSystemId];
          if (targetStar) {
            // Рассчитываем прогресс исследования на основе времени
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
  
  function drawExplorationUI() {
    ctx.restore(); // Выходим из трансформаций камеры
    
    // Fleet dropdown
    drawFleetDropdown();
    
    // Selected ship panel
    drawSelectedShipPanel();
    
    // Instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    
    let instructions = '';
    if (fleetManager.getSelectedShip()) {
      instructions = 'Click star to move selected ship • Click hexagon to select ship • ESC to deselect';
    } else if (selectedStar) {
      instructions = selectedStar.explored ? 
        'Click selected star to view system • Click elsewhere to deselect • ESC to deselect' :
        'Selected star needs exploration • Click elsewhere to deselect • ESC to deselect';
    } else {
      instructions = 'Click stars to select • Click selected star to view system • Click hexagon to select ship';
    }
    
    ctx.fillText(instructions, 20, canvas.height - 20);
    
    ctx.save(); // Возвращаемся к трансформациям камеры
    ctx.translate(controls.getCameraState().offsetX, controls.getCameraState().offsetY);
    ctx.scale(controls.getCameraState().scale, controls.getCameraState().scale);
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

  // Запуск анимации
  animationFrameId = requestAnimationFrame(function renderLoop() {
    draw();
    animationFrameId = requestAnimationFrame(renderLoop);
  });
  
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

  // Функция очистки
  return function cleanup() {
    cancelAnimationFrame(animationFrameId);
    controls.destroy();
    explorationSystem.destroy();
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', resizeCanvas);
  };
}