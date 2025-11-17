import { generateGalaxyMap } from './utils/mapGenerator.js';
import { renderGalaxy } from './ui/GalaxyView.js';
import { renderStarSystem } from './ui/StarSystemView.js';
import { gameConfig } from './config/gameConfig.js';
import { ExplorationSystem } from './utils/utils.js';
import { FleetManager } from './utils/fleetManager.js';
import { renderPlanetScreen, renderMoonScreen } from './ui/PlanetView.js';
import { clearPlanetTextureCache } from './utils/proceduralTextures.js';
import { updateBreadcrumbs } from './ui/Breadcrumbs.js';
import { initSpeedControls } from './ui/SpeedControls.js';
import { generatePlanetarySystem } from './utils/planetGenerator.js';

const canvas = document.getElementById('galaxy');
let stars = generateGalaxyMap();
let explorationSystem = new ExplorationSystem(stars);

// Create fleetManager AFTER stars are generated and startingSystemId is set
let fleetManager = new FleetManager(stars);
let stopGalaxyRender = null;
let stopSystemRender = null;
let stopPlanetRender = null;
let stopMoonRender = null;

// Make fleetManager globally accessible for ship UI
window.fleetManager = fleetManager;
window.explorationSystem = explorationSystem;

// Set initial camera position after galaxy generation and fleet initialization
// Zoom 300% and center on player's starting system
try {
  gameConfig.ui.galaxyCamera.scale = 3.0;
  const startId = (gameConfig.player?.startingSystemId ?? 0);
  const startStar = stars[startId];
  setGalaxyCamMiddle(startStar);
} catch (e) {
  console.warn('Failed to set initial galaxy camera:', e);
  setGalaxyCamMiddle();
}

function clearUI() {
  document.querySelectorAll('button').forEach(b => b.remove());
}

function setGalaxyCamMiddle(focusStar = null) {
    const scale = gameConfig.ui.galaxyCamera.scale || 1;

    // If a specific star is provided, center on it
    if (focusStar && typeof focusStar.x === 'number' && typeof focusStar.y === 'number') {
        gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - focusStar.x * scale;
        gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - focusStar.y * scale;
        return;
    }

    // If we have a remembered current star id, try centering on it
    if (gameConfig.ui.currentStarId !== null) {
        const currentStar = stars[gameConfig.ui.currentStarId];
        if (currentStar) {
            gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - currentStar.x * scale;
            gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - currentStar.y * scale;
            return;
        }
    }

    // Center camera on player's starting system if available and exists
    if (gameConfig.player.startingSystemId !== null) {
        const playerStar = stars[gameConfig.player.startingSystemId];
        if (playerStar) {
            gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - playerStar.x * scale;
            gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - playerStar.y * scale;
            return;
        }
    }
    
    // Fallback to galaxy center - ensure we have valid mapSize
    const mapWidth = gameConfig.galaxy.mapSize?.width || 1000;
    const mapHeight = gameConfig.galaxy.mapSize?.height || 1000;
    
    gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - mapWidth/2 * scale;
    gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - mapHeight/2 * scale;
}

function setStarsystemCamMiddle() {
    gameConfig.ui.starsystemCamera.offsetX = window.innerWidth/2 - canvas.width/2 * gameConfig.ui.starsystemCamera.scale;
    gameConfig.ui.starsystemCamera.offsetY =  window.innerHeight/2 - canvas.height/2 * gameConfig.ui.starsystemCamera.scale;
}

function setPlanetCamMiddle() {
    gameConfig.ui.planetCamera.offsetX = window.innerWidth/2 - canvas.width/2 * gameConfig.ui.planetCamera.scale;
    gameConfig.ui.planetCamera.offsetY =  window.innerHeight/2 - canvas.height/2 * gameConfig.ui.planetCamera.scale;
}

function setSatelliteCamMiddle() {
    gameConfig.ui.satelliteCamera.offsetX = window.innerWidth/2 - canvas.width/2 * gameConfig.ui.satelliteCamera.scale;
    gameConfig.ui.satelliteCamera.offsetY =  window.innerHeight/2 - canvas.height/2 * gameConfig.ui.satelliteCamera.scale;
}

// Disable pinch-zoom gestures
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

document.addEventListener('touchmove', function (e) {
  if (e.scale !== undefined && e.scale !== 1) {
    e.preventDefault();
  }
}, { passive: false });

function cleanupAllRenders() {
  if (stopGalaxyRender) { stopGalaxyRender(); stopGalaxyRender = null; }
  if (stopSystemRender) { stopSystemRender(); stopSystemRender = null; }
  if (stopPlanetRender) { stopPlanetRender(); stopPlanetRender = null; }
  if (stopMoonRender) { stopMoonRender(); stopMoonRender = null; }
}

function showGalaxy(focusStar = null) {
  clearUI();
  gameConfig.ui.currentView = 'galaxy';
  gameConfig.ui.currentStarId = null;
  gameConfig.ui.currentPlanetIndex = null;
  gameConfig.ui.currentMoonIndex = null;
  // Update breadcrumbs: only Galaxy is active
  updateBreadcrumbs({ onGalaxy: () => showGalaxy() });
  initSpeedControls();
  
  // Stop other render loops
  cleanupAllRenders();

  // Clear procedural planet texture cache when returning to galaxy
  try { clearPlanetTextureCache(); } catch (e) { console.error('Error clearing planet texture cache:', e); }
  
  // Clear canvas using WebGL renderer
  try {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  } catch (e) {
    console.error('Error clearing canvas:', e);
  }
  
  setGalaxyCamMiddle(focusStar);
  
  const galaxyRenderResult = renderGalaxy(canvas, stars, explorationSystem, fleetManager, showStarSystem);
  if (typeof galaxyRenderResult === 'function') {
    stopGalaxyRender = galaxyRenderResult;
  } else if (galaxyRenderResult && typeof galaxyRenderResult.cleanup === 'function') {
    stopGalaxyRender = galaxyRenderResult.cleanup;
  } else {
    stopGalaxyRender = null;
    console.warn('renderGalaxy did not return a cleanup function');
  }
}

