// ===================== Общая игровая логика =====================
// Используется в мультиплеере и одиночной игре

function neighbors(r, c, N) {
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  return dirs.map(([dr,dc])=>[r+dr,c+dc]).filter(([rr,cc])=>rr>=0&&rr<N&&cc>=0&&cc<N);
}

function countAround(board, r, c, playerNum) {
  const N = board.length;
  return neighbors(r, c, N).filter(([rr,cc])=>board[rr][cc]===playerNum).length;
}

function getEmptyCells(board) {
  const N = board.length;
  const cells = [];
  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      if (board[r][c]===0) cells.push([r,c]);
    }
  }
  return cells;
}

function getLegalCells(board, player) {
  const N = board.length;
  const empty = getEmptyCells(board);
  const opp = player===1?2:1;
  
  let myCount = 0, oppCount = 0;
  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      if (board[r][c]===player) myCount++;
      if (board[r][c]===opp) oppCount++;
    }
  }
  
  // Ранняя игра: не можем ставить рядом с противником
  if (myCount <= 1 && oppCount <= 1 && (myCount + oppCount) > 0) {
    const filtered = empty.filter(([r,c]) =>
      neighbors(r, c, N).every(([rr,cc]) => board[rr][cc] !== opp)
    );
    if (filtered.length > 0) return filtered;
  }
  
  return empty;
}

// Вычисление волн каскада (для анимации)
function calculateCascadeWaves(initialBoard, moveR, moveC, player, cascadeOn = true) {
  const N = initialBoard.length;
  const waves = [];
  const tmp = initialBoard.map(row => [...row]);
  
  // Первый ход
  tmp[moveR][moveC] = player;
  
  const opp = player===1?2:1;
  
  let go = true;
  while (go) {
    go = false;
    const wave = [];
    
    for (let rr = 0; rr < N; rr++) {
      for (let cc = 0; cc < N; cc++) {
        const cellVal = tmp[rr][cc];
        if (cellVal === opp) {
          // Это вражеская клетка - проверяем условие захвата
          const friendlyCount = countAround(tmp, rr, cc, player);
          const enemyCount = countAround(tmp, rr, cc, cellVal);
          
          if (friendlyCount > enemyCount) {
            wave.push([rr, cc]);
          }
        }
      }
    }
    
    if (wave.length > 0) {
      // Применяем захваты этой волны
      wave.forEach(([r, c]) => {
        tmp[r][c] = player;
      });
      waves.push(wave);
      go = cascadeOn; // Продолжаем каскад только если включён
    }
  }
  
  return waves;
}

// Симуляция хода (для ИИ)
function simulateMove(board, r, c, player, cascadeOn = true) {
  const N = board.length;
  const nb = board.map(row=>[...row]);
  nb[r][c] = player;
  
  const opp = player===1?2:1;
  let flipped = true;
  let totalFlips = 0;
  
  while (flipped) {
    flipped = false;
    let round = [];
    
    for (let rr=0; rr<N; rr++) {
      for (let cc=0; cc<N; cc++) {
        if (nb[rr][cc]===opp) {
          if (countAround(nb,rr,cc,player) > countAround(nb,rr,cc,opp)) {
            round.push([rr,cc]);
          }
        }
      }
    }
    
    if (round.length>0) {
      round.forEach(([fr,fc])=>{ nb[fr][fc]=player; });
      totalFlips += round.length;
      flipped = cascadeOn;
    }
  }
  
  return { board: nb, flips: totalFlips };
}

function boardScore(board, player) {
  const N = board.length;
  let my=0, opp=0;
  const opponent = player===1?2:1;
  
  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      if (board[r][c]===player) my++;
      else if (board[r][c]===opponent) opp++;
    }
  }
  return my - opp;
}

function friendlyAdjacent(board, r, c, player) {
  const N = board.length;
  return neighbors(r,c,N).filter(([rr,cc]) => board[rr][cc] === player).length;
}

function centerProximity(r, c, N) {
  const cr = (N-1)/2, cc = (N-1)/2;
  const maxDist = Math.sqrt(cr*cr + cc*cc);
  const dist = Math.sqrt((r-cr)*(r-cr) + (c-cc)*(c-cc));
  return 1 - dist / maxDist;
}

function neighborCount(r, c, N) {
  return neighbors(r,c,N).length;
}

function stabilityScore(board, player) {
  const N = board.length;
  const opp = player===1?2:1;
  let safe = 0, risk = 0;
  
  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      if (board[r][c] === player) {
        const fn = countAround(board,r,c,player);
        const en = countAround(board,r,c,opp);
        if (fn > en) safe++;
        else if (en > 0 && en >= fn) risk++;
      }
    }
  }
  return safe - risk * 2;
}

function evaluate(board, player) {
  const opp = player===1?2:1;
  const net = boardScore(board, player);
  const myStab = stabilityScore(board, player);
  const oppStab = stabilityScore(board, opp);
  return net * 4 + (myStab - oppStab) * 1.5;
}
