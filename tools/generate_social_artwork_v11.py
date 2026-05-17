from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "social-artwork" / "source-captures" / "liveavatar" / "clean"
PREV = ROOT / "public" / "social-artwork" / "v10"
OUT = ROOT / "public" / "social-artwork" / "v11"
OUT.mkdir(parents=True, exist_ok=True)

FONT_LOGO = Path("C:/Windows/Fonts/ariblk.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
FONT_REG = Path("C:/Windows/Fonts/arial.ttf")

TEXT_LIGHT = (244, 198, 120)
TEXT_MID = (207, 143, 72)
TEXT_DARK = (132, 82, 40)
TEXT_SHADOW = (25, 12, 5)
COPY = (255, 230, 190)
GOLD = (230, 176, 96)
EDGE = (210, 136, 50)


ASSET_ITEMS = [
    ("Real mobile font proof", "aiasap-real-mobile-font-proof-v11.png", "review", "Real app CSS logo proof"),
    ("Brand lockup HeadShot", "aiasap-6-brand-lockup-1024.png", "1024x1024", "Square lockup with larger face-focused 6"),
    ("Brand lockup alternate", "aiasap-6-brand-lockup-expressive-1024.png", "1024x1024", "Alternate square lockup"),
    ("Master profile HeadShot", "aiasap-6-profile-master-1024.png", "1024x1024", "Approved no-ring profile source"),
    ("X profile", "x-profile-400.png", "400x400", "Upload to X profile image"),
    ("Facebook profile", "facebook-profile-320.png", "320x320", "Upload to Facebook profile image"),
    ("Instagram profile", "instagram-profile-320.png", "320x320", "Upload to Instagram profile image"),
    ("Threads profile", "threads-profile-640.png", "640x640", "Upload to Threads profile image"),
    ("TikTok profile", "tiktok-profile-1024.png", "1024x1024", "Upload to TikTok profile image"),
    ("YouTube watermark", "youtube-watermark-150.png", "150x150", "Upload as YouTube video watermark"),
    ("X banner", "x-banner-1500x500.png", "1500x500", "Larger face-focused X header/banner"),
    ("YouTube banner", "youtube-banner-2560x1440.png", "2560x1440", "Larger face-focused YouTube channel banner"),
    ("Facebook cover", "facebook-cover-851x315.png", "851x315", "Larger face-focused Facebook cover"),
    ("YouTube thumbnail", "youtube-thumbnail-1280x720.png", "1280x720", "Larger face-focused intro video thumbnail"),
    ("Instagram square", "instagram-square-1080.png", "1080x1080", "Face-forward square post template"),
    ("Instagram portrait", "instagram-portrait-1080x1350.png", "1080x1350", "Face-forward portrait feed post"),
    ("Instagram reel cover", "instagram-reel-cover-1080x1920.png", "1080x1920", "Face-forward Reel/story cover"),
    ("Threads vertical", "threads-post-1440x1920.png", "1440x1920", "Face-forward Threads vertical post"),
    ("TikTok cover", "tiktok-cover-1080x1920.png", "1080x1920", "Face-forward TikTok cover"),
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path if path.exists() else FONT_REG), size=size)


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def soft_brown_background(width: int, height: int, left_glow: bool = True) -> Image.Image:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)
    top = (13, 6, 3)
    mid = (62, 26, 10)
    bottom = (2, 1, 1)
    for y in range(height):
        t = y / max(1, height - 1)
        if t < 0.52:
            color = blend(top, mid, t / 0.52)
        else:
            color = blend(mid, bottom, (t - 0.52) / 0.48)
        draw.line((0, y, width, y), fill=(*color, 255))

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    if left_glow:
        gd.ellipse(
            (
                -int(width * 0.28),
                int(height * 0.04),
                int(width * 0.62),
                int(height * 1.15),
            ),
            fill=(183, 102, 38, 58),
        )
    gd.ellipse(
        (
            int(width * 0.22),
            int(height * 0.30),
            int(width * 0.84),
            int(height * 1.02),
        ),
        fill=(105, 47, 15, 34),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(18, min(width, height) // 8)))
    img.alpha_composite(glow)

    vignette = Image.new("L", (180, 180), 0)
    px = vignette.load()
    for yy in range(180):
        for xx in range(180):
            dx = (xx - 90) / 90
            dy = (yy - 90) / 90
            dist = min(1.0, math.sqrt(dx * dx + dy * dy))
            px[xx, yy] = int(190 * max(0, dist - 0.38) / 0.62)
    vignette = vignette.resize((width, height), Image.Resampling.BICUBIC)
    dark = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    dark.putalpha(vignette)
    img.alpha_composite(dark)
    return img


def text_gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    grad = Image.new("RGBA", size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / max(1, h - 1)
        if t < 0.45:
            color = blend(TEXT_LIGHT, TEXT_MID, t / 0.45)
        else:
            color = blend(TEXT_MID, TEXT_DARK, (t - 0.45) / 0.55)
        gd.line((0, y, w, y), fill=(*color, 255))
    return grad


def skew_layer(layer: Image.Image, degrees: float = -8.0, scale_x: float = 0.94) -> Image.Image:
    shear = math.tan(math.radians(degrees))
    w, h = layer.size
    new_w = int((w + abs(shear) * h) * scale_x) + 4
    shifted = Image.new("RGBA", (w + int(abs(shear) * h) + 8, h), (0, 0, 0, 0))
    offset_x = int(abs(shear) * h) if shear < 0 else 0
    shifted.alpha_composite(layer, (offset_x, 0))
    transformed = shifted.transform(
        shifted.size,
        Image.Transform.AFFINE,
        (1, -shear, -offset_x, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )
    transformed = transformed.resize((new_w, h), Image.Resampling.LANCZOS)
    bbox = transformed.getbbox()
    return transformed.crop(bbox) if bbox else transformed


def render_wordmark(target_width: int) -> Image.Image:
    text = "aiASAP"
    probe = Image.new("L", (10, 10), 0)
    size = 24
    best_font = font(FONT_LOGO, size)
    for candidate in range(24, 420):
        f = font(FONT_LOGO, candidate)
        bbox = ImageDraw.Draw(probe).textbbox((0, 0), text, font=f, stroke_width=max(1, candidate // 110))
        if (bbox[2] - bbox[0]) > target_width * 1.02:
            break
        best_font = f
        size = candidate

    bbox = ImageDraw.Draw(probe).textbbox((0, 0), text, font=best_font, stroke_width=max(1, size // 110))
    pad = max(18, size // 5)
    layer = Image.new("RGBA", (bbox[2] - bbox[0] + pad * 2, bbox[3] - bbox[1] + pad * 2), (0, 0, 0, 0))
    mask = Image.new("L", layer.size, 0)
    md = ImageDraw.Draw(mask)
    x = pad - bbox[0]
    y = pad - bbox[1]
    stroke = max(1, size // 115)
    md.text((x, y), text, font=best_font, fill=255, stroke_width=stroke, stroke_fill=235)
    shadow = mask.filter(ImageFilter.GaussianBlur(radius=max(4, size // 18)))
    shadow_layer = Image.new("RGBA", layer.size, (*TEXT_SHADOW, 0))
    shadow_layer.putalpha(shadow.point(lambda p: int(p * 0.58)))
    layer.alpha_composite(shadow_layer, (max(1, size // 35), max(1, size // 28)))
    grad = text_gradient(layer.size)
    layer.alpha_composite(Image.composite(grad, Image.new("RGBA", layer.size, (0, 0, 0, 0)), mask))
    out = skew_layer(layer)
    if out.width != target_width:
        scale = target_width / out.width
        out = out.resize((target_width, int(out.height * scale)), Image.Resampling.LANCZOS)
    return out


def draw_tracking_text(img: Image.Image, text: str, center: tuple[int, int], size: int, tracking: float) -> None:
    f = font(FONT_BOLD, size)
    letters = list(text)
    widths = [ImageDraw.Draw(Image.new("L", (1, 1))).textlength(ch, font=f) for ch in letters]
    gap = size * tracking
    total = sum(widths) + gap * (len(letters) - 1)
    x = center[0] - total / 2
    y = center[1] - size * 0.48
    d = ImageDraw.Draw(img)
    for ch, w in zip(letters, widths):
        d.text((int(x), int(y)), ch, font=f, fill=TEXT_LIGHT)
        x += w + gap


def draw_logo_lockup(
    img: Image.Image,
    center: tuple[int, int],
    width: int,
    leap_size: int | None = None,
    gap: int | None = None,
) -> None:
    mark = render_wordmark(width)
    if leap_size is None:
        leap_size = max(16, int(width * 0.13))
    if gap is None:
        gap = max(8, int(width * 0.04))
    total_h = mark.height + gap + int(leap_size * 1.05)
    x = center[0] - mark.width // 2
    y = center[1] - total_h // 2
    img.alpha_composite(mark, (x, y))
    draw_tracking_text(img, "Take the Leap", (center[0], y + mark.height + gap + leap_size // 2), leap_size, 0.32)


def tone_c_avatar(img: Image.Image) -> Image.Image:
    rgb = ImageEnhance.Color(img.convert("RGB")).enhance(0.84)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.03)
    pix = rgb.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = pix[x, y]
            if r > 72 and r > g * 1.09 and r > b * 1.12:
                delta = r - max(g, b)
                r = int(r - delta * 0.24)
                g = int(g + delta * 0.055)
                b = int(b + delta * 0.018)
                pix[x, y] = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
    return rgb.convert("RGBA")


def load_avatar(name: str = "headshot-clean.png") -> Image.Image:
    img = Image.open(SRC / name).convert("RGBA")
    # Remove browser chrome/control bands while keeping the LiveAvatar room.
    crop = img.crop((0, 45, img.width, min(img.height - 28, 1050)))
    return tone_c_avatar(crop)


def face_crop(name: str, crop: tuple[int, int, int, int] = (56, 25, 594, 690)) -> Image.Image:
    avatar = load_avatar(name)
    return avatar.crop(crop)


def soft_mask(size: tuple[int, int], edge: int = 26) -> Image.Image:
    w, h = size
    mask = Image.new("L", size, 255)
    edge = min(edge, w // 4, h // 4)
    if edge <= 0:
        return mask
    alpha = Image.new("L", size, 0)
    d = ImageDraw.Draw(alpha)
    d.rectangle((edge, edge, w - edge, h - edge), fill=255)
    d.rectangle((edge, 0, w - edge, h), fill=255)
    d.rectangle((0, edge, w, h - edge), fill=255)
    return alpha.filter(ImageFilter.GaussianBlur(edge // 2))


def paste_avatar(
    img: Image.Image,
    avatar: Image.Image,
    height: int,
    center: tuple[int, int],
    edge: int = 30,
) -> None:
    ratio = height / avatar.height
    resized = avatar.resize((int(avatar.width * ratio), height), Image.Resampling.LANCZOS)
    mask = soft_mask(resized.size, edge=edge)
    x = center[0] - resized.width // 2
    y = center[1] - resized.height // 2
    shadow = Image.new("RGBA", resized.size, (0, 0, 0, 0))
    shadow_mask = mask.filter(ImageFilter.GaussianBlur(max(12, edge)))
    shadow.putalpha(shadow_mask.point(lambda p: int(p * 0.24)))
    img.alpha_composite(shadow, (x + max(8, height // 38), y + max(8, height // 34)))
    img.paste(resized, (x, y), mask)


def save(img: Image.Image, name: str) -> Path:
    path = OUT / name
    img.save(path, optimize=True)
    return path


def make_font_proof() -> Path:
    img = soft_brown_background(1600, 900)
    d = ImageDraw.Draw(img)
    d.text((90, 92), "Real mobile website font style from app CSS", font=font(FONT_BOLD, 34), fill=TEXT_LIGHT)
    draw_logo_lockup(img, (800, 462), 920, leap_size=78, gap=34)
    d.text((90, 790), "Arial Black / italic / skewX(-8deg) scaleX(0.94) / brown-gold gradient", font=font(FONT_BOLD, 30), fill=(210, 158, 96))
    return save(img, "aiasap-real-mobile-font-proof-v11.png")


def make_lockup(name: str, source: str, logo_width: int = 380) -> Path:
    img = soft_brown_background(1024, 1024)
    avatar = face_crop(source, (64, 18, 590, 665))
    paste_avatar(img, avatar, 690, (512, 426), edge=24)
    draw_logo_lockup(img, (512, 835), logo_width, leap_size=40, gap=12)
    return save(img, name)


def make_x_banner() -> Path:
    img = soft_brown_background(1500, 500)
    draw_logo_lockup(img, (385, 258), 390, leap_size=40, gap=14)
    avatar = face_crop("headshot-clean.png", (58, 20, 590, 665))
    paste_avatar(img, avatar, 560, (1112, 273), edge=22)
    return save(img, "x-banner-1500x500.png")


def make_facebook_cover() -> Path:
    img = soft_brown_background(851, 315)
    draw_logo_lockup(img, (226, 166), 248, leap_size=26, gap=10)
    avatar = face_crop("headshot-clean.png", (62, 18, 590, 658))
    paste_avatar(img, avatar, 372, (652, 171), edge=16)
    return save(img, "facebook-cover-851x315.png")


def make_youtube_banner() -> Path:
    img = soft_brown_background(2560, 1440)
    # Keep the main signals inside the typical YouTube center safe zone.
    draw_logo_lockup(img, (910, 720), 520, leap_size=54, gap=18)
    avatar = face_crop("liveavatar-060843-clean.png", (60, 20, 590, 670))
    paste_avatar(img, avatar, 760, (1628, 732), edge=34)
    return save(img, "youtube-banner-2560x1440.png")


def make_youtube_thumbnail() -> Path:
    img = soft_brown_background(1280, 720)
    draw_logo_lockup(img, (360, 382), 370, leap_size=38, gap=14)
    avatar = face_crop("liveavatar-060843-clean.png", (58, 14, 590, 690))
    paste_avatar(img, avatar, 780, (900, 406), edge=26)
    return save(img, "youtube-thumbnail-1280x720.png")


def make_square_post() -> Path:
    img = soft_brown_background(1080, 1080)
    draw_logo_lockup(img, (540, 176), 310, leap_size=32, gap=10)
    avatar = face_crop("headshot-clean.png", (58, 18, 590, 720))
    paste_avatar(img, avatar, 780, (540, 650), edge=28)
    return save(img, "instagram-square-1080.png")


def make_portrait(name: str, size: tuple[int, int], source: str = "headshot-clean.png") -> Path:
    w, h = size
    img = soft_brown_background(w, h)
    draw_logo_lockup(img, (w // 2, int(h * 0.13)), int(w * 0.31), leap_size=max(28, int(w * 0.03)), gap=max(8, int(w * 0.011)))
    avatar = face_crop(source, (56, 16, 592, 735))
    paste_avatar(img, avatar, int(h * 0.62), (w // 2, int(h * 0.56)), edge=max(20, w // 35))
    return save(img, name)


def copy_profile_assets() -> None:
    names = [
        "aiasap-6-profile-master-1024.png",
        "x-profile-400.png",
        "facebook-profile-320.png",
        "instagram-profile-320.png",
        "threads-profile-640.png",
        "tiktok-profile-1024.png",
        "youtube-watermark-150.png",
    ]
    for name in names:
        shutil.copy2(PREV / name, OUT / name)


def make_proof(paths: Sequence[Path]) -> Path:
    thumb_w, thumb_h = 620, 360
    label_h = 82
    gap = 34
    cols = 3
    rows = math.ceil(len(paths) / cols)
    header_h = 170
    sheet_w = cols * thumb_w + (cols + 1) * gap
    sheet_h = header_h + rows * (thumb_h + label_h + gap) + gap
    sheet = soft_brown_background(sheet_w, sheet_h)
    d = ImageDraw.Draw(sheet)
    d.text((gap, 34), "aiASAP social artwork v11 draft", font=font(FONT_BOLD, 52), fill=COPY)
    d.text(
        (gap, 98),
        "Real mobile website font, approved profile crop, bigger face-focused 6 in banners/covers, no scans, no teal/tan bars. Draft only.",
        font=font(FONT_BOLD, 26),
        fill=TEXT_LIGHT,
    )
    label_font = font(FONT_BOLD, 28)
    file_font = font(FONT_BOLD, 20)
    lookup = {file: (label, size, use) for label, file, size, use in ASSET_ITEMS}
    for i, path in enumerate(paths):
        row, col = divmod(i, cols)
        x = gap + col * (thumb_w + gap)
        y = header_h + row * (thumb_h + label_h + gap)
        src = Image.open(path).convert("RGBA")
        src.thumbnail((thumb_w - 18, thumb_h - 18), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (thumb_w, thumb_h), (7, 2, 1, 255))
        frame.alpha_composite(src, ((thumb_w - src.width) // 2, (thumb_h - src.height) // 2))
        sheet.alpha_composite(frame, (x, y))
        d.rounded_rectangle((x, y, x + thumb_w, y + thumb_h), radius=7, outline=EDGE, width=2)
        label = lookup[path.name][0]
        d.text((x + 10, y + thumb_h + 16), label, font=label_font, fill=COPY)
        d.text((x + 10, y + thumb_h + 50), path.name, font=file_font, fill=TEXT_LIGHT)
    return save(sheet, "aiasap-social-artwork-v11-proof-sheet.png")


def make_manifest() -> None:
    assets = [
        {
            "label": label,
            "file": file_name,
            "size": size,
            "use": use,
            "path": str(OUT / file_name),
        }
        for label, file_name, size, use in ASSET_ITEMS
    ]
    assets.insert(
        0,
        {
            "label": "Proof sheet",
            "file": "aiasap-social-artwork-v11-proof-sheet.png",
            "size": "review",
            "use": "One-sheet desktop review of the v11 draft",
            "path": str(OUT / "aiasap-social-artwork-v11-proof-sheet.png"),
        },
    )
    payload = {
        "version": "v11",
        "approval_status": "draft-only awaiting G approval before any social upload",
        "approved_rules": [
            "Use real mobile website aiASAP logo styling from app CSS, not a screenshot scan.",
            "Logo style source: app/globals.css .aiasap-logo-mark, Arial Black stack, italic, tracking 0, skewX(-8deg) scaleX(0.94), brown-gold gradient.",
            "No teal/tan separator bars, decorative accent lines, strong yellow rings, or inner profile circles.",
            "Profile images use the approved no-ring no-inner-circle HeadShot crop copied forward from v10/v8.",
            "Banners and covers make 6 much bigger and focus mostly on his face/upper torso.",
            "Use approved C tone reduction to reduce LiveAvatar red cast toward natural tan.",
            "Use soft-brown radial palette with dark edges and muted brown center.",
            "No social upload until G approves the exact artwork.",
        ],
        "assets": assets,
        "sources": {
            "liveavatar_clean_folder": str(SRC),
            "profile_assets_copied_from": str(PREV),
            "font_css": "app/globals.css .aiasap-logo-mark",
            "font_file_used_for_png_artwork": str(FONT_LOGO),
        },
    }
    (OUT / "manifest.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    copy_profile_assets()
    generated = [
        make_font_proof(),
        make_lockup("aiasap-6-brand-lockup-1024.png", "headshot-clean.png"),
        make_lockup("aiasap-6-brand-lockup-expressive-1024.png", "liveavatar-060843-clean.png"),
        OUT / "aiasap-6-profile-master-1024.png",
        OUT / "x-profile-400.png",
        OUT / "facebook-profile-320.png",
        OUT / "instagram-profile-320.png",
        OUT / "threads-profile-640.png",
        OUT / "tiktok-profile-1024.png",
        OUT / "youtube-watermark-150.png",
        make_x_banner(),
        make_youtube_banner(),
        make_facebook_cover(),
        make_youtube_thumbnail(),
        make_square_post(),
        make_portrait("instagram-portrait-1080x1350.png", (1080, 1350), "headshot-clean.png"),
        make_portrait("instagram-reel-cover-1080x1920.png", (1080, 1920), "headshot-clean.png"),
        make_portrait("threads-post-1440x1920.png", (1440, 1920), "liveavatar-060843-clean.png"),
        make_portrait("tiktok-cover-1080x1920.png", (1080, 1920), "headshot-clean.png"),
    ]
    make_proof(generated)
    make_manifest()
    print(f"Wrote v11 artwork to {OUT}")


if __name__ == "__main__":
    main()
