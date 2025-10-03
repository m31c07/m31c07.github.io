class CurrencyModule {
    constructor(ctx) {
        this.ctx = ctx;
        this.gold = 0;
        this.gems = 0;
    }
    
    render() {
        // Draw currency bar at the top
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, 768, 80);
        
        // Draw gold currency
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText('GOLD', 20, 35);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(this.gold.toLocaleString(), 20, 65);
        
        // Draw gems currency
        this.ctx.fillStyle = '#00BFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText('GEMS', 180, 35);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(this.gems.toLocaleString(), 180, 65);
        
        // Draw shop button
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(650, 20, 100, 40);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SHOP', 700, 45);
        this.ctx.textAlign = 'left';
    }
    
    // Methods to modify currency would go here
    addGold(amount) {
        this.gold += amount;
    }
    
    addGems(amount) {
        this.gems += amount;
    }
    
    spendGold(amount) {
        if (this.gold >= amount) {
            this.gold -= amount;
            return true;
        }
        return false;
    }
    
    spendGems(amount) {
        if (this.gems >= amount) {
            this.gems -= amount;
            return true;
        }
        return false;
    }
}