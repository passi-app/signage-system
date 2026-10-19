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

def make_qr_code(path_png, path_svg, target_url='https://signage-system-inky.vercel.app/our-pages'):
    import qrcode
    import qrcode.image.svg

    # Generate genuine scannable PNG QR code (Standard Medium 15% error correction for screen scanning)
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(target_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#000000', back_color='#ffffff')
    img.save(path_png, 'PNG')
    print(f"Generated genuine QR PNG {path_png} pointing to {target_url}")

    # Generate genuine scannable SVG QR code
    factory = qrcode.image.svg.SvgPathImage
    svg_img = qrcode.make(target_url, image_factory=factory, error_correction=qrcode.constants.ERROR_CORRECT_M)
    svg_img.save(path_svg)
    print(f"Generated genuine QR SVG {path_svg}")

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
    import shutil
    target_qr_url = 'https://signage-system-inky.vercel.app/our-pages'
    os.makedirs('logos', exist_ok=True)
    os.makedirs('public/logos', exist_ok=True)
    os.makedirs('sponsors', exist_ok=True)
    os.makedirs('public/sponsors', exist_ok=True)

    if not os.path.exists('logos/passi-logo.png'):
        make_passi_logo('logos/passi-logo.png', 'logos/passi-logo.svg')
    if not os.path.exists('logos/lagora-logo.png'):
        make_lagora_logo('logos/lagora-logo.png', 'logos/lagora-logo.svg')
    make_qr_code('logos/qr-code.png', 'logos/qr-code.svg', target_url=target_qr_url)

    shutil.copy('logos/qr-code.png', 'public/logos/qr-code.png')
    shutil.copy('logos/qr-code.svg', 'public/logos/qr-code.svg')

    # Generate sponsor logos
    make_sponsor_logo('sponsors/sponsor_zara.png', 'ZARA', 'MODE & ACCESSOIRES')
    make_sponsor_logo('sponsors/sponsor_apple.png', 'APPLE STORE', 'PREMIUM RESELLER')
    make_sponsor_logo('sponsors/sponsor_sephora.png', 'SEPHORA', 'BEAUTÉ & PARFUM')
    make_sponsor_logo('sponsors/sponsor_nespresso.png', 'NESPRESSO', 'BOUTIQUE CAFÉ')

    print("All logos & sponsors created successfully!")
