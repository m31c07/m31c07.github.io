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
        this.isMoving = false; // Track if creature is moving
        
        // Spots for mobs, chests, etc.
        this.spots = [
            { x: 100, y: 100, type: 'player', occupied: true },
            { x: 300, y: 100, type: 'mob', occupied: false },
            { x: 500, y: 100, type: 'chest', occupied: false },
            { x: 700, y: 100, type: 'mob', occupied: false }
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
        // Draw spots/containers for mobs, chests, etc.
        this.spots.forEach(spot => {
            this.ctx.fillStyle = spot.occupied ? '#444444' : '#666666';
            this.ctx.fillRect(spot.x - 25, spot.y - 25, 50, 50);
            
            // Add a border to spots
            this.ctx.strokeStyle = '#333333';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(spot.x - 25, spot.y - 25, 50, 50);
            
            // Mark the spot type
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(spot.type.charAt(0).toUpperCase(), spot.x, spot.y + 5);
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
}