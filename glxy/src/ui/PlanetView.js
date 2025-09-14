// src/ui/PlanetView.js
import { generatePlanetTexture, generatePlanetUVTexture } from '../utils/proceduralTextures.js';

// Определяет, имеет ли планета атмосферу на основе её типа
export function planetHasAtmosphere(planetType) {
  return ['terran', 'ocean', 'jungle', 'arctic', 'desert', 'volcanic', 'gas', 'ice', 'toxic'].includes(planetType);
}

// Возвращает цвет атмосферы для разных типов планет
export function getAtmosphereColor(planetType) {
  const atmosphereColors = {
    terran: 'rgba(120, 180, 255, 0.3)',   // Голубая атмосфера
    ocean: 'rgba(100, 170, 255, 0.3)',    // Голубая атмосфера
    jungle: 'rgba(120, 200, 120, 0.3)',   // Зеленоватая атмосфера
    arctic: 'rgba(200, 230, 255, 0.3)',   // Светло-голубая атмосфера
    desert: 'rgba(255, 210, 120, 0.3)',   // Желтоватая атмосфера
    volcanic: 'rgba(255, 100, 50, 0.3)',  // Красноватая атмосфера
    gas: 'rgba(200, 180, 255, 0.3)',      // Фиолетовая атмосфера
    ice: 'rgba(180, 220, 255, 0.2)',      // Светло-голубая атмосфера
    toxic: 'rgba(100, 255, 50, 0.3)'      // Ядовито-зеленая атмосфера
  };
  
  return atmosphereColors[planetType] || 'rgba(150, 150, 150, 0.2)';
}

// Преобразует HEX-цвет в RGB объект
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Создает битмап планеты с текстурой
export function createPlanetBitmap(planet, star) {
  const size = Math.ceil(planet.size * 2.5);
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d');
  
  const centerX = size;
  const centerY = size;
  
  // Используем id звезды вместо координат, если координаты не предоставлены
  const starX = star.x || (star.id * 1000);
  const starY = star.y || (star.id * 1000);
  
  // Генерация процедурной UV-текстуры для анимации вращения
  const uvTexture = generatePlanetUVTexture(
    starX, 
    starY, 
    planet.id, 
    planet.type, 
    Math.max(128, size), // Минимальное разрешение текстуры
    1.5 // Множитель ширины вращения
  );
  
  // Сохраняем ссылку на UV-текстуру для анимации вращения
  planet._uvTexture = uvTexture;
  planet._rotationOffset = 0; // Текущее смещение вращения
  
  // Создаем начальный рендер планеты с текстурой при вращении 0
  return renderPlanetWithRotation(planet, centerX, centerY, size, 0);
}

