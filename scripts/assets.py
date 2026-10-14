"""
Cuts the background out of every image in assets-raw/ and writes a trimmed,
transparent PNG of the same name to public/assets/crow/.

Run it through `npm run assets` (scripts/assets.mjs), which sets up Python
and rembg first. Videos (walk.mp4) are copied as they are: the green screen
is removed live, in the shader.
"""
import shutil
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

MAX_SIDE = 2048
IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
VIDEOS = {".mp4", ".webm"}


def main(raw: Path, out: Path) -> int:
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in raw.iterdir() if p.suffix.lower() in IMAGES | VIDEOS)
    if not files:
        print(f"Nothing to do: put images in {raw.name}/ first.")
        return 0

    session = None
    for src in files:
        if src.suffix.lower() in VIDEOS:
            shutil.copyfile(src, out / src.name)
            print(f"  copied   {src.name}  (video: keyed in the browser, not here)")
            continue

        if session is None:
            print("  loading the background-removal model (first run downloads about 170 MB)...")
            session = new_session("u2net")

        cut = remove(Image.open(src).convert("RGBA"), session=session)
        box = cut.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box is None:
            print(f"  SKIPPED  {src.name}  (nothing left after removing the background)")
            continue
        cut = cut.crop(box)
        if max(cut.size) > MAX_SIDE:
            cut.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        dest = out / (src.stem + ".png")
        cut.save(dest, optimize=True)
        print(f"  wrote    {dest.name}  {cut.width}x{cut.height}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2])))
