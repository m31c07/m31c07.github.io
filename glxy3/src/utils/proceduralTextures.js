// src/utils/proceduralTextures.js
// Universal procedural planet texture generation with biomes and urbanization

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

// Utility helpers (module-level)
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3 - 2 * t);
}
function lerpColorRGB(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t))
  ];
}

// Biome and planet type configuration
// All parameters are data-only; generation uses these configs universally
const PLANET_TYPES = {
  terran: {
    waterLevel: 0.0,
    polarCapSize: 0.07,
    relief: { continentsFreq: 0.75, continentsGain: 0.55, continentsOctaves: 4, mountainFreq: 3.0, mountainGain: 0.6, mountainOctaves: 3 },
    biomes: [
      { name: 'ocean', elev: [-1.0, -0.02], color: [40, 110, 180], noiseTint: 0.15 },
      { name: 'shore', elev: [-0.02, 0.02], color: [220, 210, 160], noiseTint: 0.10 },
      { name: 'grassland', elev: [0.02, 0.25], color: [70, 140, 60], noiseTint: 0.15 },
      { name: 'forest', elev: [0.08, 0.35], color: [50, 110, 50], noiseTint: 0.20 },
      { name: 'swamp', elev: [0.0, 0.15], lat: [0.3, 0.8], color: [70, 90, 50], noiseTint: 0.15 },
      { name: 'desert', elev: [0.0, 0.2], lat: [0.0, 0.3], color: [210, 185, 130], noiseTint: 0.15 },
      { name: 'highlands', elev: [0.25, 0.45], color: [140, 120, 100], noiseTint: 0.10 },
      { name: 'mountain', elev: [0.45, 1.0], color: [110, 110, 120], noiseTint: 0.25 },
      { name: 'snow', elev: [0.55, 1.0], lat: [0.4, 1.0], color: [240, 240, 255], noiseTint: 0.05 },
    ]
  },
  desert: {
    waterLevel: -0.7,
    polarCapSize: 0.05,
    relief: { continentsFreq: 0.8, continentsGain: 0.5, continentsOctaves: 4, mountainFreq: 2.5, mountainGain: 0.5, mountainOctaves: 3 },
    biomes: [
      { name: 'ocean', elev: [-1.0, -0.02], color: [40, 110, 160], noiseTint: 0.15 },
      { name: 'shore', elev: [-0.02, 0.02], color: [230, 210, 160], noiseTint: 0.10 },
      { name: 'dunes', elev: [0.02, 0.35], color: [220, 190, 140], noiseTint: 0.2 },
      { name: 'rock', elev: [0.35, 0.55], color: [160, 130, 90], noiseTint: 0.15 },
      { name: 'mesa', elev: [0.55, 1.0], color: [140, 110, 80], noiseTint: 0.15 },
    ]
    , noCitiesBiomes: ['dunes', 'shore']
  },
  ice: {
    waterLevel: -0.3,
    polarCapSize: 0.20,
    relief: { continentsFreq: 0.7, continentsGain: 0.5, continentsOctaves: 4, mountainFreq: 2.0, mountainGain: 0.6, mountainOctaves: 3 },
    biomes: [
      { name: 'ocean', elev: [-1.0, -0.05], color: [40, 120, 200], noiseTint: 0.15 },
      { name: 'iceShelf', elev: [-0.05, 0.02], color: [220, 235, 250], noiseTint: 0.05 },
      { name: 'tundra', elev: [0.02, 0.25], color: [180, 200, 210], noiseTint: 0.10 },
      { name: 'permafrost', elev: [0.25, 0.6], color: [210, 220, 235], noiseTint: 0.05 },
      { name: 'iceCap', elev: [0.15, 1.0], lat: [0.5, 1.0], color: [240, 245, 255], noiseTint: 0.05 },
    ]
  },
  ocean: {
    waterLevel: 0.48,
    polarCapSize: 0.07,
    relief: { continentsFreq: 0.6, continentsGain: 0.45, continentsOctaves: 3, mountainFreq: 2.0, mountainGain: 0.5, mountainOctaves: 2 },
    biomes: [
      { name: 'deepOcean', elev: [-1.0, -0.4], color: [20, 70, 140], noiseTint: 0.2 },
      { name: 'midOcean', elev: [-0.4, -0.1], color: [30, 100, 180], noiseTint: 0.2 },
      { name: 'shallow', elev: [-0.1, 0.02], color: [60, 150, 210], noiseTint: 0.15 },
      { name: 'islands', elev: [0.02, 0.25], color: [65, 120, 60], noiseTint: 0.15 },
      { name: 'reefs', elev: [0.0, 0.1], color: [220, 210, 160], noiseTint: 0.1 },
    ]
  },
  rocky: {
    waterLevel: -0.9,
    polarCapSize: 0.06,
    relief: { continentsFreq: 0.9, continentsGain: 0.55, continentsOctaves: 4, mountainFreq: 3.5, mountainGain: 0.65, mountainOctaves: 4 },
    biomes: [
      { name: 'cratered', elev: [0.0, 0.4], color: [130, 120, 110], noiseTint: 0.2 },
      { name: 'highlands', elev: [0.4, 0.7], color: [150, 130, 100], noiseTint: 0.15 },
      { name: 'mountain', elev: [0.7, 1.0], color: [160, 160, 170], noiseTint: 0.25 },
    ]
    , noCitiesBiomes: ['mountain']
  },
  lava: {
    waterLevel: -0.8,
    polarCapSize: 0.0,
    relief: { continentsFreq: 0.7, continentsGain: 0.6, continentsOctaves: 3, mountainFreq: 2.5, mountainGain: 0.6, mountainOctaves: 3 },
    biomes: [
      { name: 'basalt', elev: [0.0, 0.4], color: [90, 60, 50], noiseTint: 0.15 },
      { name: 'lavaFlow', elev: [0.2, 0.6], color: [200, 60, 20], noiseTint: 0.25 },
      { name: 'glow', elev: [0.6, 1.0], color: [255, 120, 60], noiseTint: 0.25 },
    ]
    , noCitiesBiomes: ['lavaFlow', 'glow']
  },
  volcanic: {
    waterLevel: -0.6,
    polarCapSize: 0.02,
    relief: { continentsFreq: 0.7, continentsGain: 0.6, continentsOctaves: 3, mountainFreq: 3.0, mountainGain: 0.65, mountainOctaves: 3 },
    biomes: [
      { name: 'ash', elev: [0.0, 0.4], color: [70, 70, 70], noiseTint: 0.2 },
      { name: 'lavaFlow', elev: [0.4, 0.7], color: [200, 60, 20], noiseTint: 0.25 },
      { name: 'cone', elev: [0.7, 1.0], color: [100, 100, 110], noiseTint: 0.2 },
    ]
    , noCitiesBiomes: ['lavaFlow', 'cone']
  },
  toxic: {
    waterLevel: -0.4,
    polarCapSize: 0.06,
    relief: { continentsFreq: 0.8, continentsGain: 0.55, continentsOctaves: 4, mountainFreq: 2.2, mountainGain: 0.5, mountainOctaves: 3 },
    biomes: [
      { name: 'sludge', elev: [-0.1, 0.2], color: [80, 200, 40], noiseTint: 0.2 },
      { name: 'acidFlats', elev: [0.2, 0.5], color: [100, 220, 60], noiseTint: 0.2 },
      { name: 'fumes', elev: [0.5, 1.0], color: [160, 230, 100], noiseTint: 0.15 },
    ]
    , noCitiesBiomes: ['acidFlats', 'fumes']
  },
  crystal: {
    waterLevel: -0.8,
    polarCapSize: 0.05,
    relief: { continentsFreq: 0.9, continentsGain: 0.55, continentsOctaves: 4, mountainFreq: 3.0, mountainGain: 0.6, mountainOctaves: 3 },
    biomes: [
      { name: 'plain', elev: [0.0, 0.5], color: [150, 100, 255], noiseTint: 0.15 },
      { name: 'spires', elev: [0.5, 1.0], color: [200, 160, 255], noiseTint: 0.2 },
    ]
    , noCitiesBiomes: ['spires']
  },
  gas: {
    waterLevel: -2.0,
    polarCapSize: 0.0,
    relief: { continentsFreq: 0.25, continentsGain: 0.4, continentsOctaves: 2, mountainFreq: 1.0, mountainGain: 0.2, mountainOctaves: 1 },
    // Gas giants: use broad latitudinal bands; elevation only modulates colors slightly
    biomes: [
      { name: 'band1', lat: [0.0, 0.15], color: [220, 180, 80], noiseTint: 0.1 },
      { name: 'band2', lat: [0.15, 0.3], color: [210, 170, 90], noiseTint: 0.1 },
      { name: 'band3', lat: [0.3, 0.45], color: [200, 160, 100], noiseTint: 0.1 },
      { name: 'band4', lat: [0.45, 0.6], color: [190, 150, 110], noiseTint: 0.1 },
      { name: 'band5', lat: [0.6, 0.75], color: [200, 160, 95], noiseTint: 0.1 },
      { name: 'band6', lat: [0.75, 1.0], color: [220, 180, 80], noiseTint: 0.1 },
    ]
  }
};