// Рендерит планету с определенным смещением вращения и наклоном оси
export function renderPlanetWithRotation(planet, centerX, centerY, size, rotationOffset) {
  const canvas = document.createElement('canvas');
  canvas.width = centerX * 2;
  canvas.height = centerY * 2;
  const ctx = canvas.getContext('2d');
  
  if (!planet._uvTexture) return canvas;
  
  const uvTexture = planet._uvTexture;
  const textureWidth = uvTexture.width;
  const textureHeight = uvTexture.height;
  
  // Создаем круговую маску для планеты
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, planet.size, 0, Math.PI * 2);
  ctx.clip();
  
  // Применяем трансформацию наклона оси
  ctx.save();
  ctx.translate(centerX, centerY);
  if (planet.axialTilt) {
    ctx.rotate(planet.axialTilt);
  }
  ctx.translate(-centerX, -centerY);
  
  // Улучшенный расчет смещения текстуры с субпиксельной точностью
  const preciseOffsetX = (rotationOffset * textureWidth);
  // const offsetX = Math.floor(preciseOffsetX) % textureWidth;
  const offsetX = (rotationOffset * textureWidth) % textureWidth;
  const drawWidth = planet.size * 2;
  const drawHeight = planet.size * 2;
  
  // Отключаем сглаживание изображения для пиксельно-точного рендеринга
  // ctx.imageSmoothingEnabled = false;
  
  // Рисуем UV-текстуру со смещением вращения (с оборачиванием)
  if (offsetX + drawWidth <= textureWidth) {
    // Оборачивание не требуется - одиночное рисование
    ctx.drawImage(
      uvTexture,
      offsetX, 0, drawWidth, drawHeight, // Исходная область
      centerX - planet.size, centerY - planet.size, drawWidth, drawHeight // Целевая область
    );
  } else {
    // Требуется оборачивание - рисуем в две части с улучшенной точностью
    const firstPartWidth = textureWidth - offsetX;
    const secondPartWidth = drawWidth - firstPartWidth;
    
    // Первая часть (правая сторона текстуры)
    ctx.drawImage(
      uvTexture,
      offsetX, 0, firstPartWidth, drawHeight, // Исходная область
      centerX - planet.size, centerY - planet.size, firstPartWidth, drawHeight // Целевая область
    );
    
    // Вторая часть (левая сторона текстуры) - бесшовно соединенная
    ctx.drawImage(
      uvTexture,
      0, 0, secondPartWidth, drawHeight, // Исходная область (обернутая часть)
      centerX - planet.size + firstPartWidth, centerY - planet.size, secondPartWidth, drawHeight // Целевая область
    );
  }
  
  // Включаем сглаживание для других элементов
  ctx.imageSmoothingEnabled = true;
  
  ctx.restore(); // Восстанавливаем трансформацию наклона оси
  ctx.restore(); // Восстанавливаем обрезку
  
  // Добавляем реалистичный 3D-эффект освещения поверх текстуры
  const lightingGradient = ctx.createRadialGradient(
    centerX - planet.size * 0.3, centerY - planet.size * 0.3, 0,
    centerX, centerY, planet.size
  );
  
  lightingGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)'); // Сбалансированная подсветка
  lightingGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)'); // Постепенное затухание
  lightingGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');        // Нейтральный
  lightingGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');        // Сбалансированная тень
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, planet.size, 0, Math.PI * 2);
  ctx.fillStyle = lightingGradient;
  ctx.fill();
  
  // Добавляем согласованное атмосферное свечение для планет с атмосферой
  if (planetHasAtmosphere(planet.type)) {
    // Scale atmospheric halo based on planet size for consistent appearance
    // Use a proportional offset that scales with planet size, with minimum and maximum limits
    const atmosphereOffset = Math.max(3, Math.min(15, planet.size * 0.3));
    
    const atmosphereGradient = ctx.createRadialGradient(
      centerX, centerY, planet.size,
      centerX, centerY, planet.size + atmosphereOffset
    );
    
    const atmosphereColor = getAtmosphereColor(planet.type);
    
    atmosphereGradient.addColorStop(0, atmosphereColor);
    atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, planet.size + atmosphereOffset, 0, Math.PI * 2);
    ctx.fillStyle = atmosphereGradient;
    ctx.fill();
  }
  
  return canvas;
}

// Создает битмап луны с текстурой
export function createMoonBitmap(moon, planetId, moonIndex, star) {
  const size = Math.ceil(moon.size * 2.5);
  const canvas = document.createElement('canvas');
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d');
  
  const centerX = size;
  const centerY = size;
  
  // Генерация процедурной UV-текстуры для анимации вращения луны (как у планет)
  // Используем id звезды вместо координат, если координаты не предоставлены
  const starX = star.x || (star.id * 1000);
  const starY = star.y || (star.id * 1000);
  
  const uvTexture = generatePlanetUVTexture(
    starX, 
    starY, 
    planetId * 100 + moonIndex, // Уникальный ID луны
    moon.type, 
    Math.max(128, size), // Минимальное разрешение текстуры
    1.3 // Множитель ширины вращения для лун
  );
  
  // Сохраняем ссылку на UV-текстуру для анимации вращения
  moon._uvTexture = uvTexture;
  moon._rotationOffset = 0; // Текущее смещение вращения
  
  // Создаем начальный рендер луны с текстурой при вращении 0
  return renderMoonWithRotation(moon, centerX, centerY, moon.size, 0);
}

