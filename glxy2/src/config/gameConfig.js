export const gameConfig = {
  galaxy: {
    starCount: 750,                     // Общее количество звёзд
    mapSize: { width: 5000, height: 5000 }, // Размер карты
    innerRadius: 600,                   // Радиус внутренней пустоты
    outerRadius: 2400,                  // Внешний радиус галактики
    coreRadius: 1500,                   // Радиус максимальной плотности
    densityPower: 2.5,                  // Степень резкости убывания плотности
    minStarDistance: 40,                // Минимальное расстояние между звёздами
    maxLinksPerStar: 4,                 // Максимальное число гиперкоридоров у звезды
    linkRadius: 400,                    // Максимальная длина гиперкоридора
    corridorChances: {                  // Распределение вероятности числа гиперкоридоров
      1: 0.05,
      2: 0.1,
      3: 0.6,
      4: 0.2,
      5: 0.05
    },
  },
  ui: {
    currentView: null, // 'galaxy', 'starsystem', 'planet', 'satellite'
    selectedShip: null,
    fleetDropdownOpen: false,
    fleetDropdownSystemId: null,
    galaxyCamera: {
      offsetX: 0,
      offsetY: 0,
      scale: 0.5
    },
    starsystemCamera: {
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    planetCamera: {
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    satelliteCamera: {
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    // Текущая навигационная цепочка контекста
    currentStarId: null,
    currentPlanetIndex: null,
    currentMoonIndex: null,
    // Вспомогательное состояние для системного меню небесных тел
    celestialMenu: null
  },
  planets: {
    minPlanets: 2,
    maxPlanets: 8,
    moonChance: 0.7,
    ringChance: 0.3
  },
  empireColors: ['#00f', '#f00', '#0f0', '#ff0', '#0ff'],
  player: {
    id: 0,
    name: 'Player',
    color: '#00f',
    startingSystemId: null, // Will be set during galaxy generation
    scout: {
      shipId: null, // Will be set when scout ship is created
      currentSystemId: null,
      // Legacy fields kept for compatibility during exploration
      isExploring: false,
      explorationStartTime: null,
      explorationDuration: 0,
      phase: 'idle'
    }
  },
  exploration: {
    baseExplorationTime: 300, // 5 seconds base
    timePerObject: 300, // +5 seconds per planet/moon
    travelTime: 300, // Fixed 5 seconds travel time
    unexploredSystemName: '...',
    exploredSystems: new Set() // Will contain IDs of explored systems
  }
};
