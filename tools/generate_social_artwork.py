from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "social-artwork" / "version-2-mobile-font"
OUT.mkdir(parents=True, exist_ok=True)

TEXT = "aiASAP"

BG_TOP = (28, 16, 8)
BG_BOTTOM = (0, 0, 0)
WARM_GLOW = (224, 170, 98)
TEXT_LIGHT = (245, 204, 132)
TEXT_MID = (215, 160, 90)
TEXT_DARK = (168, 117, 52)
TEXT_SHADOW = (35, 19, 7)
BORDER = (87, 53, 24)

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/segoeuiz.ttf"),
    Path("C:/Windows/Fonts/arialbi.ttf"),
    Path("C:/Windows/Fonts/georgiaz.ttf"),
]


def get_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


def blend(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background(width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), BG_BOTTOM)
    draw = ImageDraw.Draw(img)

    for y in range(height):
        t = y / max(height - 1, 1)
        row = blend(BG_TOP, BG_BOTTOM, t * 0.86)
        draw.line([(0, y), (width, y)], fill=row)

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        (
            -int(width * 0.38),
            -int(height * 0.7),
            int(width * 0.86),
            int(height * 0.95),
        ),
        fill=(*WARM_GLOW, 58),
    )
    gd.ellipse(
        (
            int(width * 0.1),
            -int(height * 0.55),
            int(width * 1.14),
            int(height * 0.78),
        ),
        fill=(110, 64, 27, 36),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(width, height) // 14))
    img = Image.alpha_composite(img.convert("RGBA"), glow)

    vignette_small = Image.new("L", (160, 160), 0)
    px = vignette_small.load()
    for y in range(160):
        for x in range(160):
            dx = (x - 80) / 80
            dy = (y - 80) / 80
            dist = min((dx * dx + dy * dy) ** 0.5, 1)
            px[x, y] = int(176 * max(0, dist - 0.38) / 0.62)
    vignette = vignette_small.resize((width, height), Image.Resampling.BICUBIC)
    dark = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    dark.putalpha(vignette)
    img = Image.alpha_composite(img, dark)

    return img


def text_bbox(font: ImageFont.FreeTypeFont, text: str) -> Tuple[int, int, int, int]:
    probe = Image.new("L", (10, 10), 0)
    return ImageDraw.Draw(probe).textbbox((0, 0), text, font=font)


def fit_font(max_width: int, max_height: int) -> ImageFont.FreeTypeFont:
    lo, hi = 24, max(32, max_width)
    best = get_font(lo)
    while lo <= hi:
        mid = (lo + hi) // 2
        font = get_font(mid)
        left, top, right, bottom = text_bbox(font, TEXT)
        if right - left <= max_width and bottom - top <= max_height:
            best = font
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def vertical_gradient(size: Tuple[int, int]) -> Image.Image:
    width, height = size
    grad = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grad)
    for y in range(height):
        t = y / max(height - 1, 1)
        if t < 0.52:
            color = blend(TEXT_LIGHT, TEXT_MID, t / 0.52)
        else:
            color = blend(TEXT_MID, TEXT_DARK, (t - 0.52) / 0.48)
        draw.line([(0, y), (width, y)], fill=(*color, 255))
    return grad


