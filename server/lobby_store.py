from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import secrets
import string
import threading
import time


def _now() -> float:
    return time.time()


def _gen_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _norm_code(code: str) -> str:
    return (code or "").strip().upper()


@dataclass
class Player:
    player_id: str
    nick: str
    is_host: bool
    joined_at: float
    last_seen: float


@dataclass
class Lobby:
    code: str
    game_format: str
    max_players: int
    created_at: float
    started: bool
    players: Dict[str, Player]  # key = player_id

    def host(self) -> Optional[Player]:
        for p in self.players.values():
            if p.is_host:
                return p
        return None

    def player_list(self) -> List[dict]:
        # Sort by join time for stable UI
        items = sorted(self.players.values(), key=lambda p: p.joined_at)
        return [
            {
                "player_id": p.player_id,
                "nick": p.nick,
                "is_host": p.is_host,
                "last_seen": p.last_seen,
            }
            for p in items
        ]


class LobbyStore:
    def __init__(self, max_players: int = 5, player_timeout_seconds: int = 35):
        self._lock = threading.Lock()
        self._lobbies: Dict[str, Lobby] = {}
        self.max_players = int(max_players)
        self.player_timeout_seconds = int(player_timeout_seconds)

        # Placeholder formats; can be changed later.
        self.formats = ["Classic", "Fast", "Blitz"]

    def _new_player(self, nick: str, is_host: bool) -> Player:
        pid = secrets.token_urlsafe(10)
        t = _now()
        return Player(player_id=pid, nick=nick, is_host=is_host, joined_at=t, last_seen=t)

    def create_lobby(self, host_nick: str, game_format: str) -> Tuple[Lobby, Player]:
        with self._lock:
            while True:
                code = _gen_code(6)
                if code not in self._lobbies:
                    break

            host = self._new_player(host_nick, is_host=True)
            lobby = Lobby(
                code=code,
                game_format=game_format,
                max_players=self.max_players,
                created_at=_now(),
                started=False,
                players={host.player_id: host},
            )
            self._lobbies[code] = lobby
            return lobby, host

    def get_lobby(self, code: str) -> Optional[Lobby]:
        code = _norm_code(code)
        with self._lock:
            return self._lobbies.get(code)

    def list_public(self) -> List[dict]:
        with self._lock:
            res = []
            for lobby in self._lobbies.values():
                if lobby.started:
                    continue
                res.append({
                    "code": lobby.code,
                    "format": lobby.game_format,
                    "players": len(lobby.players),
                    "max_players": lobby.max_players,
                    "created_at": lobby.created_at,
                })
            res.sort(key=lambda x: x["created_at"], reverse=True)
            return res

    def get_public_state(self, code: str) -> dict:
        code = _norm_code(code)
        with self._lock:
            lobby = self._lobbies.get(code)
            if not lobby:
                return {"ok": False, "error": "Lobby not found"}

            host = lobby.host()
            return {
                "ok": True,
                "code": lobby.code,
                "format": lobby.game_format,
                "started": lobby.started,
                "players": lobby.player_list(),
                "players_count": len(lobby.players),
                "max_players": lobby.max_players,
                "host_nick": host.nick if host else None,
            }

    def join_lobby(self, code: str, nick: str) -> dict:
        code = _norm_code(code)
        with self._lock:
            lobby = self._lobbies.get(code)
            if not lobby:
                return {"ok": False, "error": "Lobby not found"}
            if lobby.started:
                return {"ok": False, "error": "Lobby already started"}
            if len(lobby.players) >= lobby.max_players:
                return {"ok": False, "error": "Lobby is full"}

            # Enforce unique nick inside lobby (simple approach)
            nicks = {p.nick.lower() for p in lobby.players.values()}
            if nick.lower() in nicks:
                return {"ok": False, "error": "Nick already taken in this lobby"}

            p = self._new_player(nick, is_host=False)
            lobby.players[p.player_id] = p
            return {
                "ok": True,
                "code": lobby.code,
                "player_id": p.player_id,
                "is_host": False,
                "max_players": lobby.max_players,
            }

    def leave_lobby(self, code: str, player_id: str) -> bool:
        code = _norm_code(code)
        with self._lock:
            lobby = self._lobbies.get(code)
            if not lobby:
                return False
            p = lobby.players.pop(player_id, None)
            if not p:
                return False

            # If host left, promote earliest joined remaining player
            if p.is_host and lobby.players:
                remaining = sorted(lobby.players.values(), key=lambda x: x.joined_at)
                remaining[0].is_host = True

            if not lobby.players:
                self._lobbies.pop(code, None)
            return True

    def ping(self, code: str, player_id: str) -> None:
        code = _norm_code(code)
        with self._lock:
            lobby = self._lobbies.get(code)
            if not lobby:
                return
            p = lobby.players.get(player_id)
            if not p:
                return
            p.last_seen = _now()

    def start_lobby(self, code: str, player_id: str) -> dict:
        code = _norm_code(code)
        with self._lock:
            lobby = self._lobbies.get(code)
            if not lobby:
                return {"ok": False, "error": "Lobby not found"}
            p = lobby.players.get(player_id)
            if not p:
                return {"ok": False, "error": "Player not found"}
            if not p.is_host:
                return {"ok": False, "error": "Only host can start"}
            if lobby.started:
                return {"ok": False, "error": "Already started"}

            lobby.started = True
            return {"ok": True, "started": True}

    def cleanup(self) -> None:
        cutoff = _now() - self.player_timeout_seconds
        with self._lock:
            to_delete = []
            for code, lobby in self._lobbies.items():
                stale = [pid for pid, p in lobby.players.items() if p.last_seen < cutoff]
                for pid in stale:
                    lobby.players.pop(pid, None)

                # Ensure host exists if players remain
                if lobby.players and not any(p.is_host for p in lobby.players.values()):
                    remaining = sorted(lobby.players.values(), key=lambda x: x.joined_at)
                    remaining[0].is_host = True

                if not lobby.players:
                    to_delete.append(code)

            for code in to_delete:
                self._lobbies.pop(code, None)
