import { gameConfig } from '../config/gameConfig.js';
import { generateStarName } from './utils.js';
import { generatePlanetarySystem, getRandomSpectralType } from './planetGenerator.js';

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cross(p1, p2, p3) {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

function segmentsIntersect(a, b, c, d) {
  if (!a || !b || !c || !d) return false;
  const ab = cross(a, b, c) * cross(a, b, d);
  const cd = cross(c, d, a) * cross(c, d, b);
  return ab < 0 && cd < 0;
}

function connectionIntersectsExisting(i, j, stars) {
  const a = stars[i];
  const b = stars[j];
  for (const star of stars) {
    for (const neighborId of star.connections) {
      if (
        (star.id === i && neighborId === j) ||
        (star.id === j && neighborId === i)
      ) continue;

      const c = stars[star.id];
      const d = stars[neighborId];

      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function pickLinkCount(chances) {
  const rnd = Math.random();
  let acc = 0;
  for (const [countStr, weight] of Object.entries(chances)) {
    acc += weight;
    if (rnd < acc) return parseInt(countStr);
  }
  return 1;
}

export function generateGalaxyMap() {
  const {
    starCount,
    mapSize,
    minStarDistance,
    coreRadius,
    innerRadius,
    outerRadius,
    densityPower,
    maxLinksPerStar,
    linkRadius,
    corridorChances,
  } = gameConfig.galaxy;

  const centerX = mapSize.width / 2;
  const centerY = mapSize.height / 2;
  const stars = [];

  // First, generate player's starting star in a good location
  const playerStartR = (innerRadius + coreRadius) / 2; // Middle zone
  const playerStartAngle = Math.random() * 2 * Math.PI;
  const playerStartX = centerX + playerStartR * Math.cos(playerStartAngle);
  const playerStartY = centerY + playerStartR * Math.sin(playerStartAngle);
  
  const playerStartName = generateStarName();
  const playerStartStar = {
    id: 0,
    x: playerStartX,
    y: playerStartY,
    connections: [],
    owner: gameConfig.player.id,
    name: playerStartName,
    planets: generatePlanetarySystem(playerStartName, playerStartX, playerStartY),
    spectralType: 'G', // Sun-like star for player
    explored: true
  };
  
  stars.push(playerStartStar);
  gameConfig.player.startingSystemId = 0;
  console.log('Player starting system ID:', gameConfig.player.startingSystemId); // ADDED
  gameConfig.exploration.exploredSystems.add(0);

  // Generate remaining stars
  while (stars.length < starCount) {
    const r = Math.sqrt(randomBetween(innerRadius ** 2, outerRadius ** 2));
    const angle = Math.random() * 2 * Math.PI;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    const normalized = Math.abs(r - coreRadius) / (outerRadius - innerRadius);
    const densityFactor = 1 - Math.pow(normalized, densityPower);
    
    if (Math.random() > densityFactor) continue;
    
    const tooClose = stars.some(s => distance(s, { x, y }) < minStarDistance);
    if (tooClose) continue;
    
    const starName = generateStarName();
    
    stars.push({
      id: stars.length,
      x,
      y,
      connections: [],
      owner: null,
      name: starName,
      planets: generatePlanetarySystem(starName, x, y),
      spectralType: getRandomSpectralType(),
      explored: true // All other stars are unexplored
    });
  }

  // Минимальное связующее дерево (гарантирует связность)
  const connected = new Set();
  connected.add(0); // Начинаем с первой звезды
  
  while (connected.size < stars.length) {
    let closestEdge = null;
    let minDist = Infinity;
    
    connected.forEach(i => {
      stars.forEach((jStar, j) => {
        if (!connected.has(j)) {
          const dist = distance(stars[i], jStar);
          if (dist < minDist) {
            minDist = dist;
            closestEdge = [i, j];
          }
        }
      });
    });
    
    if (closestEdge) {
      const [i, j] = closestEdge;
      stars[i].connections.push(j);
      stars[j].connections.push(i);
      connected.add(j);
    }
  }

  // Добавление дополнительных связей
  stars.forEach(star => {
    const targetLinks = pickLinkCount(corridorChances);
    if (star.connections.length >= targetLinks) return;
    
    const neighbors = stars
      .filter(other => 
        other.id !== star.id &&
        !star.connections.includes(other.id) &&
        other.connections.length < maxLinksPerStar
      )
      .map(other => ({
        id: other.id,
        dist: distance(star, other),
      }))
      .filter(n => n.dist <= linkRadius)
      .sort((a, b) => a.dist - b.dist);

    for (const neighbor of neighbors) {
      if (star.connections.length >= targetLinks) break;
      
      const other = stars[neighbor.id];
      if (connectionIntersectsExisting(star.id, other.id, stars)) continue;
      
      star.connections.push(other.id);
      other.connections.push(star.id);
    }
  });

  return stars;
}
