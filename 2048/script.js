const size = 5;
const INIT_CELL_VAL = 512;
let MIN_START_VALUE = INIT_CELL_VAL; // Используем let вместо const
let MAX_START_VALUE = INIT_CELL_VAL; // Используем let вместо const
const STARTING_CELLS = 1;
const MIN_SPLIT_VALUE = 4;

const REMOVE_PROBABILITIES = [1, 1]; 

const REMOVE_WEIGHTS = {    2:  100,    4:  100,    8:  10,    16: 5,    32: 2,    64: 1};

// const grid = Array.from({ length: size }, () => Array(size).fill(null));
let grid = Array.from({ length: size }, () => Array(size).fill(null)); // Создаем пустую сетку
let selectedCell = null;
let cellsToDelete = [];
let gameInProgress = true; // Флаг для отслеживания текущей игры

let disabledCells = [
    { x: 0, y: 2 },{ x: 2, y: 0 },{ x: 2, y: 4 },{ x: 4, y: 2 },
    // { x: 2, y: 2 },
    // { x: 4, y: 0 },{ x: 4, y: 4 },
    // { x: 0, y: 0 },{ x: 0, y: 1 },{ x: 0, y: 2 },{ x: 0, y: 3 },{ x: 0, y: 4 },{ x: 0, y: 5 },
    // { x: 1, y: 0 },                                                            { x: 1, y: 5 },
    // { x: 2, y: 0 },                                                            { x: 2, y: 5 },
    // { x: 3, y: 0 },                                                            { x: 3, y: 5 },
    // { x: 4, y: 0 },                                                            { x: 4, y: 5 },
    // { x: 5, y: 0 },{ x: 5, y: 1 },{ x: 5, y: 2 },{ x: 5, y: 3 },{ x: 5, y: 4 },{ x: 5, y: 5 },

]

let stagesCompleted = 0; // Добавляем переменную для отслеживания этапов

let isKeyCooldown = false; // Флаг для отслеживания задержки

let animationQueue = {
    move: null, // Параметры для анимации перемещения
    remove: []  // Список клеток для анимации удаления
};

let touchStartX = 0;
let touchStartY = 0;

function handleSwipe(event) {
    const gridElement = document.getElementById("grid");
    const gameOverOverlay = document.getElementById('game-over-overlay');

    if (gameOverOverlay && gameOverOverlay.style.display === 'flex') return; // Игнорируем свайпы, если игра завершена

    switch (event.type) {
        case 'touchstart':
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            break;

        case 'touchend':
            const touchEndX = event.changedTouches[0].clientX;
            const touchEndY = event.changedTouches[0].clientY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Если разница по X больше, чем по Y, это свайп влево/вправ
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 0) {
                    move("ArrowRight");
                } else {
                    move("ArrowLeft");
                }
            } else {
                // Если разница по Y больше, это свайп вверх/вниз
                if (diffY > 0) {
                    move("ArrowDown");
                } else {
                    move("ArrowUp");
                }
            }
            break;
    }
}

// Добавляем обработчики событий для свайпов
document.addEventListener('touchstart', handleSwipe);
document.addEventListener('touchend', handleSwipe);


function updateGridStyle() {
    const gridElement = document.getElementById("grid");
    gridElement.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gridElement.style.gridTemplateRows = `repeat(${size}, 1fr)`;
}


function getRandomValue() {
    let power = Math.log2(MIN_START_VALUE);
    let maxPower = Math.log2(MAX_START_VALUE);
    let randomPower = Math.floor(Math.random() * (maxPower - power + 1)) + power;
    return 2 ** randomPower;
}

function initializeGrid() {
    updateGridStyle();
    updateStagesDisplay(); // Обновляем отображение этапов
        deleteMarkedCells();
    let filledCells = 0;
    while (filledCells < STARTING_CELLS) {
        let x = Math.floor(Math.random() * size);
        let y = Math.floor(Math.random() * size);
        if (grid[x][y] === null && !disabledCells.some(cell => cell.x === x && cell.y === y)) {
            grid[x][y] = getRandomValue();
            filledCells++;
        }
    }
    selectRandomCell();
    renderGrid();
}

function updateStagesDisplay() {
    const stagesDisplay = document.getElementById('stages-completed');
    if (stagesDisplay) {
        stagesDisplay.textContent = `Этап: ${stagesCompleted}`;
    }
}


