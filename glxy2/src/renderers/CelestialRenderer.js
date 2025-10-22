/**
 * Единый 3D рендерер для небесных тел (планет и лун)
 * Заменяет плоские круги на объемные 3D сферы
 * Работает с существующим WebGLRenderer
 */
export class CelestialRenderer {
  constructor(webglRenderer) {
    this.renderer = webglRenderer;
    this.gl = webglRenderer.gl;
    this.sphereVertices = null;
    this.sphereIndices = null;
    this.sphereVertexCount = 0;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    
    this.initSphere();
  }

  /**
   * Создает геометрию сферы
   */
  initSphere() {
    // Use WebGLRenderer's sphere creation methods
    const radius = 1.0; // Unit sphere, will be scaled per object
    const widthSegments = 16;
    const heightSegments = 12;
    
    this.sphereGeometry = this.renderer.createSphereVertices(radius, widthSegments, heightSegments);
    this.sphereIndices = this.renderer.createSphereIndices(widthSegments, heightSegments);
    
    this.buffers = {};
    this.initBuffers();
  }
  
  initBuffers() {
    // Create vertex buffer for positions
    this.buffers.position = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sphereGeometry.positions), this.gl.STATIC_DRAW);
    
    // Create buffer for texture coordinates
    this.buffers.texCoord = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.texCoord);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sphereGeometry.texCoords), this.gl.STATIC_DRAW);
    
    // Create buffer for normals
    this.buffers.normal = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.sphereGeometry.normals), this.gl.STATIC_DRAW);
    
    // Create index buffer
    this.buffers.index = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.sphereIndices), this.gl.STATIC_DRAW);
  }

  /**
   * Parse RGBA color string or array to normalized values
   * @param {string|Array} rgbaInput - RGBA color string like "rgba(255, 0, 0, 1)" or array [r, g, b, a]
   * @returns {Object} Object with normalized RGBA values {r, g, b, a}
   */
  parseRGBA(rgbaInput) {
    // If input is already an array, convert to normalized values
    if (Array.isArray(rgbaInput)) {
      return new Float32Array([
        rgbaInput[0] || 0,
        rgbaInput[1] || 0,
        rgbaInput[2] || 0,
        rgbaInput[3] !== undefined ? rgbaInput[3] : 1
      ]);
    }
    
    // If input is a string, parse it
    if (typeof rgbaInput === 'string') {
      const match = rgbaInput.match(/rgba?\(([^)]+)\)/);
      if (!match) return new Float32Array([1, 1, 1, 1]); // Default white
      
      const values = match[1].split(',').map(v => parseFloat(v.trim()));
      return new Float32Array([
        values[0] / 255, // r
        values[1] / 255, // g  
        values[2] / 255, // b
        values[3] || 1   // a
      ]);
    }
    
    // Default fallback
    return new Float32Array([1, 1, 1, 1]);
  }

  /**
   * Create model matrix for positioning and scaling
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} z - Z position
   * @param {number} scale - Scale factor
   * @returns {Float32Array} 4x4 model matrix
   */
  createModelMatrix(x, y, z, scale) {
    const matrix = new Float32Array(16);
    
    // Identity matrix with translation and scale
    matrix[0] = scale; matrix[4] = 0;     matrix[8] = 0;  matrix[12] = x;
    matrix[1] = 0;     matrix[5] = scale; matrix[9] = 0;  matrix[13] = y;
    matrix[2] = 0;     matrix[6] = 0;     matrix[10] = scale; matrix[14] = z;
    matrix[3] = 0;     matrix[7] = 0;     matrix[11] = 0; matrix[15] = 1;
    
    return matrix;
  }

  /**
   * Create a 3D render object for a celestial body
   * @param {CelestialBody} celestialBody - The celestial body to render
   * @param {number} time - Current time for animations
   * @returns {Object} Render object for WebGLRenderer
   */
  createRenderObject(celestialBody, time = 0) {
    const color = this.parseRGBA(celestialBody.getColor());
    const atmosphereColor = this.parseRGBA(celestialBody.getAtmosphereColor());
    
    // Create model matrix for positioning and scaling
    const scale = celestialBody.scale || celestialBody.radius || 10;
    const x = celestialBody.position ? celestialBody.position[0] : celestialBody.x || 0;
    const y = celestialBody.position ? celestialBody.position[1] : celestialBody.y || 0;
    
    const modelMatrix = this.createModelMatrix(x, y, 0, scale);
    
    const renderObject = {
      type: celestialBody.bodyType, // 'planet' or 'moon'
      planetType: celestialBody.type, // 'lava', 'desert', 'ocean', etc.
      vertices: this.sphereGeometry.positions,
      texCoords: this.sphereGeometry.texCoords,
      normals: this.sphereGeometry.normals,
      indices: this.sphereIndices,
      modelMatrix: modelMatrix,
      color: color,
      atmosphereColor: atmosphereColor,
      atmosphereThickness: celestialBody.atmosphereThickness || 2.0,
      time: time,
      // Additional properties for WebGL rendering
      buffers: this.buffers
    };
    
    return renderObject;
  }
  
  /**
   * Render multiple celestial bodies
   * @param {CelestialBody[]} celestialBodies - Array of celestial bodies
   * @param {number} time - Current time for animations
   * @returns {Object[]} Array of render objects
   */
  createRenderObjects(celestialBodies, time = 0) {
    return celestialBodies.map(body => this.createRenderObject(body, time));
  }

  /**
   * Clean up WebGL resources
   */
  dispose() {
    // Delete buffers
    Object.values(this.buffers).forEach(buffer => {
      if (buffer) {
        this.gl.deleteBuffer(buffer);
      }
    });
    
    this.buffers = {};
    this.sphereGeometry = null;
    this.sphereIndices = null;
  }
}