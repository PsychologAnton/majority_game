/**
 * game-logger.js — Общий модуль подробного логирования игры
 * Используется во ВСЕХ режимах: singleplayer, multiplayer, debug-local
 *
 * API:
 *   GameLogger.init(options)   — инициализация / сброс лога
 *   GameLogger.logMove(...)    — запись хода
 *   GameLogger.logCascade(...) — запись волны каскада
 *   GameLogger.logCapture(...) — запись захвата внутри волны
 *   GameLogger.logGameEnd(...) — итог игры
 *   GameLogger.save()          — скачать файл
 *   GameLogger.isEnabled()     — проверить активность
 */
const GameLogger = (() => {
  let _enabled = false;
  let _lines = [];
  let _moveCounter = 0;
  let _sessionId = '';
  let _mode = 'unknown';  // 'singleplayer' | 'multiplayer' | 'debug-local'
  let _boardSize = 0;
  let _playerNames = {};  // { playerNum: 'Nick' }

  function _ts() {
    return new Date().toISOString().replace('T', ' ').substring(0, 23);
  }

  function _line(text) {
    _lines.push(text);
  }

  function _playerLabel(playerNum) {
    const name = _playerNames[playerNum] || `Игрок ${playerNum}`;
    return `[P${playerNum}:${name}]`;
  }

  function init({ enabled, mode, boardSize, playerNames }) {
    _enabled = !!enabled;
    _lines = [];
    _moveCounter = 0;
    _mode = mode || 'unknown';
    _boardSize = boardSize || 0;
    _playerNames = playerNames || {};
    // Генерация уникального ID сессии
    _sessionId = `${_mode}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!_enabled) return;

    _line(`========================================`);
    _line(`  MAJORITY GAME — ПОДРОБНЫЙ ЛОГ ПАРТИИ`);
    _line(`========================================`);
    _line(`Режим:      ${_mode}`);
    _line(`Размер поля: ${_boardSize}x${_boardSize}`);
    _line(`Игроки:`);
    for (const [num, name] of Object.entries(_playerNames)) {
      _line(`  P${num}: ${name}`);
    }
    _line(`Начало:     ${_ts()}`);
    _line(`ID сессии:  ${_sessionId}`);
    _line(`========================================`);
    _line('');
  }

  function logMove({ playerNum, r, c, boardBefore }) {
    if (!_enabled) return;
    _moveCounter++;
    _line(`--- Ход #${_moveCounter} ---`);
    _line(`  ${_ts()}`);
    _line(`  Игрок: ${_playerLabel(playerNum)}`);
    _line(`  Поставил фишку: (строка ${r}, колонка ${c})`);
    if (boardBefore) {
      const emptyCount = boardBefore.flat().filter(v => v === 0).length;
      const scores = {};
      boardBefore.flat().forEach(v => { if (v > 0) scores[v] = (scores[v] || 0) + 1; });
      _line(`  Состояние ДО хода:`);
      _line(`    Пустых клеток: ${emptyCount}`);
      for (const [p, s] of Object.entries(scores)) {
        _line(`    ${_playerLabel(parseInt(p))}: ${s} клеток`);
      }
    }
  }

  function logCascade({ waveIndex, cells, playerNum }) {
    if (!_enabled) return;
    if (!cells || cells.length === 0) return;
    _line(`  ▸ Волна каскада #${waveIndex + 1}: захвачено ${cells.length} клеток`);
    cells.forEach(([r, c]) => {
      _line(`      ✦ захват (${r}, ${c}) → ${_playerLabel(playerNum)}`);
    });
  }

  function logCapture({ r, c, fromPlayer, toPlayer }) {
    if (!_enabled) return;
    _line(`      ↺ (${r}, ${c}): ${_playerLabel(fromPlayer)} → ${_playerLabel(toPlayer)}`);
  }

  function logMoveResult({ totalCaptured, boardAfter }) {
    if (!_enabled) return;
    _line(`  Итог хода: захвачено всего ${totalCaptured} клеток каскадом`);
    if (boardAfter) {
      const scores = {};
      boardAfter.flat().forEach(v => { if (v > 0) scores[v] = (scores[v] || 0) + 1; });
      _line(`  Счёт после хода:`);
      for (const [p, s] of Object.entries(scores)) {
        _line(`    ${_playerLabel(parseInt(p))}: ${s} клеток`);
      }
    }
    _line('');
  }

  function logGameEnd({ winner, playerNum, scores, reason }) {
    if (!_enabled) return;
    _line(`========================================`);
    _line(`  КОНЕЦ ИГРЫ`);
    _line(`========================================`);
    _line(`Время:    ${_ts()}`);
    _line(`Ходов:    ${_moveCounter}`);
    _line(`Причина:  ${reason || 'доска заполнена или победа по очкам'}`);
    _line(``);
    _line(`Итоговый счёт:`);
    if (scores) {
      for (const [p, s] of Object.entries(scores)) {
        _line(`  ${_playerLabel(parseInt(p))}: ${s} клеток`);
      }
    }
    _line(``);
    if (winner === 'draw') {
      _line(`Результат: 🤝 НИЧЬЯ`);
    } else if (playerNum) {
      _line(`Результат: 🏆 ПОБЕДИТЕЛЬ — ${_playerLabel(playerNum)}`);
    } else if (winner) {
      _line(`Результат: 🏆 ПОБЕДИТЕЛЬ — ${winner}`);
    }
    _line(`========================================`);
  }

  function save() {
    if (!_enabled || _lines.length === 0) return;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `majority_log_${_mode}_${dateStr}.txt`;
    const content = _lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    console.log(`[Logger] Лог сохранён: ${filename}`);
  }

  function isEnabled() {
    return _enabled;
  }

  function getRawLog() {
    return _lines.join('\n');
  }

  return { init, logMove, logCascade, logCapture, logMoveResult, logGameEnd, save, isEnabled, getRawLog };
})();
