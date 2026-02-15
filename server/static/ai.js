// ===================== AI Logic =====================

function getEmptyCells(b) {
  const cells = [];
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (b[r][c]===0) cells.push([r,c]);
  return cells;
}

function getLegalCells(b, player) {
  const empty = getEmptyCells(b);
  const opp = player===1?2:1;
  let myCount = 0, oppCount = 0;
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    if (b[r][c]===player) myCount++;
    if (b[r][c]===opp) oppCount++;
  }
  if (myCount <= 1 && oppCount <= 1 && (myCount + oppCount) > 0) {
    const filtered = empty.filter(([r,c]) =>
      neighbors(r,c).every(([rr,cc]) => b[rr][cc] !== opp)
    );
    if (filtered.length > 0) return filtered;
  }
  return empty;
}

function boardScore(b, player) {
  let my=0, opp=0;
  const opponent = player===1?2:1;
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    if (b[r][c]===player) my++;
    else if (b[r][c]===opponent) opp++;
  }
  return my - opp;
}

function friendlyAdjacent(b, r, c, player) {
  return neighbors(r,c).filter(([rr,cc]) => b[rr][cc] === player).length;
}

function centerProximity(r, c) {
  const cr = (N-1)/2, cc = (N-1)/2;
  const maxDist = Math.sqrt(cr*cr + cc*cc);
  const dist = Math.sqrt((r-cr)*(r-cr) + (c-cc)*(c-cc));
  return 1 - dist / maxDist;
}

function neighborCount(r, c) {
  return neighbors(r,c).length;
}

function stabilityScore(b, player) {
  const opp = player===1?2:1;
  let safe = 0, risk = 0;
  for (let r=0;r<N;r++) for (let c=0;c<N;c++) {
    if (b[r][c] === player) {
      const fn = countAround(b,r,c,player);
      const en = countAround(b,r,c,opp);
      if (fn > en) safe++;
      else if (en > 0 && en >= fn) risk++;
    }
  }
  return safe - risk * 2;
}

function evaluate(b, player) {
  const opp = player===1?2:1;
  const net = boardScore(b, player);
  const myStab = stabilityScore(b, player);
  const oppStab = stabilityScore(b, opp);
  return net * 4 + (myStab - oppStab) * 1.5;
}

function aiEasy() {
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  let best = [], bestScore = -Infinity;
  for (const [r,c] of empty) {
    const {flips} = simulateMove(board,r,c,2);
    const score = flips * 0.5 + Math.random() * 3;
    if (score > bestScore) { bestScore = score; best = [[r,c]]; }
    else if (Math.abs(score-bestScore) < 1.5) best.push([r,c]);
  }
  return best[Math.floor(Math.random()*best.length)];
}

function aiMedium() {
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  let best = null, bestScore = -Infinity;

  const totalCells = N*N;
  const filled = totalCells - getEmptyCells(board).length;
  const phase = filled / totalCells;

  for (const [r,c] of empty) {
    const sim = simulateMove(board,r,c,2);
    const flips = sim.flips;
    const net = boardScore(sim.board, 2);
    const adj = friendlyAdjacent(board, r, c, 2);
    const center = centerProximity(r, c);
    const nearOpp = friendlyAdjacent(board, r, c, 1);

    let score = net * 2 + flips * 2.5;
    score += adj * (phase < 0.3 ? 4 : 2);
    score += center * (phase < 0.4 ? 3 : 1);
    score += nearOpp * 1;
    score += Math.random() * 0.5;

    if (score > bestScore) { bestScore = score; best = [r,c]; }
  }
  return best;
}

function aiHard() {
  const empty = getLegalCells(board, 2);
  if (!empty.length) return null;
  let best = null, bestVal = -Infinity;

  const totalCells = N*N;
  const filled = totalCells - getEmptyCells(board).length;
  const phase = filled / totalCells;

  for (const [r,c] of empty) {
    const sim = simulateMove(board,r,c,2);
    const myEval = evaluate(sim.board, 2);

    const emptyAfter = getEmptyCells(sim.board);
    let worstAfterReply = myEval;

    if (emptyAfter.length > 0) {
      const ranked = emptyAfter.map(([rr,cc]) => {
        const threatToUs = friendlyAdjacent(sim.board, rr, cc, 2);
        const oppCoh    = friendlyAdjacent(sim.board, rr, cc, 1);
        return { r:rr, c:cc, priority: threatToUs * 2 + oppCoh + centerProximity(rr,cc) };
      }).sort((a,b) => b.priority - a.priority);

      const sampleSize = Math.min(ranked.length, phase < 0.3 ? 15 : 25);
      const sample = ranked.slice(0, sampleSize);

      worstAfterReply = Infinity;
      for (const {r:rr, c:cc} of sample) {
        const reply = simulateMove(sim.board, rr, cc, 1);
        const sc = evaluate(reply.board, 2);
        if (sc < worstAfterReply) worstAfterReply = sc;
      }
    }

    const adj    = friendlyAdjacent(board, r, c, 2);
    const center = centerProximity(r, c);
    const nCount = neighborCount(r, c);
    const defenseBonus = nCount / 8;

    const centerW = phase < 0.4 ? 5 : 1.5;
    const cohW    = phase < 0.3 ? 4 : 1.5;

    const val = worstAfterReply * 0.6 + myEval * 0.4
              + center * centerW
              + adj * cohW
              + defenseBonus * 2
              + sim.flips * 0.5
              + Math.random() * 0.15;

    if (val > bestVal) { bestVal = val; best = [r,c]; }
  }
  return best;
}

function aiMove() {
  let move;
  if (diffIdx === 0) move = aiEasy();
  else if (diffIdx === 1) move = aiMedium();
  else move = aiHard();

  if (!move) { aiThinking = false; lockBoard(false); checkEnd(); return; }
  const [r,c] = move;
  const animTime = applyMove(r,c,2);

  setTimeout(() => {
    currentPlayer = 1;
    aiThinking = false;
    lockBoard(false);
    updateInfo();
    checkEnd();
  }, animTime);
}
