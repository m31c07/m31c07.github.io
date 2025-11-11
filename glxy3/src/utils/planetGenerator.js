import { greekLetters, toRoman } from './utils.js';

export function generatePlanetarySystem(starName, starX = 0, starY = 0) {
  const system = {
    planets: []
  };

  // Определяем количество планет (3-8)
  const planetCount = 3 + Math.floor(Math.random() * 6);
  
  // Keep track of the outer boundary of each planet system (planet + its moons)
  let lastSystemOuterBoundary = 0;
  
  // Генерируем планеты
  for (let i = 0; i < planetCount; i++) {
    const hasRings = Math.random() < 0.3; // 30% chance for rings
    const moonCount = Math.floor(Math.random() * 4); // 0-3 moons
    const axialTilt = (Math.random() - 0.5) * Math.PI * 0.167; // Random axial tilt ±15 degrees (±π/12)
    
    // Generate deterministic day length based on planet properties
    const dayLength = generateDayLength(starX, starY, i);
    
    // Generate planet size first
    const planetSize = 5 + Math.random() * 10;
    
    // Calculate orbit radius with guaranteed spacing from previous systems
    const minOrbitRadius = Math.max(80 + i * 70, lastSystemOuterBoundary + 20);
    const orbitRadius = minOrbitRadius + (Math.random() * 20);
    // Скорость орбиты трактуем как радианы в игровой час
    const orbitSpeed = (1.2 * Math.pow(0.7, i)) / 15;
    const planetType = getPlanetType(i, planetCount);
    
    // Create planet object (moons will be generated next)
    const planet = {
      id: i,
      name: `${starName} ${toRoman(i + 1)}`,
      type: planetType,
      size: planetSize,
      orbitRadius: orbitRadius,
      orbitSpeed: orbitSpeed,
      tilt: Math.random() * 0.2,
      axialTilt: axialTilt,
      initialOrbitAngle: generateInitialOrbitAngle(starX, starY, i),
      color: getPlanetColor(planetType),
      dayLength: dayLength,
      moons: [],
      rings: hasRings ? generateRings(axialTilt) : null,
      habitable: i === Math.floor(planetCount/2) && Math.random() < 0.7
    };
    
    // Generate moons with proper spacing
    planet.moons = generateMoonsWithProperSpacing(moonCount, starX, starY, i, planetType, planet.name, planet.size);
    
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

function generateMoonsWithProperSpacing(count, starX, starY, planetIndex, planetType, planetName, planetSize) {
  const moons = [];
  
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
    const moonType = getMoonType(i, planetType, starX, starY);
    
    // Generate name based on moon type and position
    let moonName;
    if (count === 1) {
      // For single moons, use descriptive name with planet name
      const prefixes = typePrefixes[moonType] || typePrefixes['rocky'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      moonName = `${prefix} ${planetName}`;
    } else {
      // For multiple moons, use Greek letters with planet name
      const greekLetter = greekLetters[i % greekLetters.length];
      moonName = `${planetName}-${greekLetter}`;
    }
    
    // Generate deterministic day length for moon
    const dayLength = generateDayLength(starX, starY, planetIndex * 10 + i);
    
    // Generate moon size
    const moonSize = 1 + Math.random() * 3;
    
    // Calculate orbit radius with guaranteed spacing from previous moons
    const minOrbitRadius = lastMoonBoundary + moonSize + 3; // 3 units minimum spacing
    const orbitRadius = minOrbitRadius + Math.random() * 3;
    
    // Update boundary for next moon
    lastMoonBoundary = orbitRadius + moonSize;
    
    // Calculate orbit speed according to Kepler's third law for moons
    const orbitSpeed = 0.05 + 0.3 / Math.sqrt(orbitRadius / (planetSize + 3)); // радианы/игровой час
    
    moons.push({
      size: moonSize,
      orbitRadius: orbitRadius,
      orbitSpeed: orbitSpeed,
      initialOrbitAngle: generateInitialOrbitAngle(starX, starY, planetIndex * 10 + i),
      type: moonType,
      color: getPlanetColor(moonType),
      name: moonName,
      dayLength: dayLength,
      _rotationOffset: 0,
      _detailRotationOffset: 0
    });
  }
  return moons;
}

function generateRings(axialTilt = 0, steps = 120) {
  const innerRadius = 1.2 + Math.random() * 0.5;  // 1.2-1.7
  const outerRadius = 2.0 + Math.random() * 1.5;  // 2.0-3.5
  const color = `rgba(200, 180, 150, ${0.6 + Math.random() * 0.3})`;

  // Генерируем фиксированные параметры полосок кольца
  const ringData = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    ringData.push({
      t,
      alpha: 0.2 * (1 - t * t) + Math.random() * 0.05,
      lineWidth: 1 + Math.random() * 1.5,
      lightStripe: Math.random() < 0.05,
      darkStripe: Math.random() < 0.03
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


// Generate deterministic initial orbit angle based on star coordinates and object index
function generateInitialOrbitAngle(starX, starY, objectIndex) {
  // Create a seed from star coordinates and object index
  const seed = (Math.floor(starX * 1000) * 31 + Math.floor(starY * 1000) * 17 + objectIndex * 7) % 2147483647;
  
  // Simple seeded random function
  const seededRandom = () => {
    const x = Math.sin(seed + objectIndex * 12345) * 10000;
    return x - Math.floor(x);
  };
  
  // Return angle in radians (0 to 2π)
  return seededRandom() * Math.PI * 2;
}

// Generate deterministic day length based on star coordinates and object index
function generateDayLength(starX, starY, objectIndex) {
  // Create a seed from star coordinates and object index
  const seed = (Math.floor(starX * 1000) * 31 + Math.floor(starY * 1000) * 17 + objectIndex * 7) % 2147483647;
  
  // Simple seeded random function for day length (between 10 and 100 hours)
  const seededRandom = () => {
    const x = Math.sin(seed + objectIndex * 12345) * 10000;
    return x - Math.floor(x);
  };
  
  // Return day length in hours (10-100 hours)
  return 10 + Math.floor(seededRandom() * 91);
}

// Вспомогательные функции для типов и цветов
function getPlanetType(position, total) {
  const types = ['lava', 'rocky', 'terran', 'gas', 'ice', 'desert', 'ocean', 'toxic', 'crystal', 'volcanic'];
  const probabilities = [
    [0.4, 0.25, 0.05, 0.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.0],  // Близкие к звезде - больше лавы, пустынь, токсичных
    [0.2, 0.3, 0.1, 0.05, 0.0, 0.25, 0.0, 0.05, 0.05, 0.0],
    [0.05, 0.2, 0.3, 0.1, 0.05, 0.15, 0.1, 0.0, 0.05, 0.0],  // Обитаемая зона - больше терранских и океанических
    [0.0, 0.15, 0.2, 0.25, 0.15, 0.05, 0.05, 0.0, 0.1, 0.05],
    [0.0, 0.05, 0.1, 0.3, 0.35, 0.0, 0.0, 0.0, 0.15, 0.05],  // Дальние планеты - больше газовых, ледяных, кристальных
  ];
  
  const zone = Math.min(Math.floor(position / (total / 5)), 4);
  const rnd = Math.random();
  let acc = 0;
  
  for (let i = 0; i < types.length; i++) {
    acc += probabilities[zone][i];
    if (rnd < acc) return types[i];
  }
  return types[types.length - 1];
}

function getPlanetColor(planetType) {
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
  return palette[Math.floor(Math.random() * palette.length)];
}

function getMoonType(moonIndex, planetType, starX, starY) {
  // Create deterministic random for moon type based on position and index
  const seed = Math.abs(Math.floor(starX * 1000) * 31 + Math.floor(starY * 1000) * 17 + moonIndex * 13);
  let seedState = seed;
  const seededRandom = () => {
    seedState = (seedState * 1664525 + 1013904223) % 4294967296;
    return seedState / 4294967296;
  };
  
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
  const rnd = seededRandom();
  let acc = 0;
  
  for (let i = 0; i < types.length; i++) {
    acc += planetProbs[i];
    if (rnd < acc) return types[i];
  }
  return types[0];
}

export function getRandomSpectralType() {
  const types = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
  const weights = [0.00003, 0.13, 0.6, 3, 7.6, 12.1, 76.45]; // Реальные распределения звезд
  let rnd = Math.random() * 100;
  for (let i = 0; i < types.length; i++) {
    if (rnd < weights[i]) return types[i];
    rnd -= weights[i];
  }
  return 'M';
}

