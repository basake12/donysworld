"""
scripts/backfill_faceboxes.py

Backfills face bounding boxes for all ModelProfile and ModelGallery records
that currently have faceBox = NULL, using MediaPipe's face detector.

Works on Windows, Mac, Linux — no build tools needed.

Setup (run once):
    pip install mediapipe requests Pillow psycopg2-binary python-dotenv

Run:
    python scripts/backfill_faceboxes.py
"""

import os
import io
import json
import time
import requests
import psycopg2
import mediapipe as mp
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# ── DB connection ─────────────────────────────────────────────────────────────
# Use DIRECT_URL first (no PgBouncer), fall back to DATABASE_URL
DATABASE_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Neither DIRECT_URL nor DATABASE_URL found in .env")

# Strip query params that psycopg2 doesn't understand (pgbouncer, connection_limit etc.)
from urllib.parse import urlparse, urlunparse
parsed = urlparse(DATABASE_URL)
clean_url = urlunparse(parsed._replace(query=""))

print(f"Connecting to: {parsed.hostname}...")
try:
    conn = psycopg2.connect(clean_url)
    conn.autocommit = True
    cur = conn.cursor()
    print("Connected.\n")
except Exception as e:
    raise RuntimeError(f"DB connection failed: {e}")

# ── MediaPipe face detector ───────────────────────────────────────────────────
mp_face = mp.solutions.face_detection
detector = mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.3)

PAD_X = 0.30
PAD_Y = 0.45

def detect_face(image_url: str) -> dict | None:
    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        iw, ih = img.size

        result = detector.process(__import__("numpy").array(img))
        if not result.detections:
            return None

        det = result.detections[0]
        bbox = det.location_data.relative_bounding_box

        x = max(0.0, (bbox.xmin - PAD_X / 2)) * 100
        y = max(0.0, (bbox.ymin - PAD_Y / 2)) * 100
        w = min(100.0 - x, (bbox.width  + PAD_X) * 100)
        h = min(100.0 - y, (bbox.height + PAD_Y) * 100)

        return {"x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2)}
    except Exception as e:
        print(f"  [error] {e}")
        return None

DELAY = 0.15  # seconds between requests

# ── 1. Profile pictures ───────────────────────────────────────────────────────
cur.execute('SELECT id, "profilePictureUrl" FROM model_profiles WHERE "faceBox" IS NULL')
profiles = cur.fetchall()
print(f"\nStarting face box backfill...\n")
print(f"Found {len(profiles)} profile picture(s) without faceBox")

prof_ok = prof_fail = 0
for profile_id, url in profiles:
    box = detect_face(url)
    if box:
        cur.execute(
            'UPDATE model_profiles SET "faceBox" = %s WHERE id = %s',
            (json.dumps(box), profile_id)
        )
        prof_ok += 1
        print(f"  ✓ Profile {profile_id} — face at x:{box['x']}% y:{box['y']}%")
    else:
        prof_fail += 1
        print(f"  ✗ Profile {profile_id} — no face detected (default box will be used)")
    time.sleep(DELAY)

# ── 2. Gallery images ─────────────────────────────────────────────────────────
cur.execute('SELECT id, "imageUrl" FROM model_gallery WHERE "faceBox" IS NULL')
gallery = cur.fetchall()
print(f"\nFound {len(gallery)} gallery image(s) without faceBox")

gal_ok = gal_fail = 0
for item_id, url in gallery:
    box = detect_face(url)
    if box:
        cur.execute(
            'UPDATE model_gallery SET "faceBox" = %s WHERE id = %s',
            (json.dumps(box), item_id)
        )
        gal_ok += 1
        print(f"  ✓ Gallery {item_id}")
    else:
        gal_fail += 1
        print(f"  ✗ Gallery {item_id} — no face detected")
    time.sleep(DELAY)

print(f"""
Done.
  Profiles:  {prof_ok} updated, {prof_fail} skipped (no face found)
  Gallery:   {gal_ok} updated, {gal_fail} skipped
""")

cur.close()
conn.close()