// Рендерит луну с определенным смещением вращения (аналогично рендерингу планеты)
export function renderMoonWithRotation(moon, centerX, centerY, moonSize, rotationOffset) {
  const canvas = document.createElement('canvas');
  const size = Math.ceil(moonSize * 2.5);
  canvas.width = size * 2;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d');
  
  if (!moon._uvTexture) return canvas;
  
  const uvTexture = moon._uvTexture;
  const textureWidth = uvTexture.width;
  const textureHeight = uvTexture.height;
  
  // Создаем круговую маску для луны
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, moonSize, 0, Math.PI * 2);
  ctx.clip();
  
  // Улучшенный расчет смещения текстуры с субпиксельной точностью
  const preciseOffsetX = (rotationOffset * textureWidth);
  const offsetX = Math.floor(preciseOffsetX) % textureWidth;
  const drawWidth = moonSize * 2;
  const drawHeight = moonSize * 2;
  
  // Отключаем сглаживание изображения для пиксельно-точного рендеринга
  ctx.imageSmoothingEnabled = false;
  
  // Рисуем UV-текстуру со смещением вращения (с оборачиванием)
  if (offsetX + drawWidth <= textureWidth) {
    // Оборачивание не требуется - одиночное рисование
    ctx.drawImage(
      uvTexture,
      offsetX, 0, drawWidth, drawHeight, // Исходная область
      centerX - moonSize, centerY - moonSize, drawWidth, drawHeight // Целевая область
    );
  } else {
    // Требуется оборачивание - рисуем в две части с улучшенной точностью
    const firstPartWidth = textureWidth - offsetX;
    const secondPartWidth = drawWidth - firstPartWidth;
    
    // Первая часть (правая сторона текстуры)
    ctx.drawImage(
      uvTexture,
      offsetX, 0, firstPartWidth, drawHeight, // Исходная область
      centerX - moonSize, centerY - moonSize, firstPartWidth, drawHeight // Целевая область
    );
    
    // Вторая часть (левая сторона текстуры) - бесшовно соединенная
    ctx.drawImage(
      uvTexture,
      0, 0, secondPartWidth, drawHeight, // Исходная область (обернутая часть)
      centerX - moonSize + firstPartWidth, centerY - moonSize, secondPartWidth, drawHeight // Целевая область
    );
  }
  
  // Включаем сглаживание для других элементов
  ctx.imageSmoothingEnabled = true;
  
  ctx.restore(); // Восстанавливаем обрезку
  
  // Добавляем реалистичный 3D-эффект освещения (такой же, как у планет)
  const lightingGradient = ctx.createRadialGradient(
    centerX - moonSize * 0.4, centerY - moonSize * 0.4, 0,
    centerX, centerY, moonSize
  );
  
  lightingGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');   // Яркая подсветка
  lightingGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');  // Постепенное затухание
  lightingGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');          // Нейтральный
  lightingGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');          // Тень
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, moonSize, 0, Math.PI * 2);
  ctx.fillStyle = lightingGradient;
  ctx.fill();
  
  // Добавляем согласованное атмосферное свечение для лун с атмосферой
  if (planetHasAtmosphere(moon.type)) {
    // Scale atmospheric halo based on moon size for consistent appearance
    // Use a proportional offset that scales with moon size, with minimum and maximum limits
    const atmosphereOffset = Math.max(2, Math.min(10, moonSize * 0.3));
    
    const atmosphereGradient = ctx.createRadialGradient(
      centerX, centerY, moonSize,
      centerX, centerY, moonSize + atmosphereOffset
    );
    
    const atmosphereColor = getAtmosphereColor(moon.type);
    
    atmosphereGradient.addColorStop(0, atmosphereColor);
    atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, moonSize + atmosphereOffset, 0, Math.PI * 2);
    ctx.fillStyle = atmosphereGradient;
    ctx.fill();
  }
  
  return canvas;
}

