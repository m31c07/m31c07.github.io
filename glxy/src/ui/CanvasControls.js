import { gameConfig } from '../config/gameConfig.js';

export class CanvasControls {
    
  constructor(canvas, stars, {
    onPan = () => {},
    onZoom = () => {},
    onStarClick = () => {},
    onFleetClick = () => {},
    onEmptySpaceClick = () => {},
  // onPan = (dx, dy) => console.log('PAN', dx, dy),
  // onZoom = (scale, x, y) => console.log('ZOOM', scale),
  // onStarClick = (star) => console.log('CLICK', star),
    zoomLimits = { min: 0.1, max: 2 },
    cameraKey = 'galaxyCamera' // Default to galaxy camera

  } = {}) {
    this.canvas = canvas;
    this.stars = stars;
    this.onPan = onPan;
    this.onZoom = onZoom;
    this.onStarClick = onStarClick;
    this.onFleetClick = onFleetClick;
    this.onEmptySpaceClick = onEmptySpaceClick;
    this.zoomLimits = zoomLimits;
    this.cameraKey = cameraKey;
    
    // this.offsetX =  -canvas.width / 2;
    // this.offsetY =  -canvas.height / 2;
    // this.scale = gameConfig.ui.galaxyCamera.scale ?? 0.3;

  
    const camState = gameConfig.ui[cameraKey];
    
    if (!camState) {
      console.error(`Camera state not found for key: ${cameraKey}`);
      // Fallback to default values
      this.offsetX = 0;
      this.offsetY = 0;
      this.scale = 0.5;
    } else {
      this.offsetX = camState.offsetX;
      this.offsetY = camState.offsetY;
      this.scale = camState.scale;
    }
  
    // Состояние взаимодействия
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.startX = 0;
    this.startY = 0;
    this._initialPinchDistance = null;
    this._initialScale = null;

    this._bindEvents();
  }

  // ==================== Основные методы ====================
  getCameraState() {
    return {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      scale: this.scale
    };
  }

  // setCameraState({ offsetX, offsetY, scale }) {
    // this.offsetX = offsetX;
    // this.offsetY = offsetY;
    // this.scale = Math.max(
      // this.zoomLimits.min, 
      // Math.min(this.zoomLimits.max, scale)
    // );
    // this._updateConfig();
  // }

  // handleClick(e) {
    // const rect = this.canvas.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    // const y = e.clientY - rect.top;

    // const worldX = (x - gameConfig.ui.galaxyCamera.offsetX) / gameConfig.ui.galaxyCamera.scale;
    // const worldY = (y - gameConfig.ui.galaxyCamera.offsetY) / gameConfig.ui.galaxyCamera.scale;