// Relief generation utilities
function fbm3D(noise, x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 1.0;
  let freq = 1.0;
  let sum = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise.noise3D(x * freq, y * freq, z * freq);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

function ridged(noiseVal) {
  // Ridged fractal component
  const v = 1.0 - Math.abs(noiseVal);
  return v * v;
}

// Biome system: selects and blends biomes based on elevation and latitude
class BiomeSystem {
  constructor(config) {
    this.config = config;
  }

  // Find matching biomes by ranges
  findCandidates(elevN, latN) {
    const arr = this.config.biomes;
    const list = [];
    for (const b of arr) {
      const [emin, emax] = b.elev ?? [-1, 1];
      const [lmin, lmax] = b.lat ?? [0, 1];
      if (elevN >= emin && elevN <= emax && latN >= lmin && latN <= lmax) {
        list.push(b);
      }
    }
    return list.length ? list : arr; // fallback to all if none matched
  }

  // Blend two biomes based on proximity in elevation
  blendByElevation(cands, elevN) {
    // Sort by distance of elevN to biome center
    const scored = cands.map(b => {
      const [emin, emax] = b.elev ?? [-1, 1];
      const center = (emin + emax) * 0.5;
      const dist = Math.abs(elevN - center);
      return { b, dist };
    }).sort((a, b) => a.dist - b.dist);
    const b1 = scored[0].b;
    const b2 = scored[1] ? scored[1].b : b1;
    const [e1min, e1max] = b1.elev ?? [-1, 1];
    const center1 = (e1min + e1max) * 0.5;
    const [e2min, e2max] = b2.elev ?? [-1, 1];
    const center2 = (e2min + e2max) * 0.5;
    const d1 = Math.abs(elevN - center1);
    const d2 = Math.abs(elevN - center2);
    const t = d1 + d2 > 0 ? clamp(d2 / (d1 + d2), 0, 1) : 0.5;
    return { b1, b2, t };
  }

  colorFor(elevN, latN, noiseTintVal) {
    const cands = this.findCandidates(elevN, latN);
    const { b1, b2, t } = this.blendByElevation(cands, elevN);
    const base = lerpColorRGB(b1.color, b2.color, t);
    // Apply small tint from noise for variation
    const tintAmount = (b1.noiseTint + b2.noiseTint) * 0.5;
    const factor = 1.0 + (noiseTintVal - 0.5) * tintAmount;
    return [
      clamp(Math.round(base[0] * factor), 0, 255),
      clamp(Math.round(base[1] * factor), 0, 255),
      clamp(Math.round(base[2] * factor), 0, 255)
    ];
  }

  // Возвращает доминирующий биом по текущим высоте/широте (наиболее близкий по высоте)
  dominantBiomeName(elevN, latN) {
    const cands = this.findCandidates(elevN, latN);
    const { b1 } = this.blendByElevation(cands, elevN);
    return b1 && b1.name ? b1.name : null;
  }
}

// Improved universal planet texture generator
export class ProceduralPlanetTexture {
  constructor(starX, starY, planetIndex, planetType, textureSize = 512, moonIndex = 0, developmentLevel = 0) {
    // Deterministic seed from star position, planet index, and optional moon index
    this.seed = this.createSeed(starX, starY, planetIndex, moonIndex);
    this.planetType = planetType;
    this.textureSize = textureSize;
    this.noise = new SimplexNoise(this.seed);
    this.rng = this.createSeededRNG(this.seed);
    this.moonIndex = moonIndex;
    this.developmentLevel = clamp(developmentLevel, 0, 1);
    
    // Planet type specific parameters via config
    this.typeParams = this.getPlanetTypeParameters(planetType);
    this.biomes = new BiomeSystem(this.typeParams);
  }

  createSeed(starX, starY, planetIndex, moonIndex = 0) {
    // Create deterministic seed from coordinates and identifiers
    const x = Math.floor(starX * 1000) % 10000;
    const y = Math.floor(starY * 1000) % 10000;
    const m = (moonIndex || 0) % 1000;
    return (x * 31 + y * 17 + planetIndex * 7 + m * 13) % 2147483647;
  }

  createSeededRNG(seed) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  getPlanetTypeParameters(type) {
    return PLANET_TYPES[type] || PLANET_TYPES.rocky;
  }

  // Generate improved elevation map with continents, mountains, polar modulation
  generateElevationMap() {
    const elevation = new Float32Array(this.textureSize * this.textureSize);
    const cfg = this.typeParams.relief;
    const contFreq = cfg.continentsFreq;
    const contGain = cfg.continentsGain;
    const contOct = cfg.continentsOctaves;
    const mtFreq = cfg.mountainFreq;
    const mtGain = cfg.mountainGain;
    const mtOct = cfg.mountainOctaves;

    for (let y = 0; y < this.textureSize; y++) {
      const lat = (y / this.textureSize) * Math.PI; // 0..π
      const latN = Math.min(lat, Math.PI - lat) / (Math.PI / 2); // 0 at pole -> 1 at equator
      for (let x = 0; x < this.textureSize; x++) {
        const lon = (x / this.textureSize) * 2 * Math.PI;
        const sx = Math.sin(lat) * Math.cos(lon);
        const sy = Math.sin(lat) * Math.sin(lon);
        const sz = Math.cos(lat);

        // Continents: low frequency fbm
        const cont = fbm3D(this.noise, sx * contFreq, sy * contFreq, sz * contFreq, contOct, 2.0, contGain);
        // Normalize approximate fbm range [-amp..amp] to [-1..1]
        const contN = clamp(cont / 1.5, -1.0, 1.0);

        // Mountains: ridged component, weighted by continental elevation
        const mRaw = fbm3D(this.noise, sx * mtFreq, sy * mtFreq, sz * mtFreq, mtOct, 2.0, mtGain);
        const mR = ridged(mRaw);
        // Combine; emphasize mountains where continents already high
        let h = contN + mR * 0.9 * Math.max(0.0, contN);

        // Slight equatorial bulge and polar depression for realism
        const eqBulge = (1.0 - latN) * 0.05; // equator ~0.05 higher
        h += eqBulge;

        // Clamp
        elevation[y * this.textureSize + x] = clamp(h, -1.0, 1.0);
      }
    }
    return elevation;
  }

// Generate the complete planet texture
generateTexture() {
  // Deterministic generation; no external caching required
  const elevationMap = this.generateElevationMap();
  const textureData = new Uint8Array(this.textureSize * this.textureSize * 4);
  const cityMask = new Uint8Array(this.textureSize * this.textureSize);
  
  const polarCapSize = this.typeParams.polarCapSize;
  const waterLevel = this.typeParams.waterLevel;

  for (let y = 0; y < this.textureSize; y++) {
    const lat = (y / this.textureSize) * Math.PI; // 0..π
    const latToEquator = Math.min(lat, Math.PI - lat) / (Math.PI / 2); // 0 at pole -> 1 at equator
    const latN = latToEquator; // 0..1
    for (let x = 0; x < this.textureSize; x++) {
      const index = y * this.textureSize + x;
      const pix = index * 4;
      const elev = elevationMap[index];

      // 3D noise sampling to avoid seams
      const lon = (x / this.textureSize) * 2 * Math.PI;
      const nx = Math.sin(lat) * Math.cos(lon);
      const ny = Math.sin(lat) * Math.sin(lon);
      const nz = Math.cos(lat);
      const noiseVal = this.noise.noise3D(nx * 6.0, ny * 6.0, nz * 6.0) * 0.5 + 0.5;

      // Polar cap with noisy edge
      const noiseAmplitude = polarCapSize * 0.35;
      const polarThreshold = polarCapSize + (noiseVal - 0.5) * noiseAmplitude;
      const distanceFromPole = Math.min(lat, Math.PI - lat) / Math.PI; // 0 at pole
      const hasPolar = distanceFromPole < polarThreshold && this.planetType !== 'gas';

      // Normalize elevation into [-1..1], relative to water level
      const elevN = elev - waterLevel;

      // Biome color from system
      const biomeColor = this.biomes.colorFor(elevN, latN, noiseVal);

      // Apply polar override
      const color = hasPolar ? [240, 240, 255] : biomeColor;

      textureData[pix] = color[0];
      textureData[pix + 1] = color[1];
      textureData[pix + 2] = color[2];
      textureData[pix + 3] = 255;

      // Urbanization mask: deterministic city light density based on suitability
      // Suitability: near water level on land, mid latitudes preferred, avoid poles/mountains
      // Исключаем урбанизацию на отдельных биомах в зависимости от типа планеты
      const biomeName = this.biomes.dominantBiomeName(elevN, latN);
      const noCitiesBiomes = (this.typeParams && this.typeParams.noCitiesBiomes) ? this.typeParams.noCitiesBiomes : [];
      const biomeAllowed = biomeName ? !noCitiesBiomes.includes(biomeName) : true;
      const isLand = elevN >= 0.0 && this.planetType !== 'gas' && biomeAllowed;
      if (isLand && this.developmentLevel > 0) {
        const nearCoast = smoothstep(0.0, 0.12, Math.abs(elevN)); // coasts favored
        const midLatPref = smoothstep(0.2, 0.8, latN) * (1.0 - smoothstep(0.7, 1.0, latN));
        const ruggedness = smoothstep(0.3, 0.7, elevN); // avoid high mountains
        const suitability = clamp(0.6 * nearCoast + 0.3 * midLatPref + 0.1 * (1.0 - ruggedness), 0.0, 1.0);
        // Clustered noise
        const cityNoise = this.noise.noise3D(nx * 24.0, ny * 24.0, nz * 24.0) * 0.5 + 0.5;
        const threshold = 1.0 - (this.developmentLevel * suitability);
        const city = cityNoise > threshold ? 255 : 0;
        cityMask[index] = city;
      } else {
        cityMask[index] = 0;
      }
    }
  }

  // Create canvas and upload
  const canvas = document.createElement('canvas');
  canvas.width = this.textureSize;
  canvas.height = this.textureSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.createImageData(this.textureSize, this.textureSize);
  imageData.data.set(textureData);
  ctx.putImageData(imageData, 0, 0);
  canvas._isStaticTexture = true;

  // Attach city mask for potential shader use
  canvas._cityMask = cityMask; // Uint8Array
  canvas._developmentLevel = this.developmentLevel;
  canvas._seed = this.seed;
  return canvas;
}

}

// ----------------------
// Кеширование текстур
// ----------------------
const textureCache = new Map();

export function generatePlanetTexture(starX, starY, planetIndex, planetType, size=512, moonIndex=0, developmentLevel=0){
  const cacheKey = `${Math.floor(starX*1000)}_${Math.floor(starY*1000)}_${planetIndex}_${moonIndex}_${planetType}_${size}_${developmentLevel}`;
  if(textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const generator = new ProceduralPlanetTexture(starX, starY, planetIndex, planetType, size, moonIndex, developmentLevel);
  const texture = generator.generateTexture();
  textureCache.set(cacheKey, texture);
  return texture;
}

export function clearPlanetTextureCache(){
  try { textureCache.clear(); } catch(e){ console.error('Failed to clear planet texture cache:', e); }
}