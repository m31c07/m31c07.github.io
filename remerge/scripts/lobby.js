// Lobby functionality
class Lobby {
    constructor() {
        this.stage = 0;
        this.init();
    }

    init() {
        // Load saved stage from localStorage if available
        const savedStage = localStorage.getItem('witchcraft_stage');
        if (savedStage) {
            this.stage = parseInt(savedStage);
        }
        
        this.updateStageDisplay();
        this.bindEvents();
    }

    bindEvents() {
        const battleButton = document.getElementById('battle-button');
        battleButton.addEventListener('click', () => {
            this.startBattle();
        });
    }

    updateStageDisplay() {
        const stageDisplay = document.getElementById('stage-display');
        if (stageDisplay) {
            stageDisplay.textContent = this.stage;
        }
    }

    startBattle() {
        // Hide lobby screen and show battle screen
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('battle-screen').classList.remove('hidden');
        
        // Initialize battle
        if (typeof Battle !== 'undefined') {
            Battle.initialize(this.stage);
        }
    }

    exitBattle() {
        // Hide battle screen and show lobby screen
        document.getElementById('battle-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        
        // Update stage display in lobby
        this.updateStageDisplay();
    }

    incrementStage() {
        this.stage++;
        localStorage.setItem('witchcraft_stage', this.stage);
        this.updateStageDisplay();
        
        // Also update battle stage display if battle is active
        const battleStageDisplay = document.getElementById('battle-stage-display');
        if (battleStageDisplay && !document.getElementById('battle-screen').classList.contains('hidden')) {
            battleStageDisplay.textContent = this.stage;
        }
    }

    resetStage() {
        this.stage = 0;
        localStorage.setItem('witchcraft_stage', this.stage);
        this.updateStageDisplay();
    }
}

// Initialize lobby when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.Lobby = new Lobby();
});