    // const clickedStar = this._checkStarHit(worldX, worldY);
    // if (clickedStar && this.onStarClick) {
      // this.onStarClick(clickedStar);
    // }
  // }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._mouseDownHandler);
    window.removeEventListener('mousemove', this._mouseMoveHandler);
    window.removeEventListener('mouseup', this._mouseUpHandler);
    this.canvas.removeEventListener('wheel', this._wheelHandler);
    this.canvas.removeEventListener('touchstart', this._touchStartHandler);
    // this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('touchmove', this._touchMoveHandler);
    window.removeEventListener('touchend', this._touchEndHandler);
  }

  // ==================== Внутренние методы ====================
  _updateConfig() {
    // gameConfig.ui.galaxyCamera.offsetX = this.offsetX;
    // gameConfig.ui.galaxyCamera.offsetY = this.offsetY;
    // gameConfig.ui.galaxyCamera.scale = this.scale;
    if (gameConfig.ui[this.cameraKey]) {
      gameConfig.ui[this.cameraKey].offsetX = this.offsetX;
      gameConfig.ui[this.cameraKey].offsetY = this.offsetY;
      gameConfig.ui[this.cameraKey].scale   = this.scale;
    }
  }

  _screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    return {
      x: (canvasX - this.offsetX) / this.scale,
      y: (canvasY - this.offsetY) / this.scale
    };
  }

    _checkStarHit(worldX, worldY) {
      let starsArray;

      if (Array.isArray(this.stars)) {
        starsArray = this.stars;
        
        // console.error('keka:', this.stars);
      } else if (this.stars?.stars && Array.isArray(this.stars.stars)) {
        starsArray = this.stars.stars;
        // console.error('keka maka ', this.stars);
      } else {
        // console.error('Invalid stars format in CanvasControls:', this.stars);
        return null;
      }

        
      let foundStar = starsArray.find(star => Math.hypot(star.x - worldX, star.y - worldY) < 10);
      // console.error( 'kekaX:', foundStar.x, ' ', worldX, foundStar.y,  ' ', worldY ,  ' ', foundStar) ;
      return foundStar;
    }



  _handleInteraction(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;
    
    // Check for action button clicks first (highest priority)
    if (window.actionButtons && window.actionButtons.length > 0) {
      for (const button of window.actionButtons) {
        if (canvasX >= button.x && canvasX <= button.x + button.width &&
            canvasY >= button.y && canvasY <= button.y + button.height) {
          button.onClick();
          return true;
        }
      }
    }
    
    const worldPos = this._screenToWorld(x, y);
    
    // Check for fleet click (hexagons are smaller and higher priority than stars)
    const fleetHit = this._checkFleetHit(worldPos.x, worldPos.y);
    if (fleetHit) {
      this._updateConfig();
      this.onFleetClick(fleetHit.systemId, x, y);
      return true;
    }
    
    // Check for star click
    const star = this._checkStarHit(worldPos.x, worldPos.y);
    if (star) {
      this._updateConfig();
      this.onStarClick(star);
      return true;
    }
    
    // No interactive element was clicked - call empty space callback
    this.onEmptySpaceClick();
    return false;
  }
  
  _checkFleetHit(worldX, worldY) {
    // Use hexagon objects created during rendering
    if (!window.currentHexagons) return null;
    
    for (const hex of window.currentHexagons) {
      // Check if click is within hexagon bounds (simplified as circle)
      const distance = Math.hypot(hex.x - worldX, hex.y - worldY);
      if (distance < hex.size) {
        return { systemId: parseInt(hex.systemId) };
      }
    }
    
    return null;
  }

  // ==================== Обработчики событий ====================
  _bindEvents() {
    // Мышь
    this._mouseDownHandler = (e) => this._onMouseDown(e);
    this._mouseMoveHandler = (e) => this._onMouseMove(e);
    this._mouseUpHandler = (e) => this._onMouseUp(e);
    this._wheelHandler = (e) => this._onWheel(e);

    // Тач
    this._touchStartHandler = (e) => this._onTouchStart(e);
    this._touchMoveHandler = (e) => this._onTouchMove(e);
    this._touchEndHandler = (e) => this._onTouchEnd(e);

    this.canvas.addEventListener('mousedown', this._mouseDownHandler);
    window.addEventListener('mousemove', this._mouseMoveHandler);
    window.addEventListener('mouseup', this._mouseUpHandler);
    this.canvas.addEventListener('wheel', this._wheelHandler, { passive: false });

    this.canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
    window.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
    window.addEventListener('touchend', this._touchEndHandler);
    
    // this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  _onMouseDown(e) {
    this.dragging = true;
    this.lastX = this.startX = e.clientX;
    this.lastY = this.startY = e.clientY;
  }

  _onMouseMove(e) {
    if (!this.dragging) return;
    
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    
    this.offsetX += dx;
    this.offsetY += dy;
    this._updateConfig();
    this.onPan(dx, dy);
  }

  _onMouseUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    
    if (Math.hypot(e.clientX - this.startX, e.clientY - this.startY) < 5) {
      this._handleInteraction(e.clientX, e.clientY);
    }
  }

  _onWheel(e) {
    e.preventDefault();

    // Check if we're over the celestial menu and handle scrolling there first
    if (gameConfig.ui.currentView === 'starsystem' && gameConfig.ui.celestialMenu) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if mouse is over celestial menu (approximate position)
      if (mouseX >= 20 && mouseX <= 300 && mouseY >= 20 && mouseY <= 420) {
        const menuState = gameConfig.ui.celestialMenu;
        if (menuState.maxScroll > 0) {
          // Handle menu scrolling
          menuState.scrollTop = Math.max(0, Math.min(
            menuState.maxScroll, 
            menuState.scrollTop + (e.deltaY > 0 ? 1 : -1)
          ));
          // Redraw the scene to update the menu
          if (typeof window.drawSystem === 'function') {
            window.drawSystem();
          }
          return;
        }
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - this.offsetX) / this.scale;
    const worldY = (mouseY - this.offsetY) / this.scale;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1/1.1;
    const newScale = Math.max(
      this.zoomLimits.min, 
      Math.min(this.zoomLimits.max, this.scale * zoomFactor)
    );

    this.offsetX = mouseX - worldX * newScale;
    this.offsetY = mouseY - worldY * newScale;
    this.scale = newScale;
    this._updateConfig();
    
    this.onZoom(newScale, worldX, worldY);
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this.dragging = true;
      this.lastX = this.startX = e.touches[0].clientX;
      this.lastY = this.startY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this._handlePinchStart(e);
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 2) {
      this._handlePinchMove(e);
    } else if (this.dragging && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.lastX;
      const dy = e.touches[0].clientY - this.lastY;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
      
      this.offsetX += dx;
      this.offsetY += dy;
      this._updateConfig();
      this.onPan(dx, dy);
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length === 0 && this.dragging) {
      this._onMouseUp(e);

      // this.dragging = false;
      
      // if (Math.hypot(this.lastX - this.startX, this.lastY - this.startY) < 5) {
        // this._handleInteraction(this.lastX, this.lastY);
      // }
    }
  }

  _handlePinchStart(e) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    this._initialPinchDistance = Math.hypot(dx, dy);
    this._initialScale = this.scale;
    this.dragging = false;
  }

  _handlePinchMove(e) {
    e.preventDefault();
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    const distance = Math.hypot(dx, dy);

    if (this._initialPinchDistance) {
      const zoomFactor = distance / this._initialPinchDistance;
      const newScale = Math.max(
        this.zoomLimits.min, 
        Math.min(this.zoomLimits.max, this._initialScale * zoomFactor)
      );

      const rect = this.canvas.getBoundingClientRect();
      const midX = (touch1.clientX + touch2.clientX)/2 - rect.left;
      const midY = (touch1.clientY + touch2.clientY)/2 - rect.top;

      const worldX = (midX - this.offsetX)/this.scale;
      const worldY = (midY - this.offsetY)/this.scale;

      this.offsetX = midX - worldX * newScale;
      this.offsetY = midY - worldY * newScale;
      this.scale = newScale;
      this._updateConfig();
      
      this.onZoom(newScale, worldX, worldY);
    }
  }
}