import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

DB_PATH = os.getenv("REFERRAL_DB") or os.path.join(os.path.dirname(__file__), "data.db")
DIMENSIONS = ("role", "duties", "skills")

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT UNIQUE NOT NULL,
    company     TEXT,
    role        TEXT,
    duties      TEXT,  -- JSON list, set when the job is added to clusters
    skills      TEXT,  -- JSON list
    emb_role    TEXT,  -- JSON embedding vectors, one per cluster dimension
    emb_duties  TEXT,
    emb_skills  TEXT,
    scanned_at  TEXT,  -- set when a referral search was run for this job
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    title       TEXT,
    link        TEXT NOT NULL,
    university  TEXT,
    UNIQUE (job_id, link)
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with closing(connect()) as conn, conn:
        conn.executescript(SCHEMA)


def normalize_url(url):
    return url.split("#")[0].strip()


def _now():
    return datetime.now(timezone.utc).isoformat()


def save_scan(url, company, role, university, contacts):
    """Record a referral search: the job, plus the contacts found for it."""
    url = normalize_url(url)
    now = _now()
    with closing(connect()) as conn, conn:
        conn.execute(
            """INSERT INTO jobs (url, company, role, scanned_at, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(url) DO UPDATE SET
                   scanned_at = excluded.scanned_at,
                   company = COALESCE(company, excluded.company),
                   role = COALESCE(role, excluded.role)""",
            (url, company, role, now, now),
        )
        job_id = conn.execute("SELECT id FROM jobs WHERE url = ?", (url,)).fetchone()["id"]
        conn.executemany(
            "INSERT OR IGNORE INTO contacts (job_id, title, link, university) VALUES (?, ?, ?, ?)",
            [(job_id, c["title"], c["link"], university) for c in contacts],
        )
    return job_id


def save_profile(url, profile, embeddings):
    """Record a job's extracted profile and embeddings. Returns 'added' or 'updated'."""
    url = normalize_url(url)
    values = (
        profile["company"],
        profile["role"],
        json.dumps(profile["duties"]),
        json.dumps(profile["skills"]),
        json.dumps(embeddings["role"]),
        json.dumps(embeddings["duties"]),
        json.dumps(embeddings["skills"]),
    )
    with closing(connect()) as conn, conn:
        existed = conn.execute("SELECT 1 FROM jobs WHERE url = ?", (url,)).fetchone() is not None
        conn.execute(
            """INSERT INTO jobs (url, company, role, duties, skills,
                                 emb_role, emb_duties, emb_skills, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(url) DO UPDATE SET
                   company = excluded.company, role = excluded.role,
                   duties = excluded.duties, skills = excluded.skills,
                   emb_role = excluded.emb_role, emb_duties = excluded.emb_duties,
                   emb_skills = excluded.emb_skills""",
            (url, *values, _now()),
        )
    return "updated" if existed else "added"


def list_jobs():
    with closing(connect()) as conn:
        jobs = [dict(row) for row in conn.execute(
            """SELECT id, url, company, role, scanned_at, created_at,
                      emb_role IS NOT NULL AS profiled
               FROM jobs ORDER BY COALESCE(scanned_at, created_at) DESC"""
        )]
        contacts = conn.execute(
            "SELECT job_id, title, link, university FROM contacts ORDER BY id"
        ).fetchall()

    by_job = {}
    for c in contacts:
        by_job.setdefault(c["job_id"], []).append(
            {"title": c["title"], "link": c["link"], "university": c["university"]}
        )
    for job in jobs:
        job["profiled"] = bool(job["profiled"])
        job["contacts"] = by_job.get(job["id"], [])
    return jobs


def profiled_jobs(by):
    """Jobs that have an embedding for the given dimension."""
    if by not in DIMENSIONS:
        raise ValueError(f"Unknown dimension: {by}")
    col = f"emb_{by}"
    with closing(connect()) as conn:
        rows = conn.execute(
            f"""SELECT id, url, company, role, duties, skills, {col} AS embedding
                FROM jobs WHERE {col} IS NOT NULL ORDER BY id"""
        ).fetchall()
    return [
        {
            "id": r["id"], "url": r["url"], "company": r["company"], "role": r["role"],
            "duties": json.loads(r["duties"]), "skills": json.loads(r["skills"]),
            "embedding": json.loads(r["embedding"]),
        }
        for r in rows
    ]


def delete_job(job_id):
    with closing(connect()) as conn, conn:
        return conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,)).rowcount > 0
