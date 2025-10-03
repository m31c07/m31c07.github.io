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
        this.currentTurn = 1;
        this.totalTurns = 1;
        this.battleConfigModule = null;
        this.currencyModule = null;
        this.battleResult = null; // 'WIN' | 'LOSE' | null

        // Background image: load once, draw after load
        this.bgImage = new Image();
        this.backgroundPath = 'img/back/bg_lobby_1.png';
        this.bgImageLoaded = false;
        this.bgImage.onload = () => { this.bgImageLoaded = true; console.log('Battle background loaded'); };
        this.bgImage.onerror = () => { console.error('Failed to load battle background:', this.backgroundPath); };
        this.bgImage.src = this.backgroundPath;
    }

    render() {
        // Background (draw only after image is loaded; otherwise fallback fill)
        if (this.bgImage && this.bgImage.complete && this.bgImage.naturalWidth !== 0) {
            this.ctx.drawImage(this.bgImage, 0, 0, 768, 1376);
        } else {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, 768, 1376);
        }

        this.renderEnemy();
        if (this.questProgressModule) {
            this.questProgressModule.stopMovement();
            this.questProgressModule.render(this.playerCreature);
        }

        this.battleLogic.renderBoard(this.ctx, this.isTargetPositionAnimated.bind(this));
        this.drawAnimations();
        this.renderExitButton();
        this.renderBattleEndOverlay();
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

    renderBattleEndOverlay() {
        if (!this.battleResult) return;
        // Полупрозрачный оверлей
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.fillRect(0, 0, 768, 1376);

        // Текст результата
        const text = this.battleResult === 'WIN' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
        this.ctx.fillStyle = this.battleResult === 'WIN' ? '#4CAF50' : '#F44336';
        this.ctx.font = 'bold 72px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, 384, 550);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Нажмите чтобы вернуться в лобби', 384, 620);
        this.ctx.textAlign = 'left';
        this.ctx.restore();
    }

    handleBattleClick(x, y) {
        // return { type: 'SWITCH_TO_LOBBY' };
        if (x >= this.exitButton.x && x <= this.exitButton.x + this.exitButton.width &&
            y >= this.exitButton.y && y <= this.exitButton.y + this.exitButton.height) {
            return { type: 'SWITCH_TO_LOBBY' };
        }

        // Если бой завершён — игнорируем клики по полю
        if (this.battleResult) return { type: 'SWITCH_TO_LOBBY' };

        const boardPos = this.battleLogic.getBoardPosition();
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleBoardClick(x, y, boardPos, wrappedCallback);
        return null;
    }

    handleSwipe(startX, startY, endX, endY) {
        if (this.battleResult) return null;
        const boardPos = this.battleLogic.getBoardPosition();
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleBoardSwipe(startX, startY, endX, endY, boardPos, wrappedCallback);
        return null;
    }

    handleKeyboard(key) {
        if (this.battleResult) return null;
        const wrappedCallback = (fromRow, fromCol, toRow, toCol) => this.processMoveWrapper(fromRow, fromCol, toRow, toCol);
        this.battleLogic.handleKeyboardInput(key, wrappedCallback);
        return null;
    }

    processMoveWrapper(fromRow, fromCol, toRow, toCol) {
        const moveResult = this.battleLogic.processMove(fromRow, fromCol, toRow, toCol);
        if (!moveResult.success) return false;
        this.isAnimating = true;
        this.fastAnimation = false;

        const { fromRow: fr, fromCol: fc, toRow: tr, toCol: tc } = moveResult;

        this.startMoveAnimation(fr, fc, tr, tc, moveResult.crystalAtDestination.level, () => {
            this.battleLogic.clearAnimatingFlag(tr, tc);

            const cfg = this.battleConfigModule?.getBattleConfigFor(this.playerCreature);
            const nextCrystalEvent = cfg
                ? (cfg.events ?? [])
                    .filter(ev => ev.type === 'crystal' && ev.turn > this.currentTurn)
                    .sort((a, b) => a.turn - b.turn)[0]
                : null;

            // Логика продвижения хода:
            // - Если поле пустое: перепрыгиваем к ближайшему спавну (если есть), иначе +1
            // - Если остались только помеченные к удалению: просто +1 автоход
            if (this.battleLogic.isBoardEmpty()) {
                this.currentTurn = nextCrystalEvent ? nextCrystalEvent.turn : (this.currentTurn + 1);
            } else if (this.battleLogic.isOnlyMarkedCrystalsLeft()) {
                this.currentTurn = this.currentTurn + 1;
            } else {
                this.currentTurn = this.currentTurn + 1;
            }

            this.battleLogic.decrementJustSpawned();

            if (cfg) {
                for (const ev of (cfg.events ?? [])) {
                    if (ev.type === 'crystal' && ev.turn === this.currentTurn) {
                        this.battleLogic.spawnCrystal(ev.level, ev.element);
                    }
                }
            }

            if (this.questProgressModule) {
                this.questProgressModule.setCurrentTurn(this.currentTurn);
                this.questProgressModule.startMovement();
                setTimeout(() => { this.questProgressModule?.stopMovement(); }, 500);
            }

            if (this.battleLogic.pendingRemoval.length > 0) {
                this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
                    this.startDisappearAnimation(row, col, level);
                });
            }

            const proceedAfterRemovals = () => {
                this.battleLogic.markShardsForRemoval(this.playerCreature);
                this.battleLogic.highlightRandomCrystal();
                this.render();
            };

        const delayMs = this.battleLogic.pendingRemoval.length > 0 ? 220 : 0;
            setTimeout(() => {
                proceedAfterRemovals();
                this.checkAndHandleBattleEnd();
                this.render();
            }, delayMs);
        });
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

        // Авто-переход хода: если на поле пусто или остались только помеченные,
        // перепрыгиваем к ближайшему ходу со спавном и спавним ДО удаления.
        if (!this.isAnimating) {
            this.autoAdvanceIfOnlyMarkedOrEmpty();
            this.checkAndHandleBattleEnd();
        }
    }

    // setPlayerCreature(creature) { this.playerCreature = creature; }
    setCreatureDisplayModule(module) { this.creatureDisplayModule = module; }
    setQuestProgressModule(module) { this.questProgressModule = module; }
    setBattleConfigModule(module) { this.battleConfigModule = module; }
    setCurrencyModule(module) { this.currencyModule = module; }

    // Новый помощник: автопереход хода без действия игрока,
    // сохраняя отложенное удаление (спавним перед удалением)
    autoAdvanceIfOnlyMarkedOrEmpty() {
        const cfg = this.battleConfigModule?.getBattleConfigFor(this.playerCreature);
        if (!cfg) return;

        const onlyMarked = this.battleLogic.isOnlyMarkedCrystalsLeft();
        const boardEmpty = this.battleLogic.isBoardEmpty();
        if (!onlyMarked && !boardEmpty) return;

        // Если осталось только помеченное — просто +1 автоход
        if (onlyMarked) {
            this.currentTurn += 1;
            this.battleLogic.decrementJustSpawned();

            // Спавним новые кристаллы на текущем ходе ДО удаления
            for (const ev of (cfg.events ?? [])) {
                if (ev.type === 'crystal' && ev.turn === this.currentTurn) {
                    this.battleLogic.spawnCrystal(ev.level, ev.element);
                }
            }

            if (this.questProgressModule) {
                this.questProgressModule.setCurrentTurn(this.currentTurn);
                this.questProgressModule.startMovement();
                setTimeout(() => { this.questProgressModule?.stopMovement(); }, 500);
            }
        } else if (boardEmpty) {
            // Если поле пустое — перепрыгиваем к ближайшему будущему спавну
            const nextCrystalEvent = (cfg.events ?? [])
                .filter(ev => ev.type === 'crystal' && ev.turn > this.currentTurn)
                .sort((a, b) => a.turn - b.turn)[0] || null;
            if (!nextCrystalEvent) return;

            this.currentTurn = nextCrystalEvent.turn;
            this.battleLogic.decrementJustSpawned();

            for (const ev of (cfg.events ?? [])) {
                if (ev.type === 'crystal' && ev.turn === this.currentTurn) {
                    this.battleLogic.spawnCrystal(ev.level, ev.element);
                }
            }

            if (this.questProgressModule) {
                this.questProgressModule.setCurrentTurn(this.currentTurn);
                this.questProgressModule.startMovement();
                setTimeout(() => { this.questProgressModule?.stopMovement(); }, 500);
            }
        }

        // Затем удаляем ранее помеченные (если есть) — с анимацией
        if (this.battleLogic.pendingRemoval.length > 0) {
            this.isAnimating = true;
            this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
                this.startDisappearAnimation(row, col, level);
            });
        }

        // После удаления помечаем новые, подсвечиваем и перерисовываем
        const delayMs = this.battleLogic.pendingRemoval.length > 0 ? 220 : 0;
        setTimeout(() => {
            this.battleLogic.markShardsForRemoval(this.playerCreature);
            this.battleLogic.highlightRandomCrystal();
            this.render();
        }, delayMs);
    }

    onEnter(data) {
        if (data && data.playerCreature) this.setPlayerCreature(data.playerCreature);
        this.battleLogic.initializeBoard();

        const cfg = this.battleConfigModule?.getBattleConfigFor(this.playerCreature);
        if (cfg) {
            this.totalTurns = cfg.totalTurns ?? 1;
            this.currentTurn = 1;
            for (const ev of (cfg.events ?? [])) {
                if (ev.type === 'crystal' && ev.turn === 1) {
                    this.battleLogic.spawnCrystal(ev.level, ev.element);
                }
            }
            if (this.questProgressModule) {
                this.questProgressModule.setBattleConfig(cfg);
                this.questProgressModule.setCurrentTurn(this.currentTurn);
            }
        }

        if (this.battleLogic.pendingRemoval.length > 0) {
            this.isAnimating = true;
            this.battleLogic.processPendingRemovalsWithAnimation((row, col, level) => {
                this.startDisappearAnimation(row, col, level);
            });
            setTimeout(() => {
                this.battleLogic.highlightRandomCrystal();
                this.isAnimating = false;
                this.render();
                this.checkAndHandleBattleEnd();
            }, 200);
        } else {
            this.battleLogic.highlightRandomCrystal();
            this.checkAndHandleBattleEnd();
        }

        if (this.questProgressModule) {
            this.questProgressModule.startMovement();
            setTimeout(()=>{ if(this.questProgressModule) this.questProgressModule.stopMovement(); },1000);
        }
    }

    onExit() {
        // Сбросить все флаги и временные состояния боя
        this.isSwiping = false;
        this.swipeStart = { x: 0, y: 0 };
        this.swipeEnd = { x: 0, y: 0 };
        this.animations = [];
        this.isAnimating = false;
        this.fastAnimation = false;
        this.currentTurn = 1;
        this.totalTurns = 1;
        this.battleResult = null;

        // Остановить анимацию прогресса квеста
        if (this.questProgressModule && typeof this.questProgressModule.stopMovement === 'function') {
            this.questProgressModule.stopMovement();
        }

        // Очистить состояние логики боя
        if (this.battleLogic && typeof this.battleLogic.initializeBoard === 'function') {
            this.battleLogic.initializeBoard();
        }
        if (this.battleLogic) {
            this.battleLogic.highlightedCrystal = null;
            this.battleLogic.pendingRemoval = [];
        }
    }

    checkAndHandleBattleEnd() {
        const res = this.battleLogic.checkBattleEnd();
        if (res && res.ended) {
            // Если победа, но в конфиге есть будущие спавны кристаллов — не завершаем бой
            if (res.result === 'WIN' && this.battleConfigModule) {
                const cfg = this.battleConfigModule.getBattleConfigFor(this.playerCreature);
                const hasFutureCrystal = (cfg?.events ?? []).some(ev => ev.type === 'crystal' && ev.turn > this.currentTurn);
                if (hasFutureCrystal) {
                    // Поле пусто, но впереди будут спавны — пусть авто‑переход дойдёт до ближайшего
                    return;
                }
            }

            // Устанавливаем результат боя
            const prevResult = this.battleResult;
            this.battleResult = res.result; // 'WIN' или 'LOSE'

            // Начисляем награду из конфига только один раз, при первой фиксации победы
            if (!prevResult && this.battleResult === 'WIN' && this.battleConfigModule && this.currencyModule) {
                const cfg = this.battleConfigModule.getBattleConfigFor(this.playerCreature);
                const rewardCurrency = cfg?.reward?.currency || {};
                const gold = Number(rewardCurrency.gold || 0);
                const gem = Number(rewardCurrency.gem || 0);
                if (gold > 0 && typeof this.currencyModule.addGold === 'function') {
                    this.currencyModule.addGold(gold);
                }
                if (gem > 0 && typeof this.currencyModule.addGems === 'function') {
                    this.currencyModule.addGems(gem);
                }
            }
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
                onEnter: data => this.onEnter(data),
                onExit: () => this.onExit()
            }
        };
    }
}

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BattleModule;
}
