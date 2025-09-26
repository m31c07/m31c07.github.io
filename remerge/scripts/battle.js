// Battle game logic
class Battle {
    constructor() {
        this.size = 5;
        this.INIT_CELL_VAL = 2048;
        this.MIN_START_VALUE = this.INIT_CELL_VAL;
        this.MAX_START_VALUE = this.INIT_CELL_VAL;
        this.STARTING_CELLS = 1;
        this.MIN_SPLIT_VALUE = 4;

        this.REMOVE_PROBABILITIES = [1, 1]; 
        this.REMOVE_WEIGHTS = {2: 100, 4: 55, 8: 34, 16: 21, 32: 13, 64: 8, 128: 5};

        this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
        this.selectedCell = null;
        this.cellsToDelete = [];
        this.gameInProgress = true;
        this.stagesCompleted = 0;

        this.disabledCells = [];
        this.isKeyCooldown = false;

        this.animationQueue = {
            move: null,
            remove: []
        };

        this.touchStartX = 0;
        this.touchStartY = 0;

        this.init();
    }

    init() {
        this.bindEvents();
    }

    static initialize(stage = 0) {
        // Reset the battle instance
        if (window.battleInstance) {
            // Clean up existing event listeners
            document.removeEventListener('keydown', window.battleInstance.handleKeyDown);
            document.removeEventListener('touchstart', window.battleInstance.handleSwipe);
            document.removeEventListener('touchend', window.battleInstance.handleSwipe);
        }
        
        window.battleInstance = new Battle();
        window.battleInstance.stagesCompleted = stage;
        window.battleInstance.MIN_START_VALUE = window.battleInstance.INIT_CELL_VAL * Math.pow(2, stage);
        window.battleInstance.MAX_START_VALUE = window.battleInstance.INIT_CELL_VAL * Math.pow(2, stage);
        
        // Update stage display
        const battleStageDisplay = document.getElementById('battle-stage-display');
        if (battleStageDisplay) {
            battleStageDisplay.textContent = stage;
        }
        
        window.battleInstance.initializeGrid();
    }

    bindEvents() {
        // Keyboard events
        this.handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener("keydown", this.handleKeyDown);

        // Touch events for swipe
        this.handleSwipe = this.handleSwipe.bind(this);
        document.addEventListener('touchstart', this.handleSwipe);
        document.addEventListener('touchend', this.handleSwipe);

        // Exit battle button
        const exitBattleButton = document.getElementById('exit-battle-button');
        if (exitBattleButton) {
            exitBattleButton.addEventListener('click', () => {
                this.exitBattle();
            });
        }
    }

    handleKeyDown(event) {
        const gameOverOverlay = document.getElementById('game-over-overlay');

        // If cooldown is active, ignore key press
        if (this.isKeyCooldown) return;

        // Handle arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            this.move(event.key);
            this.startCooldown();
        }

