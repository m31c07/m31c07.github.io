class BattleModule {
    constructor(ctx) {
        this.ctx = ctx;
        this.battleLogic = new BattleLogicModule();

        this.isSwiping = false;
        this.swipeStart = { x: 0, y: 0 };
        this.swipeEnd = { x: 0, y: 0 };

        this.playerCreature = null;
        this.questProgressModule = null;
        this.creatureDisplayModule = null;

        this.enemy = { id: 1, name: "Dark Goblin", level: 3, hp: 80, maxHp: 80 };

        this.exitButton = { x: 648, y: 1300, width: 100, height: 50 };

        this.animations = [];
        this.isAnimating = false;
        this.fastAnimation = false;
    }

    render() {
        // Background
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, 768, 1376);

        this.renderEnemy();
        if (this.questProgressModule) {
            this.questProgressModule.stopMovement();
            this.questProgressModule.render(this.playerCreature);
        }

        this.battleLogic.renderBoard(this.ctx, this.isTargetPositionAnimated.bind(this));
        this.drawAnimations();
        this.renderExitButton();
    }

    renderEnemy() {
        const enemyX = 50, enemyY = 50, iconSize = 80;
        this.ctx.fillStyle = '#8B0000';
        this.ctx.beginPath();
        this.ctx.arc(enemyX + iconSize/2, enemyY + iconSize/2, iconSize/2, 0, Math.PI*2);
        this.ctx.fill();

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.enemy.name, enemyX + iconSize + 20, enemyY + 30);

        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Level ${this.enemy.level}`, enemyX + iconSize + 20, enemyY + 60);

        const hpBarWidth = 200, hpBarHeight = 20;
        const hpBarX = enemyX + iconSize + 20, hpBarY = enemyY + 70;
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

        const hpWidth = (this.enemy.hp/this.enemy.maxHp)*hpBarWidth;
        this.ctx.fillStyle = '#F44336';
        this.ctx.fillRect(hpBarX, hpBarY, hpWidth, hpBarHeight);

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`${this.enemy.hp}/${this.enemy.maxHp} HP`,
            hpBarX + hpBarWidth/2, hpBarY + hpBarHeight/2 + 6);
    }
    setPlayerCreature(creature) {
        this.playerCreature = creature;
        if (this.battleLogic) {
            this.battleLogic.setPlayerCreature(creature);
        }
    }
    renderExitButton() {
        this.ctx.fillStyle = '#F44336';
        this.ctx.fillRect(this.exitButton.x, this.exitButton.y, this.exitButton.width, this.exitButton.height);
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('EXIT', this.exitButton.x + this.exitButton.width/2, this.exitButton.y + this.exitButton.height/2 + 6);
        this.ctx.textAlign = 'left';
    }

    handleBattleClick(x, y) {
        if (x >= this.exitButton.x && x <= this.exitButton.x + this.exitButton.width &&
            y >= this.exitButton.y && y <= this.exitButton.y + this.exitButton.height) {
            return { type: 'SWITCH_TO_LOBBY' };
        }

        const boardPos = this.battleLogic.getBoardPosition();
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleBoardClick(x, y, boardPos, wrappedCallback);
        return null;
    }

    handleSwipe(startX, startY, endX, endY) {
        const boardPos = this.battleLogic.getBoardPosition();
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleBoardSwipe(startX, startY, endX, endY, boardPos, wrappedCallback);
        return null;
    }

    handleKeyboard(key) {
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleKeyboardInput(key, wrappedCallback);
        return null;
    }

    // processMoveWrapper(fromRow, fromCol, toRow, toCol) {
    //     const moveResult = this.battleLogic.processMove(fromRow, fromCol, toRow, toCol);
    //     if (!moveResult.success) return false;

    //     this.isAnimating = true;
    //     this.fastAnimation = false;

    //     if (this.battleLogic.pendingRemoval.length > 0) {
    //         this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
    //             this.startDisappearAnimation(row, col, level);
    //         });
    //     }

    //     const { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc, splitResult } = moveResult;
    //     this.startMoveAnimation(fr, fc, tr, tc, moveResult.crystalAtDestination.level, () => {
    //         if (splitResult && splitResult.shouldDisappear) {
    //             this.battleLogic.markShardsForRemoval(fr, fc, tr, tc, () => {
    //                 this.battleLogic.highlightRandomCrystal();
    //                 this.battleLogic.clearAnimatingFlag(tr, tc);
    //                 this.render();
    //             });
    //         } else {
    //             this.battleLogic.clearAnimatingFlag(tr, tc);
    //             this.battleLogic.highlightRandomCrystal();
    //             this.render();
    //         }
    //     });

    //     return true;
    // }
    processMoveWrapper(fromRow, fromCol, toRow, toCol) {
        const moveResult = this.battleLogic.processMove(fromRow, fromCol, toRow, toCol);
        if (!moveResult.success) return false;

        this.isAnimating = true;
        this.fastAnimation = false;

        const { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc, splitResult } = moveResult;

        if (this.battleLogic.pendingRemoval.length > 0) {
            this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
                this.startDisappearAnimation(row, col, level);
            });
        }
        // ⚡ Здесь сразу проверяем на поглощение пэтом
        // this.battleLogic.markShardsForRemoval(fr, fc, tr, tc);
        // this.battleLogic.markShardsForRemoval(fr, fc, tr, tc, this.playerCreature);
        this.battleLogic.markShardsForRemoval(this.playerCreature);



        // Запускаем анимацию движения
        this.startMoveAnimation(fr, fc, tr, tc, moveResult.crystalAtDestination.level, () => {
            // После анимации обработка удалений

            // Очистка флагов и обновление
            this.battleLogic.clearAnimatingFlag(tr, tc);
        });

        this.battleLogic.highlightRandomCrystal();
        this.render();
        return true;
    }


    isTargetPositionAnimated(row, col) {
        return this.battleLogic.isTargetPositionAnimated(row, col, this.animations);
    }

    startMoveAnimation(fromRow, fromCol, toRow, toCol, level, onComplete) {
        this.animations.push({ type:'move', fromRow, fromCol, toRow, toCol, level, startTime:Date.now(), duration:this.fastAnimation?20:200, onComplete });
    }

    startDisappearAnimation(row, col, level, onComplete) {
        this.animations.push({ type:'disappear', row, col, level, startTime:Date.now(), duration:this.fastAnimation?20:200, onComplete });
    }

    drawAnimations() {
        const currentTime = Date.now();
        const finishedCallbacks = [];
        const boardPos = this.battleLogic.getBoardPosition();
        const remaining = [];

        for (const anim of this.animations) {
            const progress = Math.min((currentTime - anim.startTime)/anim.duration, 1);
            if (anim.type === 'move') this.battleLogic.drawMoveAnimation(this.ctx, anim, progress, boardPos);
            else if (anim.type === 'disappear') this.battleLogic.drawDisappearAnimation(this.ctx, anim, progress, boardPos);

            if (progress < 1) remaining.push(anim);
            else if (typeof anim.onComplete === 'function') finishedCallbacks.push(anim.onComplete);
        }

        this.animations = remaining;
        if (remaining.length === 0) { this.isAnimating=false; this.fastAnimation=false; }

        finishedCallbacks.forEach(cb => { try { cb(); } catch(e){ console.error(e); } });
    }

    // setPlayerCreature(creature) { this.playerCreature = creature; }
    setCreatureDisplayModule(module) { this.creatureDisplayModule = module; }
    setQuestProgressModule(module) { this.questProgressModule = module; }

    onEnter(data) {
        if (data && data.playerCreature) this.setPlayerCreature(data.playerCreature);
        this.battleLogic.initializeBoard();

        if (this.battleLogic.pendingRemoval.length > 0) {
            this.isAnimating = true;
            this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
                this.startDisappearAnimation(row, col, level);
            });
            setTimeout(() => {
                this.battleLogic.highlightRandomCrystal();
                this.isAnimating = false;
                this.render();
            }, 200);
        } else {
            this.battleLogic.highlightRandomCrystal();
        }

        if (this.questProgressModule) {
            this.questProgressModule.startMovement();
            setTimeout(()=>{ if(this.questProgressModule) this.questProgressModule.stopMovement(); },1000);
        }
    }

    getStateConfig() {
        return {
            name: 'BATTLE',
            handlers: {
                render: ctx => this.render(),
                handleClick: (x,y) => this.handleBattleClick(x,y),
                handleSwipe: (sx,sy,ex,ey) => this.handleSwipe(sx,sy,ex,ey),
                handleKeyboard: key => this.handleKeyboard(key),
                onEnter: data => this.onEnter(data)
            }
        };
    }
}

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BattleModule;
}
