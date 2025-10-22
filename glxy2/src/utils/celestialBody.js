/**
 * Единый класс для небесных тел (планет и лун)
 * Унифицирует работу с планетами и лунами, так как они имеют одинаковые свойства
 */
export class CelestialBody {
  constructor(type, bodyType = 'planet', parentBody = null) {
    this.type = type; // lava, rocky, terran, gas, ice, desert, ocean, toxic, crystal, volcanic
    this.bodyType = bodyType; // 'planet' или 'moon'
    this.parentBody = parentBody; // для лун - ссылка на планету, для планет - null
    
    // Орбитальные параметры
    this.orbitRadius = 0;
    this.orbitSpeed = 0;
    this._orbitProgress = 0;
    this.initialOrbitAngle = Math.random() * Math.PI * 2;
    
    // Физические параметры
    this.size = 10;
    this.mass = 1;
    
    // Визуальные параметры
    this.color = null;
    this._uvTexture = null;
    
    // Дочерние объекты (только для планет)
    this.satellites = []; // луны для планет
    
    // Дополнительные свойства
    this.name = '';
    this.explored = false;
  }

  /**
   * Получает цвет небесного тела в формате RGBA
   */
  getColor() {
    if (this.color) return this.color;
    
    const colors = {
      lava: [1.0, 0.2, 0.0, 1.0],
      rocky: [0.6, 0.45, 0.3, 1.0],
      terran: [0.2, 0.6, 0.4, 1.0],
      gas: [0.95, 0.85, 0.6, 1.0],
      ice: [0.8, 0.9, 1.0, 1.0],
      desert: [0.9, 0.72, 0.35, 1.0],
      ocean: [0.0, 0.5, 0.8, 1.0],
      toxic: [0.4, 0.9, 0.2, 1.0],
      crystal: [0.8, 0.6, 1.0, 1.0],
      volcanic: [1.0, 0.4, 0.1, 1.0]
    };
    
    this.color = colors[this.type] || colors.rocky;
    return this.color;
  }

  /**
   * Получает цвет атмосферы (если есть)
   */
  getAtmosphereColor() {
    const atmosphereColors = {
      terran: 'rgba(120, 180, 255, 0.3)',
      ocean: 'rgba(100, 170, 255, 0.3)',
      jungle: 'rgba(120, 200, 120, 0.3)',
      arctic: 'rgba(200, 230, 255, 0.3)',
      desert: 'rgba(255, 210, 120, 0.3)',
      volcanic: 'rgba(255, 100, 50, 0.3)',
      gas: 'rgba(200, 180, 255, 0.3)',
      ice: 'rgba(180, 220, 255, 0.2)',
      toxic: 'rgba(100, 255, 50, 0.3)'
    };
    
    return atmosphereColors[this.type] || 'rgba(150, 150, 150, 0.2)';
  }

  /**
   * Проверяет, есть ли у небесного тела атмосфера
   */
  hasAtmosphere() {
    const atmosphericTypes = ['terran', 'ocean', 'jungle', 'arctic', 'desert', 'volcanic', 'gas', 'ice', 'toxic'];
    return atmosphericTypes.includes(this.type);
  }

  /**
   * Обновляет орбитальную позицию
   */
  updateOrbit(deltaTime) {
    this._orbitProgress += this.orbitSpeed * deltaTime;
    this._orbitProgress %= (Math.PI * 2);
  }

  /**
   * Получает текущую позицию на орбите относительно родительского тела
   */
  getOrbitPosition(parentX = 0, parentY = 0) {
    const x = parentX + Math.cos(this._orbitProgress) * this.orbitRadius;
    const y = parentY + Math.sin(this._orbitProgress) * this.orbitRadius;
    return { x, y };
  }

  /**
   * Добавляет спутник (только для планет)
   */
  addSatellite(satellite) {
    if (this.bodyType === 'planet') {
      satellite.parentBody = this;
      satellite.bodyType = 'moon';
      this.satellites.push(satellite);
    }
  }

  /**
   * Получает все спутники
   */
  getSatellites() {
    return this.satellites || [];
  }

  /**
   * Проверяет, является ли тело планетой
   */
  isPlanet() {
    return this.bodyType === 'planet';
  }

  /**
   * Проверяет, является ли тело луной
   */
  isMoon() {
    return this.bodyType === 'moon';
  }

  /**
   * Создает планету из существующих данных
   */
  static fromPlanetData(planetData) {
    const planet = new CelestialBody(planetData.type, 'planet');
    
    // Копируем свойства
    Object.assign(planet, {
      orbitRadius: planetData.orbitRadius || 0,
      orbitSpeed: planetData.orbitSpeed || 0,
      _orbitProgress: planetData._orbitProgress || planetData.initialOrbitAngle || 0,
      size: planetData.size || 10,
      name: planetData.name || '',
      explored: planetData.explored || false
    });

    // Конвертируем луны
    if (planetData.moons && planetData.moons.length > 0) {
      planetData.moons.forEach((moonData, index) => {
        const moon = CelestialBody.fromMoonData(moonData, index);
        planet.addSatellite(moon);
      });
    }

    return planet;
  }

  /**
   * Создает луну из существующих данных
   */
  static fromMoonData(moonData, moonIndex = 0) {
    const moon = new CelestialBody(moonData.type || 'rocky', 'moon');
    
    // Копируем свойства
    Object.assign(moon, {
      orbitRadius: moonData.orbitRadius || (8 + moonIndex * 5),
      orbitSpeed: moonData.orbitSpeed || (0.05 + (0.3 / Math.sqrt((moonData.orbitRadius || (8 + moonIndex * 5)) / 8))),
      _orbitProgress: moonData._orbitProgress || moonData.initialOrbitAngle || (Math.random() * Math.PI * 2),
      size: moonData.size || Math.max(4, Math.min(12, 6 + moonIndex)),
      name: moonData.name || '',
      explored: moonData.explored || false
    });

    return moon;
  }

  /**
   * Конвертирует CelestialBody обратно в старый формат для совместимости
   */
  toLegacyFormat() {
    const data = {
      type: this.type,
      orbitRadius: this.orbitRadius,
      orbitSpeed: this.orbitSpeed,
      _orbitProgress: this._orbitProgress,
      initialOrbitAngle: this.initialOrbitAngle,
      size: this.size,
      name: this.name,
      explored: this.explored
    };

    if (this.isPlanet() && this.satellites.length > 0) {
      data.moons = this.satellites.map(satellite => satellite.toLegacyFormat());
    }

    return data;
  }
}