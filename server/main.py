from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
STATIC_FILES = {
    "index.html",
    "portal.css",
    "favicon.svg",
    "404.html",
    "CNAME",
}
GAME_FILES = {
    "mines": {"index.html", "styles.css", "game.js", "config.js", "favicon.svg"},
    "pentix": {"index.html", "styles.css", "game.js", "favicon.svg"},
    "lines": {"index.html", "styles.css", "game.js", "favicon.svg"},
}

DIFFICULTIES = {
    "beginner": {"rows": 9, "cols": 9, "mines": 10},
    "intermediate": {"rows": 16, "cols": 16, "mines": 40},
    "expert": {"rows": 16, "cols": 30, "mines": 99},
}

NAME_RE = re.compile(r"^[\w \-.а-яА-ЯёЁ]{1,24}$", re.UNICODE)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://sapper:sapper@localhost:5433/sapper",
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    if pool is None:
        raise HTTPException(503, "База ещё не готова")
    return pool


def init_db(cxn_pool: ConnectionPool) -> None:
    with cxn_pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS scores (
                  id            BIGSERIAL PRIMARY KEY,
                  name          VARCHAR(24) NOT NULL,
                  difficulty    VARCHAR(16) NOT NULL
                    CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
                  time_seconds  SMALLINT NOT NULL
                    CHECK (time_seconds >= 0 AND time_seconds <= 999),
                  score         INTEGER NOT NULL
                    CHECK (score >= 0 AND score <= 20000),
                  opened        SMALLINT NOT NULL CHECK (opened >= 0),
                  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS scores_diff_time_idx
                  ON scores (difficulty, time_seconds ASC, created_at ASC)
                """
            )
        conn.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global pool
    pool = ConnectionPool(
        conninfo=DATABASE_URL,
        min_size=1,
        max_size=8,
        kwargs={"row_factory": dict_row, "autocommit": False},
        open=True,
    )
    init_db(pool)
    yield
    pool.close()
    pool = None


app = FastAPI(title="Сапёр leaderboard", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ScoreIn(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    difficulty: str
    time: int = Field(ge=0, le=999, alias="time")
    score: int = Field(ge=0, le=20000)
    opened: int = Field(ge=0, le=999)

    model_config = {"populate_by_name": True}


class ScoreOut(BaseModel):
    name: str
    time: int
    score: int
    opened: int
    at: int


def clean_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", raw.strip())
    if not NAME_RE.match(name):
        raise HTTPException(400, "Имя: 1–24 символа, буквы, цифры, пробел, . _ -")
    return name


@app.get("/api/health")
def health():
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            row = cur.fetchone()
    return {"ok": True, "db": bool(row)}


@app.get("/api/scores")
def list_scores(
    difficulty: str = Query(default="intermediate"),
    limit: int = Query(default=15, ge=1, le=50),
):
    if difficulty not in DIFFICULTIES:
        raise HTTPException(400, "Неизвестная сложность")
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT name, time_seconds, score, opened,
                       (extract(epoch from created_at) * 1000)::bigint AS at
                FROM scores
                WHERE difficulty = %s
                ORDER BY time_seconds ASC, created_at ASC
                LIMIT %s
                """,
                (difficulty, limit),
            )
            rows = cur.fetchall()
    return {
        "difficulty": difficulty,
        "scores": [
            {
                "name": r["name"],
                "time": r["time_seconds"],
                "score": r["score"],
                "opened": r["opened"],
                "at": r["at"],
            }
            for r in rows
        ],
    }


@app.post("/api/scores")
def create_score(payload: ScoreIn, request: Request):
    if payload.difficulty not in DIFFICULTIES:
        raise HTTPException(400, "Неизвестная сложность")
    preset = DIFFICULTIES[payload.difficulty]
    safe = preset["rows"] * preset["cols"] - preset["mines"]
    if payload.opened != safe:
        raise HTTPException(400, "Неполный клир поля")
    name = clean_name(payload.name)
    ip = request.client.host if request.client else "0.0.0.0"

    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) AS n
                FROM scores
                WHERE created_at > now() - interval '10 seconds'
                  AND name = %s
                """,
                (name,),
            )
            recent = cur.fetchone()["n"]
            if recent >= 3:
                raise HTTPException(429, "Слишком часто. Подожди немного.")
            cur.execute(
                """
                INSERT INTO scores (name, difficulty, time_seconds, score, opened)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id,
                          name,
                          time_seconds,
                          score,
                          opened,
                          (extract(epoch from created_at) * 1000)::bigint AS at
                """,
                (name, payload.difficulty, payload.time, payload.score, payload.opened),
            )
            row = cur.fetchone()
        conn.commit()

    _ = ip
    return {
        "id": row["id"],
        "name": row["name"],
        "time": row["time_seconds"],
        "score": row["score"],
        "opened": row["opened"],
        "at": row["at"],
        "difficulty": payload.difficulty,
    }


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html")


@app.get("/{game}")
@app.get("/{game}/")
def game_index(game: str):
    if game in GAME_FILES:
        return FileResponse(ROOT / game / "index.html")
    if game in STATIC_FILES:
        return FileResponse(ROOT / game)
    raise HTTPException(404)


@app.get("/{game}/{name}")
def game_static(game: str, name: str):
    allowed = GAME_FILES.get(game)
    if not allowed or name not in allowed:
        raise HTTPException(404)
    return FileResponse(ROOT / game / name)
