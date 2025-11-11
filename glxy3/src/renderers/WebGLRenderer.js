// src/renderers/WebGLRenderer.js
export default class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    
    // Simplified WebGL context initialization with standard options
    const options = {
      alpha: false,
      depth: true,
      antialias: true,
      powerPreference: 'default'  // Changed from 'high-performance' to 'default' for better compatibility
    };

    // Берём только стандартный контекст
    this.gl = canvas.getContext('webgl', options);

    if (!this.gl) {
      console.error("WebGL не поддерживается на этом устройстве");
      
      // Show user-friendly error message
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
        <p>WebGL не поддерживается на этом устройстве</p>
        <p>Попробуйте обновить страницу или использовать другой браузер.</p>
        <p><a href="https://get.webgl.org/" target="_blank" style="color: white; text-decoration: underline;">Проверить поддержку WebGL</a></p>
      `;
      document.body.appendChild(errorDiv);
      
      throw new Error("WebGL not supported");
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
    // Text rendering removed
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
    // Text rendering removed
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
    // Text rendering removed
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

  // Initialize 2D planet shader (for simple planet rendering in 2D views)
  initPlanet2DShader() {
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform float uPointSize;
      uniform vec2 uStarPosition;
      uniform vec2 uPlanetPosition;
      
      varying vec2 vLightDirection;
      
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 0.0, 1.0);
        gl_PointSize = uPointSize;
        
        // Calculate light direction from star to planet in screen space
        vec2 lightDir = normalize(uStarPosition - uPlanetPosition);
        vLightDirection = lightDir;
      }
    `;
    
const fsSource = `
  precision mediump float;
  uniform vec4 uColor;
  uniform sampler2D uTexture;
  uniform bool uUseTexture;
  uniform float uRotationOffset;
  uniform float uPlanetEdge;
  
  varying vec2 vLightDirection;
  
  void main() {
    // Make planet circular using gl_PointCoord
    vec2 p = gl_PointCoord * 2.0 - 1.0; // range [-1,1]
    
    // Rotate planet axis to match light direction (restore)
    float axisOffset = 0.0;
    float axisAngle = atan(vLightDirection.y, vLightDirection.x) + axisOffset;
    float cosR = cos(axisAngle);
    float sinR = sin(axisAngle);
    mat2 rot = mat2(cosR, -sinR, sinR, cosR);
    vec2 pRot = rot * p;
    
    float r = length(pRot);
    float r2 = r * r;
    if (r > 1.0) { discard; }
    
    vec2 lightRot = rot * vLightDirection; // (star - planet)
    vec3 finalColor;
    float finalAlpha;

    if (r <= uPlanetEdge) {
      // Planet interior shading within reduced radius
      vec2 pScaled = pRot / uPlanetEdge;
      float rScaled2 = dot(pScaled, pScaled);
      float z = sqrt(max(0.0, 1.0 - rScaled2));
      
      // Spherical texture coordinates
      float longitude = atan(pScaled.x, z) / (2.0 * 3.14159265) + 0.5;
      float latitude = asin(pScaled.y / sqrt(pScaled.x * pScaled.x + pScaled.y * pScaled.y + z * z)) / 3.14159265 + 0.5;
      
      longitude += uRotationOffset;
      longitude = mod(longitude, 1.0);
      
      vec2 sphericalTexCoord = vec2(longitude, latitude);
      vec3 textureColor = texture2D(uTexture, sphericalTexCoord).rgb;
      
      vec3 surfaceNormal = normalize(vec3(pScaled.x, pScaled.y, z));
      vec3 lightDir3D = normalize(vec3(lightRot.x, lightRot.y, 0.3));
      float lightAngle = dot(surfaceNormal, lightDir3D);
      float shading = 0.3 + 0.7 * max(0.0, lightAngle);
      
      finalColor = textureColor * shading;
      finalAlpha = uColor.a;
    } else {
      // Outer rim halo occupying sprite margin [uPlanetEdge, 1.0]
      float t = clamp((r - uPlanetEdge) / (1.0 - uPlanetEdge), 0.0, 1.0);
      float rim = 1.0 - t;
      rim = smoothstep(0.0, 1.0, rim);
      
      float lightAngle2D = dot(normalize(pRot), normalize(lightRot));
      float visibility = smoothstep(-1.8, 0.1, lightAngle2D);
      rim *= visibility;
      rim = pow(rim, 2.0);
      
      vec3 rimColor = uColor.rgb;
      finalColor = rimColor * rim;
      finalAlpha = rim * 0.6;
    }

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

    
    this.programs.planet2D = this.createShaderProgram(vsSource, fsSource);
  }

  // Initialize shaders for different rendering modes
  initBasicShaders() {
    // Point shader (stars)
    this.initPointShader();
    
    // Line shader (hyperlanes)
    this.initLineShader();
    
    // Text shader (star names) - REMOVED
    // this.initTextShader();
    
    // Instanced point shader for batch rendering
    this.initInstancedPointShader();
    
    // Planet and orbit shaders
    this.initOrbitShader();
    
    // Glow point shader (soft blur for luminous objects)
    this.initGlowPointShader();
    
    // 2D planet shader (for simple planet rendering in 2D views)
    this.initPlanet2DShader();
    
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
        case 'pointBatch': // Use same program for batch
          program = this.programs.point;
          break;
        case 'glowPoint':
          program = this.programs.glowPoint;
          break;
        case 'line':
        case 'lineBatch':
          program = this.programs.line;
          break;
        // case 'polygon':
        //   program = this.programs.polygon;
        //   break;
        // Text rendering removed
        case 'planet':
        case 'moon':
          program = this.programs.planet;
          break;
        case 'planet2D':
        case 'moon2D':
          program = this.programs.planet2D;
          break;
        default:
          program = this.programs.point;
      }
      
      // Validate program before use
      if (!program) {
        console.error('Shader program not initialized for object type:', object.type);
        return;
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
      // Handle 2D planet, moon, and blurred planet objects
      else if (object.type === 'planet2D' || object.type === 'moon2D' ) {
        // Check if object has a texture
        const hasTexture = object.texture && object.texture instanceof HTMLCanvasElement;
        
        // Set texture uniform
        const useTextureLoc = this.gl.getUniformLocation(program, 'uUseTexture');
        if (useTextureLoc) {
          this.gl.uniform1i(useTextureLoc, hasTexture ? 1 : 0);
        }
        
        if (hasTexture) {
          // Bind texture
          const textureLoc = this.gl.getUniformLocation(program, 'uTexture');
          if (textureLoc) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.createTextureFromCanvas(object.texture));
            this.gl.uniform1i(textureLoc, 0);
          }
        }
        
        // Set color uniform (used as fallback or tint)
        const colorLoc = this.gl.getUniformLocation(program, 'uColor');
        if (colorLoc && object.color) {
          let color = object.color;
          if (!(color instanceof Float32Array)) {
            color = new Float32Array(color);
          }
          if (color.length !== 4) {
            color = new Float32Array([1.0, 1.0, 1.0, 1.0]);
          }
          this.gl.uniform4fv(colorLoc, color);
        }
        
        // Set planet edge ratio and adjusted point size to allocate rim outside
        const planetEdge = (object.planetEdge !== undefined) ? object.planetEdge : 0.7; // keep ~8% for rim
        const planetEdgeLoc = this.gl.getUniformLocation(program, 'uPlanetEdge');
        if (planetEdgeLoc) this.gl.uniform1f(planetEdgeLoc, planetEdge);

        if (object.pointSize) {
          const sizeLoc = this.gl.getUniformLocation(program, 'uPointSize');
          if (sizeLoc) {
            const adjustedSize = object.pointSize / planetEdge; // keep interior diameter constant
            this.gl.uniform1f(sizeLoc, adjustedSize);
          }
        }
        
        // Set rotation offset for texture animation
        const rotationLoc = this.gl.getUniformLocation(program, 'uRotationOffset');
        if (rotationLoc) {
          const rotationOffset = object.rotationOffset || 0.0;
          this.gl.uniform1f(rotationLoc, rotationOffset);
        }
        
        // Set star and planet positions for lighting calculation
        if (object.type === 'planet2D' || object.type === 'moon2D' ) {
          const starPosLoc = this.gl.getUniformLocation(program, 'uStarPosition');
          const planetPosLoc = this.gl.getUniformLocation(program, 'uPlanetPosition');
          
          if (starPosLoc && object.starPosition) {
            this.gl.uniform2fv(starPosLoc, new Float32Array(object.starPosition));
          }
          
          if (planetPosLoc && object.position) {
            this.gl.uniform2fv(planetPosLoc, new Float32Array([object.position[0], object.position[1]]));
          }
        }
        
        // Draw as points
        if (object.vertices && object.vertices.length >= 2) {
          this.gl.drawArrays(this.gl.POINTS, 0, object.vertices.length / 2);
        }
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
  
  // Create WebGL texture from canvas
  createTextureFromCanvas(canvas) {
    let texture = this.canvasTextureCache.get(canvas);
    if (!texture) {
      texture = this.gl.createTexture();
      this.canvasTextureCache.set(canvas, texture);
      this.canvasTextureList.add(texture);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      // Set texture parameters once when creating
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      // Initial upload
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    } else {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      // If canvas is static, avoid re-uploading every frame
      if (!canvas._isStaticTexture) {
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
      }
    }
    return texture;
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
    
    // Clean up cached text atlas - REMOVED
    // Text rendering removed
    
    // Удалить все текстуры, созданные из Canvas, и очистить кэш
    // Text rendering removed
    
    // Clear programs object
    this.programs = {};
  }
}
