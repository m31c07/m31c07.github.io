class QuestsModule {
    constructor(ctx) {
        this.ctx = ctx;
        // Sample quest data
        this.quests = [
            { id: 1, name: "Defeat 10 enemies", progress: 7, target: 10 },
            { id: 2, name: "Collect 50 gold", progress: 30, target: 50 },
            { id: 3, name: "Win 3 battles", progress: 1, target: 3 }
        ];
    }
    
    render() {
        const startY = 100;
        const questHeight = 80;
        const questWidth = 700;
        const questSpacing = 20;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(34, startY - 10, questWidth, 
                         this.quests.length * (questHeight + questSpacing) + 20);
        
        this.quests.forEach((quest, index) => {
            const y = startY + index * (questHeight + questSpacing);
            
            // Draw quest background
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(40, y, questWidth - 12, questHeight);
            
            // Draw quest name
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillText(quest.name, 50, y + 25);
            
            // Draw progress bar
            const progressBarWidth = 500;
            const progressBarHeight = 20;
            const progressBarX = 50;
            const progressBarY = y + 40;
            
            // Background
            this.ctx.fillStyle = '#555';
            this.ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
            
            // Progress
            const progressWidth = (quest.progress / quest.target) * progressBarWidth;
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillRect(progressBarX, progressBarY, progressWidth, progressBarHeight);
            
            // Progress text
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`${quest.progress}/${quest.target}`, 
                             progressBarX + progressBarWidth + 10, progressBarY + 15);
        });
    }
}