// src/utils/proceduralTextures.js
// Procedural planet texture generation with realistic continents, oceans, and polar caps
// Based on modern noise algorithms and geological principles

// Simplex noise implementation for seamless planetary textures
class SimplexNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.rng = this.createSeededRNG(seed);
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    this.perm = [];
    this.permMod12 = [];
    this.initPermutations();
  }

  createSeededRNG(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  initPermutations() {
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(this.rng() * 256);
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  dot(g, x, y, z) {
    return g[0] * x + g[1] * y + g[2] * z;
  }

  noise3D(x, y, z) {
    let n0, n1, n2, n3;
    const s = (x + y + z) * (1.0/3.0);
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * (1.0/6.0);
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + (1.0/6.0);
    const y1 = y0 - j1 + (1.0/6.0);
    const z1 = z0 - k1 + (1.0/6.0);
    const x2 = x0 - i2 + (2.0/6.0);
    const y2 = y0 - j2 + (2.0/6.0);
    const z2 = z0 - k2 + (2.0/6.0);
    const x3 = x0 - 1.0 + (3.0/6.0);
    const y3 = y0 - 1.0 + (3.0/6.0);
    const z3 = z0 - 1.0 + (3.0/6.0);

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    const gi0 = this.permMod12[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.permMod12[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.permMod12[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0, z0);
    }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1, z1);
    }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2, z2);
    }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0.0;
    else {
      t3 *= t3;
      n3 = t3 * t3 * this.dot(this.grad3[gi3], x3, y3, z3);
    }

    return 32.0 * (n0 + n1 + n2 + n3);
  }
}

// Planet texture generator using research-based algorithms
export class ProceduralPlanetTexture {
  constructor(starX, starY, planetIndex, planetType, textureSize = 512) {
    // Create deterministic seed from star position and planet index
    this.seed = this.createSeed(starX, starY, planetIndex);
    this.planetType = planetType;
    this.textureSize = textureSize;
    this.noise = new SimplexNoise(this.seed);
    this.rng = this.createSeededRNG(this.seed);
    
    // Planet type specific parameters
    this.typeParams = this.getPlanetTypeParameters(planetType);
    
    // Initialize biome lookup table
    this.biomeTable = this.createBiomeLookupTable();
  }

  createSeed(starX, starY, planetIndex) {
    // Create deterministic seed from coordinates
    const x = Math.floor(starX * 1000) % 10000;
    const y = Math.floor(starY * 1000) % 10000;
    return (x * 31 + y * 17 + planetIndex * 7) % 2147483647;
  }

