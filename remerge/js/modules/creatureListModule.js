class CreatureListModule {
    constructor(ctx) {
        this.ctx = ctx;
        this.selectedCreature = 0;
        this.scrollOffset = 0;
        
        // Store layout properties to avoid hardcoded values
        this.layout = {
            listY: 1250,
            itemWidth: 120,
            itemHeight: 100,
            itemSpacing: 20,
            startX: 50,
            leftScrollX: 0,
            leftScrollWidth: 30,
            rightScrollX: 738,
            rightScrollWidth: 30,
            canvasWidth: 768
        };
    }
    
    // Set the creature data module reference
    setCreatureDataModule(creatureDataModule) {
        this.creatureDataModule = creatureDataModule;
    }
    
    render() {
        // Check if creature data module is available
        if (!this.creatureDataModule) {
            return;
        }
        
        const creatures = this.creatureDataModule.getAllCreatures();
        
        // Draw background for creature list
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, this.layout.listY, this.layout.canvasWidth, 126);
        
        // Draw creatures
        creatures.forEach((creature, index) => {
            const x = this.layout.startX + index * (this.layout.itemWidth + this.layout.itemSpacing) + this.scrollOffset;
            
            // Only draw if visible
            if (x > -this.layout.itemWidth && x < this.layout.canvasWidth) {
                // Highlight selected creature
                if (index === this.selectedCreature) {
                    this.ctx.fillStyle = '#4CAF50';
                    this.ctx.fillRect(x - 5, this.layout.listY + 10, this.layout.itemWidth + 10, this.layout.itemHeight + 10);
                }
                
                // Draw creature item
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(x, this.layout.listY + 15, this.layout.itemWidth, this.layout.itemHeight);
                
                // Draw creature image
                if (creature.image && creature.image.complete) {
                    const imageSize = 100;
                    const imageX = x + this.layout.itemWidth/2 - imageSize/2;
                    const imageY = this.layout.listY+15;
                    this.ctx.drawImage(creature.image, imageX, imageY, imageSize, imageSize);
                } else {
                    // Draw creature icon placeholder
                    this.ctx.fillStyle = '#2196F3';
                    this.ctx.beginPath();
                    this.ctx.arc(x + this.layout.itemWidth/2, this.layout.listY + 85, 10, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                // Draw creature name
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(creature.name, x + this.layout.itemWidth/2, this.layout.listY + 40);
                
                // Draw creature level
                this.ctx.fillStyle = '#FFD700';
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`Lvl ${creature.level}`, x + this.layout.itemWidth/2, this.layout.listY + 60);
                
            }
        });
        
        this.ctx.textAlign = 'left';
        
        // Draw scroll indicators if needed
        if (this.scrollOffset < 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('<', 10, this.layout.listY + 70);
        }
        
        if (creatures.length * (this.layout.itemWidth + this.layout.itemSpacing) + this.scrollOffset > this.layout.canvasWidth) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText('>', 758, this.layout.listY + 70);
        }
        
        this.ctx.textAlign = 'left';
    }
    
    // Handle click events for creature selection and scrolling
    handleClick(x, y) {
        // Check if creature data module is available
        if (!this.creatureDataModule) {
            return false;
        }
        
        const creatures = this.creatureDataModule.getAllCreatures();
        let creatureSelected = false;
        
        // Check if click is on scroll buttons
        if (y >= this.layout.listY && y <= this.layout.listY + 126) {
            // Left scroll button
            if (x >= this.layout.leftScrollX && x <= this.layout.leftScrollX + this.layout.leftScrollWidth && this.scrollOffset < 0) {
                this.scrollOffset += 50;
                return false; // Return false for scroll actions
            }
            
            // Right scroll button
            if (x >= this.layout.rightScrollX && x <= this.layout.rightScrollX + this.layout.rightScrollWidth && 
                creatures.length * (this.layout.itemWidth + this.layout.itemSpacing) + this.scrollOffset > this.layout.canvasWidth) {
                this.scrollOffset -= 50;
                return false; // Return false for scroll actions
            }
            
            // Check if click is on a creature
            creatures.forEach((creature, index) => {
                const creatureX = this.layout.startX + index * (this.layout.itemWidth + this.layout.itemSpacing) + this.scrollOffset;
                if (x >= creatureX && x <= creatureX + this.layout.itemWidth &&
                    y >= this.layout.listY + 15 && y <= this.layout.listY + 15 + this.layout.itemHeight) {
                    this.selectedCreature = index;
                    creatureSelected = true;
                }
            });
        }
        
        return creatureSelected;
    }
    
    // Get the currently selected creature
    getSelectedCreature() {
        if (!this.creatureDataModule) {
            return null;
        }
        
        const creatures = this.creatureDataModule.getAllCreatures();
        return creatures[this.selectedCreature];
    }
}