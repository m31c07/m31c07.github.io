import { gameConfig } from '../config/gameConfig.js';
import { generateStarName, getRandomSpectralType } from './utils.js';
import { generatePlanetarySystem } from './planetGenerator.js';

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distance2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
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
  const playerSystemSeed = ((Math.floor(playerStartX * 1000) * 31 + Math.floor(playerStartY * 1000) * 17) >>> 0);
  const playerStartStar = {
    id: 0,
    x: playerStartX,
    y: playerStartY,
    connections: [],
    owner: gameConfig.player.id,
    name: playerStartName,
    planets: null,
    systemSeed: playerSystemSeed,
    spectralType: 'G', // Sun-like star for player
    explored: true
  };
  // Generate player's starting planetary system immediately so we can assign development levels
  try {
    playerStartStar.planets = generatePlanetarySystem(playerStartName, playerStartX, playerStartY, playerSystemSeed);
  } catch (e) {
    console.warn('Failed to generate starting planetary system:', e);
    playerStartStar.planets = playerStartStar.planets || { planets: [] };
  }
  // Назначаем разную степень урбанизации (0..0.2) планетам и лунам в стартовой системе
  try {
    const planetsArr = playerStartStar?.planets?.planets || [];
    planetsArr.forEach((planet, pIndex) => {
      const base = (pIndex + 1) / (planetsArr.length + 1);
      const jitter = Math.random() * 0.2;
      const devLevel = Math.max(0, Math.min(0.2, base * 0.2 * 0.7 + jitter * 0.3));
      planet.developmentLevel = Number(devLevel.toFixed(3));
      if (Array.isArray(planet.moons)) {
        planet.moons.forEach((moon, mIndex) => {
          const mBase = (mIndex + 1) / (planet.moons.length + 1);
          const mJitter = Math.random() * 0.2;
          const mDev = Math.max(0, Math.min(0.2, mBase * 0.2 * 0.6 + mJitter * 0.4));
          moon.developmentLevel = Number(mDev.toFixed(3));
        });
      }
    });
  } catch (e) {
    console.warn('Failed to assign development levels to starting system:', e);
  }
  
  stars.push(playerStartStar);
  gameConfig.player.startingSystemId = 0;
  console.log('Player starting system ID:', gameConfig.player.startingSystemId);
  gameConfig.exploration.exploredSystems.add(0);

  const cellSize = minStarDistance / Math.SQRT2;
  const gridCols = Math.max(1, Math.ceil(mapSize.width / cellSize));
  const gridRows = Math.max(1, Math.ceil(mapSize.height / cellSize));
  const grid = new Map();

  // Coarser grid for fast corridor (link) neighbor queries
  const linkCellSize = Math.max(1, linkRadius);
  const linkGridCols = Math.max(1, Math.ceil(mapSize.width / linkCellSize));
  const linkGridRows = Math.max(1, Math.ceil(mapSize.height / linkCellSize));
  const linkGrid = new Map();

  function cellIndexFor(x, y) {
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    if (ci < 0 || ci >= gridCols || cj < 0 || cj >= gridRows) return -1;
    return cj * gridCols + ci;
  }

  function linkCellIndexFor(x, y) {
    const ci = Math.floor(x / linkCellSize);
    const cj = Math.floor(y / linkCellSize);
    if (ci < 0 || ci >= linkGridCols || cj < 0 || cj >= linkGridRows) return -1;
    return cj * linkGridCols + ci;
  }

  function gridAdd(idx, x, y) {
    const ci = cellIndexFor(x, y);
    if (ci < 0) return;
    let arr = grid.get(ci);
    if (!arr) {
      arr = [];
      grid.set(ci, arr);
    }
    arr.push(idx);
  }

  function linkGridAdd(idx, x, y) {
    const ci = linkCellIndexFor(x, y);
    if (ci < 0) return;
    let arr = linkGrid.get(ci);
    if (!arr) {
      arr = [];
      linkGrid.set(ci, arr);
    }
    arr.push(idx);
  }

  function gridNeighbors(x, y, r) {
    const cr = Math.ceil(r / cellSize);
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    const res = [];
    for (let di = -cr; di <= cr; di++) {
      const i = ci + di;
      if (i < 0 || i >= gridCols) continue;
      for (let dj = -cr; dj <= cr; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= gridRows) continue;
        const arr = grid.get(j * gridCols + i);
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) res.push(arr[k]);
      }
    }
    return res;
  }

  function linkNeighbors(x, y, r) {
    const cr = Math.ceil(r / linkCellSize);
    const ci = Math.floor(x / linkCellSize);
    const cj = Math.floor(y / linkCellSize);
    const res = [];
    for (let di = -cr; di <= cr; di++) {
      const i = ci + di;
      if (i < 0 || i >= linkGridCols) continue;
      for (let dj = -cr; dj <= cr; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= linkGridRows) continue;
        const arr = linkGrid.get(j * linkGridCols + i);
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) res.push(arr[k]);
      }
    }
    return res;
  }

  function inRing(x, y) {
    const dx = x - centerX;
    const dy = y - centerY;
    const r = Math.hypot(dx, dy);
    return r >= innerRadius && r <= outerRadius;
  }

  function densityAccept(x, y) {
    const r = Math.hypot(x - centerX, y - centerY);
    const normalized = Math.abs(r - coreRadius) / (outerRadius - innerRadius);
    const densityFactor = 1 - Math.pow(normalized, densityPower);
    return Math.random() <= densityFactor;
  }

  function tooCloseToExisting(x, y) {
    const neighborsIdx = gridNeighbors(x, y, minStarDistance);
    for (let q = 0; q < neighborsIdx.length; q++) {
      const s = stars[neighborsIdx[q]];
      if (distance2(s, { x, y }) < (minStarDistance * minStarDistance)) return true;
    }
    return false;
  }

  function addStar(x, y) {
    const starName = generateStarName();
    const seed = ((Math.floor(x * 1000) * 31 + Math.floor(y * 1000) * 17 + stars.length * 7) >>> 0);
    const starObj = {
      id: stars.length,
      x,
      y,
      connections: [],
      owner: null,
      name: starName,
      planets: null,
      systemSeed: seed,
      spectralType: getRandomSpectralType(seed),
      explored: true
    };
    stars.push(starObj);
    gridAdd(starObj.id, x, y);
    linkGridAdd(starObj.id, x, y);
    return starObj.id;
  }

  const active = [];
  gridAdd(0, playerStartX, playerStartY);
  linkGridAdd(0, playerStartX, playerStartY);
  active.push(0);

  const kAttempts = 20;

  function randomSampleInRing() {
    const r = Math.sqrt(randomBetween(innerRadius ** 2, outerRadius ** 2));
    const angle = Math.random() * 2 * Math.PI;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    return { x, y };
  }

  function candidateAround(x0, y0) {
    const ang = Math.random() * 2 * Math.PI;
    const rad = minStarDistance * (1 + Math.random());
    const x = x0 + Math.cos(ang) * rad;
    const y = y0 + Math.sin(ang) * rad;
    return { x, y };
  }

  while (stars.length < starCount) {
    if (active.length === 0) {
      const p = randomSampleInRing();
      if (!densityAccept(p.x, p.y)) continue;
      if (tooCloseToExisting(p.x, p.y)) continue;
      const id = addStar(p.x, p.y);
      active.push(id);
      continue;
    }
    const ai = Math.floor(Math.random() * active.length);
    const baseIdx = active[ai];
    const base = stars[baseIdx];
    let placed = false;
    for (let t = 0; t < kAttempts; t++) {
      const c = candidateAround(base.x, base.y);
      if (!inRing(c.x, c.y)) continue;
      if (!densityAccept(c.x, c.y)) continue;
      if (tooCloseToExisting(c.x, c.y)) continue;
      const id = addStar(c.x, c.y);
      active.push(id);
      placed = true;
      break;
    }
    if (!placed) {
      active.splice(ai, 1);
    }
  }

  stars.forEach(star => {
    const targetLinks = Math.min(pickLinkCount(corridorChances), maxLinksPerStar);
    if (star.connections.length >= targetLinks) return;
    const neighborsIdx = linkNeighbors(star.x, star.y, linkRadius);
    const best = [];
    const sectors = 8;
    const usedSectors = new Set();
    function sectorIndex(ax, ay, bx, by) {
      const ang = Math.atan2(by - ay, bx - ax);
      const norm = ang < 0 ? ang + 2 * Math.PI : ang;
      return Math.floor(norm / (2 * Math.PI / sectors));
    }
    function crossesExisting(i, j) {
      const a = stars[i];
      const b = stars[j];
      for (const nid of a.connections) {
        if (nid === j) continue;
        const c = stars[i];
        const d = stars[nid];
        if (segmentsIntersect(a, b, c, d)) return true;
      }
      for (const nid of b.connections) {
        if (nid === i) continue;
        const c = stars[j];
        const d = stars[nid];
        if (segmentsIntersect(a, b, c, d)) return true;
      }
      return false;
    }
    const linkRadius2 = linkRadius * linkRadius;
    for (let q = 0; q < neighborsIdx.length; q++) {
      const otherId = neighborsIdx[q];
      if (otherId === star.id) continue;
      if (star.connections.includes(otherId)) continue;
      const other = stars[otherId];
      if (!other || other.connections.length >= maxLinksPerStar) continue;
      const d2 = distance2(star, other);
      if (d2 > linkRadius2) continue;
      if (best.length < targetLinks) {
        best.push({ id: otherId, dist2: d2 });
        if (best.length === targetLinks) best.sort((a, b) => a.dist2 - b.dist2);
      } else if (d2 < best[best.length - 1].dist2) {
        let pos = best.length - 1;
        while (pos > 0 && best[pos - 1].dist2 > d2) pos--;
        best.splice(pos, 0, { id: otherId, dist2: d2 });
        best.pop();
      }
    }
    for (let i = 0; i < best.length; i++) {
      if (star.connections.length >= targetLinks) break;
      const nid = best[i].id;
      const other = stars[nid];
      if (!other || other.connections.length >= maxLinksPerStar) continue;
      const sec = sectorIndex(star.x, star.y, other.x, other.y);
      if (usedSectors.has(sec)) continue;
      if (crossesExisting(star.id, nid)) continue;
      usedSectors.add(sec);
      star.connections.push(nid);
      other.connections.push(star.id);
    }
  });

  return stars;
}