  createSeededRNG(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  getPlanetTypeParameters(type) {
    const params = {
      lava: {
        waterLevel: -0.8,
        temperatureBase: 800,
        polarCapSize: 0.0,
        continentScale: 2.0,
        humidityVariation: 0.1,
        mountainHeight: 0.4
      },
      rocky: {
        waterLevel: -0.9,
        temperatureBase: -50,
        polarCapSize: 0.1,
        continentScale: 1.5,
        humidityVariation: 0.05,
        mountainHeight: 0.6
      },
      terran: {
        waterLevel: -0.1,
        temperatureBase: 15,
        polarCapSize: 0.15,
        continentScale: 1.0,
        humidityVariation: 0.8,
        mountainHeight: 0.3
      },
      gas: {
        waterLevel: -2.0, // No solid surface
        temperatureBase: -120,
        polarCapSize: 0.05,
        continentScale: 0.5,
        humidityVariation: 0.9,
        mountainHeight: 0.1
      },
      ice: {
        waterLevel: -0.3,
        temperatureBase: -100,
        polarCapSize: 0.35,
        continentScale: 1.2,
        humidityVariation: 0.2,
        mountainHeight: 0.2
      },
      desert: {
        waterLevel: -0.7,
        temperatureBase: 45,
        polarCapSize: 0.05,
        continentScale: 1.8,
        humidityVariation: 0.1,
        mountainHeight: 0.4
      },
      ocean: {
        waterLevel: 0.3, // Mostly water
        temperatureBase: 10,
        polarCapSize: 0.2,
        continentScale: 0.8,
        humidityVariation: 0.9,
        mountainHeight: 0.2
      },
      toxic: {
        waterLevel: -0.4,
        temperatureBase: 60,
        polarCapSize: 0.0,
        continentScale: 1.3,
        humidityVariation: 0.6,
        mountainHeight: 0.5
      },
      crystal: {
        waterLevel: -0.8,
        temperatureBase: -80,
        polarCapSize: 0.1,
        continentScale: 2.2,
        humidityVariation: 0.3,
        mountainHeight: 0.7
      },
      volcanic: {
        waterLevel: -0.6,
        temperatureBase: 200,
        polarCapSize: 0.0,
        continentScale: 1.6,
        humidityVariation: 0.2,
        mountainHeight: 0.6
      }
    };
    return params[type] || params.rocky;
  }

  // Multi-octave noise for realistic terrain generation
  generateElevationMap() {
    const elevation = new Float32Array(this.textureSize * this.textureSize);
    const octaves = 6;
    let frequency = 2.0 * this.typeParams.continentScale;
    let amplitude = 1.0;
    let maxValue = 0;

    // Calculate maximum possible value for normalization
    for (let i = 0; i < octaves; i++) {
      maxValue += amplitude;
      amplitude *= 0.5;
    }

    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const index = y * this.textureSize + x;
        
        // Convert to spherical coordinates to avoid distortion
        const lon = (x / this.textureSize) * 2 * Math.PI;
        const lat = (y / this.textureSize) * Math.PI;
        
        // Sample 3D noise on sphere surface for seamless texture
        const sx = Math.sin(lat) * Math.cos(lon);
        const sy = Math.sin(lat) * Math.sin(lon);
        const sz = Math.cos(lat);

        let value = 0;
        frequency = 2.0 * this.typeParams.continentScale;
        amplitude = 1.0;

        // Multi-octave fractal noise
        for (let i = 0; i < octaves; i++) {
          value += this.noise.noise3D(sx * frequency, sy * frequency, sz * frequency) * amplitude;
          frequency *= 2.0;
          amplitude *= 0.5;
        }

        // Normalize and apply continent formation
        value = value / maxValue;
        
        // Apply continent-forming algorithm (fracture-like)
        if (this.planetType === 'terran' || this.planetType === 'rocky') {
          value = this.applyContinentFormation(value, lat, lon);
        }

        elevation[index] = value;
      }
    }

