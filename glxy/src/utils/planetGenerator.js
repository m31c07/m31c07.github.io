export function generatePlanetarySystem(starName) {
    // console.log('keka mama fo:', starName);
  const system = {
    planets: [],
    asteroidBelts: []
  };

  // Определяем количество планет (3-8)
  const planetCount = 3 + Math.floor(Math.random() * 6);
  
  // Генерируем планеты
  for (let i = 0; i < planetCount; i++) {
    const hasRings = Math.random() < 0.3; // 30% chance for rings
    const moonCount = Math.floor(Math.random() * 4); // 0-3 moons
    
    system.planets.push({
      id: i,
      // name: `Planet-${i+1}`,
      name: `${starName} ${toRoman(i + 1)}`,
      type: getPlanetType(i, planetCount),
      size: 5 + Math.random() * 10,
      orbitRadius: 80 + i * 60 + (Math.random() * 30 - 15),
      orbitSpeed: 0.5 + Math.random() * 2,
      tilt: Math.random() * 0.2,
      color: getPlanetColor(i),
      moons: generateMoons(moonCount),
      rings: hasRings ? generateRings() : null,
      habitable: i === Math.floor(planetCount/2) && Math.random() < 0.7
    });
  }
  
  // Generate asteroid belts
  const beltChance = 0.5; // 50% chance for asteroid belt
  if (Math.random() < beltChance) {
    const beltCount = 1 + Math.floor(Math.random() * 2); // 1-2 belts
    
    for (let i = 0; i < beltCount; i++) {
      const beltRadius = 200 + i * 150 + Math.random() * 100;
      system.asteroidBelts.push({
        id: i,
        name: `${starName} Asteroid Belt ${i + 1}`,
        innerRadius: beltRadius - 20,
        outerRadius: beltRadius + 20,
        density: 0.3 + Math.random() * 0.4
      });
    }
  }

  return system;
}

function generateMoons(count) {
  const moons = [];
  for (let i = 0; i < count; i++) {
    moons.push({
      size: 1 + Math.random() * 3,
      orbitRadius: 8 + i * 5 + Math.random() * 10,
      orbitSpeed: 1 + Math.random() * 3,
      color: getMoonColor()
    });
  }
  return moons;
}

function generateRings() {
  return {
    innerRadius: 1.2 + Math.random() * 0.5,  // 1.2-1.7
    outerRadius: 2.0 + Math.random() * 1.5,  // 2.0-3.5
    tilt: Math.random() * 0.3,
    color: `rgba(200, 180, 150, ${0.6 + Math.random() * 0.3})` // Более заметные кольца
  };
}


// Вспомогательные функции для типов и цветов
function getPlanetType(position, total) {
  const types = ['lava', 'rocky', 'terran', 'gas', 'ice'];
  const probabilities = [
    [0.6, 0.3, 0.1, 0.0, 0.0],  // Близкие к звезде
    [0.3, 0.4, 0.2, 0.1, 0.0],
    [0.1, 0.3, 0.3, 0.2, 0.1],  // Обитаемая зона
    [0.0, 0.2, 0.3, 0.3, 0.2],
    [0.0, 0.1, 0.2, 0.4, 0.3],  // Дальние планеты
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

function getPlanetColor(index) {
  const colors = {
    lava: ['#ff3300', '#ff5500', '#cc2200'],
    rocky: ['#996633', '#887755', '#aa8866'],
    terran: ['#2277ff', '#44aa88', '#338855'],
    gas: ['#ffdd88', '#eecc99', '#ffcc66'],
    ice: ['#aaddff', '#cceeff', '#ddeeff']
  };
  const type = getPlanetType(index, 5); // Упрощенный вызов
  const palette = colors[type] || colors.rocky;
  return palette[Math.floor(Math.random() * palette.length)];
}

function getMoonColor() {
  const colors = ['#cccccc', '#aaaaaa', '#999999', '#bbbbbb'];
  return colors[Math.floor(Math.random() * colors.length)];
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

function toRoman(num) {
    const romanNumerals = [
      { value: 1000, numeral: 'M' },
      { value: 900, numeral: 'CM' },
      { value: 500, numeral: 'D' },
      { value: 400, numeral: 'CD' },
      { value: 100, numeral: 'C' },
      { value: 90, numeral: 'XC' },
      { value: 50, numeral: 'L' },
      { value: 40, numeral: 'XL' },
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    let roman = '';
    romanNumerals.forEach(({ value, numeral }) => {
      while (num >= value) {
        roman += numeral;
        num -= value;
      }
    });
    return roman;
}