function showStarSystem(star) {
  clearUI();
  gameConfig.ui.currentView = 'starsystem';
  gameConfig.ui.currentStarId = star?.id ?? null;
  gameConfig.ui.currentPlanetIndex = null;
  gameConfig.ui.currentMoonIndex = null;
  setStarsystemCamMiddle();

  // Update breadcrumbs: Galaxy > Star
  updateBreadcrumbs({
    star,
    onGalaxy: () => showGalaxy(star),
    onStar: () => showStarSystem(star),
    // Allow selecting planets from star dropdown
    onPlanetIndex: (pIndex) => {
      const p = star?.planets?.planets?.[pIndex];
      if (!p) return;
      showPlanet(star, p, pIndex);
    }
  });
  initSpeedControls();

  cleanupAllRenders();

  // Clear canvas using WebGL renderer
  try {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  } catch (e) {
    console.error('Error clearing canvas:', e);
  }
  
  if (!star.planets) {
    star.planets = generatePlanetarySystem(star.name, star.x, star.y, star.systemSeed);
  }

  const returnToGalaxy = () => showGalaxy(star);
  stopSystemRender = renderStarSystem(
    canvas,
    star,
    explorationSystem,
    returnToGalaxy,
    // onPlanetClick
    (planet, planetIndex) => showPlanet(star, planet, planetIndex),
    // onMoonClick
    (planet, planetIndex, moon, moonIndex) => showSatellite(star, planet, planetIndex, moon, moonIndex)
  );
}

function showPlanet(star, planet, planetIndex) {
  clearUI();
  gameConfig.ui.currentView = 'planet';
  gameConfig.ui.currentStarId = star?.id ?? null;
  gameConfig.ui.currentPlanetIndex = planetIndex ?? null;
  gameConfig.ui.currentMoonIndex = null;
  setPlanetCamMiddle();

  // Update breadcrumbs: Galaxy > Star > Planet
  updateBreadcrumbs({
    star,
    planetIndex,
    onGalaxy: () => showGalaxy(star),
    onStar: () => showStarSystem(star),
    onPlanet: () => showPlanet(star, planet, planetIndex),
    // Allow selecting planets from star dropdown
    onPlanetIndex: (pIndex) => {
      const p = star?.planets?.planets?.[pIndex];
      if (!p) return;
      showPlanet(star, p, pIndex);
    },
    // Allow selecting moons from planet dropdown
    onMoonIndex: (mIndex) => {
      const m = planet?.moons?.[mIndex];
      if (!m) return;
      showSatellite(star, planet, planetIndex, m, mIndex);
    }
  });
  initSpeedControls();

  cleanupAllRenders();

  stopPlanetRender = renderPlanetScreen(
    canvas,
    star,
    planet,
    planetIndex, // Передаем planetIndex
    // onGalaxy
    () => showGalaxy(star),
    // onSystem
    () => showStarSystem(star),
    // onPlanet self
    () => showPlanet(star, planet, planetIndex),
    // onOpenMoon
    (moon, moonIndex) => showSatellite(star, planet, planetIndex, moon, moonIndex)
  );
}

function showSatellite(star, planet, planetIndex, moon, moonIndex) {
  clearUI();
  gameConfig.ui.currentView = 'satellite';
  gameConfig.ui.currentStarId = star?.id ?? null;
  gameConfig.ui.currentPlanetIndex = planetIndex ?? null;
  gameConfig.ui.currentMoonIndex = moonIndex ?? null;
  setSatelliteCamMiddle();

  // Update breadcrumbs: Galaxy > Star > Planet > Moon
  updateBreadcrumbs({
    star,
    planetIndex,
    moonIndex,
    onGalaxy: () => showGalaxy(star),
    onStar: () => showStarSystem(star),
    onPlanet: () => showPlanet(star, planet, planetIndex),
    onMoon: () => showSatellite(star, planet, planetIndex, moon, moonIndex),
    // Allow selecting planets from star dropdown
    onPlanetIndex: (pIndex) => {
      const p = star?.planets?.planets?.[pIndex];
      if (!p) return;
      showPlanet(star, p, pIndex);
    },
    // Allow selecting moons from planet dropdown
    onMoonIndex: (mIndex) => {
      const m = planet?.moons?.[mIndex];
      if (!m) return;
      showSatellite(star, planet, planetIndex, m, mIndex);
    }
  });
  initSpeedControls();

  cleanupAllRenders();

  stopMoonRender = renderMoonScreen(
    canvas,
    star,
    planet,
    planetIndex, // Передаем planetIndex
    moon,
    moonIndex, // Передаем moonIndex
    // onGalaxy
    () => showGalaxy(star),
    // onSystem
    () => showStarSystem(star),
    // onPlanet
    () => showPlanet(star, planet, planetIndex)
  );
}

// Initial
setStarsystemCamMiddle();
showGalaxy();
