class LobbyModule {
    constructor(ctx) {
        this.ctx = ctx;
        
        // Load background image
        this.bgImage = new Image();
        this.bgImage.src = 'img/back/bg_lobby_1.png';
        
        // Add onload and onerror handlers for debugging
        this.bgImage.onload = () => {
            console.log('Background image loaded successfully');
        };
        
        this.bgImage.onerror = () => {
            console.error('Failed to load background image');
        };
        
        // Store battle button coordinates for click detection
        this.battleButton = {
            x: 284,
            y: 1150,
            width: 200,
            height: 60
        };
    }
    
    render() {
        // Always draw a background color first
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, 768, 1376);
        
        // Draw background image
        if (this.bgImage.complete && this.bgImage.naturalWidth !== 0) {
            this.ctx.drawImage(this.bgImage, 0, 0, 768, 1376);
        } else {
            // Fallback background color while image loads
            console.log('Using fallback background color');
            // The background color is already drawn above
        }
        
        // Render all lobby modules
        if (this.currencyModule) this.currencyModule.render();
        if (this.shopModule) this.shopModule.render();
        if (this.questsModule) this.questsModule.render();
        if (this.creatureDisplayModule) this.creatureDisplayModule.renderAtPosition(768 / 2, 800, 1.0);
        // Render battle button directly instead of calling battleModule.renderButton()
        this.renderBattleButton();
        if (this.creatureListModule) this.creatureListModule.render();
    }
    
    // Render the battle button directly in the lobby module
    renderBattleButton() {
        // Draw battle button
        this.ctx.fillStyle = '#F44336';
        this.ctx.fillRect(this.battleButton.x, this.battleButton.y, this.battleButton.width, this.battleButton.height);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BATTLE', 
                         this.battleButton.x + this.battleButton.width/2, 
                         this.battleButton.y + this.battleButton.height/2 + 8);
        this.ctx.textAlign = 'left';
    }
    
    handleClick(x, y) {
        // Handle lobby-specific click events
        // Check if battle button was clicked using stored coordinates
        if (x >= this.battleButton.x && 
            x <= this.battleButton.x + this.battleButton.width && 
            y >= this.battleButton.y && 
            y <= this.battleButton.y + this.battleButton.height) {
            // Get selected creature and pass it to battle
            if (this.creatureListModule && this.creatureListModule.getSelectedCreature) {
                const selectedCreature = this.creatureListModule.getSelectedCreature();
                return { 
                    type: 'SWITCH_TO_BATTLE',
                    data: { playerCreature: selectedCreature }
                };
            }
            return { type: 'SWITCH_TO_BATTLE' };
        }
        
        // Handle creature list clicks
        if (this.creatureListModule && this.creatureListModule.handleClick(x, y)) {
            // Update creature display with selected creature
            if (this.creatureDisplayModule && this.creatureListModule.getSelectedCreature) {
                const selectedCreature = this.creatureListModule.getSelectedCreature();
                this.creatureDisplayModule.setCreature(selectedCreature);
            }
            return null;
        }
        
        return null;
    }
    
    onEnter() {
        // Initialize creature display with the first creature from the list
        if (this.creatureListModule && this.creatureDisplayModule) {
            const firstCreature = this.creatureListModule.getSelectedCreature();
            if (firstCreature) {
                this.creatureDisplayModule.setCreature(firstCreature);
            }
        }
        console.log('Entered lobby');
    }
    
    onExit() {
        // Any cleanup logic when exiting lobby
        console.log('Exited lobby');
    }
    
    // Setter methods for modules
    setModules(modules) {
        this.currencyModule = modules.currencyModule;
        this.shopModule = modules.shopModule;
        this.questsModule = modules.questsModule;
        this.creatureDisplayModule = modules.creatureDisplayModule;
        this.battleModule = modules.battleModule;
        this.creatureListModule = modules.creatureListModule;
        this.creatureDataModule = modules.creatureDataModule;
        
        // Pass creature data module to creature list module
        if (this.creatureListModule && this.creatureDataModule) {
            this.creatureListModule.setCreatureDataModule(this.creatureDataModule);
        }
    }
    
    // Return state configuration for this module
    getStateConfig() {
        return {
            name: 'LOBBY',
            handlers: {
                render: (ctx) => {
                    this.render();
                },
                handleClick: (x, y) => {
                    return this.handleClick(x, y);
                },
                onEnter: () => {
                    this.onEnter();
                },
                onExit: () => {
                    this.onExit();
                }
            }
        };
    }
}