function selectRandomCell() {
    // 1. Получаем все доступные клетки (уже без проверки на cellsToDelete)
    let availableCells = getAvailableCells().filter(cell => 
        grid[cell.x][cell.y] >= MIN_SPLIT_VALUE
    );

    // 2. Если есть подходящие клетки
    if (availableCells.length > 0) {
        // Выбираем случайную клетку
        const randomIndex = Math.floor(Math.random() * availableCells.length);
        selectedCell = availableCells[randomIndex];
        
        // 3. Удаляем выбранную клетку из cellsToDelete (если она там была)
        cellsToDelete = cellsToDelete.filter(cell => 
            !(cell.x === selectedCell.x && cell.y === selectedCell.y)
        );
        
        return selectedCell;
    }
    
    // 4. Если нет доступных клеток
    selectedCell = null;
    return null;
}

function hasEmptyNeighbor(x, y) {
    return (
        (x > 0 && grid[x - 1][y] === null && !disabledCells.some(cell => cell.x === x - 1 && cell.y === y)) ||
        (x < size - 1 && grid[x + 1][y] === null && !disabledCells.some(cell => cell.x === x + 1 && cell.y === y)) ||
        (y > 0 && grid[x][y - 1] === null && !disabledCells.some(cell => cell.x === x && cell.y === y - 1)) ||
        (y < size - 1 && grid[x][y + 1] === null && !disabledCells.some(cell => cell.x === x && cell.y === y + 1))
    );
}

function getAvailableCells() {
    let available = [];
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            if (grid[x][y] !== null &&
                // !cellsToDelete.some(cell => cell.x === x && cell.y === y) &&
                hasEmptyNeighbor(x, y) ) {
                available.push({ x, y });
            }
        }
    }
    return available;
}

function isGameOver() {
    // Проверяем, если нет выделенной клетки, то продолжаем логику завершения игры
    if (!selectedCell) {
        return true;
    }
    // Если выделенная клетка есть, то возвращаем false (игра продолжается)
    return false;
}


