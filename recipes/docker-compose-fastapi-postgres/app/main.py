from __future__ import annotations

import os

import psycopg2
from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/items")
def items() -> dict[str, list[str]]:
    database_url = os.environ["DATABASE_URL"]
    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM items ORDER BY id")
            rows = [row[0] for row in cur.fetchall()]
    return {"items": rows}
