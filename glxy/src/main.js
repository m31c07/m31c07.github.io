import { generateGalaxyMap } from './utils/mapGenerator.js';
import { renderGalaxy } from './ui/GalaxyView.js';
import { renderStarSystem } from './ui/StarSystemView.js';
import { gameConfig } from './config/gameConfig.js';
import { ExplorationSystem } from './utils/explorationSystem.js';
import { FleetManager } from './utils/fleetManager.js';

const canvas = document.getElementById('galaxy');
let stars = generateGalaxyMap();
let explorationSystem = new ExplorationSystem(stars);
let fleetManager = new FleetManager(stars);
let stopGalaxyRender = null;
let stopSystemRender = null;

// Make fleetManager globally accessible for ship UI
window.fleetManager = fleetManager;
window.explorationSystem = explorationSystem;

// Set initial camera position after galaxy generation and fleet initialization
setGalaxyCamMiddle();

// Debug: Check if scout was created
console.log('Starting system ID:', gameConfig.player.startingSystemId);
console.log('Fleet at starting system:', fleetManager.getFleetAtSystem(gameConfig.player.startingSystemId));
console.log('Scout config:', gameConfig.player.scout);

// Сохраняем параметры камеры при переходах
// let cameraState = {
  // offsetX: null,
  // offsetY: null,
  // scale: null,
// };

function clearUI() {
  document.querySelectorAll('button').forEach(b => b.remove());
}
    
  // console.log("kek main", gameConfig.galaxy.mapSize);
  // console.log("kek main", gameConfig.galaxy.mapSize.width);
  // console.log("kek main", gameConfig.galaxy.mapSize.height);
  console.log("kek main", window.innerWidth, window.innerHeight);

// gameConfig.ui.galaxyCamera.offsetX = (canvas.width - gameConfig.galaxy.mapSize.width)/2 * gameConfig.ui.galaxyCamera.scale + window.innerWidth/2;
// gameConfig.ui.galaxyCamera.offsetY = (canvas.height - gameConfig.galaxy.mapSize.height)/2 * gameConfig.ui.galaxyCamera.scale + window.innerHeight/2;

function setGalaxyCamMiddle() {
    // Center camera on player's starting system if available
    if (gameConfig.player.startingSystemId !== null) {
        const playerStar = stars[gameConfig.player.startingSystemId];
        if (playerStar) {
            gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - playerStar.x * gameConfig.ui.galaxyCamera.scale;
            gameConfig.ui.galaxyCamera.offsetY = window.innerHeight/2 - playerStar.y * gameConfig.ui.galaxyCamera.scale;
            return;
        }
    }
    
    // Fallback to galaxy center
    gameConfig.ui.galaxyCamera.offsetX = window.innerWidth/2 - gameConfig.galaxy.mapSize.width/2 * gameConfig.ui.galaxyCamera.scale;
    gameConfig.ui.galaxyCamera.offsetY =  window.innerHeight/2 - gameConfig.galaxy.mapSize.height/2 * gameConfig.ui.galaxyCamera.scale;
}

function setStarsystemCamMiddle() {
    gameConfig.ui.starsystemCamera.offsetX = window.innerWidth/2 - canvas.width/2 * gameConfig.ui.starsystemCamera.scale;
    gameConfig.ui.starsystemCamera.offsetY =  window.innerHeight/2 - canvas.height/2 * gameConfig.ui.starsystemCamera.scale;

    // console.log("kek main", gameConfig.ui.galaxyCamera.offsetX, gameConfig.ui.galaxyCamera.offsetY);
}

// Отключение пинч-зума Safari
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

// Также можно отключить масштабирование при touchmove
document.addEventListener('touchmove', function (e) {
  if (e.scale !== undefined && e.scale !== 1) {
    e.preventDefault();
  }
}, { passive: false });



function showGalaxy() {
  clearUI();

  if (gameConfig.ui.currentView === 'galaxy') return;
  gameConfig.ui.currentView = 'galaxy';
  
  // Stop system rendering if active
  if (stopSystemRender) {
    stopSystemRender();
    stopSystemRender = null;
  }
  
  // Stop any existing galaxy rendering
  if (stopGalaxyRender) {
    stopGalaxyRender();
  }
  
  // Clear canvas before starting galaxy view
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Re-center camera on starting system when returning to galaxy
  setGalaxyCamMiddle();
  
  // Start galaxy rendering
  stopGalaxyRender = renderGalaxy(canvas, stars, explorationSystem, fleetManager, showStarSystem);
}

function showStarSystem(star) {
  clearUI();
  setStarsystemCamMiddle();

  gameConfig.ui.currentView = 'starsystem';
  // Stop galaxy rendering
  if (stopGalaxyRender) {
    stopGalaxyRender();
    stopGalaxyRender = null;
  }
  
  // Clear canvas before switching to system view
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Start system rendering and store cleanup function
  stopSystemRender = renderStarSystem(canvas, star, explorationSystem, showGalaxy);
}

setStarsystemCamMiddle();
showGalaxy();
