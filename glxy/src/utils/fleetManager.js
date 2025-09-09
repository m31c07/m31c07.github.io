import { gameConfig } from '../config/gameConfig.js';

export class FleetManager {
  constructor(stars) {
    this.stars = stars;
    this.fleets = new Map(); // systemId -> fleet array
    this.selectedShip = null;
    this.selectedFleet = null;
    this.shipIdCounter = 0;
    
    // Initialize starting scout
    this.initializeStartingFleet();
  }

  initializeStartingFleet() {
    const startingSystemId = gameConfig.player.startingSystemId;
    console.log('Initializing starting fleet for system:', startingSystemId);
    
    if (startingSystemId !== null) {
      const scout = this.createShip('scout', 'Scout Alpha', startingSystemId);
      this.addShipToSystem(scout, startingSystemId);
      
      // Update scout reference in gameConfig
      gameConfig.player.scout.shipId = scout.id;
      gameConfig.player.scout.currentSystemId = startingSystemId;
      
      console.log('Scout created:', scout);
      console.log('Fleet at starting system:', this.getFleetAtSystem(startingSystemId));
    } else {
      console.error('No starting system ID found!');
    }
  }

  createShip(type, name, systemId) {
    return {
      id: this.shipIdCounter++,
      type: type,
      name: name,
      currentSystemId: systemId,
      targetSystemId: null,
      isMoving: false,
      isExploring: false,
      path: [],
      moveStartTime: null,
      moveDuration: gameConfig.exploration.travelTime, // Use config value
      capabilities: this.getShipCapabilities(type),
      status: 'idle'
    };
  }

  getShipCapabilities(type) {
    switch (type) {
      case 'scout':
        return {
          canExplore: true,
          canEnterUnexplored: true,
          explorationBonus: 1.0
        };
      case 'corvette':
        return {
          canExplore: false,
          canEnterUnexplored: false,
          combatPower: 10
        };
      default:
        return {};
    }
  }

  addShipToSystem(ship, systemId) {
    if (!this.fleets.has(systemId)) {
      this.fleets.set(systemId, []);
    }
    this.fleets.get(systemId).push(ship);
    ship.currentSystemId = systemId;
  }

  removeShipFromSystem(ship, systemId) {
    const fleet = this.fleets.get(systemId);
    if (fleet) {
      const index = fleet.findIndex(s => s.id === ship.id);
      if (index !== -1) {
        fleet.splice(index, 1);
        if (fleet.length === 0) {
          this.fleets.delete(systemId);
        }
      }
    }
  }

  getFleetAtSystem(systemId) {
    return this.fleets.get(systemId) || [];
  }

  getFleetSize(systemId) {
    const fleet = this.getFleetAtSystem(systemId);
    return fleet.length;
  }

  selectShip(ship) {
    if (ship && !ship.isMoving) {
      this.selectedShip = ship;
      this.selectedFleet = this.getFleetAtSystem(ship.currentSystemId);
      return true;
    }
    return false;
  }

  deselectShip() {
    this.selectedShip = null;
    this.selectedFleet = null;
  }

  getSelectedShip() {
    return this.selectedShip;
  }

  // Check if ship can move to target system
  canMoveToSystem(ship, targetSystemId) {
    if (!ship || ship.isMoving || ship.isExploring) return false;
    
    const targetStar = this.stars[targetSystemId];
    if (!targetStar) return false;

    // Scouts can enter unexplored systems
    if (ship.capabilities.canExplore && ship.capabilities.canEnterUnexplored) {
      return true;
    }

    // Other ships can only enter explored systems
    return targetStar.explored;
  }

  // Find path between two systems using only explored systems
  findPath(fromSystemId, toSystemId, allowUnexplored = false) {
    if (fromSystemId === toSystemId) return [fromSystemId];

    const visited = new Set();
    const queue = [{systemId: fromSystemId, path: [fromSystemId]}];
    
    while (queue.length > 0) {
      const {systemId, path} = queue.shift();
      
      if (systemId === toSystemId) {
        return path;
      }
      
      if (visited.has(systemId)) continue;
      visited.add(systemId);
      
      const currentStar = this.stars[systemId];
      if (!currentStar) continue;
      
      for (const connectedId of currentStar.connections) {
        if (visited.has(connectedId)) continue;
        
        const connectedStar = this.stars[connectedId];
        if (!connectedStar) continue;
        
        // Only use explored systems in path (unless allowUnexplored is true)
        if (!allowUnexplored && !connectedStar.explored) continue;
        
        queue.push({
          systemId: connectedId,
          path: [...path, connectedId]
        });
      }
    }
    
    return null; // No path found
  }

  // Move ship along a path
  moveShipAlongPath(ship, path) {
    if (!ship || !path || path.length < 2) return false;
    
    // Cancel any ongoing exploration when ship starts moving
    if (ship.isExploring) {
      this.cancelShipExploration(ship);
    }
    
    ship.path = [...path];
    ship.targetSystemId = path[1]; // Next system in path
    ship.isMoving = true;
    ship.moveStartTime = Date.now();
    ship.status = 'moving';
    
    // Start movement to next system
    setTimeout(() => {
      this.completeShipMove(ship);
    }, ship.moveDuration);
    
    return true;
  }

