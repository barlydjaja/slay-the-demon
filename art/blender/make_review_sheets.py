"""Arrange the actual Blender studio renders for a compact visual review (requires Pillow)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
names = list(json.loads((ROOT / "art/blender/asset-manifest.json").read_text()))
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 17)
for start in range(0, len(names), 12):
    sheet = Image.new("RGB", (1024, 864), "#182226")
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names[start:start + 12]):
        x, y = (i % 4) * 256, (i // 4) * 288
        with Image.open(ROOT / f"art/review/{name}.png") as render:
            sheet.paste(render.convert("RGB").resize((256, 256)), (x, y))
        draw.text((x + 128, y + 271), name.replace("_", " ").title(),
                  fill="#e3e6db", font=font, anchor="mm")
    sheet.save(ROOT / f"art/review/asset-sheet-{start // 12 + 1}.jpg", quality=92)
