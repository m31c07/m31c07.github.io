class BattleConfigModule {
  constructor() {
    this.activeConfig = null;
  }

  getDefaultConfig() {
    return {
      totalTurns: 20,
      reward: {
        currency: {
          gold: 100,
          gem: 1
        },
        items: {}
      },
      events: [
        { turn: 1, type: 'crystal', level: 7, element: 'fire' },
        { turn: 10, type: 'crystal', level: 7, element: 'ice' },
        { turn: 20, type: 'crystal', level: 7, element: 'stone' }
      ]
    };
  }

  setActiveConfig(config) {
    this.activeConfig = config;
  }

  getBattleConfigFor(playerCreature) {
    return this.activeConfig ?? this.getDefaultConfig();
  }
}

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattleConfigModule;
}