/* function removeCellsBasedOnWeights() {

    // Функция для выбора числа на основе весов
    function getRandomNumberBasedOnWeights() {
        // Сумма всех весов
        const totalWeight = Object.values(REMOVE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

        // Случайное число от 0 до totalWeight
        const randomWeight = Math.random() * totalWeight;

        // Пробегаем по числам и их весам, чтобы выбрать число
        let cumulativeWeight = 0;
        for (let value in REMOVE_WEIGHTS) {
            cumulativeWeight += REMOVE_WEIGHTS[value];
            if (randomWeight <= cumulativeWeight) {
                return parseInt(value);
            }
        }
    }

    // Для каждого слота для удаления
    for (let slot = 0; slot < REMOVE_PROBABILITIES.length; slot++) {
        let found = false;

        // Выбираем число на основе весов
        const selectedNumber = getRandomNumberBasedOnWeights();

        // Ищем клетки с выбранным числом
        let availableCells = [];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                // Ищем клетки, подходящие по значению и не помеченные для удаления
                if (grid[x][y] === selectedNumber && !cellsToDelete.some(cell => cell.x === x && cell.y === y)) {
                    availableCells.push({ x, y });
                }
            }
        }

        // Если нашли клетки с выбранным числом
        if (availableCells.length > 0) {
            // Выбираем случайную клетку
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            const cell = availableCells[randomIndex];
            cellsToDelete.push(cell);

            // Нашли клетку для удаления
            found = true;
        }

        // Если не нашли клетку с выбранным числом, ищем клетку с числом 2
        if (!found) {
            let availableCellsWithTwo = [];
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if (grid[x][y] === 2 && !cellsToDelete.some(cell => cell.x === x && cell.y === y)) {
                        availableCellsWithTwo.push({ x, y });
                    }
                }
            }

            // Если есть клетки с числом 2, добавляем одну случайную в список для удаления
            if (availableCellsWithTwo.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableCellsWithTwo.length);
                const cell = availableCellsWithTwo[randomIndex];
                cellsToDelete.push(cell);
            }
        }
    }
} */
/* function removeCellsBasedOnWeights() {
    // 1. Разделяем числа на "приоритетные" (вес >= 100) и "взвешенные" (вес < 100)
    const priorityNumbers = [];
    const weightedNumbers = [];
    let totalWeight = 0;
    
    for (let number in REMOVE_WEIGHTS) {
        const num = parseInt(number);
        const weight = REMOVE_WEIGHTS[number];
        
        if (weight >= 100) {
            priorityNumbers.push(num);
        } else {
            weightedNumbers.push(num);
            totalWeight += weight;
        }
    }

    // 2. Для каждого слота выбираем число и ищем клетку
    for (let slot = 0; slot < REMOVE_PROBABILITIES.length; slot++) {
        let selectedNumber;
        let found = false;

        // 2a. Сначала пробуем выбрать из взвешенных чисел (вес < 100)
        if (weightedNumbers.length > 0 && totalWeight > 0) {
            const randomWeight = Math.random() * totalWeight;
            let cumulativeWeight = 0;
            
            for (let number of weightedNumbers) {
                cumulativeWeight += REMOVE_WEIGHTS[number];
                if (randomWeight <= cumulativeWeight) {
                    selectedNumber = number;
                    break;
                }
            }

            // Ищем клетки с выбранным числом
            const availableCells = [];
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if (grid[x][y] === selectedNumber && 
                        !cellsToDelete.some(c => c.x === x && c.y === y)) {
                        availableCells.push({ x, y });
                    }
                }
            }

            if (availableCells.length > 0) {
                const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
                cellsToDelete.push(randomCell);
                found = true;
            }
        }

        // 2b. Если не нашли среди взвешенных или их нет, ищем среди приоритетных
        if (!found && priorityNumbers.length > 0) {
            // Собираем все доступные приоритетные клетки
            const allPriorityCells = [];
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if (priorityNumbers.includes(grid[x][y]) && 
                        !cellsToDelete.some(c => c.x === x && c.y === y)) {
                        allPriorityCells.push({ x, y });
                    }
                }
            }

            // Если есть приоритетные клетки, выбираем случайную
            if (allPriorityCells.length > 0) {
                const randomCell = allPriorityCells[Math.floor(Math.random() * allPriorityCells.length)];
                cellsToDelete.push(randomCell);
                found = true;
            }
        }

        // 2c. Если вообще ничего не нашли (маловероятно), пропускаем слот
    }
} */
function removeCellsBasedOnWeights() {
    // 1. Разделяем числа на две группы:
    const guaranteedNumbers = [];  // числа с 100% вероятностью
    const percentageNumbers = [];  // числа с процентным распределением
    let totalPercentage = 0;

    for (let number in REMOVE_WEIGHTS) {
        const num = parseInt(number);
        const percentage = REMOVE_WEIGHTS[number];

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

    // 2. Для каждого слота выбираем число и ищем клетку
    for (let slot = 0; slot < REMOVE_PROBABILITIES.length; slot++) {
        let found = false;

        // 2a. Сначала пробуем выбрать из процентных чисел (если есть и общий процент > 0)
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

            // Ищем клетки с выбранным числом
            if (selectedNumber !== null) {
                const availableCells = [];
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        if (grid[x][y] === selectedNumber && 
                            !cellsToDelete.some(c => c.x === x && c.y === y)) {
                            availableCells.push({ x, y });
                        }
                    }
                }

                if (availableCells.length > 0) {
                    const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
                    cellsToDelete.push(randomCell);
                    found = true;
                }
            }
        }

        // 2b. Если не нашли среди процентных, ищем среди гарантированных (100%)
        if (!found && guaranteedNumbers.length > 0) {
            // Собираем все доступные клетки с гарантированными числами
            const allGuaranteedCells = [];
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    if (guaranteedNumbers.includes(grid[x][y]) && 
                        !cellsToDelete.some(c => c.x === x && c.y === y)) {
                        allGuaranteedCells.push({ x, y });
                    }
                }
            }

            // Если есть гарантированные клетки, выбираем случайную
            if (allGuaranteedCells.length > 0) {
                const randomCell = allGuaranteedCells[Math.floor(Math.random() * allGuaranteedCells.length)];
                cellsToDelete.push(randomCell);
                found = true;
            }
        }

        // 2c. Если вообще ничего не нашли, пропускаем слот
    }
}

function deleteMarkedCells() {
    cellsToDelete.forEach(cell => {
        const { x, y } = cell;
        const gridElement = document.getElementById("grid");
        const cells = gridElement.querySelectorAll(".cell");
        const cellElement = cells[x * size + y];

        // Добавляем клетку в очередь для анимации удаления
        animationQueue.remove.push({ cellElement, x, y });

        // Удаляем клетку из сетки
        grid[x][y] = null;
    });

    // Очищаем массив после удаления
    cellsToDelete = [];

    // Запускаем анимацию
    animateCell();
}

