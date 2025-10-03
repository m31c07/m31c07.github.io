class QuestProgressModule {
    constructor(ctx) {
        this.ctx = ctx;
        this.width = 768;
        this.height = 200;
        this.x = 0;
        this.y = 300; // Position below the enemy info
        
        // Animation properties
        this.animationFrame = 0;
        this.animationSpeed = 0.05;
        this.isMoving = false;
        this.totalTurns = 1;
        this.currentTurn = 1;
        this.events = [];
        this.spots = [
            { x: this.computeXForTurn(1), y: 300, type: 'player', occupied: true }
        ];
    }
    
    render(playerCreature) {
        // Draw the background
        this.drawBackground();
        
        // Draw spots/containers
        this.drawSpots();
        
        // Draw the player creature if available
        if (playerCreature) {
            this.drawPlayerCreature(playerCreature);
        }
    }
    
    drawBackground() {
        // Gray background - can be replaced with an image later
        this.ctx.fillStyle = '#888888';
        this.ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Add a border
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    
    drawSpots() {
        this.spots.forEach(spot => {
            if (spot.type === 'crystal') {
                this.ctx.fillStyle = spot.occupied ? '#444444' : '#666666';
                this.ctx.fillRect(spot.x - 25, spot.y - 25, 50, 50);
                this.ctx.strokeStyle = '#333333';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(spot.x - 25, spot.y - 25, 50, 50);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(String(spot.level), spot.x, spot.y + 5);
            }
        });
    }
    
    drawPlayerCreature(creature) {
        // Find the player spot
        const playerSpot = this.spots.find(spot => spot.type === 'player');
        if (!playerSpot) return;
        
        // Only apply animation if creature is moving
        let animationOffset = 0;
        if (this.isMoving) {
            animationOffset = Math.sin(this.animationFrame) * 10;
        }
        
        // Draw creature name
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(creature.name, playerSpot.x + animationOffset, playerSpot.y - 40);
        
        // Draw creature level
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Level ${creature.level}`, playerSpot.x + animationOffset, playerSpot.y - 20);
        
        // Draw creature image or placeholder
        if (creature.image && creature.image.complete) {
            const size = 60;
            this.ctx.drawImage(
                creature.image,
                playerSpot.x - size/2 + animationOffset,
                playerSpot.y - size/2,
                size,
                size
            );
        } else {
            // Fallback: draw a placeholder circle
            this.ctx.fillStyle = '#FF5722';
            this.ctx.beginPath();
            this.ctx.arc(
                playerSpot.x + animationOffset,
                playerSpot.y,
                30,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }
        
        // Update animation frame only when moving
        if (this.isMoving) {
            this.animationFrame += this.animationSpeed;
        }
    }
    
    // Method to update animation
    update() {
        // Only update if moving
        if (this.isMoving) {
            this.animationFrame += this.animationSpeed;
        }
    }
    
    // Method to start movement animation
    startMovement() {
        this.isMoving = true;
    }
    
    // Method to stop movement animation
    stopMovement() {
        this.isMoving = false;
        // Reset animation frame to prevent jerky restart
        this.animationFrame = 0;
    }
    
    // Return state configuration for this module
    getStateConfig() {
        // This module is not a standalone state, so it returns null
        return null;
    }

    setBattleConfig(cfg) {
        this.totalTurns = cfg?.totalTurns ?? 1;
        this.events = Array.isArray(cfg?.events) ? cfg.events.filter(e => e.type === 'crystal') : [];
        this.spots = [ { x: this.computeXForTurn(1), y: 300, type: 'player', occupied: true } ];
        for (const ev of this.events) {
            this.spots.push({ x: this.computeXForTurn(ev.turn), y: 300, type: 'crystal', level: ev.level, turn: ev.turn, occupied: false });
        }
    }

    setCurrentTurn(turn) {
        this.currentTurn = Math.max(1, Math.min(turn, this.totalTurns));
        const player = this.spots.find(s => s.type === 'player');
        if (player) player.x = this.computeXForTurn(this.currentTurn);
        for (const s of this.spots) {
            if (s.type === 'crystal') s.occupied = (s.turn <= this.currentTurn);
        }
    }

    computeXForTurn(turn) {
        const padding = 40;
        const usableWidth = this.width - padding * 2;
        const step = this.totalTurns > 1 ? usableWidth / (this.totalTurns - 1) : 0;
        return this.x + padding + step * (turn - 1);
    }
}