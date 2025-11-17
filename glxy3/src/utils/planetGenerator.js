import { greekLetters, toRoman } from './utils.js';
import { gameConfig } from '../config/gameConfig.js';

function createSeededRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generatePlanetarySystem(starName, starX = 0, starY = 0, systemSeed = 0) {
  const system = {
    planets: []
  };

  const minPlanets = Number(gameConfig?.planets?.minPlanets ?? 3);
  const maxPlanets = Number(gameConfig?.planets?.maxPlanets ?? 8);
  const rng = createSeededRNG(systemSeed >>> 0);
  const planetCount = minPlanets + Math.floor(rng() * (maxPlanets - minPlanets + 1));
  
  // Keep track of the outer boundary of each planet system (planet + its moons)
  let lastSystemOuterBoundary = 0;
  
  // Генерируем планеты
  for (let i = 0; i < planetCount; i++) {
    const ringChance = Number(gameConfig?.planets?.ringChance ?? 0.3);
    const hasRings = rng() < ringChance;
    const hasMoons = rng() < Number(gameConfig?.planets?.moonChance ?? 0.7);
    const moonCount = hasMoons ? Math.floor(rng() * 4) : 0;
    const axialTilt = (rng() - 0.5) * Math.PI * 0.167;
    
    // Generate deterministic day length based on planet properties
    const dayLength = generateDayLength(systemSeed, i);
    
    // Generate planet size first
    const planetSize = 5 + rng() * 10;
    
    // Calculate orbit radius with guaranteed spacing from previous systems
    const minOrbitRadius = Math.max(80 + i * 70, lastSystemOuterBoundary + 20);
    const orbitRadius = minOrbitRadius + (rng() * 20);
    // Скорость орбиты трактуем как радианы в игровой час
    const orbitSpeed = (1.2 * Math.pow(0.7, i)) / 15;
    const planetType = getPlanetType(i, planetCount, rng);
    
    // Create planet object (moons will be generated next)
    const planet = {
      id: i,
      name: `${starName} ${toRoman(i + 1)}`,
      type: planetType,
      size: planetSize,
      orbitRadius: orbitRadius,
      orbitSpeed: orbitSpeed,
      tilt: rng() * 0.2,
      axialTilt: axialTilt,
      initialOrbitAngle: generateInitialOrbitAngle(systemSeed, i),
      color: getPlanetColor(planetType, rng),
      dayLength: dayLength,
      moons: [],
      rings: hasRings ? generateRings(axialTilt, 120, createSeededRNG((systemSeed ^ ((i + 1) * 0x9e3779b9)) >>> 0)) : null,
      habitable: i === Math.floor(planetCount/2) && rng() < 0.7
    };
    
    // Generate moons with proper spacing
    planet.moons = generateMoonsWithProperSpacing(moonCount, systemSeed, i, planetType, planet.name, planet.size);
    
    // Calculate the outer boundary of this planet system (planet + its furthest moon)
    let systemOuterBoundary = planet.orbitRadius + planet.size;
    if (planet.moons.length > 0) {
      // Find the moon with the largest orbit
      let maxMoonOrbit = 0;
      for (const moon of planet.moons) {
        maxMoonOrbit = Math.max(maxMoonOrbit, moon.orbitRadius + moon.size);
      }
      systemOuterBoundary += maxMoonOrbit;
    }
    
    // Update the last system boundary for next iteration
    lastSystemOuterBoundary = systemOuterBoundary;
    
    system.planets.push(planet);
  }

  return system;
}