function move(direction) {
    // if (!selectedCell) selectRandomCell();
    if (!selectedCell) return;

    let { x, y } = selectedCell;
    let value = grid[x][y];
    let newX = x, newY = y;
    let moved = false;  // Флаг для отслеживания, было ли движение

    switch (direction) {
        case "ArrowUp": newX = x - 1; break;
        case "ArrowDown": newX = x + 1; break;
        case "ArrowLeft": newY = y - 1; break;
        case "ArrowRight": newY = y + 1; break;
    }

    // Проверяем, что целевая клетка доступна для перемещения
    if (
        newX >= 0 && newX < size && 
        newY >= 0 && newY < size && 
        grid[newX][newY] === null && // Клетка должна быть пустой
        !cellsToDelete.some(cell => cell.x === newX && cell.y === newY) && // Клетка не должна быть помечена на удаление
        !disabledCells.some(cell => cell.x === newX && cell.y === newY) && // Клетка не должна быть помечена на удаление
        value >= MIN_SPLIT_VALUE
    ) {
        let newValue = value / 2;
        grid[x][y] = newValue;
        grid[newX][newY] = newValue;

        const gridElement = document.getElementById("grid");
        const cells = gridElement.querySelectorAll(".cell");
        const cellElement = cells[x * size + y];

        // Обновляем глобальные параметры для анимации перемещения
        animationQueue.move = {
            cellElement,
            newX,
            newY,
            oldX: x,
            oldY: y,
            newValue // Передаем новое значение
        };
        moved = true; // Отмечаем, что движение произошло
    }
    
    // Если было движение, запускаем анимацию
    if (moved) {
        // Удаляем помеченные клетки
        deleteMarkedCells();
        // После завершения анимации, помечаем новые клетки на удаление
        removeCellsBasedOnWeights();
        // Выбираем новую выделенную клетку
        selectRandomCell();
        if (isGameOver()) showGameOver();
    } else {
        // Если движение не произошло, просто выбираем новую ячейку (или не выбираем, в зависимости от логики)
        console.log("Движение невозможно. Выбираем новую случайную ячейку.");
        // selectRandomCell();
    }
}


function animateCell() {
    
    const gridElement = document.getElementById("grid");
    const cells = gridElement.querySelectorAll(".cell");
    const gridRect = gridElement.getBoundingClientRect();
    // const cellElement = cells[x * size + y];
    
    
    // Анимация перемещения
    if (animationQueue.move) {
        const { cellElement, newX, newY, oldX, oldY, newValue } = animationQueue.move;

        const movingCell = cellElement.cloneNode(true);
        movingCell.classList.add("moving");
        
        // Позиционируем относительно gridElement
        movingCell.style.left = `${oldY * 85}px`;
        movingCell.style.top = `${oldX * 85}px`;
        movingCell.style.width = '80px';
        movingCell.style.height = '80px';
        
        gridElement.appendChild(movingCell);
        
        // Обновляем значения
        cellElement.textContent = newValue;
        movingCell.textContent = newValue;
        
        // Анимация через requestAnimationFrame для плавности
        requestAnimationFrame(() => {
            movingCell.style.transform = `translate(${(newY - oldY) * 85}px, ${(newX - oldX) * 85}px)`;
        });
        
        // Удаление после анимации
        setTimeout(() => {
            movingCell.remove();
            animationQueue.move = null;
            renderGrid();
        }, 300);
    }

    // Анимация удаления
    if (animationQueue.remove.length > 0) {
        animationQueue.remove.forEach(({ cellElement, x, y }, index) => {
            // Проверяем, что клетка существует и не пуста
            if (!cellElement || !cellElement.textContent) return;

            // Создаем копию удаляемой клетки (пустую ячейку)
            const emptyCell = cellElement.cloneNode(true);
            emptyCell.classList.remove("filled"); // Убираем класс filled, чтобы копия выглядела как пустая ячейка
            emptyCell.classList.add("cell");   // Добавляем класс для анимации удаления

            console.log(cellElement);
            emptyCell.style.position = "absolute";
            emptyCell.style.left = `${gridRect.left + y * 85}px`; // Смещение по X (колонка) + смещение сетки
            emptyCell.style.top = `${gridRect.top + x * 85}px`;  // Смещение по Y (строка) + смещение сетки

            // Добавляем копию в DOM
            // gridElement.appendChild(emptyCell);
            // gridElement.insertBefore(emptyCell, cellElement);

            // Запускаем анимацию удаления
            setTimeout(() => {
                cellElement.style.transition = "transform 0.3s ease";
                cellElement.style.transform = "scale(0)";
            }, 10);

            // Удаляем клетку и её копию после завершения анимации
            setTimeout(() => {
                cellElement.remove();
                emptyCell.remove();
                animationQueue.remove.splice(index, 1); // Удаляем задачу из очереди

                // Обновляем сетку после завершения анимации удаления
                if (animationQueue.remove.length === 0) {
                    renderGrid();
                }
            }, 310); // 300 мс (анимация) + 10 мс (задержка)
        });
    }
}

