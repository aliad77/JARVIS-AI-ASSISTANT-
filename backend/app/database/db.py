"""Local SQLite storage.

Every query uses ``?`` placeholders (parameterised SQL). No secrets are ever
written here (JARVIS uses no API keys).
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    grade       INTEGER NOT NULL,
    subject     TEXT NOT NULL,
    mode        TEXT NOT NULL DEFAULT 'chat',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    meta             TEXT NOT NULL DEFAULT '{}',
    created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE TABLE IF NOT EXISTS preferences (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quizzes (
    id          TEXT PRIMARY KEY,
    subject     TEXT NOT NULL,
    topic       TEXT NOT NULL,
    grade       INTEGER NOT NULL,
    source      TEXT NOT NULL CHECK (source IN ('engine', 'ai')),
    title       TEXT NOT NULL,
    questions   TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id     TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    subject     TEXT NOT NULL,
    grade       INTEGER NOT NULL,
    score       INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    answers     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS practice_items (
    id          TEXT PRIMARY KEY,
    topic       TEXT NOT NULL,
    grade       INTEGER NOT NULL,
    payload     TEXT NOT NULL,
    solved      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
    subject     TEXT NOT NULL,
    grade       INTEGER NOT NULL,
    correct     INTEGER NOT NULL DEFAULT 0,
    attempted   INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (subject, grade)
);
CREATE TABLE IF NOT EXISTS ai_usage (
    day            TEXT PRIMARY KEY,
    requests       INTEGER NOT NULL DEFAULT 0,
    input_tokens   INTEGER NOT NULL DEFAULT 0,
    output_tokens  INTEGER NOT NULL DEFAULT 0
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path | str):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        # A single shared connection keeps ":memory:" databases alive for tests;
        # the lock serialises access across FastAPI worker threads.
        self._conn = sqlite3.connect(self.path, check_same_thread=False, timeout=10)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        if self.path != ":memory:":
            self._conn.execute("PRAGMA journal_mode = WAL")
        self._conn.executescript(SCHEMA)
        self._conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        self._conn.commit()

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            try:
                yield self._conn
                self._conn.commit()
            except Exception:
                self._conn.rollback()
                raise

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # -- conversations -----------------------------------------------------
    def create_conversation(self, title: str, grade: int, subject: str, mode: str = "chat") -> dict[str, Any]:
        cid = uuid.uuid4().hex
        now = _now()
        with self.tx() as c:
            c.execute(
                "INSERT INTO conversations (id, title, grade, subject, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cid, title[:80] or "New mission", grade, subject, mode, now, now),
            )
        return self.get_conversation(cid)  # type: ignore[return-value]

    def get_conversation(self, cid: str) -> dict[str, Any] | None:
        with self.tx() as c:
            row = c.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        return dict(row) if row else None

    def list_conversations(self, limit: int = 100) -> list[dict[str, Any]]:
        with self.tx() as c:
            rows = c.execute(
                """SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
                   FROM conversations c ORDER BY c.updated_at DESC, c.created_at DESC LIMIT ?""",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def update_conversation(self, cid: str, *, title: str | None = None, grade: int | None = None,
                            subject: str | None = None, mode: str | None = None) -> None:
        with self.tx() as c:
            row = c.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
            if not row:
                return
            c.execute(
                "UPDATE conversations SET title = ?, grade = ?, subject = ?, mode = ?, updated_at = ? WHERE id = ?",
                (title[:80] if title else row["title"], grade or row["grade"], subject or row["subject"],
                 mode or row["mode"], _now(), cid),
            )

    def delete_conversation(self, cid: str) -> bool:
        with self.tx() as c:
            cur = c.execute("DELETE FROM conversations WHERE id = ?", (cid,))
        return cur.rowcount > 0

    def clear_conversations(self) -> int:
        with self.tx() as c:
            cur = c.execute("DELETE FROM conversations")
        return cur.rowcount

    # -- messages ----------------------------------------------------------
    def add_message(self, cid: str, role: str, content: str, meta: dict[str, Any] | None = None) -> dict[str, Any]:
        now = _now()
        with self.tx() as c:
            cur = c.execute(
                "INSERT INTO messages (conversation_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?)",
                (cid, role, content, json.dumps(meta or {}), now),
            )
            c.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, cid))
            mid = cur.lastrowid
        return {"id": mid, "conversation_id": cid, "role": role, "content": content, "meta": meta or {}, "created_at": now}

    def get_messages(self, cid: str, limit: int | None = None) -> list[dict[str, Any]]:
        with self.tx() as c:
            if limit is None:
                rows = c.execute("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id", (cid,)).fetchall()
            else:
                rows = c.execute(
                    "SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id",
                    (cid, limit),
                ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["meta"] = json.loads(d["meta"] or "{}")
            out.append(d)
        return out

    # -- preferences -------------------------------------------------------
    def get_preferences(self) -> dict[str, Any]:
        with self.tx() as c:
            rows = c.execute("SELECT key, value FROM preferences").fetchall()
        return {r["key"]: json.loads(r["value"]) for r in rows}

    def set_preferences(self, values: dict[str, Any]) -> None:
        with self.tx() as c:
            c.executemany(
                "INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [(k, json.dumps(v)) for k, v in values.items()],
            )

    # -- quizzes -----------------------------------------------------------
    def save_quiz(self, quiz_id: str, subject: str, topic: str, grade: int, source: str, title: str,
                  questions: list[dict[str, Any]]) -> None:
        with self.tx() as c:
            c.execute(
                "INSERT INTO quizzes (id, subject, topic, grade, source, title, questions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (quiz_id, subject, topic, grade, source, title, json.dumps(questions), _now()),
            )

    def get_quiz(self, quiz_id: str) -> dict[str, Any] | None:
        with self.tx() as c:
            row = c.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["questions"] = json.loads(d["questions"])
        return d

    def add_quiz_attempt(self, quiz_id: str, subject: str, grade: int, score: int, total: int,
                         answers: list[int | None]) -> int:
        with self.tx() as c:
            cur = c.execute(
                "INSERT INTO quiz_attempts (quiz_id, subject, grade, score, total, answers, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (quiz_id, subject, grade, score, total, json.dumps(answers), _now()),
            )
        self.record_progress(subject, grade, score, total)
        return int(cur.lastrowid)

    def list_quiz_attempts(self, limit: int = 50) -> list[dict[str, Any]]:
        with self.tx() as c:
            rows = c.execute(
                """SELECT a.id, a.quiz_id, a.subject, a.grade, a.score, a.total, a.created_at, q.title, q.topic, q.source
                   FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id ORDER BY a.id DESC LIMIT ?""",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    # -- practice ----------------------------------------------------------
    def save_practice_item(self, item_id: str, topic: str, grade: int, payload: dict[str, Any]) -> None:
        with self.tx() as c:
            c.execute(
                "INSERT INTO practice_items (id, topic, grade, payload, created_at) VALUES (?, ?, ?, ?, ?)",
                (item_id, topic, grade, json.dumps(payload), _now()),
            )

    def get_practice_item(self, item_id: str) -> dict[str, Any] | None:
        with self.tx() as c:
            row = c.execute("SELECT * FROM practice_items WHERE id = ?", (item_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        return d

    def mark_practice_solved(self, item_id: str) -> None:
        with self.tx() as c:
            c.execute("UPDATE practice_items SET solved = 1 WHERE id = ?", (item_id,))

    # -- progress ----------------------------------------------------------
    def record_progress(self, subject: str, grade: int, correct: int, attempted: int) -> None:
        with self.tx() as c:
            c.execute(
                """INSERT INTO progress (subject, grade, correct, attempted, updated_at) VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(subject, grade) DO UPDATE SET correct = correct + excluded.correct,
                   attempted = attempted + excluded.attempted, updated_at = excluded.updated_at""",
                (subject, grade, correct, attempted, _now()),
            )

    def get_progress(self) -> list[dict[str, Any]]:
        with self.tx() as c:
            rows = c.execute("SELECT * FROM progress ORDER BY subject, grade").fetchall()
        return [dict(r) for r in rows]

    def clear_learning_data(self) -> None:
        with self.tx() as c:
            c.execute("DELETE FROM quiz_attempts")
            c.execute("DELETE FROM quizzes")
            c.execute("DELETE FROM practice_items")
            c.execute("DELETE FROM progress")

    # -- AI usage (daily cost guard) --------------------------------------
    def ai_requests_today(self) -> int:
        with self.tx() as c:
            row = c.execute("SELECT requests FROM ai_usage WHERE day = ?", (date.today().isoformat(),)).fetchone()
        return int(row["requests"]) if row else 0

    def record_ai_usage(self, input_tokens: int, output_tokens: int) -> None:
        with self.tx() as c:
            c.execute(
                """INSERT INTO ai_usage (day, requests, input_tokens, output_tokens) VALUES (?, 1, ?, ?)
                   ON CONFLICT(day) DO UPDATE SET requests = requests + 1,
                   input_tokens = input_tokens + excluded.input_tokens,
                   output_tokens = output_tokens + excluded.output_tokens""",
                (date.today().isoformat(), input_tokens, output_tokens),
            )

    def ai_usage_today(self) -> dict[str, int]:
        with self.tx() as c:
            row = c.execute("SELECT * FROM ai_usage WHERE day = ?", (date.today().isoformat(),)).fetchone()
        return {k: int(row[k]) for k in ("requests", "input_tokens", "output_tokens")} if row else \
            {"requests": 0, "input_tokens": 0, "output_tokens": 0}
