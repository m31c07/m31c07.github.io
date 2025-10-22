import { gameConfig } from '../config/gameConfig.js';

export class CanvasControls {
    
  constructor(canvas, stars, options = {}) {
    this.canvas = canvas;
    this.stars = stars;
    this.renderer = options.renderer; // Store renderer reference
    
    // Always use WebGL renderer
    this.ctx = null;
    this.onPan = options.onPan || (() => {});
    this.onZoom = options.onZoom || (() => {});
    this.onStarClick = options.onStarClick || (() => {});
    this.onFleetClick = options.onFleetClick || (() => {});
    this.onEmptySpaceClick = options.onEmptySpaceClick || (() => {});
    this.zoomLimits = options.zoomLimits || { min: 0.1, max: 2 };
    this.cameraKey = options.cameraKey || 'galaxyCamera';
    this.panBounds = options.panBounds || null;
    
    // Режим рендера и параметры камеры (для 3D-aware зума)
    this.renderMode = options.renderMode || '2d';
    this.cameraParams = options.cameraParams || null;
    
    const camState = gameConfig.ui[this.cameraKey];
    
    if (!camState) {
      console.error(`Camera state not found for key: ${this.cameraKey}`);
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
    this._clampOffset();
  }

  // ==================== Основные методы ====================
  getCameraState() {
    return {
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      scale: this.scale
    };
  }

  // ==================== Внутренние методы ====================
  _updateConfig() {
    if (gameConfig.ui[this.cameraKey]) {
      gameConfig.ui[this.cameraKey].offsetX = this.offsetX;
      gameConfig.ui[this.cameraKey].offsetY = this.offsetY;
      gameConfig.ui[this.cameraKey].scale   = this.scale;
    }
  }

  _clampOffset() {
    if (!this.panBounds) return;

    const width = this.canvas.width || window.innerWidth;
    const height = this.canvas.height || window.innerHeight;
    const buffer = 11; // 1px orbit + 10px safety buffer

    const { centerX, centerY, limit } = this.panBounds;

    const minOffsetX = buffer - (centerX + limit) * this.scale;
    const maxOffsetX = (width - buffer) - (centerX - limit) * this.scale;
    const minOffsetY = buffer - (centerY + limit) * this.scale;
    const maxOffsetY = (height - buffer) - (centerY - limit) * this.scale;

    this.offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, this.offsetX));
    this.offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, this.offsetY));
  }

  _screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    // Перспективная конверсия для 3D режима (общая для всех камер)
    if (this.renderMode === '3d' && this.cameraParams) {
      const width = this.canvas.width || window.innerWidth;
      const height = this.canvas.height || window.innerHeight;
      const aspect = width / height;
      const fov = this.cameraParams.fov || (Math.PI / 10);
      const f = 1.0 / Math.tan(fov / 2);
      const minDistance = this.cameraParams.minDistance ?? 50;
      const maxDistance = this.cameraParams.maxDistance ?? 500;
      const cameraDistance = this.cameraParams.cameraDistance ?? 200;
      const cameraHeight = this.cameraParams.cameraHeight ?? 0;
      const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / this.scale));
      const zView = -zoomDistance - cameraHeight;
      
      // Экран → NDC
      const ndcX = (canvasX / width) * 2 - 1;
      const ndcY = 1 - (canvasY / height) * 2;
      
      // NDC → координаты вида (после view, до projection)
      const xView = ndcX * (-zView) * aspect / f;
      const yView = ndcY * (-zView) / f;
      
      // Вид → мир (обратная трансляция и масштаб)
      return {
        x: (xView - this.offsetX) / this.scale,
        y: (yView - this.offsetY) / this.scale
      };
    }
    
    // Базовая 2D конверсия
    return {
      x: (canvasX - this.offsetX) / this.scale,
      y: (canvasY - this.offsetY) / this.scale
    };
  }

  _checkStarHit(worldX, worldY) {
    let starsArray;

    if (Array.isArray(this.stars)) {
      starsArray = this.stars;
    } else if (this.stars?.stars && Array.isArray(this.stars.stars)) {
      starsArray = this.stars.stars;
    } else {
      return null;
    }

    let foundStar = starsArray.find(star => Math.hypot(star.x - worldX, star.y - worldY) < 10);
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
    
    const fleetHit = this._checkFleetHit(worldPos.x, worldPos.y);
    if (fleetHit) {
      this._updateConfig();
      this.onFleetClick(fleetHit.systemId, x, y);
      return true;
    }
    
    const star = this._checkStarHit(worldPos.x, worldPos.y);
    if (star) {
      this._updateConfig();
      this.onStarClick(star);
      return true;
    }
    
    this.onEmptySpaceClick();
    return false;
  }
  
  _checkFleetHit(worldX, worldY) {
    if (!window.currentHexagons) return null;
    
    for (const hex of window.currentHexagons) {
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
    
    if (this.renderMode === '3d' && this.cameraParams) {
      const width = this.canvas.width || window.innerWidth;
      const height = this.canvas.height || window.innerHeight;
      const aspect = width / height;
      const fov = this.cameraParams.fov || (Math.PI / 10);
      const f = 1.0 / Math.tan(fov / 2);
      const minDistance = this.cameraParams.minDistance ?? 50;
      const maxDistance = this.cameraParams.maxDistance ?? 500;
      const cameraDistance = this.cameraParams.cameraDistance ?? 200;
      const cameraHeight = this.cameraParams.cameraHeight ?? 0;
      const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / this.scale));
      const zView = -zoomDistance - cameraHeight;
      
      const ndcDx = (2 * dx) / width;
      const ndcDy = (-2 * dy) / height; // инверсия экранного Y для NDC
      const deltaXView = ndcDx * (-zView) * aspect / f;
      const deltaYView = ndcDy * (-zView) / f;
      
      this.offsetX += deltaXView;
      this._clampOffset();
      this.offsetY += deltaYView;
      this._clampOffset();
      this._updateConfig();
      this.onPan(deltaXView, deltaYView);
      return;
    }
    
    this.offsetX += dx;
    this._clampOffset();
    this.offsetY += dy;
    this._clampOffset();
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

    // Прокрутка меню небесных тел работает только в системном виде
    if (gameConfig.ui.currentView === 'starsystem' && gameConfig.ui.celestialMenu) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (mouseX >= 20 && mouseX <= 300 && mouseY >= 20 && mouseY <= 420) {
        const menuState = gameConfig.ui.celestialMenu;
        if (menuState.maxScroll > 0) {
          menuState.scrollTop = Math.max(0, Math.min(
            menuState.maxScroll, 
            menuState.scrollTop + (e.deltaY > 0 ? 1 : -1)
          ));
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

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1/1.1;
    const newScale = Math.max(
      this.zoomLimits.min, 
      Math.min(this.zoomLimits.max, this.scale * zoomFactor)
    );

    // 3D-aware zoom anchoring (общая для всех камер)
    if (this.renderMode === '3d' && this.cameraParams) {
      const aspect = (this.canvas.width || window.innerWidth) / (this.canvas.height || window.innerHeight);
      const fov = this.cameraParams.fov || (Math.PI / 10);
      const f = 1.0 / Math.tan(fov / 2);
      const minDistance = this.cameraParams.minDistance ?? 50;
      const maxDistance = this.cameraParams.maxDistance ?? 500;
      const cameraDistance = this.cameraParams.cameraDistance ?? 200;
      const cameraHeight = this.cameraParams.cameraHeight ?? 0;

      const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / this.scale));
      const zView = -zoomDistance - cameraHeight;

      const ndcX = (mouseX / (this.canvas.width || window.innerWidth)) * 2 - 1;
      const ndcY = 1 - (mouseY / (this.canvas.height || window.innerHeight)) * 2;

      const xView = ndcX * (-zView) * aspect / f;
      const yView = ndcY * (-zView) / f;

      const worldX = (xView - this.offsetX) / this.scale;
      const worldY = (yView - this.offsetY) / this.scale;

      const newZoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / newScale));
      const newZView = -newZoomDistance - cameraHeight;

      const newXView = ndcX * (-newZView) * aspect / f;
      const newYView = ndcY * (-newZView) / f;

      this.offsetX = newXView - worldX * newScale;
      this.offsetY = newYView - worldY * newScale;
      this.scale = newScale;
      this._clampOffset();
      this._updateConfig();
      this.onZoom(newScale, worldX, worldY);
      return;
    }

    // Fallback: 2D/orthographic-style zoom anchoring
    const worldX = (mouseX - this.offsetX) / this.scale;
    const worldY = (mouseY - this.offsetY) / this.scale;

    this.offsetX = mouseX - worldX * newScale;
    this.offsetY = mouseY - worldY * newScale;
    this.scale = newScale;
    this._clampOffset();
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
      
      if (this.renderMode === '3d' && this.cameraParams) {
        const width = this.canvas.width || window.innerWidth;
        const height = this.canvas.height || window.innerHeight;
        const aspect = width / height;
        const fov = this.cameraParams.fov || (Math.PI / 10);
        const f = 1.0 / Math.tan(fov / 2);
        const minDistance = this.cameraParams.minDistance ?? 50;
        const maxDistance = this.cameraParams.maxDistance ?? 500;
        const cameraDistance = this.cameraParams.cameraDistance ?? 200;
        const cameraHeight = this.cameraParams.cameraHeight ?? 0;
        const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / this.scale));
        const zView = -zoomDistance - cameraHeight;
        
        const ndcDx = (2 * dx) / width;
        const ndcDy = (-2 * dy) / height;
        const deltaXView = ndcDx * (-zView) * aspect / f;
        const deltaYView = ndcDy * (-zView) / f;
        
        this.offsetX += deltaXView;
        this._clampOffset();
        this.offsetY += deltaYView;
        this._clampOffset();
        this._updateConfig();
        this.onPan(deltaXView, deltaYView);
        return;
      }
      
      this.offsetX += dx;
      this._clampOffset();
      this.offsetY += dy;
      this._clampOffset();
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

      // 3D-aware pinch anchoring for starsystemCamera
      if (this.renderMode === '3d' && this.cameraParams && this.cameraKey === 'starsystemCamera') {
        const aspect = (this.canvas.width || window.innerWidth) / (this.canvas.height || window.innerHeight);
        const fov = this.cameraParams.fov || (Math.PI / 10);
        const f = 1.0 / Math.tan(fov / 2);
        const minDistance = this.cameraParams.minDistance ?? 50;
        const maxDistance = this.cameraParams.maxDistance ?? 500;
        const cameraDistance = this.cameraParams.cameraDistance ?? 200;
        const cameraHeight = this.cameraParams.cameraHeight ?? 0;

        const zoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / this.scale));
        const zView = -zoomDistance - cameraHeight;

        const ndcX = (midX / (this.canvas.width || window.innerWidth)) * 2 - 1;
        const ndcY = 1 - (midY / (this.canvas.height || window.innerHeight)) * 2;

        const xView = ndcX * (-zView) * aspect / f;
        const yView = ndcY * (-zView) / f;

        const worldX = (xView - this.offsetX) / this.scale;
        const worldY = (yView - this.offsetY) / this.scale;

        const newZoomDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance / newScale));
        const newZView = -newZoomDistance - cameraHeight;

        const newXView = ndcX * (-newZView) * aspect / f;
        const newYView = ndcY * (-newZView) / f;

        this.offsetX = newXView - worldX * newScale;
        this.offsetY = newYView - worldY * newScale;
        this.scale = newScale;
        this._clampOffset();
        this._updateConfig();
        
        this.onZoom(newScale, worldX, worldY);
        return;
      }

      const worldX = (midX - this.offsetX)/this.scale;
      const worldY = (midY - this.offsetY)/this.scale;

      this.offsetX = midX - worldX * newScale;
      this.offsetY = midY - worldY * newScale;
      this.scale = newScale;
      this._clampOffset();
      this._updateConfig();
      
      this.onZoom(newScale, worldX, worldY);
    }
  }

  // Clean up event listeners and interaction state
  destroy() {
    // Mouse events
    if (this._mouseDownHandler) this.canvas.removeEventListener('mousedown', this._mouseDownHandler);
    if (this._mouseMoveHandler) window.removeEventListener('mousemove', this._mouseMoveHandler);
    if (this._mouseUpHandler) window.removeEventListener('mouseup', this._mouseUpHandler);
    if (this._wheelHandler) this.canvas.removeEventListener('wheel', this._wheelHandler);

    // Touch events
    if (this._touchStartHandler) this.canvas.removeEventListener('touchstart', this._touchStartHandler);
    if (this._touchMoveHandler) window.removeEventListener('touchmove', this._touchMoveHandler);
    if (this._touchEndHandler) window.removeEventListener('touchend', this._touchEndHandler);

    // Reset interaction flags
    this.dragging = false;
    this._initialPinchDistance = null;
    this._initialScale = null;

    // No-ops to release references
    this.onPan = () => {};
    this.onZoom = () => {};
    this.onStarClick = () => {};
    this.onFleetClick = () => {};
    this.onEmptySpaceClick = () => {};
  }
}