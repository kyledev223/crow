"""
The `npm run assets` worker. Run through scripts/assets.mjs, which sets up
Python, rembg and the rest first.

  assets-raw/crow-*.png|jpg   ->  public/assets/crow/crow-*.png
      background removed, trimmed to the figure, max 2048px

  assets-raw/bg-NN.png|jpg    ->  public/assets/bg/bg-NN.jpg
                                  public/assets/bg/bg-NN-depth.png
      the backplate, web-sized, plus a depth map (Depth Anything V2) that the
      site uses to give the photo real parallax

  assets-raw/walk.mp4         ->  public/assets/crow/walk.webm  (VP9 with alpha)
                                  public/assets/crow/walk.mp4   (H.264 on pure green)
                                  public/assets/crow/walk.json  (loop facts)
      watermark cropped off, audio stripped, trimmed to the cleanest loop with
      the seam crossfaded, green keyed out with spill suppression

Nothing is pixelated here: the site's filter runs over the final picture.
Outputs are skipped when they are newer than their source; pass --force to
redo everything.
"""
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

MAX_SIDE = 2048
IMAGES = {".png", ".jpg", ".jpeg", ".webp"}
FORCE = "--force" in sys.argv
DEPTH_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx"


def fresh(src: Path, *outs: Path) -> bool:
    """True if every output exists and is newer than the source."""
    return not FORCE and all(o.exists() and o.stat().st_mtime >= src.stat().st_mtime for o in outs)


# ---------------------------------------------------------------------------
# Crow cutouts
# ---------------------------------------------------------------------------
def cutouts(raw: Path, out: Path):
    from rembg import new_session, remove

    session = None
    for src in sorted(p for p in raw.iterdir() if p.suffix.lower() in IMAGES and p.stem.startswith("crow-")):
        dest = out / (src.stem + ".png")
        if fresh(src, dest):
            print(f"  up to date  {dest.name}")
            continue
        if session is None:
            print("  loading the background-removal model (first run downloads about 170 MB)...")
            session = new_session("u2net")
        cut = remove(Image.open(src).convert("RGBA"), session=session, post_process_mask=True)
        box = cut.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if box is None:
            print(f"  SKIPPED  {src.name}  (nothing left after removing the background)")
            continue
        cut = cut.crop(box)
        if max(cut.size) > MAX_SIDE:
            cut.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        # The see-through pixels still carry the old backdrop colour; when the
        # site shrinks the image, that colour bleeds into the edges. Darken
        # each pixel by its own transparency so nothing light is hiding there.
        px = np.asarray(cut, dtype=np.float32)
        px[..., :3] *= px[..., 3:4] / 255.0
        cut = Image.fromarray(px.round().astype(np.uint8), "RGBA")
        cut.save(dest, optimize=True)
        print(f"  wrote    {dest.name}  {cut.width}x{cut.height}")


# ---------------------------------------------------------------------------
# Backplates + depth
# ---------------------------------------------------------------------------
def depth_session(models: Path):
    import onnxruntime as ort

    model = models / "depth-anything-v2-small.onnx"
    if not model.exists():
        models.mkdir(parents=True, exist_ok=True)
        print("  downloading Depth Anything V2 (small, about 100 MB, one time)...")
        tmp = model.with_suffix(".part")
        urllib.request.urlretrieve(DEPTH_URL, tmp)
        tmp.rename(model)
    return ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])