function generateMoonsWithProperSpacing(count, systemSeed, planetIndex, planetType, planetName, planetSize) {
  const moons = [];
  const rng = createSeededRNG((systemSeed ^ ((planetIndex + 1) * 0x9e3779b9)) >>> 0);
  
  // Descriptive prefixes based on moon type
  const typePrefixes = {
    'lava': ['Ignis', 'Pyro', 'Magma', 'Flame', 'Ember'],
    'rocky': ['Petra', 'Litho', 'Silex', 'Granite', 'Basalt'],
    'terran': ['Terra', 'Gaia', 'Eden', 'Nova', 'Verda'],
    'gas': ['Nebula', 'Vapor', 'Mist', 'Cloud', 'Haze'],
    'ice': ['Glacies', 'Frost', 'Cryo', 'Winter', 'Blizzard'],
    'desert': ['Dune', 'Sahara', 'Oasis', 'Mirage', 'Dust'],
    'ocean': ['Aqua', 'Tide', 'Marina', 'Azure', 'Coral'],
    'toxic': ['Venom', 'Toxin', 'Poison', 'Acid', 'Blight'],
    'crystal': ['Crystal', 'Gem', 'Prism', 'Jewel', 'Diamond'],
    'volcanic': ['Vulcan', 'Eruption', 'Ash', 'Sulfur', 'Crater']
  };
  
  // Keep track of the outer boundary for moon placement
  let lastMoonBoundary = planetSize + 5; // Start moons at least 5 units from planet center
  
  for (let i = 0; i < count; i++) {
    const moonType = getMoonType(i, planetType, rng);
    
    // Generate name based on moon type and position
    let moonName;
    if (count === 1) {
      // For single moons, use descriptive name with planet name
      const prefixes = typePrefixes[moonType] || typePrefixes['rocky'];
      const prefix = prefixes[Math.floor(rng() * prefixes.length)];
      moonName = `${prefix} ${planetName}`;
    } else {
      // For multiple moons, use Greek letters with planet name
      const greekLetter = greekLetters[i % greekLetters.length];
      moonName = `${planetName}-${greekLetter}`;
    }
    
    // Generate deterministic day length for moon
    const dayLength = generateDayLength(systemSeed, planetIndex * 10 + i);
    
    // Generate moon size
    const moonSize = 1 + rng() * 3;
    
    // Calculate orbit radius with guaranteed spacing from previous moons
    const minOrbitRadius = lastMoonBoundary + moonSize + 3; // 3 units minimum spacing
    const orbitRadius = minOrbitRadius + rng() * 3;
    
    // Update boundary for next moon
    lastMoonBoundary = orbitRadius + moonSize;
    
    // Calculate orbit speed according to Kepler's third law for moons
    const orbitSpeed = 0.05 + 0.3 / Math.sqrt(orbitRadius / (planetSize + 3)); // радианы/игровой час
    
    moons.push({
      size: moonSize,
      orbitRadius: orbitRadius,
      orbitSpeed: orbitSpeed,
      initialOrbitAngle: generateInitialOrbitAngle(systemSeed, planetIndex * 10 + i),
      type: moonType,
      color: getPlanetColor(moonType, rng),
      name: moonName,
      dayLength: dayLength,
      _rotationOffset: 0,
      _detailRotationOffset: 0
    });
  }
  return moons;
}

function generateRings(axialTilt = 0, steps = 120, rng) {
  const innerRadius = 1.2 + rng() * 0.5;
  const outerRadius = 2.0 + rng() * 1.5;
  const color = `rgba(200, 180, 150, ${0.6 + rng() * 0.3})`;

  // Генерируем фиксированные параметры полосок кольца
  const ringData = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    ringData.push({
      t,
      alpha: 0.2 * (1 - t * t) + rng() * 0.05,
      lineWidth: 1 + rng() * 1.5,
      lightStripe: rng() < 0.05,
      darkStripe: rng() < 0.03
    });
  }

  return {
    innerRadius,
    outerRadius,
    tilt: axialTilt,
    color,
    ringData
  };
}


function generateInitialOrbitAngle(systemSeed, objectIndex) {
  const r = createSeededRNG(((systemSeed ^ (objectIndex * 0x9e3779b9)) >>> 0));
  return r() * Math.PI * 2;
}

function generateDayLength(systemSeed, objectIndex) {
  const r = createSeededRNG(((systemSeed ^ (objectIndex * 0x9e3779b9)) >>> 0));
  return 10 + Math.floor(r() * 91);
}

