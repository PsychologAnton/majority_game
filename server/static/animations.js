// ===================== Общие анимации и визуализация =====================
// Используется в мультиплеере и одиночной игре

function getCell(r, c) {
  return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function updateCellVisual(board, r, c, animate) {
  const cell = getCell(r, c);
  if (!cell) return;
  
  const val = board[r][c];
  const cls = val > 0 ? ` p${val}` : '';
  cell.className = 'cell' + cls;
  
  if (animate) {
    cell.classList.add('flip');
    setTimeout(() => cell.classList.remove('flip'), 350);
  }
}

function updateThreats(board) {
  const N = board.length;
  
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const cell = getCell(r, c);
      if (!cell) continue;
      
      const player = board[r][c];
      if (player === 0) {
        cell.classList.remove('threatened');
        continue;
      }
      
      // Определяем противника
      const opp = player === 1 ? 2 : 1;
      
      const fn = countAround(board, r, c, player);
      const en = countAround(board, r, c, opp);
      
      const hasEmpty = neighbors(r, c, N).some(([rr,cc]) => board[rr][cc] === 0);
      
      const threatened = (fn - en < 1) && hasEmpty;
      cell.classList.toggle('threatened', threatened);
    }
  }
}

function lockBoard(lock) {
  document.querySelectorAll('.cell').forEach(c => {
    if (lock) c.classList.add('locked');
    else c.classList.remove('locked');
  });
}

/**
 * Применяет ход с анимацией каскада
 * @param {Array} board - доска (изменяется!)
 * @param {number} r - строка
 * @param {number} c - столбец
 * @param {number} player - игрок (1 или 2)
 * @param {boolean} cascadeOn - включён ли каскад
 * @returns {number} - время анимации в мс
 */
function applyMoveWithAnimation(board, r, c, player, cascadeOn = true) {
  const N = board.length;
  
  // Применяем ход
  board[r][c] = player;
  updateCellVisual(board, r, c, false);
  updateThreats(board);

  // Вычисляем волны каскада
  const waves = calculateCascadeWaves(board, r, c, player, cascadeOn);

  // Константы анимации
  const DOT_TIME   = 400;
  const FLIP_GAP   = N <= 10 ? 150 : 80;
  const WAVE_PAUSE = 250;
  let t = 0;

  waves.forEach((wave) => {
    // Показываем точки vulnerable
    setTimeout(()=>{
      wave.forEach(([fr,fc])=>{
        const cell = getCell(fr,fc);
        if (cell) {
          cell.classList.remove('threatened');
          cell.classList.add('vulnerable');
        }
      });
    }, t);
    t += DOT_TIME;

    // Переворачиваем клетки последовательно
    wave.forEach(([fr,fc], i)=>{
      setTimeout(()=>{
        board[fr][fc] = player;
        const cell = getCell(fr,fc);
        if (cell) cell.classList.remove('vulnerable');
        updateCellVisual(board, fr, fc, true);
        updateThreats(board);
      }, t + i * FLIP_GAP);
    });
    t += wave.length * FLIP_GAP + WAVE_PAUSE;
  });

  return t;
}

function cellSize(N) {
  return N <= 10 ? 56 : 32;
}

function renderBoard(N) {
  const el = document.getElementById('board');
  const sz = cellSize(N);
  
  el.style.gridTemplateColumns = `repeat(${N}, ${sz}px)`;
  el.style.gap = N <= 10 ? '3px' : '2px';
  el.style.padding = N <= 10 ? '12px' : '8px';
  el.innerHTML = '';
  
  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.width = sz+'px';
      cell.style.height = sz+'px';
      if (sz <= 32) cell.style.fontSize = '14px';
      cell.dataset.r = r;
      cell.dataset.c = c;
      el.appendChild(cell);
    }
  }
}
