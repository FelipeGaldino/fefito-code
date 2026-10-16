#!/usr/bin/env python3
"""Regenerate the Fefito icon and Windows installer artwork (requires Pillow)."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
WINDOWS = ROOT / "resources" / "win32"
SCALE = 4
BACKGROUND = (40, 42, 54)
PURPLE = (189, 147, 249)
CYAN = (139, 233, 253)
WHITE = (248, 248, 242)


def icon(size: int) -> Image.Image:
    side = size * SCALE
    image = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def rect(box: tuple[int, int, int, int], **kwargs: object) -> None:
        draw.rounded_rectangle(tuple(round(value * side / 1024) for value in box), **kwargs)

    def ellipse(box: tuple[int, int, int, int], **kwargs: object) -> None:
        draw.ellipse(tuple(round(value * side / 1024) for value in box), **kwargs)

    rect((24, 24, 1000, 1000), radius=round(side * 0.22), fill=BACKGROUND + (255,))
    ellipse((145, 145, 879, 879), outline=PURPLE + (255,), width=max(1, round(side * 0.03)))
    ellipse((763, 170, 900, 307), fill=CYAN + (255,))
    rect((311, 280, 412, 764), radius=round(side * 0.024), fill=WHITE + (255,))
    rect((311, 280, 706, 378), radius=round(side * 0.024), fill=WHITE + (255,))
    rect((311, 474, 631, 572), radius=round(side * 0.024), fill=WHITE + (255,))
    return image.resize((size, size), Image.Resampling.LANCZOS)


def installer_art(size: tuple[int, int], small: bool) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size)
    pixels = image.load()
    for y in range(height):
        fraction = y / max(1, height - 1)
        color = (
            round(40 + 27 * fraction),
            round(42 + 13 * fraction),
            round(54 + 45 * fraction),
        )
        for x in range(width):
            pixels[x, y] = color
    logo_size = round(min(width, height) * (0.77 if small else 0.72))
    logo = icon(logo_size)
    image.paste(logo, ((width - logo_size) // 2, (height - logo_size) // 2), logo)
    return image


def main() -> None:
    sizes = (16, 24, 32, 48, 64, 128, 256)
    icon(256).save(WINDOWS / "code.ico", format="ICO", sizes=[(side, side) for side in sizes])
    for side in (70, 150):
        icon(side).save(WINDOWS / f"code_{side}x{side}.png")
    for artwork in WINDOWS.glob("inno-*.bmp"):
        with Image.open(artwork) as original:
            size = original.size
        installer_art(size, artwork.name.startswith("inno-small")).save(artwork, format="BMP")
    print("Ícone e imagens do instalador Windows atualizados.")


if __name__ == "__main__":
    main()
