#!/usr/bin/env python3
"""Запуск Flask сервера для Majority Game."""

from server.app import app

if __name__ == "__main__":
    print("="*60)
    print("🎮 Majority Game Server")
    print("="*60)
    print("Сервер запущен на: http://localhost:5000")
    print("Для локальной сети используйте: http://<ваш-IP>:5000")
    print("Нажмите Ctrl+C для остановки")
    print("="*60)
    
    app.run(host="0.0.0.0", port=5000, debug=True)
