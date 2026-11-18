"""Tiny SQLite progress store (anonymous learner id kept in the browser)."""
from __future__ import annotations

import os
import sqlite3
import threading
import time

DB_PATH = os.environ.get("SCALEFORGE_DB", os.path.join(os.path.dirname(__file__), "..", "scaleforge.db"))
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init() -> None:
    with _lock, _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL,
            score REAL NOT NULL, max_score REAL NOT NULL, passed INTEGER NOT NULL,
            created_at REAL NOT NULL)""")
        c.execute("CREATE INDEX IF NOT EXISTS ix_attempts_uid ON attempts(uid)")
        c.execute("""CREATE TABLE IF NOT EXISTS designs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL, name TEXT NOT NULL, graph TEXT NOT NULL, updated_at REAL NOT NULL,
            UNIQUE(uid, name))""")


def record(uid: str | None, kind: str, ref: str, score: float, max_score: float, passed: bool) -> None:
    if not uid:
        return
    with _lock, _conn() as c:
        c.execute("INSERT INTO attempts(uid, kind, ref, score, max_score, passed, created_at) VALUES (?,?,?,?,?,?,?)",
                  (uid[:64], kind, ref, score, max_score, int(passed), time.time()))


def progress(uid: str) -> dict:
    with _lock, _conn() as c:
        rows = c.execute("SELECT kind, ref, MAX(score * 1.0 / max_score) AS best, MAX(passed) AS passed, COUNT(*) AS n, "
                         "MAX(created_at) AS last FROM attempts WHERE uid=? GROUP BY kind, ref", (uid,)).fetchall()
    out: dict = {"quiz": {}, "estimation": {}, "scenario": {}, "interview": {}}
    for r in rows:
        out.setdefault(r["kind"], {})[r["ref"]] = {"best": round(r["best"] * 100, 1), "passed": bool(r["passed"]),
                                                    "attempts": r["n"], "last": r["last"]}
    return out


def save_design(uid: str, name: str, graph: str) -> None:
    with _lock, _conn() as c:
        c.execute("INSERT INTO designs(uid, name, graph, updated_at) VALUES (?,?,?,?) "
                  "ON CONFLICT(uid, name) DO UPDATE SET graph=excluded.graph, updated_at=excluded.updated_at",
                  (uid[:64], name[:80], graph, time.time()))


def list_designs(uid: str) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT name, graph, updated_at FROM designs WHERE uid=? ORDER BY updated_at DESC", (uid,)).fetchall()
    return [dict(r) for r in rows]


def delete_design(uid: str, name: str) -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM designs WHERE uid=? AND name=?", (uid, name))
