// src/renderers/WebGLRenderer.js
// import CelestialBodyRenderer from './CelestialBodyRenderer.js';

export default class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    // Попробуем получить стандартный контекст
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    // Если не получилось, попробуем получить контекст с ослабленными требованиями
    if (!this.gl) {
      const options = {
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'low-power'
      };
      this.gl = canvas.getContext('webgl', options) ||
                canvas.getContext('experimental-webgl', options);
    }
    
    if (!this.gl) {
      // Проверим поддержку WebGL через Modernizr если доступен
      let hasWebGL = true;
      if (typeof Modernizr !== 'undefined') {
        hasWebGL = Modernizr.webgl;
      } else {
        // Базовая проверка поддержки WebGL
        try {
          const testCanvas = document.createElement('canvas');
          hasWebGL = !!(testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
        } catch (e) {
          hasWebGL = false;
        }
      }
      
    // this.celestialBodyRenderer = new CelestialBodyRenderer(this.gl);
    
      const message = hasWebGL ?
        "Не удалось инициализировать WebGL. Возможно, проблема с драйверами видеокарты." :
        "Ваш браузер не поддерживает WebGL. Пожалуйста, обновите браузер или используйте Chrome/Firefox/Edge.";
      
      showErrorOverlay(message);
      throw new Error(message);
    }
    
    function showErrorOverlay(message) {
      const errorDiv = document.createElement('div');
      errorDiv.id = 'webgl-error';
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '0';
      errorDiv.style.left = '0';
      errorDiv.style.width = '100%';
      errorDiv.style.backgroundColor = 'rgba(200,0,0,0.8)';
      errorDiv.style.color = 'white';
      errorDiv.style.padding = '20px';
      errorDiv.style.zIndex = '10000';
      errorDiv.style.fontFamily = 'Arial, sans-serif';
      errorDiv.style.fontSize = '16px';
      errorDiv.style.textAlign = 'center';
      errorDiv.innerHTML = `
        <h2>Ошибка WebGL</h2>
        <p>${message}</p>
        <p><a href="https://get.webgl.org/" target="_blank" style="color: white; text-decoration: underline;">Узнать больше о WebGL</a></p>
      `;
      document.body.appendChild(errorDiv);
    }
    

    // Check for instanced rendering support
    this.extInstanced = this.gl.getExtension('ANGLE_instanced_arrays');
    if (!this.extInstanced) {
      console.warn('Instanced rendering not supported, falling back to individual point draws for stars');
    }

    // Initialize WebGL settings
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0, 0, 0, 1);
    
    // Store shader programs
    this.programs = {};
    
    // Camera and projection matrices
    this.projectionMatrix = new Float32Array(16);
    this.viewMatrix = new Float32Array(16);
    
    // Initialize buffers
    this.vertexBuffer = this.gl.createBuffer();
    this.indexBuffer = this.gl.createBuffer();
    
    // Buffer cache for performance optimization
    this.bufferCache = new Map();
    this.maxCacheSize = 100; // Limit cache size to prevent memory leaks
    this.textMetricsCache = new Map();
    // Кэш текстур для Canvas, чтобы не создавать новую текстуру каждый кадр
    this.canvasTextureCache = new Map();
    this.canvasTextureList = new Set();
    
    this.initBasicShaders();
  }


  // Initialize point shader
  initPointShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform float uPointSize;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
        gl_PointSize = uPointSize;
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        // Make point circular using gl_PointCoord
        vec2 p = gl_PointCoord * 2.0 - 1.0; // range [-1,1]
        float r2 = dot(p, p);
        if (r2 > 1.0) {
          discard;
        }
        gl_FragColor = uColor;
      }
    `;
    
    this.programs.point = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize line shader
  initLineShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
    `;
    
    this.programs.line = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize text shader
  initTextShader() {
    const vsSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform vec4 uColor;
      varying vec2 vTexCoord;
      
      void main() {
        vec4 texColor = texture2D(uTexture, vTexCoord);
        gl_FragColor = uColor * texColor;
      }
    `;
    
    this.programs.text = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize polygon shader (for fleets, UI)
  initPolygonShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
    `;
    
    this.programs.polygon = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize instanced point shader for efficient star rendering
  initInstancedPointShader() {
    const vsSource = `
      attribute vec2 aBasePosition;
      attribute vec2 aInstancePosition;
      attribute vec4 aInstanceColor;
      attribute float aInstanceSize;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      varying vec4 vColor;
      void main() {
        vec4 worldPos = vec4(aBasePosition + aInstancePosition, 0.0, 1.0);
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
        gl_PointSize = aInstanceSize;
        vColor = aInstanceColor;
      }
    `;
    
    const fsSource = `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (dot(p, p) > 1.0) {
          discard;
        }
        gl_FragColor = vColor;
      }
    `;
    
    this.programs.instancedPoint = this.createShaderProgram(vsSource, fsSource);
  }
  
  // Initialize instanced text shader for efficient text rendering
  initInstancedTextShader() {
    const vsSource = `
      attribute vec2 aBasePosition;
      attribute vec2 aInstancePosition;
      attribute vec2 aInstanceSize;
      attribute vec4 aInstanceColor;
      attribute vec4 aInstanceTexCoord;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform vec2 uScreenSize;
      varying vec2 vTexCoord;
      varying vec4 vColor;
      
      void main() {
        // Transform world position to clip space
        vec4 clipPos = uProjectionMatrix * uViewMatrix * vec4(aInstancePosition, 0.0, 1.0);
        
        // Convert to normalized device coordinates
        vec2 ndc = clipPos.xy / clipPos.w;
        
        // Calculate text quad in screen pixels (fixed size)
        // Adjust Y coordinate to fix vertical flipping
        vec2 adjustedBasePos = vec2(aBasePosition.x - 0.5, 0.5 - aBasePosition.y);
        vec2 pixelOffset = adjustedBasePos * aInstanceSize;
        
        // Convert pixel offset to NDC space
        vec2 ndcOffset = vec2(pixelOffset.x / (uScreenSize.x * 0.5), pixelOffset.y / (uScreenSize.y * 0.5));
        
        // Final position: world position + fixed pixel offset (preserve clip w)
        gl_Position = vec4((ndc + ndcOffset) * clipPos.w, 0.0, clipPos.w);
        
        // Fix texture coordinates
        vTexCoord = aInstanceTexCoord.xy + aBasePosition * aInstanceTexCoord.zw;
        vColor = aInstanceColor;
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      varying vec2 vTexCoord;
      varying vec4 vColor;
      
      void main() {
        vec4 texColor = texture2D(uTexture, vTexCoord);
        gl_FragColor = vColor * texColor;
      }
    `;
    
    this.programs.instancedText = this.createShaderProgram(vsSource, fsSource);
  }
  
  // Initialize orbit shader (unchanged)
  initOrbitShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        gl_FragColor = uColor;
      }
    `;
    
    this.programs.orbit = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize glow point shader (soft radial falloff for blur effect)
  initGlowPointShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform float uPointSize;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
        gl_PointSize = uPointSize;
      }
    `;
    
    const fsSource = `
      precision mediump float;
      uniform vec4 uColor;
      
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float dist = length(p);
        if (dist > 1.0) { discard; }
        // Gaussian-like falloff for soft glow
        float glow = exp(-dist * dist * 6.0);
        // Add slightly stronger core
        float core = exp(-dist * dist * 24.0);
        float alpha = clamp(glow * 0.7 + core * 0.6, 0.0, 1.0) * uColor.a;
        gl_FragColor = vec4(uColor.rgb, alpha);
      }
    `;
    
    this.programs.glowPoint = this.createShaderProgram(vsSource, fsSource);
  }
