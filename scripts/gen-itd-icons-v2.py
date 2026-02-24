#!/usr/bin/env python3
import struct, zlib, os, math

BLUE = (13, 36, 69, 255)  # MTCC blue

FONT = {
    'I': ["11111","00100","00100","00100","00100","00100","11111"],
    'T': ["11111","00100","00100","00100","00100","00100","00100"],
    'D': ["11110","10001","10001","10001","10001","10001","11110"],
}


def set_px(buf, size, x, y, color):
    if x < 0 or y < 0 or x >= size or y >= size:
        return
    i = (y * size + x) * 4
    buf[i:i+4] = color


def draw_circle(buf, size, cx, cy, r, thickness=1):
    r2 = r * r
    inner = max(0, r - thickness)
    inner2 = inner * inner
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx = x - cx
            dy = y - cy
            d2 = dx * dx + dy * dy
            if inner2 <= d2 <= r2:
                set_px(buf, size, x, y, BLUE)


def draw_line(buf, size, x0, y0, x1, y1, thickness=1):
    dx = x1 - x0
    dy = y1 - y0
    steps = int(max(abs(dx), abs(dy)))
    if steps == 0:
        set_px(buf, size, int(round(x0)), int(round(y0)), BLUE)
        return
    for i in range(steps + 1):
        t = i / steps
        x = x0 + dx * t
        y = y0 + dy * t
        for oy in range(-thickness, thickness + 1):
            for ox in range(-thickness, thickness + 1):
                if ox * ox + oy * oy <= thickness * thickness:
                    set_px(buf, size, int(round(x + ox)), int(round(y + oy)), BLUE)


def draw_dot(buf, size, x, y, r=1):
    for yy in range(int(y - r), int(y + r + 1)):
        for xx in range(int(x - r), int(x + r + 1)):
            if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                set_px(buf, size, xx, yy, BLUE)


def draw_globe(buf, size, detail):
    cx = cy = size / 2
    r = size * 0.46
    thickness = max(1, size // 64)
    draw_circle(buf, size, cx, cy, r, thickness)

    if detail >= 2:
        draw_line(buf, size, cx - r * 0.9, cy, cx + r * 0.9, cy, thickness)
        draw_line(buf, size, cx, cy - r * 0.85, cx, cy + r * 0.85, thickness)
    elif detail == 1:
        draw_line(buf, size, cx - r * 0.9, cy, cx + r * 0.9, cy, thickness)

    if detail >= 3:
        draw_line(buf, size, cx - r * 0.7, cy - r * 0.35, cx + r * 0.7, cy - r * 0.35, thickness)
        draw_line(buf, size, cx - r * 0.7, cy + r * 0.35, cx + r * 0.7, cy + r * 0.35, thickness)
        draw_dot(buf, size, cx - r * 0.6, cy - r * 0.25, max(1, size // 64))
        draw_dot(buf, size, cx + r * 0.55, cy + r * 0.1, max(1, size // 64))
        draw_dot(buf, size, cx, cy - r * 0.75, max(1, size // 64))


def draw_text(buf, size):
    text = "ITD"
    glyph_w, glyph_h = 5, 7
    spacing = 2
    units_w = len(text) * glyph_w + (len(text) - 1) * spacing
    scale = max(1, int(size / 14))
    text_w = units_w * scale
    text_h = glyph_h * scale
    start_x = (size - text_w) // 2
    start_y = (size - text_h) // 2
    slant = max(1, scale // 2)
    x = start_x
    for ch in text:
        pattern = FONT[ch]
        for row in range(glyph_h):
            for col in range(glyph_w):
                if pattern[row][col] == '1':
                    for sy in range(scale):
                        for sx in range(scale):
                            cx = x + col * scale + sx + row * slant // 3
                            cy = start_y + row * scale + sy
                            set_px(buf, size, cx, cy, BLUE)
        x += (glyph_w + spacing) * scale


def write_png(path, size, detail):
    buf = bytearray((0, 0, 0, 0) * (size * size))
    draw_globe(buf, size, detail)
    draw_text(buf, size)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(buf[y * stride:(y + 1) * stride])
    data = zlib.compress(bytes(raw))

    def chunk(tag, data_bytes):
        return (struct.pack('!I', len(data_bytes)) + tag + data_bytes +
                struct.pack('!I', zlib.crc32(tag + data_bytes) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('!IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', data)
    png += chunk(b'IEND', b'')

    with open(path, 'wb') as f:
        f.write(png)


def write_svg(path):
    svg = """<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" fill=\"none\" stroke=\"#0d2445\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\">
  <circle cx=\"50\" cy=\"50\" r=\"46\" />
  <path d=\"M8 50 H92\" />
  <path d=\"M50 8 V92\" />
  <path d=\"M18 35 H82\" />
  <path d=\"M18 65 H82\" />
  <circle cx=\"24\" cy=\"38\" r=\"2\" fill=\"#0d2445\" stroke=\"none\" />
  <circle cx=\"76\" cy=\"56\" r=\"2\" fill=\"#0d2445\" stroke=\"none\" />
  <g transform=\"translate(12 34) skewX(-8)\" fill=\"#0d2445\" stroke=\"none\">
    <path d=\"M10 0 H26 V6 H20 V32 H26 V38 H10 V32 H16 V6 H10 Z\" />
    <path d=\"M34 0 H56 V6 H48 V38 H42 V6 H34 Z\" />
    <path d=\"M64 0 H80 C88 0 92 6 92 19 V19 C92 32 88 38 80 38 H64 Z M70 6 V32 H79 C83 32 86 28 86 19 V19 C86 10 83 6 79 6 Z\" />
  </g>
</svg>"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)


if __name__ == '__main__':
    sizes = [16, 32, 48, 192, 256, 512]
    base_dirs = [
        '/opt/it-portal/user-portal/public',
        '/opt/it-portal/admin-cms/public'
    ]
    for d in base_dirs:
        os.makedirs(d, exist_ok=True)
        write_svg(os.path.join(d, 'itd-icon-v2.svg'))
        for s in sizes:
            detail = 1 if s <= 32 else 2 if s <= 128 else 3
            name = f"favicon-itd-v2-{s}.png" if s in (16,32,48) else f"app-icon-itd-v2-{s}.png"
            write_png(os.path.join(d, name), s, detail)
    print('ITD v2 icons generated.')