function renderGrid() {
    const gridElement = document.getElementById("grid");
    if (!gridElement) return;

    gridElement.innerHTML = "";

    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            const cell = document.createElement("div");
            
            
            if (disabledCells.some(c => c.x === x && c.y === y)) {
                cell.classList.add("empty");
                // cell.classList.remove("cell");
            }
            // else {
                cell.classList.add("cell");
            // }

            if (cellsToDelete.some(c => c.x === x && c.y === y)) {
                cell.classList.add("to-remove");
            }

            if (grid[x][y] !== null) {
                cell.textContent = grid[x][y];
                cell.classList.add("filled");

                if (selectedCell && selectedCell.x === x && selectedCell.y === y) {
                    cell.classList.add("selected");
                }
            }


            gridElement.appendChild(cell);
        }
    }

}

function showGameOver() {
    if (!gameInProgress) return; // Если игра уже завершена, выходим
    let hasOtherValues = false;

    // Сначала проверяем, есть ли на поле клетки с другими значениями (кроме 2)
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            // Проверяем, что клетка не равна 2 и не пуста и не помечена на удаление
            if (grid[x][y] !== null && grid[x][y] !== 2 && !cellsToDelete.some(cell => cell.x === x && cell.y === y) ) {
            // if (grid[x][y] !== null && grid[x][y] !== 2  ) {
                hasOtherValues = true;
                break;
            }
        }
        if (hasOtherValues) break;
    }

    // Если есть другие значения, то проигрыш
    if (!hasOtherValues) {
        // Выигрыш - помечаем клетки с 2 для удаления
        // cellsToDelete = []; // Сбросим список клеток для удаления
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                if (grid[x][y] === 2 ) {
                // if (grid[x][y] === 2 ) {
                    cellsToDelete.push({ x, y });
                }
            }
        }

        // Удаляем помеченные клетки
        if (cellsToDelete.length > 0) {
            deleteMarkedCells();
        }
    }

    // Показываем сообщение о завершении игры
    setTimeout(() => {
        const gameOverOverlay = document.getElementById('game-over-overlay');
        const gameOverMessage = document.getElementById('game-over-message');
        if (gameOverOverlay && gameOverMessage) {
            if (hasOtherValues) {
                gameOverMessage.textContent = 'Поражение, начать сначала';
                MIN_START_VALUE = MIN_START_VALUE;
                MAX_START_VALUE = MAX_START_VALUE;
                stagesCompleted = 0; // Сбрасываем счетчик
            } else {
                MIN_START_VALUE *= 2;
                MAX_START_VALUE *= 2;
                stagesCompleted++;
                gameOverMessage.textContent = `Победа, следующий противник! Этап: ${stagesCompleted}`;
                updateStagesDisplay(); // Обновляем отображение этапов
            }
            gameOverOverlay.style.display = 'flex'; // Показываем overlay
            gameInProgress = false; // Завершаем игру
        }
    }, 500);

    // Добавляем обработчик для кнопки рестарта
    const restartButton = document.getElementById('restart-button');
    if (restartButton) restartButton.addEventListener('click', restartGame);
}



function restartGame() {
    const gameOverOverlay = document.getElementById('game-over-overlay');
    if (gameOverOverlay) gameOverOverlay.style.display = 'none'; // Скрываем overlay
    // Сброс флага, чтобы новая игра начиналась заново
    gameInProgress = true;
    // Сбрасываем сетку
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            grid[x][y] = null;
        }
    }

    // Инициализируем игру с новыми параметрами
    initializeGrid();
}

document.addEventListener("keydown", (event) => {
    const gameOverOverlay = document.getElementById('game-over-overlay');

    // Если задержка активна, игнорируем нажатие
    if (isKeyCooldown) return;

    // Обработка стрелок
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        move(event.key);
        startCooldown(); // Запускаем задержку
    }

    // Обработка Enter или Пробела, если игра завершена
    if (gameOverOverlay && gameOverOverlay.style.display === 'flex') {
        if (event.key === "Enter" || event.key === " ") {
            restartGame(); // Перезапускаем игру
            startCooldown(); // Запускаем задержку
        }
    }
});


// Функция для запуска задержки
function startCooldown() {
    isKeyCooldown = true; // Блокируем обработку новых нажатий
    setTimeout(() => {
        isKeyCooldown = false; // Разблокируем обработку через 300 мс
    }, 300); // Задержка в миллисекундах (можно изменить)
}

initializeGrid();