////////////////
  initPlanetShader() {
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      
      void main() {
        vUv = aPosition; // [-1,1] координаты для полноэкранного квада
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      
      uniform float uTime;
      uniform sampler2D uTexture;
      uniform float uDistortion;
      uniform vec2 uLightPos;
      uniform vec3 uAtmosphereColor;
      uniform float uAtmosphereIntensity;
      uniform float uRadius;
      uniform vec2 uCenter;
      uniform float uRotationSpeed;
      uniform vec3 uPlanetColor;

      varying vec2 vUv;

      void main() {
        // Преобразуем координаты относительно центра небесного тела
        vec2 uv = (vUv - uCenter);
        float r2 = dot(uv, uv);
        float maxRadius = uRadius * uRadius;

        // Жёсткое обрезание круга - пиксели за пределами не рисуем
        if(r2 > maxRadius) discard;

        // Нормализуем координаты для круга
        vec2 normalizedUV = uv / uRadius;
        
        // --- синусоидальная деформация для сферической проекции
        float factor = sqrt(1.0 - normalizedUV.y * normalizedUV.y); 
        float u = fract((normalizedUV.x * pow(factor, -uDistortion) * 0.5 + 0.5 + uTime * uRotationSpeed)); 
        float v = normalizedUV.y * 0.5 + 0.5;
        
        vec2 textureUV = vec2(u, v);
        
        // Семплируем текстуру
        vec4 textureColor = texture2D(uTexture, textureUV);
        
        // Отладочная информация - если текстура чёрная, используем цвет планеты
        if (textureColor.r + textureColor.g + textureColor.b < 0.1) {
            textureColor = vec4(uPlanetColor, 1.0);
        }
        
        // Применяем простое затемнение к краям для объёма
        float edgeFactor = smoothstep(0.8, 1.0, sqrt(r2 / maxRadius));
        
        // Комбинируем цвет планеты с текстурой (как в рабочем шейдере)
        vec3 finalColor = mix(textureColor.rgb, uPlanetColor, 0.2);
        
        // Применяем более мягкое затемнение к краям
        finalColor *= (1.0 - edgeFactor * 0.3);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
// console.log('kek');
    this.programs.planet = this.createShaderProgram(vsSource, fsSource);
  }
/////////////////

  // Initialize shaders for different rendering modes
  initBasicShaders() {
    // Point shader (stars)
    this.initPointShader();
    
    // Line shader (hyperlanes)
    // this.initLineShader();
    
    // Polygon shader (fleets, UI)
    // this.initPolygonShader();
    
    // Text shader (star names)
    // this.initTextShader();
    
    // Instanced point shader for batch rendering
    this.initInstancedPointShader();
    
    // Planet and orbit shaders
    this.initPlanetShader();
    // this.initOrbitShader();
    
    // Instanced text shader for batch rendering
    this.initInstancedTextShader();
    
    // Glow point shader (soft blur for luminous objects)
    this.initGlowPointShader();
  }

  // Create and compile shader program
  createShaderProgram(vsSource, fsSource) {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
    
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Shader program error:', this.gl.getProgramInfoLog(program));
      return null;
    }
    
    return program;
  }

  // Compile individual shader
  compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      return null;
    }
    
    return shader;
  }

  // Buffer caching methods for performance optimization
  getCachedBuffer(data, usage = this.gl.STATIC_DRAW) {
    const key = JSON.stringify(data);
    
    if (this.bufferCache.has(key)) {
      return this.bufferCache.get(key);
    }
    
    // Create new buffer if not cached
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), usage);
    
    // Add to cache with size limit
    if (this.bufferCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.bufferCache.keys().next().value;
      const oldBuffer = this.bufferCache.get(firstKey);
      this.gl.deleteBuffer(oldBuffer);
      this.bufferCache.delete(firstKey);
    }
    
    this.bufferCache.set(key, buffer);
    return buffer;
  }
  
  clearBufferCache() {
    for (const buffer of this.bufferCache.values()) {
      this.gl.deleteBuffer(buffer);
    }
    this.bufferCache.clear();
  }

  // Update canvas size
  setSize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    
    // Recalculate projection matrix if needed
    // (this could be moved to a separate updateProjection method)
  }
  
  // Update camera matrices
  setCamera(projectionMatrix, viewMatrix) {
    this.projectionMatrix = projectionMatrix;
    this.viewMatrix = viewMatrix;
  }

  // Main render method
  render(scene) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Render all objects in scene
    scene.objects.forEach((obj, index) => {
      try {
        this.renderObject(obj);
      } catch (error) {
        console.error(`Error rendering object ${index}:`, error, obj);
      }
    });
  }

  // Render single object with support for different shaders
  renderObject(object) {
    try {
      let program;
      switch (object.type) {
        case 'point':
          program = this.programs.point;
          break;
        case 'pointBatch':
          program = this.programs.glowPoint;
          break;
        case 'glowPoint':
          program = this.programs.glowPoint;
          // program = this.programs.point;
          break;
        case 'line':
        case 'lineBatch':
          // program = this.programs.line;
          program = this.programs.point;
          break;
        case 'polygon':
          // program = this.programs.polygon;
          program = this.programs.point;
          break;
        // case 'text':
          // program = this.programs.text;
          // program = this.programs.point;
          // break;
        case 'textBatch':
          // program = this.programs.instancedText;
          program = this.programs.point;
          break;
        case 'planet':
        case 'moon':
          program = this.programs.planet;
          break;
        default:
          program = this.programs.point;
      }
      
      this.gl.useProgram(program);
      
      // Set common uniforms
      const projLoc = this.gl.getUniformLocation(program, 'uProjectionMatrix');
      const viewLoc = this.gl.getUniformLocation(program, 'uViewMatrix');
      
      if (projLoc) this.gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix);
      if (viewLoc) this.gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix);
      
      // Bind vertex data
      let positionLoc = this.gl.getAttribLocation(program, 'aPosition');
      if (object.vertices && positionLoc !== -1) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.vertices), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(positionLoc);
        this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);
      } else if (positionLoc !== -1) {
        // Disable the attribute if no vertices or invalid location
        this.gl.disableVertexAttribArray(positionLoc);
      }
      
      // Handle point batch rendering
      if (object.type === 'pointBatch') {
        if (this.extInstanced && this.programs.instancedPoint) {
          // Use instanced rendering
          if (!this.extInstanced) {
            console.error('Instanced rendering extension not initialized!');
            return;
          }
          const program = this.programs.instancedPoint;
          this.gl.useProgram(program);
          
          // Set common uniforms (already set, but ensure)
          const projLoc = this.gl.getUniformLocation(program, 'uProjectionMatrix');
          const viewLoc = this.gl.getUniformLocation(program, 'uViewMatrix');
          const screenSizeLoc = this.gl.getUniformLocation(program, 'uScreenSize');
          if (projLoc) this.gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix);
          if (viewLoc) this.gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix);
          if (screenSizeLoc) this.gl.uniform2f(screenSizeLoc, this.canvas.width, this.canvas.height);
          
          // Base position buffer: single point at (0,0) - use cached buffer
          const baseVertices = [0, 0];
          let baseBuffer = this.getCachedBuffer(baseVertices);
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, baseBuffer);
          
          const basePosLoc = this.gl.getAttribLocation(program, 'aBasePosition');
          if (basePosLoc !== -1) {
            this.gl.enableVertexAttribArray(basePosLoc);
            this.gl.vertexAttribPointer(basePosLoc, 2, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(basePosLoc, 0);
          }
          
          // Instance positions buffer - dynamic (no cache)
          const posBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.vertices), this.gl.DYNAMIC_DRAW);
          
          const instPosLoc = this.gl.getAttribLocation(program, 'aInstancePosition');
          if (instPosLoc !== -1) {
            this.gl.enableVertexAttribArray(instPosLoc);
            this.gl.vertexAttribPointer(instPosLoc, 2, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instPosLoc, 1);
          }
          
          // Instance colors buffer - dynamic (no cache)
          const colorBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.colors), this.gl.DYNAMIC_DRAW);
          
          const instColorLoc = this.gl.getAttribLocation(program, 'aInstanceColor');
          if (instColorLoc !== -1) {
            this.gl.enableVertexAttribArray(instColorLoc);
            this.gl.vertexAttribPointer(instColorLoc, 4, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instColorLoc, 1);
          }
          
          // Instance sizes buffer - dynamic (no cache)
          const sizeBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sizeBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.sizes), this.gl.DYNAMIC_DRAW);
          
          const instSizeLoc = this.gl.getAttribLocation(program, 'aInstanceSize');
          if (instSizeLoc !== -1) {
            this.gl.enableVertexAttribArray(instSizeLoc);
            this.gl.vertexAttribPointer(instSizeLoc, 1, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instSizeLoc, 1);
          }
          
          // Draw all instances with one call
          this.extInstanced.drawArraysInstancedANGLE(this.gl.POINTS, 0, 1, object.vertexCount);
          
          // Clean up: disable arrays and delete dynamic buffers
          if (basePosLoc !== -1) this.gl.disableVertexAttribArray(basePosLoc);
          if (instPosLoc !== -1) this.gl.disableVertexAttribArray(instPosLoc);
          if (instColorLoc !== -1) this.gl.disableVertexAttribArray(instColorLoc);
          if (instSizeLoc !== -1) this.gl.disableVertexAttribArray(instSizeLoc);
          
          this.gl.deleteBuffer(posBuffer);
          this.gl.deleteBuffer(colorBuffer);
          this.gl.deleteBuffer(sizeBuffer);
        }
      }
      // Handle instanced text objects
      else if (object.type === 'textBatch') {
        if (this.extInstanced && this.programs.instancedText) {
          // Use instanced rendering for text with texture atlas
          const program = this.programs.instancedText;
          this.gl.useProgram(program);
          
          // Set common uniforms (already set, but ensure)
          const projLoc = this.gl.getUniformLocation(program, 'uProjectionMatrix');
          const viewLoc = this.gl.getUniformLocation(program, 'uViewMatrix');
          const screenSizeLoc = this.gl.getUniformLocation(program, 'uScreenSize');
          if (projLoc) this.gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix);
          if (viewLoc) this.gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix);
          if (screenSizeLoc) this.gl.uniform2f(screenSizeLoc, this.canvas.width, this.canvas.height);
          
          // Create cache key based on text content and font sizes - OPTIMIZED
          // Use a faster hash instead of JSON.stringify
          let cacheKey = '';
          for (let i = 0; i < object.texts.length; i++) {
            cacheKey += object.texts[i] + '|' + (object.fontSizes[i] || 14) + '|';
          }
          
          // Check if we have cached atlas for this exact text content
          let texture, texCoords;
          if (this.textAtlasCache && this.textAtlasCache.key === cacheKey) {
            // Use cached atlas
            texture = this.textAtlasCache.texture;
            texCoords = this.textAtlasCache.texCoords;
          } else {
            // Create new atlas using reusable canvas
            if (!this.atlasCanvas) {
              this.atlasCanvas = document.createElement('canvas');
              this.atlasCtx = this.atlasCanvas.getContext('2d');
            }
            
            // Calculate atlas dimensions
            let totalWidth = 0;
            let maxHeight = 0;
            const textMetrics = [];
            
            // Measure all texts with their individual font sizes using cached metrics
            for (let i = 0; i < object.texts.length; i++) {
              const text = object.texts[i];
              const fontSize = object.fontSizes[i] || 14; // Use individual font size or fallback to 14
              const metricKey = text + '|' + fontSize;
              
              let textWidth, textHeight;
              if (this.textMetricsCache && this.textMetricsCache.has(metricKey)) {
                // Use cached metrics
                const cached = this.textMetricsCache.get(metricKey);
                textWidth = cached.width;
                textHeight = fontSize * 1; // Approximate height
              } else {
                // Measure text
                this.atlasCtx.font = `${fontSize}px Arial`;
                const metrics = this.atlasCtx.measureText(text);
                textWidth = metrics.width;
                textHeight = fontSize * 1; // Approximate height
                
                // Cache the result if cache exists
                if (this.textMetricsCache) {
                  this.textMetricsCache.set(metricKey, { width: Math.ceil(textWidth), height: Math.ceil(fontSize) });
                  
                  // Limit cache size to prevent memory leaks
                  if (this.textMetricsCache.size > 1000) {
                    const firstKey = this.textMetricsCache.keys().next().value;
                    this.textMetricsCache.delete(firstKey);
                  }
                }
              }
              
              textMetrics.push({ width: textWidth, height: textHeight, fontSize: fontSize });
              totalWidth += Math.ceil(textWidth) + 2; // Add padding
              maxHeight = Math.max(maxHeight, Math.ceil(textHeight) + 2); // Add padding
            }
            
            // Set atlas dimensions (with some padding)
            this.atlasCanvas.width = Math.max(256, totalWidth); // Minimum size
            this.atlasCanvas.height = Math.max(32, maxHeight); // Minimum size
            
            // Draw all texts to atlas
            this.atlasCtx.textAlign = 'left';
            this.atlasCtx.textBaseline = 'top';
            this.atlasCtx.fillStyle = '#ffffff';
            
            let currentX = 0;
            texCoords = [];
            for (let i = 0; i < object.texts.length; i++) {
              const text = object.texts[i];
              const metrics = textMetrics[i];
              
              // Set font size for this specific text
              this.atlasCtx.font = `${metrics.fontSize}px Arial`;
              
              // Draw text to atlas
              this.atlasCtx.fillText(text, currentX + 1, 1); // Add 1px padding
              
              // Calculate texture coordinates (0-1 range)
              const texX = currentX / this.atlasCanvas.width;
              const texY = 0;
              const texWidth = metrics.width / this.atlasCanvas.width;
              const texHeight = metrics.height / this.atlasCanvas.height;
              
              texCoords.push(texX, texY, texWidth, texHeight);
              
              // Move to next position
              currentX += Math.ceil(metrics.width) + 2; // Add padding
            }
            
            // Create texture from atlas
            texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.atlasCanvas);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            
            // Clean up old cached texture if exists
            if (this.textAtlasCache && this.textAtlasCache.texture) {
              this.gl.deleteTexture(this.textAtlasCache.texture);
            }
            
            // Cache the new atlas
            this.textAtlasCache = {
              key: cacheKey,
              texture: texture,
              texCoords: texCoords
            };
          }
          
          // Base position buffer: single quad at (0,0) to (1,1) - use cached buffer
          const baseVertices = [0, 0, 1, 0, 0, 1, 1, 1];
          let baseBuffer = this.getCachedBuffer(baseVertices);
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, baseBuffer);
          
          const basePosLoc = this.gl.getAttribLocation(program, 'aBasePosition');
          if (basePosLoc !== -1) {
            this.gl.enableVertexAttribArray(basePosLoc);
            this.gl.vertexAttribPointer(basePosLoc, 2, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(basePosLoc, 0);
          }
          
          // Instance positions buffer - dynamic (no cache)
          const posBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.positions), this.gl.DYNAMIC_DRAW);
          
          const instPosLoc = this.gl.getAttribLocation(program, 'aInstancePosition');
          if (instPosLoc !== -1) {
            this.gl.enableVertexAttribArray(instPosLoc);
            this.gl.vertexAttribPointer(instPosLoc, 2, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instPosLoc, 1);
          }
          
          // Instance colors buffer - dynamic (no cache)
          const colorBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(object.colors), this.gl.DYNAMIC_DRAW);
          
          const instColorLoc = this.gl.getAttribLocation(program, 'aInstanceColor');
          if (instColorLoc !== -1) {
            this.gl.enableVertexAttribArray(instColorLoc);
            this.gl.vertexAttribPointer(instColorLoc, 4, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instColorLoc, 1);
          }
          
          // Instance sizes buffer - dynamic (no cache)
          const sizes = [];
          if (!this.measureCtx) {
            this.measureCanvas = document.createElement('canvas');
            this.measureCtx = this.measureCanvas.getContext('2d');
          }
          // Ensure text metrics cache exists
          if (!this.textMetricsCache) {
            this.textMetricsCache = new Map();
          }
          for (let i = 0; i < object.texts.length; i++) {
            const text = object.texts[i];
            const fontSize = object.fontSizes[i] || 14;
            const metricKey = text + '|' + fontSize;
            let width, height;
            if (this.textMetricsCache.has(metricKey)) {
              const cached = this.textMetricsCache.get(metricKey);
              width = cached.width;
              // Use consistent height based on font size to avoid vertical stretch
              height = Math.ceil(fontSize);
            } else {
              this.measureCtx.font = `${fontSize}px Arial`;
              const metrics = this.measureCtx.measureText(text);
              width = Math.ceil(metrics.width);
              // Use consistent height based on font size to avoid vertical stretch
              height = Math.ceil(fontSize);
              this.textMetricsCache.set(metricKey, { width, height });
              if (this.textMetricsCache.size > 1000) {
                const firstKey = this.textMetricsCache.keys().next().value;
                this.textMetricsCache.delete(firstKey);
              }
            }
            sizes.push(width, height);
          }
          const sizeBuffer = this.gl.createBuffer();
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sizeBuffer);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(sizes), this.gl.DYNAMIC_DRAW);
          
          const instSizeLoc = this.gl.getAttribLocation(program, 'aInstanceSize');
          if (instSizeLoc !== -1) {
            this.gl.enableVertexAttribArray(instSizeLoc);
            this.gl.vertexAttribPointer(instSizeLoc, 2, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instSizeLoc, 1);
          }
          
          // Instance texture coordinates buffer - keep cached (atlas-based)
          const texCoordBuffer = this.getCachedBuffer(texCoords);
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
          
          const instTexCoordLoc = this.gl.getAttribLocation(program, 'aInstanceTexCoord');
          if (instTexCoordLoc !== -1) {
            this.gl.enableVertexAttribArray(instTexCoordLoc);
            this.gl.vertexAttribPointer(instTexCoordLoc, 4, this.gl.FLOAT, false, 0, 0);
            this.extInstanced.vertexAttribDivisorANGLE(instTexCoordLoc, 1);
          }
          
          // Draw all instances with one call
          this.extInstanced.drawArraysInstancedANGLE(this.gl.TRIANGLE_STRIP, 0, 4, object.texts.length);
          
          // Clean up: disable arrays and delete dynamic buffers
          if (basePosLoc !== -1) this.gl.disableVertexAttribArray(basePosLoc);
          if (instPosLoc !== -1) this.gl.disableVertexAttribArray(instPosLoc);
          if (instColorLoc !== -1) this.gl.disableVertexAttribArray(instColorLoc);
          if (instSizeLoc !== -1) this.gl.disableVertexAttribArray(instSizeLoc);
          if (instTexCoordLoc !== -1) this.gl.disableVertexAttribArray(instTexCoordLoc);
          
          this.gl.deleteBuffer(posBuffer);
          this.gl.deleteBuffer(colorBuffer);
          this.gl.deleteBuffer(sizeBuffer);
          // Note: texCoordBuffer is cached and should not be deleted here
        }
      }
      // Handle planet and moon objects
      else if (object.type === 'planet' || object.type === 'moon') {
          const sizeLoc = this.gl.getUniformLocation(program, 'uPointSize');
          if (sizeLoc) this.gl.uniform1f(sizeLoc, object.pointSize);

      }

      // Handle regular objects
      else {
        const colorLoc = this.gl.getUniformLocation(program, 'uColor');
        if (colorLoc && object.color) {
          // Ensure color is a Float32Array or regular array with 4 components
          let color = object.color;
          if (!(color instanceof Float32Array)) {
            color = new Float32Array(color);
          }
          // Ensure we have exactly 4 components (RGBA)
          if (color.length !== 4) {
            console.warn('Color must have 4 components (RGBA), got:', color);
            color = new Float32Array([1.0, 1.0, 1.0, 1.0]); // Default to white
          }
          this.gl.uniform4fv(colorLoc, color);
        }
        
        // Set point size for point objects
        if ((object.type === 'point' || object.type === 'glowPoint') && object.pointSize) {
          const sizeLoc = this.gl.getUniformLocation(program, 'uPointSize');
          if (sizeLoc) this.gl.uniform1f(sizeLoc, object.pointSize);
        }
        
        // Draw with indices if provided
        if (object.indices) {
          // Switch to additive blending for glow points
          const isGlow = object.type === 'glowPoint';
          if (isGlow) this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
          
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
          this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), this.gl.STATIC_DRAW);
          this.gl.drawElements(object.drawMode, object.indices.length, this.gl.UNSIGNED_SHORT, 0);
          
          // Restore default blending
          if (isGlow) this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        } else {
          // For regular drawArrays
          if (object.vertices && positionLoc !== -1) {
            const isGlow = object.type === 'glowPoint';
            if (isGlow) this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
            
            const vertexCount = object.vertexCount || (object.vertices.length / 2);
            this.gl.drawArrays(object.drawMode, 0, vertexCount);
            
            if (isGlow) this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
          } else if (!object.vertices && positionLoc !== -1) {
            // Disable the attribute if no vertices
            this.gl.disableVertexAttribArray(positionLoc);
          }
        }
      }
    } catch (error) {
      console.error('Error rendering object:', object, error);
    }
  }
  
  
  // Cleanup method to release WebGL resources
  cleanup() {
    // Delete all shader programs
    for (const programName in this.programs) {
      const program = this.programs[programName];
      if (program) {
        this.gl.deleteProgram(program);
      }
    }
    
    // Delete buffers
    if (this.vertexBuffer) {
      this.gl.deleteBuffer(this.vertexBuffer);
    }
    if (this.indexBuffer) {
      this.gl.deleteBuffer(this.indexBuffer);
    }
    
    // Clean up buffer cache
    this.clearBufferCache();
    
    // Clean up cached text atlas
    if (this.textAtlasCache && this.textAtlasCache.texture) {
      this.gl.deleteTexture(this.textAtlasCache.texture);
      this.textAtlasCache = null;
    }
    
    // Удалить все текстуры, созданные из Canvas, и очистить кэш
    if (this.canvasTextureList) {
      for (const tex of this.canvasTextureList) {
        this.gl.deleteTexture(tex);
      }
      this.canvasTextureList.clear();
    }
    if (this.canvasTextureCache) {
      this.canvasTextureCache.clear();
    }
    
    // Clear programs object
    this.programs = {};
  }
}