        // Handle Enter or Space when game is over
        if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) {
            if (event.key === "Enter" || event.key === " ") {
                this.restartGame();
                this.startCooldown();
            }
        }
    }

    handleSwipe(event) {
        const gridElement = document.getElementById("grid");
        const gameOverOverlay = document.getElementById('game-over-overlay');

        if (gameOverOverlay && !gameOverOverlay.classList.contains('hidden')) return;

        switch (event.type) {
            case 'touchstart':
                this.touchStartX = event.touches[0].clientX;
                this.touchStartY = event.touches[0].clientY;
                break;

            case 'touchend':
                const touchEndX = event.changedTouches[0].clientX;
                const touchEndY = event.changedTouches[0].clientY;

                const diffX = touchEndX - this.touchStartX;
                const diffY = touchEndY - this.touchStartY;

                // If X difference is greater than Y, it's a left/right swipe
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    if (diffX > 0) {
                        this.move("ArrowRight");
                    } else {
                        this.move("ArrowLeft");
                    }
                } else {
                    // If Y difference is greater, it's an up/down swipe
                    if (diffY > 0) {
                        this.move("ArrowDown");
                    } else {
                        this.move("ArrowUp");
                    }
                }
                break;
        }
    }

    updateGridStyle() {
        const gridElement = document.getElementById("grid");
        if (gridElement) {
            gridElement.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
            gridElement.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;
        }
    }

    getRandomValue() {
        let power = Math.log2(this.MIN_START_VALUE);
        let maxPower = Math.log2(this.MAX_START_VALUE);
        let randomPower = Math.floor(Math.random() * (maxPower - power + 1)) + power;
        return 2 ** randomPower;
    }

    initializeGrid() {
        this.updateGridStyle();
        
        // Clear grid
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                this.grid[x][y] = null;
            }
        }
        
        this.cellsToDelete = [];
        this.selectedCell = null;
        this.gameInProgress = true;
        
        // Hide game over overlay
        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) {
            gameOverOverlay.classList.add('hidden');
        }

        // Add starting cells
        let filledCells = 0;
        while (filledCells < this.STARTING_CELLS) {
            let x = Math.floor(Math.random() * this.size);
            let y = Math.floor(Math.random() * this.size);
            if (this.grid[x][y] === null && !this.disabledCells.some(cell => cell.x === x && cell.y === y)) {
                this.grid[x][y] = this.getRandomValue();
                filledCells++;
            }
        }
        
        this.selectRandomCell();
        this.renderGrid();
    }

    selectRandomCell() {
        // Get all available cells
        let availableCells = this.getAvailableCells().filter(cell => 
            this.grid[cell.x][cell.y] >= this.MIN_SPLIT_VALUE
        );

        // If there are suitable cells
        if (availableCells.length > 0) {
            // Select a random cell
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            this.selectedCell = availableCells[randomIndex];
            
            // Remove selected cell from cellsToDelete if it was there
            this.cellsToDelete = this.cellsToDelete.filter(cell => 
                !(cell.x === this.selectedCell.x && cell.y === this.selectedCell.y)
            );
            
            return this.selectedCell;
        }
        
        // If no available cells
        this.selectedCell = null;
        return null;
    }

    hasEmptyNeighbor(x, y) {
        return (
            (x > 0 && this.grid[x - 1][y] === null && !this.disabledCells.some(cell => cell.x === x - 1 && cell.y === y)) ||
            (x < this.size - 1 && this.grid[x + 1][y] === null && !this.disabledCells.some(cell => cell.x === x + 1 && cell.y === y)) ||
            (y > 0 && this.grid[x][y - 1] === null && !this.disabledCells.some(cell => cell.x === x && cell.y === y - 1)) ||
            (y < this.size - 1 && this.grid[x][y + 1] === null && !this.disabledCells.some(cell => cell.x === x && cell.y === y + 1))
        );
    }

    getAvailableCells() {
        let available = [];
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (this.grid[x][y] !== null &&
                    !this.cellsToDelete.some(cell => cell.x === x && cell.y === y) && // Add this check back
                    this.hasEmptyNeighbor(x, y)) {
                    available.push({ x, y });
                }
            }
        }
        return available;
    }

    isGameOver() {
        // If no selected cell, game is over
        if (!this.selectedCell) {
            return true;
        }
        // If there is a selected cell, game continues
        return false;
    }

    removeCellsBasedOnWeights() {
        // Separate numbers into two groups:
        const guaranteedNumbers = [];  // numbers with 100% probability
        const percentageNumbers = [];  // numbers with percentage distribution
        let totalPercentage = 0;

        for (let number in this.REMOVE_WEIGHTS) {
            const num = parseInt(number);
            const percentage = this.REMOVE_WEIGHTS[number];

            if (percentage === 100) {
                guaranteedNumbers.push(num);
            } else if (percentage > 0) {
                percentageNumbers.push({
                    number: num,
                    percentage: percentage
                });
                totalPercentage += percentage;
            }
        }

        // For each removal slot
        for (let slot = 0; slot < this.REMOVE_PROBABILITIES.length; slot++) {
            let found = false;

            // First try to select from percentage numbers (if available and total percentage > 0)
            if (percentageNumbers.length > 0 && totalPercentage > 0) {
                const randomPercent = Math.random() * totalPercentage;
                let accumulated = 0;
                let selectedNumber = null;

                for (let item of percentageNumbers) {
                    accumulated += item.percentage;
                    if (randomPercent <= accumulated) {
                        selectedNumber = item.number;
                        break;
                    }
                }

                // Find cells with selected number
                if (selectedNumber !== null) {
                    const availableCells = [];
                    for (let x = 0; x < this.size; x++) {
                        for (let y = 0; y < this.size; y++) {
                            if (this.grid[x][y] === selectedNumber && 
                                !this.cellsToDelete.some(c => c.x === x && c.y === y)) {
                                availableCells.push({ x, y });
                            }
                        }
                    }

                    if (availableCells.length > 0) {
                        const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
                        this.cellsToDelete.push(randomCell);
                        found = true;
                    }
                }
            }

            // If not found among percentage numbers, look for guaranteed numbers (100%)
            if (!found && guaranteedNumbers.length > 0) {
                // Collect all available cells with guaranteed numbers
                const allGuaranteedCells = [];
                for (let x = 0; x < this.size; x++) {
                    for (let y = 0; y < this.size; y++) {
                        if (guaranteedNumbers.includes(this.grid[x][y]) && 
                            !this.cellsToDelete.some(c => c.x === x && c.y === y)) {
                            allGuaranteedCells.push({ x, y });
                        }
                    }
                }

                // If there are guaranteed cells, select a random one
                if (allGuaranteedCells.length > 0) {
                    const randomCell = allGuaranteedCells[Math.floor(Math.random() * allGuaranteedCells.length)];
                    this.cellsToDelete.push(randomCell);
                    found = true;
                }
            }
        }
    }

    deleteMarkedCells() {
        this.cellsToDelete.forEach(cell => {
            const { x, y } = cell;
            const gridElement = document.getElementById("grid");
            if (!gridElement) return;
            
            const cells = gridElement.querySelectorAll(".cell");
            const cellElement = cells[x * this.size + y];

            // Add cell to animation queue for removal
            this.animationQueue.remove.push({ cellElement, x, y });

            // Remove cell from grid
            this.grid[x][y] = null;
        });

        // Clear array after deletion
        this.cellsToDelete = [];

        // Start animation
        this.animateCell();
    }

    move(direction) {
        if (!this.selectedCell) return;

        let { x, y } = this.selectedCell;
        let value = this.grid[x][y];
        let newX = x, newY = y;
        let moved = false;

        switch (direction) {
            case "ArrowUp": newX = x - 1; break;
            case "ArrowDown": newX = x + 1; break;
            case "ArrowLeft": newY = y - 1; break;
            case "ArrowRight": newY = y + 1; break;
        }

        // Check if target cell is available for movement
        if (
            newX >= 0 && newX < this.size && 
            newY >= 0 && newY < this.size && 
            this.grid[newX][newY] === null && // Cell must be empty
            !this.cellsToDelete.some(cell => cell.x === newX && cell.y === newY) && // Cell must not be marked for deletion
            !this.disabledCells.some(cell => cell.x === newX && cell.y === newY) && // Cell must not be disabled
            value >= this.MIN_SPLIT_VALUE
        ) {
            let newValue = value / 2;
            this.grid[x][y] = newValue;
            this.grid[newX][newY] = newValue;

            const gridElement = document.getElementById("grid");
            if (gridElement) {
                const cells = gridElement.querySelectorAll(".cell");
                const cellElement = cells[x * this.size + y];

                // Update global parameters for move animation
                this.animationQueue.move = {
                    cellElement,
                    newX,
                    newY,
                    oldX: x,
                    oldY: y,
                    newValue // Pass new value
                };
                moved = true; // Mark that movement occurred
            }
        }
        
        // If movement occurred, start animation
        if (moved) {
            // Delete marked cells
            this.deleteMarkedCells();
            // After animation completes, mark new cells for deletion
            this.removeCellsBasedOnWeights();
            // Select new highlighted cell
            this.selectRandomCell();
            if (this.isGameOver()) this.showGameOver();
        } else {
            // If movement didn't occur, select new random cell
            console.log("Movement not possible. Selecting new random cell.");
        }
    }

    animateCell() {
        const gridElement = document.getElementById("grid");
        if (!gridElement) return;
        
        const cells = gridElement.querySelectorAll(".cell");

        // Move animation
        if (this.animationQueue.move) {
            const { cellElement, newX, newY, oldX, oldY, newValue } = this.animationQueue.move;

            if (cellElement) {
                const movingCell = cellElement.cloneNode(true);
                movingCell.classList.add("moving");
                
                // Calculate cell size dynamically based on grid size
                const cellSize = (gridElement.offsetWidth - (this.size - 1) * 5) / this.size;
                
                // Position relative to gridElement
                movingCell.style.left = `${oldY * (cellSize + 5)}px`;
                movingCell.style.top = `${oldX * (cellSize + 5)}px`;
                movingCell.style.width = `${cellSize}px`;
                movingCell.style.height = `${cellSize}px`;
                
                gridElement.appendChild(movingCell);
                
                // Update values
                cellElement.textContent = newValue;
                movingCell.textContent = newValue;
                
                // Animation via requestAnimationFrame for smoothness
                requestAnimationFrame(() => {
                    movingCell.style.transform = `translate(${(newY - oldY) * (cellSize + 5)}px, ${(newX - oldX) * (cellSize + 5)}px)`;
                });
                
                // Remove after animation
                setTimeout(() => {
                    movingCell.remove();
                    this.animationQueue.move = null;
                    this.renderGrid();
                }, 300);
            }
        }

        // Removal animation
        if (this.animationQueue.remove.length > 0) {
            // Process all removals
            const removals = [...this.animationQueue.remove]; // Create a copy
            this.animationQueue.remove = []; // Clear the queue immediately
            
            removals.forEach(({ cellElement, x, y }, index) => {
                // Check if cell exists and is not empty
                if (!cellElement || !cellElement.textContent) return;

                // Start removal animation
                setTimeout(() => {
                    if (cellElement) {
                        cellElement.style.transition = "transform 0.3s ease";
                        cellElement.style.transform = "scale(0)";
                    }
                }, 10);

                // Remove cell after animation completes
                setTimeout(() => {
                    if (cellElement) {
                        cellElement.remove();
                    }
                    // Update grid after each removal animation completes
                    this.renderGrid();
                }, 310); // 300 ms (animation) + 10 ms (delay)
            });
        }
    }

    renderGrid() {
        const gridElement = document.getElementById("grid");
        if (!gridElement) return;

        // Clear grid
        gridElement.innerHTML = "";

        // Calculate cell size dynamically
        const cellSize = (gridElement.offsetWidth - (this.size - 1) * 5) / this.size;

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                const cell = document.createElement("div");

                if (this.disabledCells.some(c => c.x === x && c.y === y)) {
                    cell.classList.add("empty");
                } else {
                    cell.classList.add("cell");
                    // Set explicit dimensions
                    cell.style.width = `${cellSize}px`;
                    cell.style.height = `${cellSize}px`;
                }

                if (this.cellsToDelete.some(c => c.x === x && c.y === y)) {
                    cell.classList.add("to-remove");
                }

                if (this.grid[x][y] !== null) {
                    cell.textContent = this.grid[x][y];
                    cell.classList.add("filled");

                    if (this.selectedCell && this.selectedCell.x === x && this.selectedCell.y === y) {
                        cell.classList.add("selected");
                    }
                }

                gridElement.appendChild(cell);
            }
        }
    }

    showGameOver() {
        if (!this.gameInProgress) return; // If game already over, exit
        let hasOtherValues = false;

        // First check if there are cells with other values (except 2)
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                // Check if cell is not 2, not empty, and not marked for deletion
                if (this.grid[x][y] !== null && this.grid[x][y] !== 2 && !this.cellsToDelete.some(cell => cell.x === x && cell.y === y)) {
                    hasOtherValues = true;
                    break;
                }
            }
            if (hasOtherValues) break;
        }

        // If there are NO other values, it's a WIN
        // If there ARE other values but no moves, it's a LOSS
        const isWin = !hasOtherValues;
        
        if (isWin) {
            // Win - mark cells with 2 for deletion
            for (let x = 0; x < this.size; x++) {
                for (let y = 0; y < this.size; y++) {
                    if (this.grid[x][y] === 2) {
                        this.cellsToDelete.push({ x, y });
                    }
                }
            }

            // Delete marked cells
            if (this.cellsToDelete.length > 0) {
                this.deleteMarkedCells();
            }
        }

        // Show game over message
        setTimeout(() => {
            const gameOverOverlay = document.getElementById('game-over-overlay');
            const gameOverMessage = document.getElementById('game-over-message');
            if (gameOverOverlay && gameOverMessage) {
                if (!isWin) {
                    gameOverMessage.textContent = 'Поражение!';
                    this.gameInProgress = false; // End game
                } else {
                    // Win - increment stage
                    if (window.Lobby) {
                        window.Lobby.incrementStage();
                    }
                    gameOverMessage.textContent = `Победа! Следующий противник!`;
                    this.gameInProgress = false; // End game
                }
                gameOverOverlay.classList.remove('hidden'); // Show overlay
            }
        }, 500);
    }

    restartGame() {
        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) gameOverOverlay.classList.add('hidden'); // Hide overlay
        
        // Reset flag so new game can start
        this.gameInProgress = true;
        
        // Reset grid
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                this.grid[x][y] = null;
            }
        }

        // Initialize game with new parameters
        this.initializeGrid();
    }

    exitBattle() {
        // Hide battle screen and show lobby screen
        document.getElementById('battle-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        
        // Clean up event listeners
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener('touchstart', this.handleSwipe);
        document.removeEventListener('touchend', this.handleSwipe);
        
        // Update lobby stage if player won
        const gameOverMessage = document.getElementById('game-over-message');
        if (gameOverMessage && gameOverMessage.textContent.includes('Победа') && window.Lobby) {
            window.Lobby.incrementStage();
        }
    }

    // Function to start cooldown
    startCooldown() {
        this.isKeyCooldown = true; // Block processing new presses
        setTimeout(() => {
            this.isKeyCooldown = false; // Unblock processing after 300 ms
        }, 300); // Cooldown in milliseconds (can be changed)
    }
}

// Initialize battle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Battle will be initialized when starting battle from lobby
});