  completeShipMove(ship) {
    if (!ship.isMoving || !ship.path || ship.path.length < 2) return;
    
    const fromSystemId = ship.path[0];
    const toSystemId = ship.path[1];
    
    // Move ship from current system to next system
    this.removeShipFromSystem(ship, fromSystemId);
    this.addShipToSystem(ship, toSystemId);
    
    // Update path
    ship.path.shift(); // Remove first system from path
    
    if (ship.path.length > 1) {
      // Continue moving to next system
      ship.targetSystemId = ship.path[1];
      ship.moveStartTime = Date.now();
      
      setTimeout(() => {
        this.completeShipMove(ship);
      }, ship.moveDuration);
    } else {
      // Reached destination
      ship.isMoving = false;
      ship.targetSystemId = null;
      ship.path = [];
      ship.moveStartTime = null;
      ship.status = 'idle';
      
      // If it's a scout and arrived at unexplored system, start exploration
      if (ship.capabilities.canExplore && ship.capabilities.canEnterUnexplored) {
        const currentStar = this.stars[ship.currentSystemId];
        if (currentStar && !currentStar.explored) {
          this.startScoutExploration(ship);
        }
      }
    }
  }

  startScoutExploration(ship) {
    if (!ship.capabilities.canExplore) return;
    
    ship.isExploring = true;
    ship.status = 'exploring';
    
    // Use existing exploration system
    const explorationSystem = window.explorationSystem;
    if (explorationSystem) {
      // Calculate exploration time based on system complexity
      const systemComplexity = explorationSystem.calculateSystemComplexity(this.stars[ship.currentSystemId]);
      const explorationTime = gameConfig.exploration.baseExplorationTime + 
                             (systemComplexity * gameConfig.exploration.timePerObject);
      
      // Update scout reference in gameConfig for compatibility
      gameConfig.player.scout.currentSystemId = ship.currentSystemId;
      gameConfig.player.scout.shipId = ship.id;
      gameConfig.player.scout.isExploring = true;
      gameConfig.player.scout.targetSystemId = ship.currentSystemId;
      gameConfig.player.scout.explorationStartTime = Date.now();
      gameConfig.player.scout.explorationDuration = explorationTime;
      gameConfig.player.scout.phase = 'exploring';
      
      // Store timer reference on the ship for cancellation
      ship.explorationTimer = setTimeout(() => {
        this.completeScoutExploration(ship);
      }, explorationTime);
    }
  }
  
  // Cancel exploration for a specific ship
  cancelShipExploration(ship) {
    if (!ship.isExploring) return;
    
    // Clear the exploration timer
    if (ship.explorationTimer) {
      clearTimeout(ship.explorationTimer);
      ship.explorationTimer = null;
    }
    
    // Reset ship status
    ship.isExploring = false;
    ship.status = 'idle';
    
    // Reset scout config if this ship was the active scout
    if (gameConfig.player.scout.shipId === ship.id) {
      gameConfig.player.scout.isExploring = false;
      gameConfig.player.scout.targetSystemId = null;
      gameConfig.player.scout.explorationStartTime = null;
      gameConfig.player.scout.explorationDuration = 0;
      gameConfig.player.scout.phase = 'idle';
    }
    
    console.log(`Exploration cancelled for ${ship.name}`);
  }
  
  completeScoutExploration(ship) {
    if (!ship.isExploring) return;
    
    const currentStar = this.stars[ship.currentSystemId];
    if (currentStar) {
      // Mark system as explored
      currentStar.explored = true;
      gameConfig.exploration.exploredSystems.add(ship.currentSystemId);
      
      console.log(`🎉 ${ship.name} has completed exploration of ${currentStar.name}!`);
    }
    
    // Clear the exploration timer
    if (ship.explorationTimer) {
      clearTimeout(ship.explorationTimer);
      ship.explorationTimer = null;
    }
    
    // Reset ship status
    ship.isExploring = false;
    ship.status = 'idle';
    
    // Reset scout config
    gameConfig.player.scout.isExploring = false;
    gameConfig.player.scout.targetSystemId = null;
    gameConfig.player.scout.explorationStartTime = null;
    gameConfig.player.scout.explorationDuration = 0;
    gameConfig.player.scout.phase = 'idle';
  }

  // Get movement progress for a ship (0-1)
  getShipMoveProgress(ship) {
    if (!ship.isMoving || !ship.moveStartTime) return 0;
    
    const elapsed = Date.now() - ship.moveStartTime;
    return Math.min(elapsed / ship.moveDuration, 1);
  }

  // Get ship position during movement
  getShipPosition(ship) {
    if (!ship.isMoving || !ship.targetSystemId) {
      const currentStar = this.stars[ship.currentSystemId];
      return currentStar ? {x: currentStar.x, y: currentStar.y} : {x: 0, y: 0};
    }
    
    const currentStar = this.stars[ship.currentSystemId];
    const targetStar = this.stars[ship.targetSystemId];
    
    if (!currentStar || !targetStar) {
      return currentStar ? {x: currentStar.x, y: currentStar.y} : {x: 0, y: 0};
    }
    
    const progress = this.getShipMoveProgress(ship);
    return {
      x: currentStar.x + (targetStar.x - currentStar.x) * progress,
      y: currentStar.y + (targetStar.y - currentStar.y) * progress
    };
  }

  // Update method called each frame
  update() {
    // Update ship exploration status
    for (const fleet of this.fleets.values()) {
      for (const ship of fleet) {
        if (ship.isExploring) {
          const currentStar = this.stars[ship.currentSystemId];
          if (currentStar && currentStar.explored) {
            ship.isExploring = false;
            ship.status = 'idle';
          }
        }
      }
    }
  }
}