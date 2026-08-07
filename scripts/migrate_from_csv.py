#!/usr/bin/env python3
"""Import an existing spreadsheet of job applications into the Career Coach tracker.

Expects a CSV with the columns: Company, Job Title, Targeting/Focus, Category, PDF Path.
Rows are deduplicated by a company/role/JD fingerprint, so re-running is safe.

    python scripts/migrate_from_csv.py applications.csv
    python scripts/migrate_from_csv.py applications.csv --tracker-dir /path/to/.career-coach/jobs
"""

import os
import re
import csv
import sys
import json
import uuid
import hashlib
import argparse
from datetime import datetime, timezone

def normalize_text(val):
    if not val:
        return ""
    s = str(val).strip()
    s = re.sub(r'\s+', ' ', s)
    return s.lower()

def fingerprint_for_job(company, role, jd_text):
    source = "\n".join([normalize_text(company), normalize_text(role), normalize_text(jd_text)])
    return hashlib.sha256(source.encode('utf-8')).hexdigest()

def default_tracker_dir():
    return os.path.join(os.getcwd(), ".career-coach", "jobs")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_path", help="Path to the CSV of past applications")
    parser.add_argument("--tracker-dir", default=None,
                        help="Tracker directory (default: ./.career-coach/jobs)")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    csv_path = os.path.abspath(os.path.expanduser(args.csv_path))
    tracker_dir = os.path.abspath(os.path.expanduser(
        args.tracker_dir or os.environ.get("CAREER_COACH_TRACKER_DIR") or default_tracker_dir()))
    json_path = os.path.join(tracker_dir, "job_tracker.json")

    if not os.path.exists(csv_path):
        print(f"Error: CSV tracker file not found at {csv_path}", file=sys.stderr)
        return 1

    os.makedirs(tracker_dir, exist_ok=True)

    # Load existing tracker if present
    tracker = {
        "version": 1,
        "updatedAt": "",
        "lastCleanupAt": None,
        "jobs": []
    }
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                tracker = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load existing tracker, starting fresh: {e}")

    # Build map of existing jobs by fingerprint to avoid duplicates
    existing_fingerprints = {j["fingerprint"] for j in tracker["jobs"] if "fingerprint" in j}

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    new_jobs_count = 0
    with open(csv_path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = row.get("Company", "").strip()
            role = row.get("Job Title", "").strip()
            jd_text = row.get("Targeting/Focus", "").strip()
            category = row.get("Category", "").strip()
            pdf_path = row.get("PDF Path", "").strip()
            status = "applied"

            if not company or not role:
                continue

            fingerprint = fingerprint_for_job(company, role, jd_text)
            if fingerprint in existing_fingerprints:
                continue

            # Map category to domainTags
            domain_tags = [category] if category else []

            job_record = {
                "id": str(uuid.uuid4()),
                "company": company,
                "role": role,
                "jdText": jd_text,
                "jdUrl": "",
                "decision": "apply_now",
                "status": status,
                "fingerprint": fingerprint,
                "skillTags": [],
                "domainTags": domain_tags,
                "seniority": "",
                "resumeStatus": "generated" if pdf_path else "pending_generation",
                "resumePath": pdf_path,
                "resumeReusedFrom": "",
                "similarityScore": None,
                "artifacts": {},
                "interviewer": {
                    "text": ""
                },
                "createdAt": now,
                "updatedAt": now,
                "interviewDate": ""
            }

            tracker["jobs"].append(job_record)
            existing_fingerprints.add(fingerprint)
            new_jobs_count += 1

    tracker["updatedAt"] = now

    # Save JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(tracker, f, indent=2, ensure_ascii=False)

    print(f"Migrated {new_jobs_count} new job application(s) into {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
