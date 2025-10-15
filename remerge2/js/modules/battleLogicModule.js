// Класс BattleLogicModule — новая утилита снятия метки после хода
class BattleLogicModule {
    constructor() {
        this.board = Array.from({ length: 5 }, () => Array(5).fill(null));
        this.highlightedCrystal = null;
        this.pendingRemoval = [];

        this.boardSize = 770;
        this.slotSize = 110;
        // this.boardX = (770 - this.boardSize) / 2;
        this.boardX = 100;
        this.boardY = 500;

        // Background image for the battle board
        this.boardBgImage = new Image();
        this.boardBgImage.src = 'img/back/bg_battle_board.png';
        this.boardBgImage.onload = () => { console.log('Battle board background loaded'); };
        this.boardBgImage.onerror = () => { console.error('Failed to load battle board background'); };
    }

    // Exclude corner slots from the playable board
    isExcludedCell(row, col) {
        return (
            (row === 0 && col === 0) ||
            (row === 0 && col === 4) ||
            (row === 4 && col === 0) ||
            (row === 4 && col === 4)
        );
    }

    initializeBoard() {
        this.board = Array.from({ length: 5 }, () => Array(5).fill(null));
        this.pendingRemoval = [];
        const row = Math.floor(Math.random() * 5);
        const col = Math.floor(Math.random() * 5);
        // this.board[row][col] = { level: 7, type: 'fire' };
    }

    setPlayerCreature(creature) {
        this.playerCreature = creature;
    }

