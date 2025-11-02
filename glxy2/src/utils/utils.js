import { gameConfig } from '../config/gameConfig.js';

export function hexToRgbArray(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1.0];
}

export function generateStarName() {
  const syllables = [
    "an", "ar", "bi", "cor", "del", "el", "far", "gal", "hel", "in",
    "jen", "kel", "lor", "mor", "nel", "or", "pil", "qir", "ral", "sin",
    "tor", "ul", "ven", "wor", "xel", "yor", "zen"
  ];
  const count = Math.floor(Math.random() * 2) + 2;
  let name = "";
  for (let i = 0; i < count; i++) {
    name += syllables[Math.floor(Math.random() * syllables.length)];
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export class ExplorationSystem {
  constructor(stars) {
    this.stars = stars;
  }

  // Calculate system complexity (planets + moons)
  calculateSystemComplexity(star) {
    let complexity = star.planets.planets.length; // Base planets
    
    // Add moons
    star.planets.planets.forEach(planet => {
      complexity += planet.moons.length;
    });
    
    return complexity;
  }

  // Get display name for a star (??? if unexplored)
  getStarDisplayName(star) {
    return star.explored ? star.name : gameConfig.exploration.unexploredSystemName;
  }

  // Cleanup (no longer needed but kept for compatibility)
  destroy() {
    // No cleanup needed anymore
  }
}