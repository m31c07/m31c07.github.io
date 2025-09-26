// Main controller for handling screen transitions
class MainController {
    constructor() {
        this.currentScreen = 'lobby';
        this.init();
    }

    init() {
        // The lobby and battle scripts will handle their own initialization
        // This controller just manages the high-level screen transitions
        console.log('Main controller initialized');
    }

    switchToScreen(screenName) {
        // Hide all screens
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.add('hidden');
        });

        // Show the requested screen
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            this.currentScreen = screenName;
        }
    }

    getCurrentScreen() {
        return this.currentScreen;
    }
}

// Initialize main controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mainController = new MainController();
});