    hasAdjacentEmptySpaces(row, col) {
        const directions = [[-1,0],[0,1],[1,0],[0,-1]];
        return directions.some(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            return r >= 0 && r < 5 && c >= 0 && c < 5 && !this.isExcludedCell(r, c) && this.board[r][c] === null;
        });
    }

    attemptMove(fromRow, fromCol, toRow, toCol) {
        if (toRow < 0 || toRow >= 5 || toCol < 0 || toCol >= 5) return false;
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        if (this.isExcludedCell(fromRow, fromCol) || this.isExcludedCell(toRow, toCol)) return false;
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
    // markShardsForRemoval(playerCreature, onComplete) {
    //     for (let r = 0; r < 5; r++) {
    //         for (let c = 0; c < 5; c++) {
    //             const crystal = this.board[r][c];
    //             if (!crystal) continue;

    //             // Уже помеченный кристалл пропускаем
    //             if (crystal.markedForRemoval) continue;

    //             let chance = 0;
    //             if (crystal.level === 1) {
    //                 chance = 1; // базовый уровень всегда помечаем
    //             } else {
    //                 const absorption = playerCreature?.absorption?.[crystal.type] || {};
    //                 chance = absorption[crystal.level] ?? 0;
    //             }

    //             if (Math.random() < chance) {
    //                 this.pendingRemoval.push({ row: r, col: c });
    //                 crystal.markedForRemoval = true; // для визуальной отрисовки
    //             }
    //         }
    //     }

    //     // Вызываем только если это функция
    //     if (typeof onComplete === 'function') onComplete();
    // }
    markShardsForRemoval(playerCreature, onComplete) {
        const gridSize = this.board.length;

        // ----------------------
        // 0. Автоматическое исчезновение уровня 1
        // ----------------------
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const crystal = this.board[r][c];
                if (crystal && crystal.level === 1) {
                    this.pendingRemoval.push({ row: r, col: c });
                    crystal.markedForRemoval = true;
                }
            }
        }

        // ----------------------
        // 1. Поглощение
        // ----------------------
        const candidates = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const crystal = this.board[r][c];
                if (!crystal) continue;
                if (crystal.level === 1 || crystal.markedForRemoval) continue;

                const absorption = playerCreature?.absorption?.[crystal.type] || {};
                const chance = absorption[crystal.level] ?? 0;

                if (chance > 0 && Math.random() < chance) {
                    candidates.push({ r, c, crystal });
                }
            }
        }

        if (candidates.length) {
            const slots = playerCreature?.absorptionSlots ?? candidates.length;

            const toRemove = candidates
                .sort(() => Math.random() - 0.5) // перемешиваем
                .slice(0, Math.min(slots, candidates.length));

            for (const { r, c, crystal } of toRemove) {
                this.pendingRemoval.push({ row: r, col: c });
                crystal.markedForRemoval = true;
            }
        }

        // ----------------------
        // callback
        // ----------------------
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

    processPendingRemovalsWithAnimation(startDisappearAnimationCallback, startIgniteAnimationCallback, onCascadeComplete) {
        // Двухфазный каскад:
        // Фаза A (удаление): каждый удаляемый уровня n исчезает и поджигает ортососедей уровня (n+1).
        // Фаза B (гашение): все подожжённые снижают свой уровень на 1 и снимают поджог.
        // Если во время гашения какой-то кристалл стал уровнем 1, он попадает в следующую волну удаления.
        // Повторяем A→B, пока больше нечего удалять/гасить.

        const keyOf = (r, c) => `${r},${c}`;
        // Соседние клетки: только ортогональные (без диагоналей)
        const dirs = [
            { dr: -1, dc: 0 }, // up
            { dr: 1, dc: 0 },  // down
            { dr: 0, dc: -1 }, // left
            { dr: 0, dc: 1 }   // right
        ];

        // Уберём дубликаты и сформируем стартовую волну из ВСЕХ помеченных к удалению
        const unique = new Map();
        for (const pos of this.pendingRemoval) {
            const k = keyOf(pos.row, pos.col);
            if (!unique.has(k)) unique.set(k, pos);
        }

        let currentWave = Array.from(unique.values()).filter(p => {
            const crystal = this.board[p.row]?.[p.col];
            return !!crystal && crystal.markedForRemoval;
        });
        // Без глобальных "visited" — действуем строго по шагам каскада

        const processDeletionWave = (deletionWave, carryIgniteWave = []) => {
            // Фаза A: анимация исчезновения
            for (const pos of deletionWave) {
                const crystal = this.board[pos.row]?.[pos.col];
                if (!crystal) continue;
                startDisappearAnimationCallback?.(pos.row, pos.col, crystal.level);
            }
            setTimeout(() => {
                const igniteWave = [];
                for (const pos of deletionWave) {
                    const crystal = this.board[pos.row]?.[pos.col];
                    if (!crystal) continue;
                    const n = crystal.level;
                    // Физическое удаление
                    this.board[pos.row][pos.col] = null;
                    // Поджог соседей уровня (n+1)
                    for (const d of dirs) {
                        const nr = pos.row + d.dr;
                        const nc = pos.col + d.dc;
                        if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) continue;
                        if (this.isExcludedCell(nr, nc)) continue;
                        const neigh = this.board[nr]?.[nc];
                        if (!neigh) continue;
                        // Не зажигаем уже горящие и проверяем правило n+1
                        if (neigh.ignited) continue;
                        if (neigh.level === n + 1) {
                            startIgniteAnimationCallback?.(nr, nc, neigh.level);
                            neigh.ignited = true;
                            igniteWave.push({ row: nr, col: nc });
                        }
                    }
                }
                // Объединяем фронт поджога, возникший из удаления, с
                // заранее рассчитанным фронтом (carryIgniteWave) из предыдущего шага
                const combinedMap = new Map();
                for (const p of igniteWave) combinedMap.set(keyOf(p.row, p.col), p);
                for (const p of carryIgniteWave) combinedMap.set(keyOf(p.row, p.col), p);
                const combinedIgniteWave = Array.from(combinedMap.values());

                if (combinedIgniteWave.length > 0) processIgniteWave(combinedIgniteWave);
                else {
                    this.pendingRemoval = [];
                    if (typeof onCascadeComplete === 'function') {
                        try { onCascadeComplete(); } catch(e) { console.error(e); }
                    }
                }
            }, 200);
        };

        const processIgniteWave = (igniteWave) => {
            // Фаза B: гашение (снижение уровня на 1, снятие ignited)
            setTimeout(() => {
                const nextDeletionWave = [];
                const nextIgniteWave = [];
                for (const pos of igniteWave) {
                    const crystal = this.board[pos.row]?.[pos.col];
                    if (!crystal) continue;
                    const preLevel = crystal.level; // уровень до снижения
                    // Сначала снижаем уровень на 1
                    crystal.level = Math.max(1, preLevel - 1);

                    // Если стал уровнем 1 — попадёт в следующую волну удаления
                    if (crystal.level === 1 && !crystal.markedForRemoval) {
                        crystal.markedForRemoval = true;
                        nextDeletionWave.push({ row: pos.row, col: pos.col });
                    }

                    // «В следующем каскадном шаге подожжённый может поджечь своих n+1 соседей»
                    // n — это исходный уровень до снижения (preLevel)
                    for (const d of dirs) {
                        const nr = pos.row + d.dr;
                        const nc = pos.col + d.dc;
                        if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) continue;
                        if (this.isExcludedCell(nr, nc)) continue;
                        const neigh = this.board[nr]?.[nc];
                        if (!neigh) continue;
                        // Не зажигаем уже горящие сейчас, проверяем k+1
                        if (neigh.ignited) continue;
                        if (neigh.level === preLevel + 1) {
                            startIgniteAnimationCallback?.(nr, nc, neigh.level);
                            neigh.ignited = true;
                            nextIgniteWave.push({ row: nr, col: nc });
                        }
                    }

                    // После обработки соседей снимаем горение с текущей плитки
                    if (crystal.ignited) delete crystal.ignited;
                }

                // Приоритет шага: если есть удаление — выполняем волну удаления;
                // иначе, если есть новый фронт поджога — продолжаем поджог;
                // иначе — каскад завершён.
                if (nextDeletionWave.length > 0) {
                    // ВАЖНО: не теряем фронт поджога — передаём его как carry
                    processDeletionWave(nextDeletionWave, nextIgniteWave);
                } else if (nextIgniteWave.length > 0) {
                    processIgniteWave(nextIgniteWave);
                } else {
                    this.pendingRemoval = [];
                    if (typeof onCascadeComplete === 'function') {
                        try { onCascadeComplete(); } catch(e) { console.error(e); }
                    }
                }
            }, 180);
        };

        // Если нечего удалять, просто сбросим pendingRemoval
        if (currentWave.length === 0) {
            this.pendingRemoval = [];
            return;
        }

        processDeletionWave(currentWave);
    }

    // Спавн кристалла в случайную пустую клетку, с флажком justSpawned
    spawnCrystal(level, type) {
        const empty = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.board[r][c] === null && !this.isExcludedCell(r, c)) empty.push({ r, c });
            }
        }
        if (empty.length === 0) return false;
        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        this.board[r][c] = { level, type, justSpawned: 1 };
        return { row: r, col: c };
    }

    // Новый метод: снимаем оранжевую метку у кристаллов после хода
    decrementJustSpawned() {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (crystal && crystal.justSpawned) {
                    crystal.justSpawned--;
                    if (crystal.justSpawned <= 0) delete crystal.justSpawned;
                }
            }
        }
    }
    // Проверка: все клетки пустые
    isBoardEmpty() {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.board[r][c]) return false;
            }
        }
        return true;
    }

    // Проверка: остались только кристаллы, помеченные к удалению
    isOnlyMarkedCrystalsLeft() {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (crystal && !crystal.markedForRemoval) {
                    return false;
                }
            }
        }
        return true;
    }

    // Удалить случайные кристаллы с поля и вернуть их количество
    removeRandomCrystals(count) {
        const positions = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (!this.isExcludedCell(r, c) && this.board[r][c]) {
                    positions.push({ r, c });
                }
            }
        }
        if (positions.length === 0) return 0;

        // Перемешать и выбрать нужное количество
        positions.sort(() => Math.random() - 0.5);
        const toRemove = positions.slice(0, Math.min(count, positions.length));

        for (const { r, c } of toRemove) {
            this.board[r][c] = null;
        }

        // Сброс выделения, если выделенный кристалл был удалён
        if (this.highlightedCrystal) {
            const { row, col } = this.highlightedCrystal;
            if (!this.board[row]?.[col]) this.highlightedCrystal = null;
        }

        return toRemove.length;
    }

    handleBoardClick(x, y, boardPos, attemptMoveCallback) {
        if (x < boardPos.boardX || x >= boardPos.boardX + boardPos.boardSize ||
            y < boardPos.boardY || y >= boardPos.boardY + boardPos.boardSize) return;

        const col = Math.floor((x - boardPos.boardX) / boardPos.slotSize);
        const row = Math.floor((y - boardPos.boardY) / boardPos.slotSize);
        if (this.isExcludedCell(row, col)) return;

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
        // Обрабатываем свайп для выделенного кристалла независимо от точки начала жеста
        if (!this.highlightedCrystal) return;

        const startRow = this.highlightedCrystal.row;
        const startCol = this.highlightedCrystal.col;

        // Защита от некорректных позиций
        if (this.isExcludedCell(startRow, startCol)) return;
        if (!this.board[startRow][startCol]) return;

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
        const splittableNonSpawned = [];
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const crystal = this.board[r][c];
                if (!this.isExcludedCell(r, c) && crystal && crystal.level > 1 && this.hasAdjacentEmptySpaces(r, c) && !crystal.markedForRemoval) {
                    splittable.push({ row: r, col: c });
                    if (!crystal.justSpawned) {
                        splittableNonSpawned.push({ row: r, col: c });
                    }
                }
            }
        }
        const pool = splittableNonSpawned.length ? splittableNonSpawned : splittable;
        this.highlightedCrystal = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }


    checkBattleEnd() {
        // Подсчитываем оставшиеся (не помеченные к удалению) кристаллы
        let count = 0;
        let splittable = false;
        const pendingSet = new Set(this.pendingRemoval.map(p => `${p.row},${p.col}`));
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (pendingSet.has(`${r},${c}`)) continue;
                const crystal = this.board[r][c];
                if (crystal) {
                    count++;
                    // Клетка доступна для сплита, если уровень > 1, есть соседняя пустая,
                    // и кристалл не помечен к удалению
                    if (crystal.level > 1 && this.hasAdjacentEmptySpaces(r, c) && !crystal.markedForRemoval) {
                        splittable = true;
                    }
                }
            }
        }

        if (count === 0) return { ended: true, result: 'WIN' };
        // Если прямо сейчас нет доступных сплитов, но есть отложенные удаления,
        // не завершаем поражением — после анимаций появятся свободные клетки
        if (!splittable) {
            // Доп. защита: если на поле есть хотя бы один уровень 1,
            // поражение не наступает — эти плитки будут автоматически удалены
            let hasLevel1 = false;
            for (let r = 0; r < 5 && !hasLevel1; r++) {
                for (let c = 0; c < 5 && !hasLevel1; c++) {
                    if (this.isExcludedCell(r, c)) continue;
                    const crystal = this.board[r][c];
                    if (crystal && crystal.level === 1) hasLevel1 = true;
                }
            }
            if (hasLevel1) return { ended: false, result: null };
            if (this.pendingRemoval.length > 0) return { ended: false, result: null };
            return { ended: true, result: 'LOSE' };
        }
        return { ended: false, result: null };
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
        const cx = x + boardPos.slotSize/2;
        const cy = y + boardPos.slotSize/2;
        const r = (boardPos.slotSize-14)/2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fill();
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
        ctx.fillStyle='#FF00FF';
        const r = (boardPos.slotSize-14)/2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle='#000'; ctx.font='bold 20px Arial'; ctx.textAlign='center'; ctx.fillText(level.toString(),0,6); ctx.textAlign='left'; ctx.restore();
    }

    drawIgniteAnimation(ctx, animation, progress, boardPos) {
        const { row, col, level } = animation;
        const x = boardPos.boardX + col * boardPos.slotSize;
        const y = boardPos.boardY + row * boardPos.slotSize;
        const cx = x + boardPos.slotSize / 2;
        const cy = y + boardPos.slotSize / 2;
        const baseR = (boardPos.slotSize - 14) / 2;
        const ringR = baseR * (0.7 + 0.6 * progress);
        const alpha = 0.15 + 0.35 * (1 - Math.abs(2 * progress - 1));

        ctx.save();
        ctx.globalAlpha = alpha;
        // Огненное кольцо
        const grad = ctx.createRadialGradient(cx, cy, ringR * 0.6, cx, cy, ringR);
        grad.addColorStop(0, '#ff8c00');
        grad.addColorStop(1, '#ff4500');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.fill();
        // Лёгкая вспышка уровня
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(level.toString(), cx, cy + 6);
        ctx.textAlign = 'left';
        ctx.restore();
    }

    drawCrystal(ctx, row, col, crystal, highlightedCrystal, boardPos) {
        const x = boardPos.boardX + col * boardPos.slotSize;
        const y = boardPos.boardY + row * boardPos.slotSize;

        if (!crystal || this.isExcludedCell(row, col)) return;

        const isPendingRemoval = this.pendingRemoval.some(pos => pos.row === row && pos.col === col);

        // Приоритет: выбранный > к удалению > justSpawned > обычный (по элементу)
        if (highlightedCrystal && highlightedCrystal.row === row && highlightedCrystal.col === col) {
            // Цвет выделенного
            ctx.fillStyle = '#8B0000';
        } else if (isPendingRemoval) {
            // Цвет помеченного к удалению
            ctx.fillStyle = '#FF00FF';
        } else if (crystal.justSpawned) {
            // Цвет только что появившегося
            ctx.fillStyle = '#FFA500';
        } else {
            // Базовые цвета по элементу
            const elementColors = {
                fire: '#FF6B6B',   // светло-красный
                ice:  '#87CEFA',   // голубой
                stone:'#b8ad34'    // 
            };
            ctx.fillStyle = elementColors[crystal.type] ?? '#FFD700';
        }

        const cx = x + boardPos.slotSize/2;
        const cy = y + boardPos.slotSize/2;
        const r = (boardPos.slotSize - 14)/2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fill();

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
        // Draw background image behind the grid if loaded, else fallback fill
        if (this.boardBgImage && this.boardBgImage.complete && this.boardBgImage.naturalWidth !== 0) {
            // Image size is 770x770, center it around the 650x650 grid
            const bgX = boardPos.boardX - 110;
            const bgY = boardPos.boardY - 112;
            ctx.drawImage(this.boardBgImage, bgX, bgY, 770, 770);
        } else {
            // Fallback background around the board
            ctx.fillStyle='#16213e';
            ctx.fillRect(boardPos.boardX-10,boardPos.boardY-10,boardPos.boardSize+20,boardPos.boardSize+20);
        }
        const board=this.getBoard(), highlightedCrystal=this.getHighlightedCrystal();
        for(let r=0;r<5;r++) for(let c=0;c<5;c++){
            // const x=boardPos.boardX+c*boardPos.slotSize, y=boardPos.boardY+r*boardPos.slotSize;
            // if (!this.isExcludedCell(r, c)) {
            //     // Слот как круг: тонкая обводка
            //     const cx = x + boardPos.slotSize/2;
            //     const cy = y + boardPos.slotSize/2;
            //     const rr = (boardPos.slotSize-4)/2;
            //     ctx.strokeStyle='#1e3a8a'; ctx.lineWidth=2;
            //     ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.stroke();
            // }
            if(board[r][c] && !(board[r][c].animating && isTargetPositionAnimated(r,c))) this.drawCrystal(ctx,r,c,board[r][c],highlightedCrystal,boardPos);
        }
    }

    getBoard(){ return this.board; }
    getHighlightedCrystal(){ return this.highlightedCrystal; }
    getBoardPosition(){ return { boardX:this.boardX, boardY:this.boardY, boardSize:this.boardSize, slotSize:this.slotSize }; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = BattleLogicModule;