// Создает резервную текстуру луны (используется, если основная текстура не может быть создана)
export function createFallbackMoonTexture(moonSize, color) {
  const actualMoonSize = Math.floor(moonSize);
  const canvasSize = actualMoonSize * 2 + 1; // Всегда нечетный размер
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  
  // Центр теперь находится в целочисленных координатах
  const centerX = actualMoonSize;
  const centerY = actualMoonSize;
  
  // Создаем простую градиентную луну
  const gradient = ctx.createRadialGradient(
    centerX - actualMoonSize * 0.3, centerY - actualMoonSize * 0.3, 0,
    centerX, centerY, actualMoonSize
  );
  
  const baseColor = hexToRgb(color);
  const lightColor = `rgb(${Math.min(255, baseColor.r + 50)}, ${Math.min(255, baseColor.g + 50)}, ${Math.min(255, baseColor.b + 50)})`;
  const shadowColor = `rgb(${Math.max(0, baseColor.r - 30)}, ${Math.max(0, baseColor.g - 30)}, ${Math.max(0, baseColor.b - 30)})`;
  
  gradient.addColorStop(0, lightColor);
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, shadowColor);
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, actualMoonSize, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Добавляем согласованное атмосферное свечение для лун с атмосферой (fallback version)
  // For fallback textures, we'll use a simpler approach with less detailed atmospheric effect
  // This is just for consistency - the main rendering should use the full-featured version
  /*
  if (planetHasAtmosphere(moon.type)) {
    // Scale atmospheric halo based on moon size for consistent appearance
    // Use a proportional offset that scales with moon size, with minimum and maximum limits
    const atmosphereOffset = Math.max(2, Math.min(10, actualMoonSize * 0.3));
    
    const atmosphereGradient = ctx.createRadialGradient(
      centerX, centerY, actualMoonSize,
      centerX, centerY, actualMoonSize + atmosphereOffset
    );
    
    const atmosphereColor = getAtmosphereColor(moon.type);
    
    atmosphereGradient.addColorStop(0, atmosphereColor);
    atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, actualMoonSize + atmosphereOffset, 0, Math.PI * 2);
    ctx.fillStyle = atmosphereGradient;
    ctx.fill();
  }
  */
  
  console.log(`Created fallback texture for moon size ${moonSize}, canvas ${canvasSize}x${canvasSize}`);
  return canvas;
}

