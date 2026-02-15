from __future__ import annotations
import random
from typing import List, Dict, Any, Tuple, Optional

class GameEngine:
    def __init__(self, size: int, players: List[str]):
        """
        size: Board dimension (e.g. 8 for 8x8)
        players: List of player_ids in turn order.
        """
        self.size = size
        self.players = players  # player_id list
        self.turn_idx = 0
        # Board is a list of lists. 0 = empty. 
        # Values 1..N correspond to self.players indices (1-based for convenience in logic)
        self.board = [[0 for _ in range(size)] for _ in range(size)]
        self.winner: Optional[str] = None
        self.history: List[dict] = []
        self.cascade_enabled = True

    @property
    def current_player_id(self) -> str:
        return self.players[self.turn_idx]

    @property
    def current_player_num(self) -> int:
        return self.turn_idx + 1

    def get_state(self) -> dict:
        scores = {pid: 0 for pid in self.players}
        total_cells = self.size * self.size
        filled = 0
        
        for r in range(self.size):
            for c in range(self.size):
                val = self.board[r][c]
                if val > 0:
                    pid = self.players[val - 1]
                    scores[pid] += 1
                    filled += 1
        
        return {
            "size": self.size,
            "board": self.board,
            "players": self.players,
            "turn_idx": self.turn_idx,
            "current_player_id": self.current_player_id,
            "scores": scores,
            "winner": self.winner,
            "game_over": self.winner is not None,
            "history_len": len(self.history)
        }

    def get_legal_moves(self, player_num: int) -> List[Tuple[int, int]]:
        """
        Get all legal moves for a player.
        IMPORTANT: In the early game (first 2 moves total), 
        players cannot place adjacent to opponent pieces.
        """
        empty_cells = []
        for r in range(self.size):
            for c in range(self.size):
                if self.board[r][c] == 0:
                    empty_cells.append((r, c))
        
        # Count pieces for each player
        player_counts = {i: 0 for i in range(1, len(self.players) + 1)}
        for r in range(self.size):
            for c in range(self.size):
                val = self.board[r][c]
                if val > 0:
                    player_counts[val] += 1
        
        my_count = player_counts[player_num]
        total_placed = sum(player_counts.values())
        
        # Early game restriction: if <= 1 piece per player and at least 1 piece on board,
        # cannot place adjacent to opponent
        if total_placed > 0 and all(count <= 1 for count in player_counts.values()):
            # Filter out cells adjacent to opponents
            legal = []
            for r, c in empty_cells:
                can_place = True
                for nr, nc in self._neighbors(r, c):
                    neighbor_val = self.board[nr][nc]
                    if neighbor_val != 0 and neighbor_val != player_num:
                        can_place = False
                        break
                if can_place:
                    legal.append((r, c))
            
            # If filtered list is not empty, use it; otherwise fall back to all empty
            if legal:
                return legal
        
        return empty_cells

    def is_valid_move(self, r: int, c: int, player_id: str) -> bool:
        if self.winner:
            return False
        if player_id != self.current_player_id:
            return False
        if not (0 <= r < self.size and 0 <= c < self.size):
            return False
        if self.board[r][c] != 0:
            return False
        
        # Check if move is in legal moves list
        legal_moves = self.get_legal_moves(self.current_player_num)
        return (r, c) in legal_moves

    def make_move(self, r: int, c: int, player_id: str) -> dict:
        if not self.is_valid_move(r, c, player_id):
            return {"ok": False, "error": "Invalid move"}

        p_num = self.current_player_num
        self.board[r][c] = p_num
        
        # Каскадная логика захвата
        # ВАЖНО: Проверяем только вражеские клетки!
        processed_flips = []
        check_queue = [(r, c)]
        
        while check_queue:
            curr_r, curr_c = check_queue.pop(0)
            
            # Проверяем соседей текущей клетки
            for nr, nc in self._neighbors(curr_r, curr_c):
                target_val = self.board[nr][nc]
                
                # Пропускаем пустые и свои клетки
                if target_val == 0 or target_val == p_num:
                    continue
                
                # Это вражеская клетка - проверяем условие захвата
                if self._should_capture(nr, nc, p_num, target_val):
                    # Захватываем!
                    self.board[nr][nc] = p_num
                    processed_flips.append((nr, nc))
                    
                    # Если каскад включён, добавляем в очередь
                    if self.cascade_enabled:
                        check_queue.append((nr, nc))
                            
        self.history.append({
            "player": player_id,
            "move": (r,c),
            "flips": len(processed_flips)
        })

        # Next turn
        self.turn_idx = (self.turn_idx + 1) % len(self.players)
        
        # Check game end
        self._check_winner()
        
        return {
            "ok": True, 
            "flips": processed_flips,
            "next_player": self.current_player_id
        }

    def _neighbors(self, r, c) -> List[Tuple[int, int]]:
        deltas = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
        res = []
        for dr, dc in deltas:
            nr, nc = r+dr, c+dc
            if 0 <= nr < self.size and 0 <= nc < self.size:
                res.append((nr, nc))
        return res

    def _count_neighbors(self, r, c, val) -> int:
        count = 0
        for nr, nc in self._neighbors(r, c):
            if self.board[nr][nc] == val:
                count += 1
        return count

    def _should_capture(self, r, c, attacker_val, defender_val) -> bool:
        # The target cell is at (r,c) with value defender_val.
        # Attacker is attacker_val.
        # Condition: Attacker neighbors > Defender neighbors around (r,c)
        att_count = self._count_neighbors(r, c, attacker_val)
        def_count = self._count_neighbors(r, c, defender_val)
        return att_count > def_count

    def _check_winner(self):
        # Game ends if board full or only one player left (wipeout)
        counts = {i:0 for i in range(1, len(self.players)+1)}
        empty = 0
        for r in range(self.size):
            for c in range(self.size):
                v = self.board[r][c]
                if v == 0:
                    empty += 1
                else:
                    counts[v] += 1
        
        active_players = [i for i, c in counts.items() if c > 0]
        total_placed = sum(counts.values())
        
        # If board is full, game over
        if empty == 0:
            self._finalize_winner(counts)
            return
        
        # If at least 2 pieces placed and only one player has pieces, they win
        if total_placed >= 2 and len(active_players) == 1:
            self._finalize_winner(counts)
            return

    def _finalize_winner(self, counts):
        # Find max
        best_p_num = -1
        max_score = -1
        tie = False
        
        for p_num, score in counts.items():
            if score > max_score:
                max_score = score
                best_p_num = p_num
                tie = False
            elif score == max_score:
                tie = True
        
        if tie:
            self.winner = "draw"
        else:
            self.winner = self.players[best_p_num - 1]
