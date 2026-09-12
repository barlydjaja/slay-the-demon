"""Arrange the actual Blender studio renders for a compact visual review (requires Pillow)."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
castle = 'castle' in sys.argv[1:]
manifest = 'castle-manifest.json' if castle else 'asset-manifest.json'
review = ROOT / ('art/review/castle' if castle else 'art/review')
names = list(json.loads((ROOT / 'art/blender' / manifest).read_text()))
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
except OSError:
    font = ImageFont.load_default(size=17)
for start in range(0, len(names), 12):
    sheet = Image.new("RGB", (1024, 864), "#182226")
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names[start:start + 12]):
        x, y = (i % 4) * 256, (i // 4) * 288
        with Image.open(review / f"{name}.png") as render:
            sheet.paste(render.convert("RGB").resize((256, 256)), (x, y))
        draw.text((x + 128, y + 271), name.replace("_", " ").title(),
                  fill="#e3e6db", font=font, anchor="mm")
    sheet.save(review / f"asset-sheet-{start // 12 + 1}.jpg", quality=92)
