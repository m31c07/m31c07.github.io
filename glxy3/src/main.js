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
setGalaxyCamMiddle();

function clearUI() {
  document.querySelectorAll('button').forEach(b => b.remove());
}

function setGalaxyCamMiddle() {
    // Center camera on player's starting system if available and exists
    if (gameConfig.player.startingSystemId !== null) {
        const playerStar = stars[gameConfig.player.startingSystemId];
        if (playerStar) {
            gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - playerStar.x * gameConfig.ui.galaxyCamera.scale;
            gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - playerStar.y * gameConfig.ui.galaxyCamera.scale;
            return;
        }
    }
    
    // Fallback to galaxy center - ensure we have valid mapSize
    const mapWidth = gameConfig.galaxy.mapSize?.width || 1000;
    const mapHeight = gameConfig.galaxy.mapSize?.height || 1000;
    const scale = gameConfig.ui.galaxyCamera.scale || 1;
    
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

function showGalaxy() {
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
  
  setGalaxyCamMiddle();
  
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
    onGalaxy: () => showGalaxy(),
    onStar: () => showStarSystem(star)
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
  
  stopSystemRender = renderStarSystem(
    canvas,
    star,
    explorationSystem,
    showGalaxy,
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
    onGalaxy: () => showGalaxy(),
    onStar: () => showStarSystem(star),
    onPlanet: () => showPlanet(star, planet, planetIndex)
  });
  initSpeedControls();

  cleanupAllRenders();

  stopPlanetRender = renderPlanetScreen(
    canvas,
    star,
    planet,
    planetIndex, // Передаем planetIndex
    // onGalaxy
    () => showGalaxy(),
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
    onGalaxy: () => showGalaxy(),
    onStar: () => showStarSystem(star),
    onPlanet: () => showPlanet(star, planet, planetIndex),
    onMoon: () => showSatellite(star, planet, planetIndex, moon, moonIndex)
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
    () => showGalaxy(),
    // onSystem
    () => showStarSystem(star),
    // onPlanet
    () => showPlanet(star, planet, planetIndex)
  );
}

// Initial
setStarsystemCamMiddle();
showGalaxy();
