import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

DB_PATH = os.getenv("REFERRAL_DB") or os.path.join(os.path.dirname(__file__), "data.db")
DIMENSIONS = ("role", "duties", "skills")
STATUSES = ("applied", "interviewing", "offer", "rejected")

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
    status      TEXT,  -- NULL until added to the applications tracker; one of STATUSES
    applied_at  TEXT,  -- when the job was first marked applied
    notes       TEXT NOT NULL DEFAULT '',
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
        _migrate(conn)


def _migrate(conn):
    """Add columns introduced after a database already existed. CREATE TABLE IF NOT EXISTS
    only defines a table's shape the first time it's created, so an older data.db needs
    these added by hand."""
    existing = {row["name"] for row in conn.execute("PRAGMA table_info(jobs)")}
    if "status" not in existing:
        conn.execute("ALTER TABLE jobs ADD COLUMN status TEXT")
    if "applied_at" not in existing:
        conn.execute("ALTER TABLE jobs ADD COLUMN applied_at TEXT")
    if "notes" not in existing:
        conn.execute("ALTER TABLE jobs ADD COLUMN notes TEXT NOT NULL DEFAULT ''")


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


def mark_applied(url, company, role):
    """Add a job to the applications tracker: upsert the job, and unless it's already
    tracked, set its status to 'applied' and stamp today as the applied date. Re-marking
    a job that's already further along (e.g. interviewing) leaves its status alone."""
    url = normalize_url(url)
    now = _now()
    with closing(connect()) as conn, conn:
        conn.execute(
            """INSERT INTO jobs (url, company, role, status, applied_at, created_at)
               VALUES (?, ?, ?, 'applied', ?, ?)
               ON CONFLICT(url) DO UPDATE SET
                   company = COALESCE(company, excluded.company),
                   role = COALESCE(role, excluded.role),
                   status = COALESCE(status, excluded.status),
                   applied_at = COALESCE(applied_at, excluded.applied_at)""",
            (url, company, role, now, now),
        )
        return conn.execute("SELECT id FROM jobs WHERE url = ?", (url,)).fetchone()["id"]


def update_status(job_id, status):
    """status is one of STATUSES, or None to remove the job from the tracker (its applied
    date is cleared too, but the job itself, its contacts and its cluster data are kept)."""
    if status is not None and status not in STATUSES:
        raise ValueError(f"Unknown status: {status}")
    with closing(connect()) as conn, conn:
        cur = conn.execute(
            """UPDATE jobs SET status = ?,
                   applied_at = CASE WHEN ? IS NULL THEN NULL ELSE applied_at END
               WHERE id = ?""",
            (status, status, job_id),
        )
        return cur.rowcount > 0


def update_notes(job_id, notes):
    with closing(connect()) as conn, conn:
        cur = conn.execute("UPDATE jobs SET notes = ? WHERE id = ?", (notes, job_id))
        return cur.rowcount > 0


def list_jobs():
    with closing(connect()) as conn:
        jobs = [dict(row) for row in conn.execute(
            """SELECT id, url, company, role, scanned_at, status, applied_at, notes, created_at,
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
            f"""SELECT id, url, company, role, duties, skills, status, {col} AS embedding
                FROM jobs WHERE {col} IS NOT NULL ORDER BY id"""
        ).fetchall()
    return [
        {
            "id": r["id"], "url": r["url"], "company": r["company"], "role": r["role"],
            "duties": json.loads(r["duties"]), "skills": json.loads(r["skills"]),
            "status": r["status"], "embedding": json.loads(r["embedding"]),
        }
        for r in rows
    ]


def find_similar(company, role, exclude_url):
    """The most likely existing duplicate: a job with the same company and role (trimmed,
    case-insensitive) but a different URL. The same real posting often shows up under
    unrelated URLs (a company's own careers page vs. a LinkedIn search-result link, for
    instance), which normalize_url can't catch since there's no shared URL to clean up
    toward. This is a plain text match, not a merge — callers use it to warn, not to
    combine rows automatically, since two different openings can legitimately share a
    title at the same company."""
    if not company or not role:
        return None
    with closing(connect()) as conn:
        row = conn.execute(
            """SELECT id, url, company, role, scanned_at, status,
                      emb_role IS NOT NULL AS profiled
               FROM jobs
               WHERE lower(trim(company)) = lower(trim(?))
                 AND lower(trim(role)) = lower(trim(?))
                 AND url != ?
               ORDER BY created_at DESC LIMIT 1""",
            (company, role, normalize_url(exclude_url)),
        ).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"], "url": row["url"], "company": row["company"], "role": row["role"],
        "scanned": row["scanned_at"] is not None, "profiled": bool(row["profiled"]),
        "status": row["status"],
    }


def delete_job(job_id):
    with closing(connect()) as conn, conn:
        return conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,)).rowcount > 0
