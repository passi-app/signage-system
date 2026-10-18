"""
Asset generator for PubScreen.
Generates high-resolution, modern PNG and SVG logos and sponsors.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

os.makedirs('logos', exist_ok=True)
os.makedirs('sponsors', exist_ok=True)

def find_font(size):
    # Try common Windows TrueType fonts for crisp rendering
    font_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\tahoma.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def find_font_regular(size):
    font_paths = [
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\tahoma.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf"
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

def make_passi_logo(path_png, path_svg):
    # PNG Generation (500x160)
    w, h = 520, 150
    img = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Stylized emblem: gold / royal blue luxury gradient-like diamond
    # Draw diamond emblem
    cx, cy = 60, h // 2
    r = 36
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=(37, 99, 235, 255))
    draw.polygon([(cx, cy - r//2), (cx + r//2, cy), (cx, cy + r//2), (cx - r//2, cy)], fill=(245, 158, 11, 255))

    font_title = find_font(52)
    font_sub = find_font_regular(16)

    draw.text((120, 32), "PASSI", fill=(15, 23, 42, 255), font=font_title)
    draw.text((122, 92), "COLLECTION & MAISON", fill=(100, 116, 139, 255), font=font_sub)

    img.save(path_png, 'PNG')
    print(f"Generated {path_png}")

    # SVG counterpart
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <defs>
    <linearGradient id="passi-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  <polygon points="{cx},{cy-r} {cx+r},{cy} {cx},{cy+r} {cx-r},{cy}" fill="url(#passi-grad)" />
  <polygon points="{cx},{cy-r//2} {cx+r//2},{cy} {cx},{cy+r//2} {cx-r//2},{cy}" fill="#f59e0b" />
  <text x="120" y="80" font-family="Plus Jakarta Sans, Segoe UI, sans-serif" font-size="52" font-weight="800" fill="#0f172a" letter-spacing="3">PASSI</text>
  <text x="122" y="112" font-family="Plus Jakarta Sans, Segoe UI, sans-serif" font-size="15" font-weight="600" fill="#64748b" letter-spacing="4">COLLECTION &amp; MAISON</text>
</svg>'''
    with open(path_svg, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Generated {path_svg}")

def make_lagora_logo(path_png, path_svg):
    w, h = 540, 150
    img = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Architectural emblem: Mall Dome / Pillars
    cx, cy = 60, h // 2
    draw.arc([cx - 38, cy - 38, cx + 38, cy + 38], start=180, end=360, fill=(15, 23, 42, 255), width=7)
    draw.rectangle([cx - 30, cy - 2, cx - 22, cy + 34], fill=(37, 99, 235, 255))
    draw.rectangle([cx - 8, cy - 2, cx + 0, cy + 34], fill=(15, 23, 42, 255))
    draw.rectangle([cx + 14, cy - 2, cx + 22, cy + 34], fill=(37, 99, 235, 255))
    draw.rectangle([cx - 36, cy + 30, cx + 36, cy + 38], fill=(15, 23, 42, 255))

    font_title = find_font(48)
    font_sub = find_font_regular(15)

    draw.text((120, 34), "L'AGORA", fill=(15, 23, 42, 255), font=font_title)
    draw.text((122, 92), "MALL & LIFESTYLE", fill=(100, 116, 139, 255), font=font_sub)

    img.save(path_png, 'PNG')
    print(f"Generated {path_png}")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  <circle cx="{cx}" cy="{cy-4}" r="34" fill="none" stroke="#0f172a" stroke-width="6" stroke-dasharray="106 106" stroke-dashoffset="0"/>
  <rect x="{cx-26}" y="{cy}" width="8" height="32" rx="2" fill="#2563eb" />
  <rect x="{cx-6}" y="{cy}" width="8" height="32" rx="2" fill="#0f172a" />
  <rect x="{cx+14}" y="{cy}" width="8" height="32" rx="2" fill="#2563eb" />
  <rect x="{cx-34}" y="{cy+30}" width="64" height="6" rx="2" fill="#0f172a" />
  <text x="120" y="80" font-family="Plus Jakarta Sans, Segoe UI, sans-serif" font-size="48" font-weight="800" fill="#0f172a" letter-spacing="2">L'AGORA</text>
  <text x="122" y="112" font-family="Plus Jakarta Sans, Segoe UI, sans-serif" font-size="14" font-weight="600" fill="#64748b" letter-spacing="4">MALL &amp; LIFESTYLE</text>
</svg>'''
    with open(path_svg, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Generated {path_svg}")

def make_qr_code(path_png, path_svg):
    # Generate clean, standard QR matrix pattern
    size = 320
    grid = 25
    cell = size // grid
    margin = (size - (grid * cell)) // 2

    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Draw Finder Patterns at 3 corners
    def draw_finder(ox, oy):
        # 7x7 outer black
        draw.rectangle([ox, oy, ox + 7*cell, oy + 7*cell], fill=(15, 23, 42, 255))
        # 5x5 inner white
        draw.rectangle([ox + cell, oy + cell, ox + 6*cell, oy + 6*cell], fill=(255, 255, 255, 255))
        # 3x3 center black
        draw.rectangle([ox + 2*cell, oy + 2*cell, ox + 5*cell, oy + 5*cell], fill=(15, 23, 42, 255))

    draw_finder(margin, margin)
    draw_finder(margin + (grid - 7)*cell, margin)
    draw_finder(margin, margin + (grid - 7)*cell)

    # Timing lines
    for i in range(8, grid - 8):
        if i % 2 == 0:
            draw.rectangle([margin + i*cell, margin + 6*cell, margin + (i+1)*cell, margin + 7*cell], fill=(15, 23, 42, 255))
            draw.rectangle([margin + 6*cell, margin + i*cell, margin + 7*cell, margin + (i+1)*cell], fill=(15, 23, 42, 255))

    # Pseudo-random pseudo data cells for realistic QR code appearance
    import random
    random.seed(42)
    for r in range(grid):
        for c in range(grid):
            # Skip finders
            if (r < 8 and c < 8) or (r < 8 and c >= grid - 8) or (r >= grid - 8 and c < 8):
                continue
            if r == 6 or c == 6:
                continue
            if random.random() > 0.45:
                x = margin + c * cell
                y = margin + r * cell
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(15, 23, 42, 255))

    # Central accent dot or small brand badge
    center_box = [margin + 10*cell, margin + 10*cell, margin + 15*cell, margin + 15*cell]
    draw.rectangle(center_box, fill=(255, 255, 255, 255))
    draw.rectangle([center_box[0]+2, center_box[1]+2, center_box[2]-2, center_box[3]-2], fill=(37, 99, 235, 255))
    draw.rectangle([center_box[0]+6, center_box[1]+6, center_box[2]-6, center_box[3]-6], fill=(255, 255, 255, 255))

    img.save(path_png, 'PNG')
    print(f"Generated {path_png}")

    # Also save svg
    svg_data = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">
  <rect width="{size}" height="{size}" fill="#ffffff" rx="16"/>
  <rect x="{margin}" y="{margin}" width="{7*cell}" height="{7*cell}" fill="#0f172a" />
  <rect x="{margin+cell}" y="{margin+cell}" width="{5*cell}" height="{5*cell}" fill="#ffffff" />
  <rect x="{margin+2*cell}" y="{margin+2*cell}" width="{3*cell}" height="{3*cell}" fill="#0f172a" />

  <rect x="{margin+(grid-7)*cell}" y="{margin}" width="{7*cell}" height="{7*cell}" fill="#0f172a" />
  <rect x="{margin+(grid-6)*cell}" y="{margin+cell}" width="{5*cell}" height="{5*cell}" fill="#ffffff" />
  <rect x="{margin+(grid-5)*cell}" y="{margin+2*cell}" width="{3*cell}" height="{3*cell}" fill="#0f172a" />

  <rect x="{margin}" y="{margin+(grid-7)*cell}" width="{7*cell}" height="{7*cell}" fill="#0f172a" />
  <rect x="{margin+cell}" y="{margin+(grid-6)*cell}" width="{5*cell}" height="{5*cell}" fill="#ffffff" />
  <rect x="{margin+2*cell}" y="{margin+(grid-5)*cell}" width="{3*cell}" height="{3*cell}" fill="#0f172a" />

  <rect x="{center_box[0]}" y="{center_box[1]}" width="{5*cell}" height="{5*cell}" fill="#2563eb" rx="4" />
</svg>'''
    with open(path_svg, 'w', encoding='utf-8') as f:
        f.write(svg_data)
    print(f"Generated {path_svg}")

def make_sponsor_logo(path_png, brand_name, tag='PARTNER'):
    w, h = 320, 100
    img = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    font_title = find_font(34)
    font_sub = find_font_regular(12)

    # Subtle badge frame
    draw.rounded_rectangle([10, 10, w - 10, h - 10], radius=16, fill=(255, 255, 255, 230), outline=(226, 232, 240, 255), width=1)

    # Center text
    bbox = draw.textbbox((0, 0), brand_name, font=font_title)
    tx = (w - (bbox[2] - bbox[0])) // 2
    draw.text((tx, 22), brand_name, fill=(15, 23, 42, 255), font=font_title)

    sub_box = draw.textbbox((0, 0), tag, font=font_sub)
    sx = (w - (sub_box[2] - sub_box[0])) // 2
    draw.text((sx, 64), tag, fill=(100, 116, 139, 255), font=font_sub)

    img.save(path_png, 'PNG')
    print(f"Generated {path_png}")

if __name__ == '__main__':
    make_passi_logo('logos/passi-logo.png', 'logos/passi-logo.svg')
    make_lagora_logo('logos/lagora-logo.png', 'logos/lagora-logo.svg')
    make_qr_code('logos/qr-code.png', 'logos/qr-code.svg')

    # Generate 4 high-end sponsor logos
    make_sponsor_logo('sponsors/sponsor_zara.png', 'ZARA', 'MODE & ACCESSOIRES')
    make_sponsor_logo('sponsors/sponsor_apple.png', 'APPLE STORE', 'PREMIUM RESELLER')
    make_sponsor_logo('sponsors/sponsor_sephora.png', 'SEPHORA', 'BEAUTÉ & PARFUM')
    make_sponsor_logo('sponsors/sponsor_nespresso.png', 'NESPRESSO', 'BOUTIQUE CAFÉ')

    print("All logos & sponsors created successfully!")