def depth_map(session, img: Image.Image) -> Image.Image:
    """Relative depth, 255 = nearest, as an 8-bit greyscale image the size of `img`."""
    w, h = img.size
    th = 518
    tw = int(round(th * w / h / 14)) * 14
    x = np.asarray(img.convert("RGB").resize((tw, th), Image.BICUBIC), dtype=np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    x = x.transpose(2, 0, 1)[None]
    name = session.get_inputs()[0].name
    d = session.run(None, {name: x})[0].squeeze().astype(np.float32)
    lo, hi = np.percentile(d, 0.5), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    out = Image.fromarray((d * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    # Soften so the displaced mesh doesn't tear along hard edges.
    return out.filter(ImageFilter.GaussianBlur(max(1, w // 600)))


def plates(raw: Path, out: Path, models: Path):
    out.mkdir(parents=True, exist_ok=True)
    session = None
    for src in sorted(p for p in raw.iterdir() if p.suffix.lower() in IMAGES and p.stem.startswith("bg-")):
        jpg = out / (src.stem + ".jpg")
        dep = out / (src.stem + "-depth.png")
        if fresh(src, jpg, dep):
            print(f"  up to date  {jpg.name} + depth")
            continue
        img = Image.open(src).convert("RGB")
        if max(img.size) > MAX_SIDE:
            img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        img.save(jpg, quality=88, optimize=True, progressive=True)
        if session is None:
            session = depth_session(models)
        depth_map(session, img).resize((min(1024, img.width), round(min(1024, img.width) * img.height / img.width)), Image.BICUBIC).save(dep, optimize=True)
        print(f"  wrote    {jpg.name} {img.width}x{img.height}  +  {dep.name}")


# ---------------------------------------------------------------------------
# Walk cycle
# ---------------------------------------------------------------------------
def ffprobe_size(path: Path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    s = json.loads(r.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return s["width"], s["height"], float(num) / float(den)


def decode(path: Path, vf: str, w: int, h: int) -> np.ndarray:
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    )
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, h, w, 3)


def key(frames: np.ndarray):
    """Green-screen key with spill suppression. Returns float RGB (despilled) and alpha, 0..1."""
    f = frames.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    other = np.maximum(r, b)
    excess = g - other
    alpha = 1.0 - np.clip((excess - 0.06) / (0.22 - 0.06), 0, 1)
    # Despill: no pixel may be greener than its strongest other channel.
    # Using max(r, b) keeps the blue sheen on the feathers intact.
    g2 = np.minimum(g, other + 0.015)
    rgb = np.stack([r, g2, b], -1)
    # Edge pixels lose a little brightness with the spill; give some back.
    lost = (g - g2)[..., None] * 0.35
    rgb = np.clip(rgb + lost * (1 - alpha[..., None]), 0, 1)
    return rgb, alpha


def walk(src: Path, out: Path):
    webm, mp4, meta = out / "walk.webm", out / "walk.mp4", out / "walk.json"
    if fresh(src, webm, mp4, meta):
        print("  up to date  walk.webm + walk.mp4 + walk.json")
        return
    if not shutil.which("ffmpeg"):
        print("  SKIPPED  walk.mp4: ffmpeg is not installed (https://ffmpeg.org/download.html), copied as is instead")
        shutil.copyfile(src, mp4)
        return

    W, H, fps = ffprobe_size(src)

    # 1. Where are the feet, and where does the watermark start? Look at a half-size pass.
    hw, hh = W // 2 // 2 * 2, H // 2 // 2 * 2
    probe = decode(src, f"scale={hw}:{hh}", hw, hh).astype(np.int16)
    r, g, b = probe[..., 0], probe[..., 1], probe[..., 2]
    # The subject is dark (suit, shoes); the watermark is white. Neither is green.
    dark = (np.maximum(np.maximum(r, g), b) < 110) & (g - np.maximum(r, b) < 30)
    feet = int(np.nonzero(dark.sum(axis=(0, 2)) > 6)[0].max())
    bright = ((r > 150) & (g > 150) & (b > 150))[:, :, hw // 2 :].sum(axis=(0, 2))
    marks = np.nonzero(bright[feet + 1 :] > len(probe) * 3)[0]
    mark_top = feet + 1 + int(marks.min()) if len(marks) else hh
    cut = min(mark_top - 3, feet + int(hh * 0.02))
    if cut <= feet:
        raise SystemExit("walk.mp4: the watermark touches the feet; crop it by hand first")
    crop_h = min(H, (cut * 2) // 2 * 2)
    print(f"  walk: feet end at row {feet * 2}, watermark starts at {mark_top * 2}; keeping the top {crop_h}px of {H}")

    # 2. Decode the cropped video at a web size.
    ow = 600
    oh = int(round(ow * crop_h / W / 2)) * 2
    frames = decode(src, f"crop={W}:{crop_h}:0:0,scale={ow}:{oh}:flags=lanczos", ow, oh)
    n = len(frames)
    rgb, alpha = key(frames)

    # 3. Cleanest loop: the pair of frames (i, j) that look most alike, at least half the clip apart.
    small = alpha[:, ::8, ::8]
    fade = 6
    best = (1e9, fade, n - 1)
    for i in range(fade, n // 3):
        for j in range(i + n // 2, n):
            d = float(np.abs(small[i] - small[j]).mean())
            if d < best[0]:
                best = (d, i, j)
    _, i0, j0 = best
    print(f"  walk: loop frames {i0}..{j0 - 1} ({j0 - i0} frames, {(j0 - i0) / fps:.2f}s), seam difference {best[0]:.4f}")

    # 4. Crossfade the seam: the last `fade` frames melt into the frames just before the loop start.
    seg_rgb = rgb[i0:j0].copy()
    seg_a = alpha[i0:j0].copy()
    L = len(seg_rgb)
    for t in range(fade):
        w = (t + 1) / (fade + 1)
        a_end, a_pre = seg_a[L - fade + t], alpha[i0 - fade + t]
        c_end, c_pre = seg_rgb[L - fade + t] * a_end[..., None], rgb[i0 - fade + t] * a_pre[..., None]
        a = a_end * (1 - w) + a_pre * w
        c = c_end * (1 - w) + c_pre * w
        seg_a[L - fade + t] = a
        seg_rgb[L - fade + t] = np.where(a[..., None] > 1e-4, c / np.maximum(a[..., None], 1e-4), 0)

    # 5. Standing frame: legs closest together near the floor.
    band = seg_a[:, int(oh * 0.86) :, :] > 0.5
    spread = []
    for f in band:
        cols = np.nonzero(f.any(axis=0))[0]
        spread.append(cols.max() - cols.min() if len(cols) else ow)
    stand = int(np.argmin(spread))
    ys = np.nonzero((seg_a > 0.5).any(axis=(0, 2)))[0]
    xs = np.nonzero((seg_a > 0.5).any(axis=(0, 1)))[0]

    # 6. Encode: VP9 with alpha, and H.264 on pure green for browsers without alpha video.
    rgba = np.concatenate([seg_rgb, seg_a[..., None]], -1)
    rgba8 = (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
    green = np.array([0, 1, 0], np.float32)
    on_green = (seg_rgb * seg_a[..., None] + green * (1 - seg_a[..., None]))
    on_green8 = (np.clip(on_green, 0, 1) * 255 + 0.5).astype(np.uint8)
    size = f"{ow}x{oh}"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", size, "-r", str(fps), "-i", "-",
         "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "30", "-row-mt", "1", "-auto-alt-ref", "0", str(webm)],
        input=rgba8.tobytes(), check=True,
    )
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", size, "-r", str(fps), "-i", "-",
         "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", str(mp4)],
        input=on_green8.tobytes(), check=True,
    )
    meta.write_text(json.dumps({
        "fps": fps,
        "frames": L,
        "stand": stand,
        "width": ow,
        "height": oh,
        # where the subject sits inside the frame, as fractions
        "feet": round(float(ys.max() + 1) / oh, 4),
        "top": round(float(ys.min()) / oh, 4),
        "left": round(float(xs.min()) / ow, 4),
        "right": round(float(xs.max() + 1) / ow, 4),
    }, indent=2))
    print(f"  wrote    walk.webm ({webm.stat().st_size // 1024} KB), walk.mp4 ({mp4.stat().st_size // 1024} KB), walk.json  stand frame {stand}")


def main(raw: Path, out_crow: Path, out_bg: Path, models: Path) -> int:
    out_crow.mkdir(parents=True, exist_ok=True)
    cutouts(raw, out_crow)
    plates(raw, out_bg, models)
    if (raw / "walk.mp4").exists():
        walk(raw / "walk.mp4", out_crow)
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])))