// Генерирует детализированную текстурированную битмап-луну, используя ту же систему, что и планеты, с вращением
export function renderDetailMoonWithRotation(moon, moonSize, moonIndex, planetId, rotationOffset) {
  // Обеспечиваем целочисленный радиус луны и нечетный размер холста для правильного центрирования
  const actualMoonSize = Math.floor(moonSize);
  const canvasSize = actualMoonSize * 2 + 1; // Всегда нечетный размер
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  
  // Центр теперь находится в целочисленных координатах
  const centerX = actualMoonSize;
  const centerY = actualMoonSize;
  
  if (!moon._detailUVTexture) return canvas;
  
  const detailTexture = moon._detailUVTexture;
  
  // Создаем круговую маску для луны
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, actualMoonSize, 0, Math.PI * 2);
  ctx.clip();
  
  // Улучшенный расчет смещения текстуры с субпиксельной точностью
  const preciseOffsetX = (rotationOffset * detailTexture.width);
  const offsetX = Math.floor(preciseOffsetX) % detailTexture.width;
  const drawWidth = actualMoonSize * 2;
  const drawHeight = actualMoonSize * 2;
  
  // Отключаем сглаживание изображения для пиксельно-точного рендеринга
  ctx.imageSmoothingEnabled = false;
  
  // Рисуем UV-текстуру со смещением вращения (с оборачиванием)
  if (offsetX + drawWidth <= detailTexture.width) {
    // Оборачивание не требуется - одиночное рисование
    ctx.drawImage(
      detailTexture,
      offsetX, 0, drawWidth, drawHeight, // Исходная область
      centerX - actualMoonSize, centerY - actualMoonSize, drawWidth, drawHeight // Целевая область
    );
  } else {
    // Требуется оборачивание - рисуем в две части с улучшенной точностью
    const firstPartWidth = detailTexture.width - offsetX;
    const secondPartWidth = drawWidth - firstPartWidth;
    
    // Первая часть (правая сторона текстуры)
    ctx.drawImage(
      detailTexture,
      offsetX, 0, firstPartWidth, drawHeight, // Исходная область
      centerX - actualMoonSize, centerY - actualMoonSize, firstPartWidth, drawHeight // Целевая область
    );
    
    // Вторая часть (левая сторона текстуры) - бесшовно соединенная
    ctx.drawImage(
      detailTexture,
      0, 0, secondPartWidth, drawHeight, // Исходная область (обернутая часть)
      centerX - actualMoonSize + firstPartWidth, centerY - actualMoonSize, secondPartWidth, drawHeight // Целевая область
    );
  }
  
  // Включаем сглаживание для других элементов
  ctx.imageSmoothingEnabled = true;
  
  ctx.restore(); // Восстанавливаем обрезку
  
  // Добавляем реалистичный 3D-эффект освещения (такой же, как у планет)
  const lightingGradient = ctx.createRadialGradient(
    centerX - actualMoonSize * 0.4, centerY - actualMoonSize * 0.4, 0,
    centerX, centerY, actualMoonSize
  );
  
  lightingGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');   // Яркая подсветка
  lightingGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');  // Постепенное затухание
  lightingGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');          // Нейтральный
  lightingGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');          // Тень
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, actualMoonSize, 0, Math.PI * 2);
  ctx.fillStyle = lightingGradient;
  ctx.fill();
  
  // Добавляем согласованное атмосферное свечение для лун с атмосферой
  if (planetHasAtmosphere(moon.type)) {
    // Scale atmospheric halo based on moon size for consistent appearance
    // Use a proportional offset that scales with moon size, with minimum and maximum limits
    const atmosphereOffset = Math.max(2, Math.min(10, actualMoonSize * 0.3));
    
    const atmosphereGradient = ctx.createRadialGradient(
      centerX, centerY, actualMoonSize,
      centerX, centerY, actualMoonSize + atmosphereOffset
    );
    
    const atmosphereColor = getAtmosphereColor(moon.type);
    
    atmosphereGradient.addColorStop(0, atmosphereColor);
    atmosphereGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, actualMoonSize + atmosphereOffset, 0, Math.PI * 2);
    ctx.fillStyle = atmosphereGradient;
    ctx.fill();
  }
  
  console.log(`Moon ${moonIndex}: Generated rotating ${moon.type} texture with planetary system`);
  
  return canvas;
}

// Вспомогательная функция для получения высоты поверхности в любой точке
export function getSurfaceHeight(x, y, centerX, centerY, moonRadius, craters, seed) {
  const dx = x - centerX;
  const dy = y - centerY;
  const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  if (distanceFromCenter > moonRadius) return 0;
  
  // Базовый шум с использованием сидированного рандома для согласованности
  let pixelSeed = seed + x * 1000 + y;
  
  // Базовая высота поверхности
  let height = 0.8;
  
  // Добавляем кратеры, если они есть
  if (craters && craters.length > 0) {
    for (const crater of craters) {
      const craterDx = x - crater.x;
      const craterDy = y - crater.y;
      const distToCrater = Math.sqrt(craterDx * craterDx + craterDy * craterDy);
      
      // Если точка находится внутри кратера
      if (distToCrater < crater.radius) {
        // Нормализованное расстояние от центра кратера (0 в центре, 1 на краю)
        const normalizedDist = distToCrater / crater.radius;
        
        // Форма кратера: глубже в центре, приподнятые края
        const craterDepth = (1 - Math.pow(normalizedDist, 0.5)) * crater.depth;
        
        // Вычитаем глубину кратера из высоты поверхности
        height -= craterDepth;
      }
    }
  }
  
  return Math.max(0, Math.min(1, height));
}