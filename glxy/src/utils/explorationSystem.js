import { gameConfig } from '../config/gameConfig.js';

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