// ===================== AI Logic =====================
// Использует общие функции из game-logic.js

function aiEasy(board, cascadeOn) {
  const N = board.length;
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  
  let best = [], bestScore = -Infinity;
  for (const [r,c] of empty) {
    const {flips} = simulateMove(board, r, c, 2, cascadeOn);
    const score = flips * 0.5 + Math.random() * 3;
    if (score > bestScore) { 
      bestScore = score; 
      best = [[r,c]]; 
    } else if (Math.abs(score-bestScore) < 1.5) {
      best.push([r,c]);
    }
  }
  return best[Math.floor(Math.random()*best.length)];
}

function aiMedium(board, cascadeOn) {
  const N = board.length;
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  
  let best = null, bestScore = -Infinity;

  const totalCells = N*N;
  const filled = totalCells - getEmptyCells(board).length;
  const phase = filled / totalCells;

  for (const [r,c] of empty) {
    const sim = simulateMove(board, r, c, 2, cascadeOn);
    const flips = sim.flips;
    const net = boardScore(sim.board, 2);
    const adj = friendlyAdjacent(board, r, c, 2);
    const center = centerProximity(r, c, N);
    const nearOpp = friendlyAdjacent(board, r, c, 1);

    let score = net * 2 + flips * 2.5;
    score += adj * (phase < 0.3 ? 4 : 2);
    score += center * (phase < 0.4 ? 3 : 1);
    score += nearOpp * 1;
    score += Math.random() * 0.5;

    if (score > bestScore) { 
      bestScore = score; 
      best = [r,c]; 
    }
  }
  return best;
}

function aiHard(board, cascadeOn) {
  const N = board.length;
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  
  let best = null, bestVal = -Infinity;

  const totalCells = N*N;
  const filled = totalCells - getEmptyCells(board).length;
  const phase = filled / totalCells;

  for (const [r,c] of empty) {
    const sim = simulateMove(board, r, c, 2, cascadeOn);
    const myEval = evaluate(sim.board, 2);

    const emptyAfter = getEmptyCells(sim.board);
    let worstAfterReply = myEval;

    if (emptyAfter.length > 0) {
      const ranked = emptyAfter.map(([rr,cc]) => {
        const threatToUs = friendlyAdjacent(sim.board, rr, cc, 2);
        const oppCoh    = friendlyAdjacent(sim.board, rr, cc, 1);
        return { 
          r:rr, 
          c:cc, 
          priority: threatToUs * 2 + oppCoh + centerProximity(rr, cc, N) 
        };
      }).sort((a,b) => b.priority - a.priority);

      const sampleSize = Math.min(ranked.length, phase < 0.3 ? 15 : 25);
      const sample = ranked.slice(0, sampleSize);

      worstAfterReply = Infinity;
      for (const {r:rr, c:cc} of sample) {
        const reply = simulateMove(sim.board, rr, cc, 1, cascadeOn);
        const sc = evaluate(reply.board, 2);
        if (sc < worstAfterReply) worstAfterReply = sc;
      }
    }

    const adj    = friendlyAdjacent(board, r, c, 2);
    const center = centerProximity(r, c, N);
    const nCount = neighborCount(r, c, N);
    const defenseBonus = nCount / 8;

    const centerW = phase < 0.4 ? 5 : 1.5;
    const cohW    = phase < 0.3 ? 4 : 1.5;

    const val = worstAfterReply * 0.6 + myEval * 0.4
              + center * centerW
              + adj * cohW
              + defenseBonus * 2
              + sim.flips * 0.5
              + Math.random() * 0.15;

    if (val > bestVal) { 
      bestVal = val; 
      best = [r,c]; 
    }
  }
  return best;
}

function aiMove(board, diffIdx, cascadeOn, callback) {
  let move;
  if (diffIdx === 0) move = aiEasy(board, cascadeOn);
  else if (diffIdx === 1) move = aiMedium(board, cascadeOn);
  else move = aiHard(board, cascadeOn);

  if (!move) {
    if (callback) callback(null);
    return null;
  }
  
  const [r, c] = move;
  const animTime = applyMoveWithAnimation(board, r, c, 2, cascadeOn);

  if (callback) {
    setTimeout(() => callback(animTime), animTime);
  }
  
  return { r, c, animTime };
}