// Вспомогательные функции для типов и цветов
function getPlanetType(position, total, rng) {
  const types = ['lava', 'rocky', 'terran', 'gas', 'ice', 'desert', 'ocean', 'toxic', 'crystal', 'volcanic'];
  const probabilities = [
    [0.4, 0.25, 0.05, 0.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.0],  // Близкие к звезде - больше лавы, пустынь, токсичных
    [0.2, 0.3, 0.1, 0.05, 0.0, 0.25, 0.0, 0.05, 0.05, 0.0],
    [0.05, 0.2, 0.3, 0.1, 0.05, 0.15, 0.1, 0.0, 0.05, 0.0],  // Обитаемая зона - больше терранских и океанических
    [0.0, 0.15, 0.2, 0.25, 0.15, 0.05, 0.05, 0.0, 0.1, 0.05],
    [0.0, 0.05, 0.1, 0.3, 0.35, 0.0, 0.0, 0.0, 0.15, 0.05],  // Дальние планеты - больше газовых, ледяных, кристальных
  ];
  
  const zone = Math.min(Math.floor(position / (total / 5)), 4);
  const rnd = rng();
  let acc = 0;
  
  for (let i = 0; i < types.length; i++) {
    acc += probabilities[zone][i];
    if (rnd < acc) return types[i];
  }
  return types[types.length - 1];
}

function getPlanetColor(planetType, rng) {
  const colors = {
    lava: ['#ff3300', '#ff5500', '#cc2200'],
    rocky: ['#996633', '#887755', '#aa8866'],
    terran: ['#0066cc', '#0088ee', '#0055aa'],
    gas: ['#ffdd88', '#eecc99', '#ffcc66'],
    ice: ['#aaddff', '#cceeff', '#ddeeff'],
    desert: ['#e6b84d', '#d4a24a', '#c49247'], // Песочные оттенки
    ocean: ['#0066cc', '#0088ee', '#0055aa'], // Глубокие синие тона
    toxic: ['#66ff33', '#88ee44', '#55cc22'], // Ядовито-зеленые цвета
    crystal: ['#cc88ff', '#aa66dd', '#9955cc'], // Кристаллические фиолетовые
    volcanic: ['#ff6600', '#ee5500', '#dd4400'] // Оранжево-красные вулканы
  };
  const palette = colors[planetType] || colors.rocky;
  return palette[Math.floor(rng() * palette.length)];
}

function getMoonType(moonIndex, planetType, rng) {
  
  // Use the same types as planets
  const types = ['lava', 'rocky', 'terran', 'gas', 'ice', 'desert', 'ocean', 'toxic', 'crystal', 'volcanic'];
  
  // Moon type probabilities influenced by parent planet type
  const probabilities = {
    'lava': [0.4, 0.25, 0.05, 0.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.0],
    'rocky': [0.2, 0.3, 0.1, 0.05, 0.0, 0.25, 0.0, 0.05, 0.05, 0.0],
    'terran': [0.05, 0.2, 0.3, 0.1, 0.05, 0.15, 0.1, 0.0, 0.05, 0.0],
    'gas': [0.0, 0.15, 0.2, 0.25, 0.15, 0.05, 0.05, 0.0, 0.1, 0.05],
    'ice': [0.0, 0.05, 0.1, 0.3, 0.35, 0.0, 0.0, 0.0, 0.15, 0.05],
    'desert': [0.3, 0.3, 0.1, 0.0, 0.0, 0.2, 0.0, 0.05, 0.05, 0.0],
    'ocean': [0.05, 0.2, 0.25, 0.1, 0.1, 0.1, 0.15, 0.0, 0.05, 0.0],
    'toxic': [0.1, 0.2, 0.0, 0.05, 0.0, 0.1, 0.0, 0.4, 0.1, 0.05],
    'crystal': [0.0, 0.1, 0.1, 0.1, 0.2, 0.05, 0.05, 0.05, 0.3, 0.05],
    'volcanic': [0.3, 0.2, 0.05, 0.0, 0.0, 0.1, 0.0, 0.1, 0.05, 0.2]
  };
  
  const planetProbs = probabilities[planetType] || probabilities['rocky'];
  const rnd = rng();
  let acc = 0;
  
  for (let i = 0; i < types.length; i++) {
    acc += planetProbs[i];
    if (rnd < acc) return types[i];
  }
  return types[0];
}

