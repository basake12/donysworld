"""
scripts/backfill_faceboxes.py

Re-runs face detection on ALL records with tighter padding.
Run with: python scripts/backfill_faceboxes.py
"""

import os, io, json, time, requests, psycopg2, numpy as np
from PIL import Image
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

load_dotenv()

DATABASE_URL = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Neither DIRECT_URL nor DATABASE_URL found in .env")

parsed    = urlparse(DATABASE_URL)
clean_url = urlunparse(parsed._replace(query=""))
print(f"Connecting to: {parsed.hostname}...")
conn = psycopg2.connect(clean_url)
conn.autocommit = True
cur = conn.cursor()
print("Connected.\n")

MODEL_PATH = "face_detector.tflite"
if not os.path.exists(MODEL_PATH):
    print("Downloading face detector model...")
    r = requests.get(
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        timeout=60
    )
    r.raise_for_status()
    with open(MODEL_PATH, "wb") as f:
        f.write(r.content)
    print("Model downloaded.\n")

base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
options      = mp_vision.FaceDetectorOptions(
    base_options=base_options,
    min_detection_confidence=0.25,
)
detector = mp_vision.FaceDetector.create_from_options(options)

# Tight padding — just enough to cover forehead and ears
# Values are fractions of image size added around the detected box
PAD_X = 0.08   # 8% of image width per side
PAD_Y = 0.12   # 12% of image height per side

def detect_face(image_url: str) -> dict | None:
    try:
        resp = requests.get(image_url, timeout=15)
        resp.raise_for_status()
        pil  = Image.open(io.BytesIO(resp.content)).convert("RGB")
        iw, ih = pil.size

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(pil, dtype=np.uint8))
        result   = detector.detect(mp_image)
        if not result.detections:
            return None

        det  = result.detections[0]
        bbox = det.bounding_box

        # Convert pixel bbox → % with tight padding
        x = max(0.0,   (bbox.origin_x / iw - PAD_X)) * 100
        y = max(0.0,   (bbox.origin_y / ih - PAD_Y)) * 100
        w = min(100.0 - x, (bbox.width  / iw + PAD_X * 2) * 100)
        h = min(100.0 - y, (bbox.height / ih + PAD_Y * 2) * 100)

        return {"x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2)}
    except Exception as e:
        print(f"  [error] {e}")
        return None

DELAY = 0.1

# ── Profiles — update ALL (force re-detect with tighter padding) ──────────────
cur.execute('SELECT id, "profilePictureUrl" FROM model_profiles')
profiles = cur.fetchall()
print(f"Processing {len(profiles)} profile picture(s)...")

prof_ok = prof_fail = 0
for pid, url in profiles:
    box = detect_face(url)
    if box:
        cur.execute('UPDATE model_profiles SET "faceBox" = %s WHERE id = %s', (json.dumps(box), pid))
        prof_ok += 1
        print(f"  ✓ Profile {pid} — x:{box['x']}% y:{box['y']}% w:{box['w']}% h:{box['h']}%")
    else:
        # Reset to NULL so default box is used
        cur.execute('UPDATE model_profiles SET "faceBox" = NULL WHERE id = %s', (pid,))
        prof_fail += 1
        print(f"  ✗ Profile {pid} — no face (reset to NULL)")
    time.sleep(DELAY)

# ── Gallery — update ALL ──────────────────────────────────────────────────────
cur.execute('SELECT id, "imageUrl" FROM model_gallery')
gallery = cur.fetchall()
print(f"\nProcessing {len(gallery)} gallery image(s)...")

gal_ok = gal_fail = 0
for gid, url in gallery:
    box = detect_face(url)
    if box:
        cur.execute('UPDATE model_gallery SET "faceBox" = %s WHERE id = %s', (json.dumps(box), gid))
        gal_ok += 1
        print(f"  ✓ Gallery {gid} — x:{box['x']}% y:{box['y']}% w:{box['w']}% h:{box['h']}%")
    else:
        cur.execute('UPDATE model_gallery SET "faceBox" = NULL WHERE id = %s', (gid,))
        gal_fail += 1
        print(f"  ✗ Gallery {gid} — no face (reset to NULL)")
    time.sleep(DELAY)

print(f"""
Done.
  Profiles:  {prof_ok} updated, {prof_fail} reset to NULL
  Gallery:   {gal_ok} updated, {gal_fail} reset to NULL
""")
cur.close()
conn.close()