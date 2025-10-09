class StateManager {
    constructor() {
        this.states = {};
        this.currentState = null;
        this.previousState = null;
        this.stateData = {}; // Store data for states
    }
    
    // Register a new state
    registerState(name, stateObject) {
        console.log(`Registering state: ${name}`);
        this.states[name] = stateObject;
    }
    
    // Switch to a specific state
    switchTo(stateName, data = null) {
        console.log(`Switching to state: ${stateName}`);
        if (this.states[stateName]) {
            // Call exit method on current state if it exists
            if (this.currentState && this.states[this.currentState] && 
                typeof this.states[this.currentState].onExit === 'function') {
                this.states[this.currentState].onExit();
            }
            
            // Store previous state
            this.previousState = this.currentState;
            
            // Store data for the new state
            if (data) {
                this.stateData[stateName] = data;
            }
            
            // Set new state
            this.currentState = stateName;
            
            // Call enter method on new state if it exists
            if (typeof this.states[this.currentState].onEnter === 'function') {
                this.states[this.currentState].onEnter(this.stateData[stateName]);
            }
            
            return true;
        }
        return false;
    }
    
    // Go back to previous state
    goBack() {
        if (this.previousState) {
            this.switchTo(this.previousState);
        }
    }
    
    // Get current state object
    getCurrentState() {
        return this.currentState ? this.states[this.currentState] : null;
    }
    
    // Get current state name
    getCurrentStateName() {
        return this.currentState;
    }
    
    // Render current state
    render(ctx) {
        if (this.currentState && this.states[this.currentState] && 
            typeof this.states[this.currentState].render === 'function') {
            this.states[this.currentState].render(ctx);
        }
    }
    
    // Handle click events for current state
    handleClick(x, y) {
        if (this.currentState && this.states[this.currentState] && 
            typeof this.states[this.currentState].handleClick === 'function') {
            return this.states[this.currentState].handleClick(x, y);
        }
        return null;
    }
    
    // Handle swipe events for current state
    handleSwipe(startX, startY, endX, endY) {
        if (this.currentState && this.states[this.currentState] && 
            typeof this.states[this.currentState].handleSwipe === 'function') {
            return this.states[this.currentState].handleSwipe(startX, startY, endX, endY);
        }
        return null;
    }
    
    // Handle keyboard events for current state
    handleKeyboard(key) {
        if (this.currentState && this.states[this.currentState] && 
            typeof this.states[this.currentState].handleKeyboard === 'function') {
            return this.states[this.currentState].handleKeyboard(key);
        }
        return null;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize state manager
        this.stateManager = new StateManager();
        
        // Set up event handling
        this.setupEventListeners();
        
        // Set the proper scaling for the canvas
        this.setupCanvas();
        window.addEventListener('resize', () => this.setupCanvas());
        
        // Module placeholders
        this.modules = {};
        
        // Swipe handling
        this.isSwiping = false;
        this.swipeStart = { x: 0, y: 0 };
        
        // Load all modules and then start the game
        this.loadModules().then(() => {
            // Register states dynamically based on available modules
            this.registerStates();
            // Start with lobby state by default
            console.log('Switching to LOBBY state');
            this.stateManager.switchTo('LOBBY');
            // Start game loop
            this.gameLoop();
        }).catch(error => {
            console.error('Error loading modules:', error);
        });
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.isSwiping = true;
            this.swipeStart = { x, y };
            
            // Ensure canvas has focus for keyboard events
            this.canvas.focus();
        });
        
        this.canvas.addEventListener('mouseup', (event) => {
            if (!this.isSwiping) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            
            // Check if this is a swipe (moved more than threshold)
            const deltaX = x - this.swipeStart.x;
            const deltaY = y - this.swipeStart.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Minimum swipe distance threshold
            if (distance > 30) {
                const action = this.stateManager.handleSwipe(
                    this.swipeStart.x, 
                    this.swipeStart.y, 
                    x, 
                    y
                );
                if (action) {
                    this.handleAction(action);
                }
            } else {
                // Treat as click if not a significant swipe
                const action = this.stateManager.handleClick(x, y);
                if (action) {
                    this.handleAction(action);
                }
            }
            
            this.isSwiping = false;
        });
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = event.touches[0];
            const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
            
            this.isSwiping = true;
            this.swipeStart = { x, y };
            
            // Ensure canvas has focus for keyboard events
            this.canvas.focus();
        });
        
        this.canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            if (!this.isSwiping) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const touch = event.changedTouches[0];
            const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);
            
            // Check if this is a swipe (moved more than threshold)
            const deltaX = x - this.swipeStart.x;
            const deltaY = y - this.swipeStart.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Minimum swipe distance threshold
            if (distance > 30) {
                const action = this.stateManager.handleSwipe(
                    this.swipeStart.x, 
                    this.swipeStart.y, 
                    x, 
                    y
                );
                if (action) {
                    this.handleAction(action);
                }
            } else {
                // Treat as click if not a significant swipe
                const action = this.stateManager.handleClick(x, y);
                if (action) {
                    this.handleAction(action);
                }
            }
            
            this.isSwiping = false;
        });
        
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            // Handle arrow keys for battle controls
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
                const action = this.stateManager.handleKeyboard(event.key);
                if (action) {
                    this.handleAction(action);
                }
                // Prevent default behavior for arrow keys to avoid page scrolling
                event.preventDefault();
            }
        });
        
        // Ensure canvas can receive focus
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.style.outline = 'none';
        
        // Prevent context menu on long press
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    
    handleAction(action) {
        // Generic action handler that delegates to state manager
        if (action && action.type) {
            console.log(`Handling action: ${action.type}`);
            if (action.type.startsWith('SWITCH_TO_')) {
                const stateName = action.type.replace('SWITCH_TO_', '');
                this.stateManager.switchTo(stateName, action.data);
            }
            // Additional action types can be handled here
        }
    }
    
    registerStates() {
        // Register states dynamically based on available modules
        // Each module should have a getStateConfig method that returns its state configuration
        console.log('Registering states...');
        for (const [moduleName, module] of Object.entries(this.modules)) {
            console.log(`Checking module: ${moduleName}`);
            if (module && typeof module.getStateConfig === 'function') {
                const stateConfig = module.getStateConfig();
                if (stateConfig && stateConfig.name && stateConfig.handlers) {
                    console.log(`Registering state for module: ${moduleName}`);
                    this.stateManager.registerState(stateConfig.name, stateConfig.handlers);
                }
            }
        }
    }
    
    async loadModules() {
        console.log('Loading modules...');
        // In a real implementation, you might want to load these in parallel
        // For now, we'll load them sequentially to ensure proper initialization
        
        // Single source of truth for modules with factory functions
        const moduleConfig = [
            { path: 'js/modules/currencyModule.js', name: 'currencyModule', factory: (ctx) => new CurrencyModule(ctx) },
            { path: 'js/modules/shopModule.js', name: 'shopModule', factory: (ctx) => new ShopModule(ctx) },
            { path: 'js/modules/questsModule.js', name: 'questsModule', factory: (ctx) => new QuestsModule(ctx) },
            { path: 'js/modules/creatureDisplayModule.js', name: 'creatureDisplayModule', factory: (ctx) => new CreatureDisplayModule(ctx) },
            { path: 'js/modules/battleLogicModule.js', name: 'battleLogicModule', factory: () => new BattleLogicModule() }, // New module
            { path: 'js/modules/battleModule.js', name: 'battleModule', factory: (ctx) => new BattleModule(ctx) },
            { path: 'js/modules/creatureListModule.js', name: 'creatureListModule', factory: (ctx) => new CreatureListModule(ctx) },
            { path: 'js/modules/creatureDataModule.js', name: 'creatureDataModule', factory: (ctx) => new CreatureDataModule() },
            { path: 'js/modules/lobbyModule.js', name: 'lobbyModule', factory: (ctx) => new LobbyModule(ctx) },
            { path: 'js/modules/questProgressModule.js', name: 'questProgressModule', factory: (ctx) => new QuestProgressModule(ctx) },
            { path: 'js/modules/battleConfigModule.js', name: 'battleConfigModule', factory: () => new BattleConfigModule() }
        ];
        
        // Load all module scripts
        for (const module of moduleConfig) {
            console.log(`Loading module: ${module.path}`);
            await this.loadScript(module.path);
        }
        
        // Initialize all modules from the configuration
        for (const module of moduleConfig) {
            console.log(`Initializing module: ${module.name}`);
            this.modules[module.name] = module.factory(this.ctx);
        }
        
        // Pass module references to lobby module
        if (this.modules.lobbyModule) {
            console.log('Setting modules in lobby module');
            this.modules.lobbyModule.setModules(this.modules);
        }
        
        // Pass creature display module to battle module
        if (this.modules.battleModule && this.modules.creatureDisplayModule) {
            console.log('Setting creature display module in battle module');
            this.modules.battleModule.setCreatureDisplayModule(this.modules.creatureDisplayModule);
        }
        
        // Pass quest progress module to battle module
        if (this.modules.battleModule && this.modules.questProgressModule) {
            console.log('Setting quest progress module in battle module');
            this.modules.battleModule.setQuestProgressModule(this.modules.questProgressModule);
        }

        if (this.modules.battleModule && this.modules.battleConfigModule) {
            this.modules.battleModule.setBattleConfigModule(this.modules.battleConfigModule);
        }

        // Pass currency module to battle module for rewards
        if (this.modules.battleModule && this.modules.currencyModule) {
            console.log('Setting currency module in battle module');
            this.modules.battleModule.setCurrencyModule(this.modules.currencyModule);
        }
        
        console.log('All modules loaded');
    }
    
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`Script loaded: ${src}`);
                resolve();
            };
            script.onerror = (error) => {
                console.error(`Failed to load script: ${src}`, error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }
    
    setupCanvas() {
        const container = document.getElementById('gameContainer');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Calculate scale to fit either width or height
        const scaleWidth = containerWidth / 768;
        const scaleHeight = containerHeight / 1376;
        const scale = Math.min(scaleWidth, scaleHeight);
        
        // Set canvas display size
        this.canvas.style.width = (768 * scale) + 'px';
        this.canvas.style.height = (1376 * scale) + 'px';
        
        // Maintain crisp rendering
        this.canvas.width = 768;
        this.canvas.height = 1376;
    }
    
    gameLoop() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render current state
        this.stateManager.render(this.ctx);
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

function setViewportHeightVar() {
    const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', setViewportHeightVar);
window.addEventListener('orientationchange', setViewportHeightVar);
window.addEventListener('load', setViewportHeightVar);

// Initialize the game when the page loads
window.addEventListener('load', () => {
    window.game = new Game();
});