    return elevation;
  }

  // UV Elevation map generation for wider texture
  generateUVElevationMap(uvWidth, uvHeight) {
    const elevation = new Float32Array(uvWidth * uvHeight);
    const octaves = 6;
    let frequency = 2.0 * this.typeParams.continentScale;
    let amplitude = 1.0;
    let maxValue = 0;

    // Calculate maximum possible value for normalization
    for (let i = 0; i < octaves; i++) {
      maxValue += amplitude;
      amplitude *= 0.5;
    }

    // Calculate base width for seamless wrapping
    const baseWidth = uvWidth - 2; // Account for extra wrap pixels

    for (let y = 0; y < uvHeight; y++) {
      for (let x = 0; x < uvWidth; x++) {
        const index = y * uvWidth + x;
        
        // Handle seamless wrapping for longitude
        let normalizedX = x;
        if (x >= baseWidth) {
          normalizedX = x - baseWidth; // Wrap the extra pixels
        }
        
        // Convert to spherical coordinates (UV unwrapping)
        const lon = (normalizedX / baseWidth) * 2 * Math.PI; // Normalized longitude range
        const lat = (y / uvHeight) * Math.PI;
        
        // Sample 3D noise on sphere surface for seamless texture
        const sx = Math.sin(lat) * Math.cos(lon);
        const sy = Math.sin(lat) * Math.sin(lon);
        const sz = Math.cos(lat);

        let value = 0;
        frequency = 2.0 * this.typeParams.continentScale;
        amplitude = 1.0;

        // Multi-octave fractal noise
        for (let i = 0; i < octaves; i++) {
          value += this.noise.noise3D(sx * frequency, sy * frequency, sz * frequency) * amplitude;
          frequency *= 2.0;
          amplitude *= 0.5;
        }

        // Normalize and apply continent formation
        value = value / maxValue;
        
        // Apply continent-forming algorithm (fracture-like)
        if (this.planetType === 'terran' || this.planetType === 'rocky') {
          value = this.applyContinentFormation(value, lat, lon);
        }

        elevation[index] = value;
      }
    }

    return elevation;
  }

  // Realistic continent formation using fracture-like algorithm
  applyContinentFormation(baseElevation, lat, lon) {
    const numContinents = 3 + Math.floor(this.rng() * 4); // 3-6 continents
    let continentValue = baseElevation;

    for (let i = 0; i < numContinents; i++) {
      // Generate continent center
      const centerLat = (this.rng() - 0.5) * Math.PI * 0.8; // Avoid extreme poles
      const centerLon = this.rng() * 2 * Math.PI;
      
      // Calculate distance to continent center on sphere
      const distance = this.sphericalDistance(lat, lon, centerLat, centerLon);
      const continentSize = 0.3 + this.rng() * 0.5; // Continent radius
      
      if (distance < continentSize) {
        const influence = Math.pow(1 - distance / continentSize, 2);
        continentValue += influence * 0.4;
      }
    }

    return continentValue;
  }

  sphericalDistance(lat1, lon1, lat2, lon2) {
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(lat1) * Math.cos(lat2) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Generate humidity map for biome determination
  generateHumidityMap() {
    const humidity = new Float32Array(this.textureSize * this.textureSize);
    const octaves = 4;
    let frequency = 1.5;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      maxValue += amplitude;
      amplitude *= 0.5;
    }

    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const index = y * this.textureSize + x;
        
        const lon = (x / this.textureSize) * 2 * Math.PI;
        const lat = (y / this.textureSize) * Math.PI;
        
        const sx = Math.sin(lat) * Math.cos(lon);
        const sy = Math.sin(lat) * Math.sin(lon);
        const sz = Math.cos(lat);

        let value = 0;
        frequency = 1.5;
        amplitude = 1.0;

        for (let i = 0; i < octaves; i++) {
          value += this.noise.noise3D(sx * frequency + 100, sy * frequency + 100, sz * frequency + 100) * amplitude;
          frequency *= 2.0;
          amplitude *= 0.5;
        }

        // Apply climate effects (more humidity near equator, less at poles)
        const climateEffect = Math.cos(lat - Math.PI/2);
        value = (value / maxValue + 1) * 0.5; // Normalize to 0-1
        value *= climateEffect * this.typeParams.humidityVariation + 0.3;
        
        humidity[index] = Math.max(0, Math.min(1, value));
      }
    }

    return humidity;
  }

  // UV Humidity map generation for wider texture
  generateUVHumidityMap(uvWidth, uvHeight) {
    const humidity = new Float32Array(uvWidth * uvHeight);
    const octaves = 4;
    let frequency = 1.5;
    let amplitude = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      maxValue += amplitude;
      amplitude *= 0.5;
    }

    // Calculate base width for seamless wrapping
    const baseWidth = uvWidth - 2; // Account for extra wrap pixels

    for (let y = 0; y < uvHeight; y++) {
      for (let x = 0; x < uvWidth; x++) {
        const index = y * uvWidth + x;
        
        // Handle seamless wrapping for longitude
        let normalizedX = x;
        if (x >= baseWidth) {
          normalizedX = x - baseWidth; // Wrap the extra pixels
        }
        
        // Convert to spherical coordinates (UV unwrapping)
        const lon = (normalizedX / baseWidth) * 2 * Math.PI; // Normalized longitude range
        const lat = (y / uvHeight) * Math.PI;
        
        const sx = Math.sin(lat) * Math.cos(lon);
        const sy = Math.sin(lat) * Math.sin(lon);
        const sz = Math.cos(lat);

        let value = 0;
        frequency = 1.5;
        amplitude = 1.0;

        for (let i = 0; i < octaves; i++) {
          value += this.noise.noise3D(sx * frequency + 100, sy * frequency + 100, sz * frequency + 100) * amplitude;
          frequency *= 2.0;
          amplitude *= 0.5;
        }

        // Apply climate effects (more humidity near equator, less at poles)
        const climateEffect = Math.cos(lat - Math.PI/2);
        value = (value / maxValue + 1) * 0.5; // Normalize to 0-1
        value *= climateEffect * this.typeParams.humidityVariation + 0.3;
        
        humidity[index] = Math.max(0, Math.min(1, value));
      }
    }

    return humidity;
  }

  // Create biome lookup table for realistic planet coloring
  createBiomeLookupTable() {
    const tableSize = 256;
    const table = new Array(tableSize * tableSize);

    for (let y = 0; y < tableSize; y++) {
      for (let x = 0; x < tableSize; x++) {
        const elevation = y / tableSize; // 0 = low, 1 = high
        const humidity = x / tableSize;  // 0 = dry, 1 = wet
        
        table[y * tableSize + x] = this.getBiomeColor(elevation, humidity);
      }
    }

    return table;
  }

  getBiomeColor(elevation, humidity) {
    const params = this.typeParams;
    
    // Water level check
    if (elevation < params.waterLevel + 0.1) {
      return this.getWaterColor(elevation);
    }

    switch (this.planetType) {
      case 'terran':
        return this.getTerranBiomeColor(elevation, humidity);
      case 'lava':
        return this.getLavaBiomeColor(elevation, humidity);
      case 'rocky':
        return this.getRockyBiomeColor(elevation, humidity);
      case 'ice':
        return this.getIceBiomeColor(elevation, humidity);
      case 'gas':
        return this.getGasBiomeColor(elevation, humidity);
      case 'desert':
        return this.getDesertBiomeColor(elevation, humidity);
      case 'ocean':
        return this.getOceanBiomeColor(elevation, humidity);
      case 'toxic':
        return this.getToxicBiomeColor(elevation, humidity);
      case 'crystal':
        return this.getCrystalBiomeColor(elevation, humidity);
      case 'volcanic':
        return this.getVolcanicBiomeColor(elevation, humidity);
      default:
        return { r: 128, g: 128, b: 128 };
    }
  }

  getTerranBiomeColor(elevation, humidity) {
    if (elevation < -0.05) return { r: 30, g: 90, b: 200 }; // Deep ocean
    if (elevation < 0.0) return { r: 60, g: 120, b: 220 }; // Shallow ocean
    if (elevation < 0.05) return { r: 240, g: 220, b: 160 }; // Beach

    if (humidity < 0.2) {
      if (elevation > 0.7) return { r: 150, g: 130, b: 100 }; // Desert mountains
      return { r: 200, g: 180, b: 120 }; // Desert
    } else if (humidity < 0.5) {
      if (elevation > 0.6) return { r: 120, g: 100, b: 80 }; // Rocky mountains
      return { r: 180, g: 160, b: 100 }; // Grassland
    } else if (humidity < 0.8) {
      if (elevation > 0.7) return { r: 100, g: 80, b: 60 }; // Forest mountains
      return { r: 60, g: 120, b: 40 }; // Forest
    } else {
      if (elevation > 0.8) return { r: 255, g: 255, b: 255 }; // Snow peaks
      return { r: 40, g: 100, b: 30 }; // Dense forest
    }
  }

  getLavaBiomeColor(elevation, humidity) {
    const heat = 0.8 + elevation * 0.2;
    if (elevation > 0.6) {
      return { r: 255, g: Math.floor(100 * heat), b: 0 }; // Bright lava
    } else if (elevation > 0.2) {
      return { r: 200, g: Math.floor(50 * heat), b: 0 }; // Cooling lava
    } else {
      return { r: 100 + Math.floor(100 * heat), g: 20, b: 0 }; // Volcanic rock
    }
  }

  getRockyBiomeColor(elevation, humidity) {
    const base = 60 + elevation * 40;
    const variation = humidity * 20;
    return { 
      r: Math.floor(base + variation), 
      g: Math.floor(base * 0.8 + variation * 0.7), 
      b: Math.floor(base * 0.6 + variation * 0.5) 
    };
  }

  getIceBiomeColor(elevation, humidity) {
    const iceIntensity = 0.7 + elevation * 0.3;
    const blue = Math.floor(200 + 55 * iceIntensity);
    return { 
      r: Math.floor(180 + 75 * iceIntensity), 
      g: Math.floor(200 + 55 * iceIntensity), 
      b: Math.min(255, blue)
    };
  }

  getGasBiomeColor(elevation, humidity) {
    const bands = Math.floor((elevation + humidity) * 10) % 3;
    switch (bands) {
      case 0: return { r: 255, g: 200, b: 100 }; // Light bands
      case 1: return { r: 220, g: 180, b: 80 };  // Medium bands
      case 2: return { r: 180, g: 150, b: 60 };  // Dark bands
    }
  }

  getDesertBiomeColor(elevation, humidity) {
    if (elevation < this.typeParams.waterLevel + 0.1) {
      return { r: 139, g: 69, b: 19 }; // Dry lake beds
    }
    
    const sandIntensity = 0.7 + elevation * 0.3;
    const base = Math.floor(180 + 40 * sandIntensity);
    
    if (humidity < 0.1) {
      // Pure sand dunes
      return { r: base, g: Math.floor(base * 0.8), b: Math.floor(base * 0.4) };
    } else if (humidity < 0.3) {
      // Rocky desert
      return { r: Math.floor(base * 0.9), g: Math.floor(base * 0.7), b: Math.floor(base * 0.5) };
    } else {
      // Sparse vegetation
      return { r: Math.floor(base * 0.8), g: Math.floor(base * 0.8), b: Math.floor(base * 0.4) };
    }
  }

  getOceanBiomeColor(elevation, humidity) {
    if (elevation < this.typeParams.waterLevel - 0.2) {
      return { r: 0, g: 50, b: 150 }; // Deep ocean trenches
    } else if (elevation < this.typeParams.waterLevel) {
      return { r: 20, g: 80, b: 180 }; // Deep ocean
    } else if (elevation < this.typeParams.waterLevel + 0.1) {
      return { r: 40, g: 120, b: 200 }; // Shallow seas
    } else if (elevation < this.typeParams.waterLevel + 0.2) {
      // Small islands and atolls
      if (humidity > 0.6) {
        return { r: 34, g: 139, b: 34 }; // Tropical islands
      } else {
        return { r: 244, g: 164, b: 96 }; // Sandy islands
      }
    } else {
      // Rare high land
      return { r: 105, g: 105, b: 105 }; // Rocky outcrops
    }
  }

  getToxicBiomeColor(elevation, humidity) {
    const toxicity = 0.6 + elevation * 0.4;
    const green = Math.floor(100 + 120 * toxicity);
    
    if (elevation < this.typeParams.waterLevel + 0.1) {
      return { r: 80, g: green, b: 40 }; // Toxic swamps
    }
    
    if (humidity < 0.3) {
      // Toxic wastelands
      return { r: Math.floor(green * 0.6), g: green, b: Math.floor(green * 0.3) };
    } else if (humidity < 0.7) {
      // Toxic forests
      return { r: Math.floor(green * 0.4), g: green, b: Math.floor(green * 0.2) };
    } else {
      // Dense toxic vegetation
      return { r: Math.floor(green * 0.3), g: green, b: Math.floor(green * 0.4) };
    }
  }

  getCrystalBiomeColor(elevation, humidity) {
    const crystalIntensity = 0.5 + elevation * 0.5;
    const purple = Math.floor(150 + 80 * crystalIntensity);
    const blue = Math.floor(120 + 60 * crystalIntensity);
    
    if (elevation > 0.7) {
      // Pure crystal formations
      return { r: purple, g: Math.floor(purple * 0.6), b: 255 };
    } else if (elevation > 0.4) {
      // Mixed crystal and rock
      return { r: Math.floor(purple * 0.8), g: Math.floor(purple * 0.5), b: blue };
    } else {
      // Crystal-infused ground
      return { r: Math.floor(purple * 0.6), g: Math.floor(purple * 0.4), b: Math.floor(blue * 0.8) };
    }
  }

  getVolcanicBiomeColor(elevation, humidity) {
    const heat = 0.6 + elevation * 0.4;
    
    if (elevation > 0.8) {
      // Active volcanic peaks
      return { r: 255, g: Math.floor(80 + 100 * heat), b: 0 };
    } else if (elevation > 0.5) {
      // Volcanic slopes
      return { r: Math.floor(200 + 55 * heat), g: Math.floor(60 + 40 * heat), b: 20 };
    } else if (elevation > 0.2) {
      // Volcanic plains
      return { r: Math.floor(120 + 80 * heat), g: Math.floor(40 + 30 * heat), b: 10 };
    } else {
      // Cooled lava fields
      return { r: Math.floor(80 + 60 * heat), g: Math.floor(30 + 20 * heat), b: 5 };
    }
  }

  getWaterColor(elevation) {
    const depth = Math.abs(elevation - this.typeParams.waterLevel);
    const blue = Math.max(50, 255 - Math.floor(depth * 400));
    return { 
      r: Math.floor(blue * 0.2), 
      g: Math.floor(blue * 0.6), 
      b: blue 
    };
  }

  // Apply polar caps based on latitude
  applyPolarCaps(colorData, elevationData) {
    const capSize = this.typeParams.polarCapSize;
    if (capSize <= 0) return;

    for (let y = 0; y < this.textureSize; y++) {
      const lat = (y / this.textureSize) * Math.PI;
      const distanceFromPole = Math.min(lat, Math.PI - lat) / Math.PI;
      
      if (distanceFromPole < capSize) {
        const capStrength = 1 - (distanceFromPole / capSize);
        const capStrength2 = capStrength * capStrength;
        
        for (let x = 0; x < this.textureSize; x++) {
          const index = (y * this.textureSize + x) * 4;
          const elevation = elevationData[y * this.textureSize + x];
          
          // Only apply ice to land areas above a certain elevation
          if (elevation > this.typeParams.waterLevel + 0.05) {
            colorData[index] = Math.floor(colorData[index] * (1 - capStrength2) + 255 * capStrength2);     // R
            colorData[index + 1] = Math.floor(colorData[index + 1] * (1 - capStrength2) + 255 * capStrength2); // G
            colorData[index + 2] = Math.floor(colorData[index + 2] * (1 - capStrength2) + 255 * capStrength2); // B
          }
        }
      }
    }
  }

  // Apply polar caps to UV texture
  applyUVPolarCaps(colorData, elevationData, uvWidth, uvHeight) {
    const capSize = this.typeParams.polarCapSize;
    if (capSize <= 0) return;

    for (let y = 0; y < uvHeight; y++) {
      const lat = (y / uvHeight) * Math.PI;
      const distanceFromPole = Math.min(lat, Math.PI - lat) / Math.PI;
      
      if (distanceFromPole < capSize) {
        const capStrength = 1 - (distanceFromPole / capSize);
        const capStrength2 = capStrength * capStrength;
        
        for (let x = 0; x < uvWidth; x++) {
          const index = (y * uvWidth + x) * 4;
          const elevation = elevationData[y * uvWidth + x];
          
          // Only apply ice to land areas above a certain elevation
          if (elevation > this.typeParams.waterLevel + 0.05) {
            colorData[index] = Math.floor(colorData[index] * (1 - capStrength2) + 255 * capStrength2);     // R
            colorData[index + 1] = Math.floor(colorData[index + 1] * (1 - capStrength2) + 255 * capStrength2); // G
            colorData[index + 2] = Math.floor(colorData[index + 2] * (1 - capStrength2) + 255 * capStrength2); // B
          }
        }
      }
    }
  }

  // Generate the complete planet texture as UV unwrap for rotation animation
  generateTexture() {
    console.log(`Generating procedural texture for ${this.planetType} planet (seed: ${this.seed})`);
    
    const elevationMap = this.generateElevationMap();
    const humidityMap = this.generateHumidityMap();
    
    // Create RGBA texture data
    const textureData = new Uint8Array(this.textureSize * this.textureSize * 4);
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const index = y * this.textureSize + x;
        const pixelIndex = index * 4;
        
        const elevation = elevationMap[index];
        const humidity = humidityMap[index];
        
        // Sample biome lookup table
        const elevationIndex = Math.floor(Math.max(0, Math.min(255, (elevation + 1) * 127.5)));
        const humidityIndex = Math.floor(Math.max(0, Math.min(255, humidity * 255)));
        const color = this.biomeTable[elevationIndex * 256 + humidityIndex];
        
        textureData[pixelIndex] = color.r;     // Red
        textureData[pixelIndex + 1] = color.g; // Green
        textureData[pixelIndex + 2] = color.b; // Blue
        textureData[pixelIndex + 3] = 255;     // Alpha
      }
    }
    
    // Apply polar caps
    this.applyPolarCaps(textureData, elevationMap);
    
    // Create canvas from texture data
    const canvas = document.createElement('canvas');
    canvas.width = this.textureSize;
    canvas.height = this.textureSize;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(this.textureSize, this.textureSize);
    imageData.data.set(textureData);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }

  // Generate UV unwrapped texture for rotation animation (wider format)
  generateUVTexture(rotationWidth = 1.5) {
    console.log(`Generating UV unwrapped texture for ${this.planetType} planet (seed: ${this.seed})`);
    
    // Create wider texture to accommodate rotation with extra pixels for seamless wrapping
    const baseWidth = Math.floor(this.textureSize * rotationWidth);
    const uvWidth = baseWidth + 2; // Add 2 pixels for seamless wrapping
    const uvHeight = this.textureSize;
    
    const elevationMap = this.generateUVElevationMap(uvWidth, uvHeight);
    const humidityMap = this.generateUVHumidityMap(uvWidth, uvHeight);
    
    // Create RGBA texture data
    const textureData = new Uint8Array(uvWidth * uvHeight * 4);
    
    for (let y = 0; y < uvHeight; y++) {
      for (let x = 0; x < uvWidth; x++) {
        const index = y * uvWidth + x;
        const pixelIndex = index * 4;
        
        // Handle seamless wrapping for extra pixels
        let sampleX = x;
        if (x >= baseWidth) {
          sampleX = x - baseWidth; // Wrap the extra pixels to the beginning
        }
        
        const elevation = elevationMap[index];
        const humidity = humidityMap[index];
        
        // Sample biome lookup table
        const elevationIndex = Math.floor(Math.max(0, Math.min(255, (elevation + 1) * 127.5)));
        const humidityIndex = Math.floor(Math.max(0, Math.min(255, humidity * 255)));
        const color = this.biomeTable[elevationIndex * 256 + humidityIndex];
        
        textureData[pixelIndex] = color.r;     // Red
        textureData[pixelIndex + 1] = color.g; // Green
        textureData[pixelIndex + 2] = color.b; // Blue
        textureData[pixelIndex + 3] = 255;     // Alpha
      }
    }
    
    // Apply polar caps
    this.applyUVPolarCaps(textureData, elevationMap, uvWidth, uvHeight);
    
    // Create canvas from texture data
    const canvas = document.createElement('canvas');
    canvas.width = uvWidth;
    canvas.height = uvHeight;
    const ctx = canvas.getContext('2d');
    
    const imageData = ctx.createImageData(uvWidth, uvHeight);
    imageData.data.set(textureData);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }
}

