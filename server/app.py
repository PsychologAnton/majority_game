from __future__ import annotations

import os
import threading
import time
from flask import Flask, jsonify, render_template, request, abort, send_from_directory

from .lobby_store import LobbyStore


def create_app() -> Flask:
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static",
    )

    store = LobbyStore(max_players=5, player_timeout_seconds=35)

    def _cleanup_loop() -> None:
        while True:
            time.sleep(5)
            store.cleanup()

    t = threading.Thread(target=_cleanup_loop, daemon=True)
    t.start()

    @app.get("/")
    def index():
        return render_template("index.html", formats=store.formats)

    @app.get("/lobby/<code>")
    def lobby_page(code: str):
        return render_template("lobby.html", code=code)

    @app.get("/game/<code>")
    def game_page(code: str):
        # Multiplayer game client
        return render_template("game.html", code=code)

    # -------- API --------

    @app.get("/api/lobbies")
    def api_list_lobbies():
        return jsonify(store.list_public())

    @app.post("/api/lobbies")
    def api_create_lobby():
        data = request.get_json(silent=True) or {}
        nick = (data.get("nick") or "").strip()
        game_format = (data.get("format") or "").strip()
        if not nick:
            return jsonify({"error": "Nick is required"}), 400
        if game_format not in store.formats:
            return jsonify({"error": "Unknown format"}), 400

        lobby, player = store.create_lobby(host_nick=nick, game_format=game_format)
        return jsonify({
            "code": lobby.code,
            "player_id": player.player_id,
            "is_host": True,
            "max_players": lobby.max_players,
        })

    @app.get("/api/lobbies/<code>")
    def api_get_lobby(code: str):
        player_id = (request.args.get("player_id") or "").strip() or None
        lobby = store.get_lobby(code)
        if not lobby:
            return jsonify({"error": "Lobby not found"}), 404

        if player_id:
            store.ping(code, player_id)

        # If game started, include a flag so client redirects
        return jsonify(store.get_public_state(code))

    @app.post("/api/lobbies/<code>/join")
    def api_join_lobby(code: str):
        data = request.get_json(silent=True) or {}
        nick = (data.get("nick") or "").strip()
        if not nick:
            return jsonify({"error": "Nick is required"}), 400

        res = store.join_lobby(code=code, nick=nick)
        if res["ok"] is False:
            return jsonify(res), 400
        return jsonify(res)

    @app.post("/api/lobbies/<code>/leave")
    def api_leave_lobby(code: str):
        data = request.get_json(silent=True) or {}
        player_id = (data.get("player_id") or "").strip()
        if not player_id:
            return jsonify({"error": "player_id is required"}), 400

        ok = store.leave_lobby(code=code, player_id=player_id)
        if not ok:
            return jsonify({"error": "Lobby or player not found"}), 404
        return jsonify({"ok": True})

    @app.post("/api/lobbies/<code>/start")
    def api_start_lobby(code: str):
        data = request.get_json(silent=True) or {}
        player_id = (data.get("player_id") or "").strip()
        if not player_id:
            return jsonify({"error": "player_id is required"}), 400

        res = store.start_lobby(code=code, player_id=player_id)
        if res["ok"] is False:
            return jsonify(res), 400
        return jsonify(res)
    
    # -------- Game API --------
    
    @app.get("/api/game/<code>")
    def api_game_state(code: str):
        player_id = (request.args.get("player_id") or "").strip() or None
        if player_id:
            store.ping(code, player_id)
            
        state = store.get_game_state(code)
        if not state:
            return jsonify({"error": "Game not found"}), 404
        return jsonify(state)

    @app.post("/api/game/<code>/move")
    def api_game_move(code: str):
        data = request.get_json(silent=True) or {}
        player_id = (data.get("player_id") or "").strip()
        row = data.get("r")
        col = data.get("c")
        
        if not player_id:
            return jsonify({"error": "Auth required"}), 401
            
        res = store.make_move(code, player_id, row, col)
        if res["ok"] is False:
            return jsonify(res), 400
        
        return jsonify(res)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