def draw_logo(
    img: Image.Image,
    box: Tuple[int, int, int, int],
    anchor: str = "center",
    scale: float = 0.86,
) -> None:
    left, top, right, bottom = box
    max_width = int((right - left) * scale)
    max_height = int((bottom - top) * scale)
    font = fit_font(max_width, max_height)
    bx0, by0, bx1, by1 = text_bbox(font, TEXT)
    tw = bx1 - bx0
    th = by1 - by0

    if anchor == "left":
        x = left
        y = top + ((bottom - top) - th) // 2 - by0
    elif anchor == "right":
        x = right - tw
        y = top + ((bottom - top) - th) // 2 - by0
    else:
        x = left + ((right - left) - tw) // 2 - bx0
        y = top + ((bottom - top) - th) // 2 - by0

    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    md.text((x, y), TEXT, font=font, fill=255)

    shadow = mask.filter(ImageFilter.GaussianBlur(radius=max(4, img.size[0] // 180)))
    shadow_layer = Image.new("RGBA", img.size, (*TEXT_SHADOW, 0))
    shadow_layer.putalpha(shadow.point(lambda p: int(p * 0.62)))
    img.alpha_composite(shadow_layer, (max(2, img.size[0] // 260), max(2, img.size[1] // 170)))

    gradient = vertical_gradient(img.size)
    img.alpha_composite(Image.composite(gradient, Image.new("RGBA", img.size, (0, 0, 0, 0)), mask))


def add_edge(img: Image.Image, radius: int = 0) -> None:
    draw = ImageDraw.Draw(img)
    w, h = img.size
    inset = max(2, min(w, h) // 150)
    if radius:
        draw.rounded_rectangle(
            (inset, inset, w - inset - 1, h - inset - 1),
            radius=radius,
            outline=(*BORDER, 135),
            width=max(2, min(w, h) // 250),
        )
    else:
        draw.rectangle(
            (inset, inset, w - inset - 1, h - inset - 1),
            outline=(*BORDER, 115),
            width=max(2, min(w, h) // 250),
        )


def square_asset(size: int, name: str, logo_scale: float = 0.74) -> Path:
    img = background(size, size)
    pad = int(size * 0.13)
    draw_logo(img, (pad, pad, size - pad, size - pad), scale=logo_scale)
    add_edge(img, radius=int(size * 0.07))
    path = OUT / name
    img.save(path)
    return path


def banner_asset(width: int, height: int, name: str, safe: Tuple[float, float, float, float] | None = None) -> Path:
    img = background(width, height)
    if safe is None:
        box = (int(width * 0.12), int(height * 0.18), int(width * 0.88), int(height * 0.82))
    else:
        box = (
            int(width * safe[0]),
            int(height * safe[1]),
            int(width * safe[2]),
            int(height * safe[3]),
        )
    draw_logo(img, box, scale=0.86)
    add_edge(img, radius=int(min(width, height) * 0.055))
    path = OUT / name
    img.save(path)
    return path


def story_asset(width: int, height: int, name: str) -> Path:
    img = background(width, height)
    draw_logo(img, (int(width * 0.09), int(height * 0.34), int(width * 0.91), int(height * 0.62)), scale=0.86)
    add_edge(img, radius=int(width * 0.055))
    path = OUT / name
    img.save(path)
    return path


def make_preview(paths: Iterable[Path]) -> Path:
    items = list(paths)
    thumb_w, thumb_h = 360, 210
    label_h = 36
    gap = 22
    cols = 3
    rows = (len(items) + cols - 1) // cols
    preview = background(cols * thumb_w + (cols + 1) * gap, rows * (thumb_h + label_h) + (rows + 1) * gap)
    draw = ImageDraw.Draw(preview)
    label_font = get_font(18)

    for i, path in enumerate(items):
        src = Image.open(path).convert("RGBA")
        src.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        row, col = divmod(i, cols)
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + label_h + gap)
        frame = Image.new("RGBA", (thumb_w, thumb_h), (8, 4, 3, 255))
        frame.alpha_composite(src, ((thumb_w - src.width) // 2, (thumb_h - src.height) // 2))
        preview.alpha_composite(frame, (x, y))
        draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline=(*BORDER, 150), width=2)
        draw.text((x, y + thumb_h + 8), path.stem, font=label_font, fill=TEXT_LIGHT)

    out = OUT / "aiasap-social-artwork-preview.png"
    preview.save(out)
    return out


def main() -> None:
    paths = [
        square_asset(1024, "aiasap-universal-profile-1024.png", logo_scale=0.78),
        banner_asset(1500, 500, "x-header-1500x500.png"),
        banner_asset(2560, 1440, "youtube-banner-2560x1440.png", safe=(0.22, 0.36, 0.78, 0.63)),
        banner_asset(1280, 720, "youtube-thumbnail-1280x720.png"),
        banner_asset(1640, 624, "facebook-cover-1640x624.png"),
        square_asset(1080, "instagram-square-1080.png"),
        square_asset(1080, "threads-square-1080.png"),
        square_asset(1080, "tiktok-square-1080.png"),
        story_asset(1080, 1920, "instagram-story-1080x1920.png"),
        story_asset(1080, 1920, "tiktok-vertical-1080x1920.png"),
        story_asset(1080, 1920, "threads-vertical-1080x1920.png"),
    ]
    preview = make_preview(paths)
    print(f"Wrote {len(paths)} assets")
    print(preview)


if __name__ == "__main__":
    main()