// Helper function to create planet texture with caching
const textureCache = new Map();
const uvTextureCache = new Map();

export function generatePlanetTexture(starX, starY, planetIndex, planetType, size = 512) {
  const cacheKey = `${Math.floor(starX * 1000)}_${Math.floor(starY * 1000)}_${planetIndex}_${planetType}_${size}`;
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }
  
  const generator = new ProceduralPlanetTexture(starX, starY, planetIndex, planetType, size);
  const texture = generator.generateTexture();
  
  textureCache.set(cacheKey, texture);
  return texture;
}

// Helper function to create UV planet texture for rotation animation
export function generatePlanetUVTexture(starX, starY, planetIndex, planetType, size = 512, rotationWidth = 1.5) {
  const cacheKey = `uv_${Math.floor(starX * 1000)}_${Math.floor(starY * 1000)}_${planetIndex}_${planetType}_${size}_${rotationWidth}`;
  
  if (uvTextureCache.has(cacheKey)) {
    return uvTextureCache.get(cacheKey);
  }
  
  const generator = new ProceduralPlanetTexture(starX, starY, planetIndex, planetType, size);
  const uvTexture = generator.generateUVTexture(rotationWidth);
  
  uvTextureCache.set(cacheKey, uvTexture);
  return uvTexture;
}

// Clear texture cache (useful for memory management)
export function clearTextureCache() {
  textureCache.clear();
  uvTextureCache.clear();
}