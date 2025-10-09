class CreatureDisplayModule {
    constructor(ctx) {
        this.ctx = ctx;
        // Initialize with empty creature data
        // The actual creature will be set by the lobby module when it's ready
        this.currentCreature = null;
    }
    
    render() {
        // Default rendering at center of screen
        this.renderAtPosition(768 / 2, 1376 / 2, 1.0);
    }
    
    // Render creature at a specific position
    renderAtPosition(centerX, centerY, scale = 1.0) {
        // Draw creature display area (500x450)
        // this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        // this.ctx.fillRect(centerX - 250, centerY - 225, 500, 450);
        
        // Only render creature details if we have a creature
        if (this.currentCreature) {
            // Draw creature name
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.currentCreature.name, centerX, centerY - 200 * scale);
            
            // Draw creature level
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Level ${this.currentCreature.level}`, centerX, centerY - 170 * scale);
            
            // Draw creature image (scaled to fit within the display area)
            if (this.currentCreature.image && this.currentCreature.image.complete) {
                const maxWidth = 500 * scale;
                const maxHeight = 500 * scale;
                const imageAspectRatio = this.currentCreature.image.width / this.currentCreature.image.height;
                
                let drawWidth, drawHeight;
                
                if (imageAspectRatio > 1) {
                    // Image is wider than tall
                    drawWidth = Math.min(maxWidth, this.currentCreature.image.width);
                    drawHeight = drawWidth / imageAspectRatio;
                } else {
                    // Image is taller than wide or square
                    drawHeight = Math.min(maxHeight, this.currentCreature.image.height);
                    drawWidth = drawHeight * imageAspectRatio;
                }
                
                const x = centerX - drawWidth / 2;
                const y = centerY - drawHeight / 2;
                
                this.ctx.drawImage(
                    this.currentCreature.image, 
                    x, 
                    y, 
                    drawWidth, 
                    drawHeight
                );
            } else {
                // Fallback: draw a placeholder circle
                this.ctx.fillStyle = '#FF5722';
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, 80 * scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Draw HP bar (positioned below the creature image)
            // const hpBarWidth = 300;
            // const hpBarHeight = 20;
            // const hpBarX = centerX - hpBarWidth / 2;
            // const hpBarY = centerY + 180;
            
            // Background
            // this.ctx.fillStyle = '#555';
            // this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
            
            // // HP
            // const hpWidth = (this.currentCreature.hp / this.currentCreature.maxHp) * hpBarWidth;
            // this.ctx.fillStyle = '#F44336';
            // this.ctx.fillRect(hpBarX, hpBarY, hpWidth, hpBarHeight);
            
            // // HP text
            // this.ctx.fillStyle = '#FFF';
            // this.ctx.font = '16px Arial';
            // this.ctx.fillText(`${this.currentCreature.hp}/${this.currentCreature.maxHp} HP`, 
            //                  centerX, hpBarY + hpBarHeight + 20);
        }
        
        this.ctx.textAlign = 'left';
    }
    
    setCreature(creature) {
        // Directly use the creature object including its image
        this.currentCreature = creature;
    }
}