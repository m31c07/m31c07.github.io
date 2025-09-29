class BattleLogicModule {
    constructor() {
        this.board = Array.from({ length: 5 }, () => Array(5).fill(null));
        this.highlightedCrystal = null;
        this.pendingRemoval = [];

        this.boardSize = 650;
        this.slotSize = this.boardSize / 5;
        this.boardX = (768 - this.boardSize) / 2;
        this.boardY = 500;
    }

    initializeBoard() {
        this.board = Array.from({ length: 5 }, () => Array(5).fill(null));
        this.pendingRemoval = [];
        const row = Math.floor(Math.random() * 5);
        const col = Math.floor(Math.random() * 5);
        this.board[row][col] = { level: 7, type: 'fire' };
    }

    setPlayerCreature(creature) {
        this.playerCreature = creature;
    }

    hasAdjacentEmptySpaces(row, col) {
        const directions = [[-1,0],[0,1],[1,0],[0,-1]];
        return directions.some(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            return r >= 0 && r < 5 && c >= 0 && c < 5 && this.board[r][c] === null;
        });
    }

    attemptMove(fromRow, fromCol, toRow, toCol) {
        if (toRow < 0 || toRow >= 5 || toCol < 0 || toCol >= 5) return false;
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        return ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) && this.board[toRow][toCol] === null;
    }

    splitCrystal(fromRow, fromCol, toRow, toCol) {
        const crystal = this.board[fromRow][fromCol];
        const shardLevel = crystal.level - 1;
        this.board[fromRow][fromCol] = { level: shardLevel, type: crystal.type };
        this.board[toRow][toCol] = { level: shardLevel, type: crystal.type };
        return { shardLevel, shouldDisappear: shardLevel === 1 };
    }

    // markShardsForRemoval(fromRow, fromCol, toRow, toCol, onComplete) {
    //     [[fromRow, fromCol],[toRow, toCol]].forEach(([r,c])=>{
    //         if (this.board[r][c] && this.board[r][c].level === 1) this.pendingRemoval.push({row:r,col:c});
    //     });
    //     if (onComplete) onComplete();
    // }
    // markShardsForRemoval(fromRow, fromCol, toRow, toCol, playerCreature, onComplete) {
    //     // Обходим все кристаллы на поле
    //     for (let r = 0; r < 5; r++) {
    //         for (let c = 0; c < 5; c++) {
    //             const crystal = this.board[r][c];
    //             if (!crystal) continue;

    //             let chance = 0;

    //             // Первый уровень всегда помечаем
    //             if (crystal.level === 1) {
    //                 chance = 1;
    //             } else {
    //                 // Более высокие уровни зависят от пэта
    //                 const absorption = playerCreature?.absorption?.[crystal.type] || {};
    //                 chance = absorption[crystal.level] ?? 0;
    //             }

    //             if (Math.random() < chance) {
    //                 this.pendingRemoval.push({ row: r, col: c });
    //                 crystal.markedForRemoval = true; // для визуальной отрисовки
    //             }
    //         }
    //     }

    //     if (onComplete) onComplete();
    // }
    markShardsForRemoval(playerCreature, onComplete) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (!crystal) continue;

                // Уже помеченный кристалл пропускаем
                if (crystal.markedForRemoval) continue;

                let chance = 0;
                if (crystal.level === 1) {
                    chance = 1; // базовый уровень всегда помечаем
                } else {
                    const absorption = playerCreature?.absorption?.[crystal.type] || {};
                    chance = absorption[crystal.level] ?? 0;
                }

                if (Math.random() < chance) {
                    this.pendingRemoval.push({ row: r, col: c });
                    crystal.markedForRemoval = true; // для визуальной отрисовки
                }
            }
        }

        // Вызываем только если это функция
        if (typeof onComplete === 'function') onComplete();
    }




    processPendingRemovals() {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (crystal && crystal.markedForRemoval) {
                    this.board[r][c] = null;
                }
            }
        }
    }

    processPendingRemovalsWithAnimation(startDisappearAnimationCallback) {
        for (const pos of this.pendingRemoval) {
            if (this.board[pos.row][pos.col]) startDisappearAnimationCallback(pos.row, pos.col, this.board[pos.row][pos.col].level);
        }
        setTimeout(() => {
            this.pendingRemoval.forEach(pos => this.board[pos.row][pos.col] = null);
            this.pendingRemoval = [];
        }, 200);
    }

    handleBoardClick(x, y, boardPos, attemptMoveCallback) {
        if (x < boardPos.boardX || x >= boardPos.boardX + boardPos.boardSize ||
            y < boardPos.boardY || y >= boardPos.boardY + boardPos.boardSize) return;

        const col = Math.floor((x - boardPos.boardX) / boardPos.slotSize);
        const row = Math.floor((y - boardPos.boardY) / boardPos.slotSize);

        if (!this.board[row][col]) return;
        if (!this.highlightedCrystal || this.highlightedCrystal.row !== row || this.highlightedCrystal.col !== col) return;

        const directions = [[0,1],[1,0],[0,-1],[-1,0]];
        for (const [dr,dc] of directions) {
            const tr = row+dr, tc = col+dc;
            if (this.attemptMove(row,col,tr,tc)) {
                attemptMoveCallback(row,col,tr,tc);
                return;
            }
        }
    }

    handleBoardSwipe(startX, startY, endX, endY, boardPos, attemptMoveCallback) {
        if (startX < boardPos.boardX || startX >= boardPos.boardX + boardPos.boardSize ||
            startY < boardPos.boardY || startY >= boardPos.boardY + boardPos.boardSize) return;

        const startCol = Math.floor((startX - boardPos.boardX) / boardPos.slotSize);
        const startRow = Math.floor((startY - boardPos.boardY) / boardPos.slotSize);

        if (!this.board[startRow][startCol] ||
            !this.highlightedCrystal ||
            this.highlightedCrystal.row !== startRow ||
            this.highlightedCrystal.col !== startCol) return;

        let targetRow = startRow, targetCol = startCol;
        const deltaX = endX - startX, deltaY = endY - startY;
        if (Math.abs(deltaX) > Math.abs(deltaY)) targetCol += deltaX > 0 ? 1 : -1;
        else targetRow += deltaY > 0 ? 1 : -1;

        attemptMoveCallback(startRow, startCol, targetRow, targetCol);
    }

    handleKeyboardInput(key, attemptMoveCallback) {
        if (!this.highlightedCrystal) return;
        const row = this.highlightedCrystal.row, col = this.highlightedCrystal.col;
        if (!this.board[row][col] || this.board[row][col].level <= 1 || !this.hasAdjacentEmptySpaces(row,col)) return;

        let targetRow = row, targetCol = col;
        switch(key){
            case 'ArrowUp': targetRow--; break;
            case 'ArrowDown': targetRow++; break;
            case 'ArrowLeft': targetCol--; break;
            case 'ArrowRight': targetCol++; break;
            default: return;
        }
        attemptMoveCallback(row,col,targetRow,targetCol);
    }

    highlightRandomCrystal() {
        const splittable = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (crystal && crystal.level > 1 && this.hasAdjacentEmptySpaces(r,c) && !crystal.markedForRemoval) {
                    splittable.push({ row: r, col: c });
                }
            }
        }
        this.highlightedCrystal = splittable.length ? splittable[Math.floor(Math.random() * splittable.length)] : null;
    }


    checkBattleEnd() {
        let count = 0, splittable=false;
        const pendingSet = new Set(this.pendingRemoval.map(p=>`${p.row},${p.col}`));
        for (let r=0;r<5;r++) for (let c=0;c<5;c++){
            if (pendingSet.has(`${r},${c}`)) continue;
            if (this.board[r][c]) {
                count++;
                if (this.board[r][c].level>1 && this.hasAdjacentEmptySpaces(r,c)) splittable=true;
            }
        }
        if (count===0 || !splittable) console.log("Battle ended");
    }

    isTargetPositionAnimated(row, col, animations) {
        return animations.some(anim=>anim.type==='move' && anim.toRow===row && anim.toCol===col);
    }

    processMove(fromRow, fromCol, toRow, toCol) {
        if (!this.attemptMove(fromRow, fromCol, toRow, toCol)) return { success:false, fromRow, fromCol, toRow, toCol, splitResult:null, crystalAtSource:null, crystalAtDestination:null, message:"Invalid move" };
        const crystal = this.board[fromRow][fromCol];
        if (!crystal) return { success:false, fromRow, fromCol, toRow, toCol, splitResult:null, crystalAtSource:null, crystalAtDestination:null, message:"No crystal" };

        const splitResult = this.splitCrystal(fromRow, fromCol, toRow, toCol);
        if (this.board[toRow][toCol]) this.board[toRow][toCol].animating = true;

        return { success:true, fromRow, fromCol, toRow, toCol, splitResult, crystalAtSource:this.board[fromRow][fromCol], crystalAtDestination:this.board[toRow][toCol], message:"Move successful" };
    }

    clearAnimatingFlag(row, col) { if (this.board[row] && this.board[row][col] && this.board[row][col].animating) delete this.board[row][col].animating; }

    drawMoveAnimation(ctx, animation, progress, boardPos) {
        const { fromRow, fromCol, toRow, toCol, level } = animation;
        const fromX = boardPos.boardX + fromCol*boardPos.slotSize;
        const fromY = boardPos.boardY + fromRow*boardPos.slotSize;
        const toX = boardPos.boardX + toCol*boardPos.slotSize;
        const toY = boardPos.boardY + toRow*boardPos.slotSize;
        const x = fromX + (toX-fromX)*progress;
        const y = fromY + (toY-fromY)*progress;
        ctx.fillStyle='#8B0000';
        ctx.fillRect(x+5,y+5,boardPos.slotSize-14,boardPos.slotSize-14);
        ctx.fillStyle='#000'; ctx.font='bold 20px Arial'; ctx.textAlign='center';
        ctx.fillText(level.toString(),x+boardPos.slotSize/2,y+boardPos.slotSize/2+6); ctx.textAlign='left';
    }

    drawDisappearAnimation(ctx, animation, progress, boardPos) {
        const { row, col, level } = animation;
        if (!this.board[row][col]) return;
        const x = boardPos.boardX + col*boardPos.slotSize;
        const y = boardPos.boardY + row*boardPos.slotSize;
        const scale = 1 + progress, opacity = 1 - progress;
        ctx.save(); ctx.globalAlpha = opacity; ctx.translate(x+boardPos.slotSize/2,y+boardPos.slotSize/2); ctx.scale(scale,scale);
        ctx.fillStyle='#FF00FF'; ctx.fillRect(-boardPos.slotSize/2+5,-boardPos.slotSize/2+5,boardPos.slotSize-14,boardPos.slotSize-14);
        ctx.fillStyle='#000'; ctx.font='bold 20px Arial'; ctx.textAlign='center'; ctx.fillText(level.toString(),0,6); ctx.textAlign='left'; ctx.restore();
    }

    drawCrystal(ctx, row, col, crystal, highlightedCrystal, boardPos) {
        const x = boardPos.boardX + col * boardPos.slotSize;
        const y = boardPos.boardY + row * boardPos.slotSize;

        if (!crystal) return;

        // Если кристалл в pendingRemoval — красим в фиолетовый
        const isPendingRemoval = this.pendingRemoval.some(pos => pos.row === row && pos.col === col);

        if (isPendingRemoval) {
            ctx.fillStyle = '#FF00FF'; // фиолетовый для кристаллов к удалению
        } else if (highlightedCrystal && highlightedCrystal.row === row && highlightedCrystal.col === col) {
            ctx.fillStyle = '#8B0000'; // темно-красный для выделенного
        } else {
            ctx.fillStyle = '#FFD700'; // желтый для обычного
        }

        ctx.fillRect(x + 5, y + 5, boardPos.slotSize - 14, boardPos.slotSize - 14);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(crystal.level.toString(),
            x + boardPos.slotSize / 2,
            y + boardPos.slotSize / 2 + 6);
        ctx.textAlign = 'left';
    }

    renderBoard(ctx,isTargetPositionAnimated){
        const boardPos=this.getBoardPosition();
        ctx.fillStyle='#16213e'; ctx.fillRect(boardPos.boardX-10,boardPos.boardY-10,boardPos.boardSize+20,boardPos.boardSize+20);
        const board=this.getBoard(), highlightedCrystal=this.getHighlightedCrystal();
        for(let r=0;r<5;r++) for(let c=0;c<5;c++){
            const x=boardPos.boardX+c*boardPos.slotSize, y=boardPos.boardY+r*boardPos.slotSize;
            ctx.fillStyle='#0f3460'; ctx.fillRect(x,y,boardPos.slotSize-4,boardPos.slotSize-4);
            ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2; ctx.strokeRect(x,y,boardPos.slotSize-4,boardPos.slotSize-4);
            if(board[r][c] && !(board[r][c].animating && isTargetPositionAnimated(r,c))) this.drawCrystal(ctx,r,c,board[r][c],highlightedCrystal,boardPos);
        }
    }

    getBoard(){ return this.board; }
    getHighlightedCrystal(){ return this.highlightedCrystal; }
    getBoardPosition(){ return { boardX:this.boardX, boardY:this.boardY, boardSize:this.boardSize, slotSize:this.slotSize }; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = BattleLogicModule;
