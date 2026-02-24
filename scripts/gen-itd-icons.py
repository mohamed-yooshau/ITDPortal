#!/usr/bin/env python3
import struct, zlib, os

BG = (13, 36, 69, 255)  # #0d2445
FG = (255, 255, 255, 255)

FONT = {
    'I': ["11111","00100","00100","00100","00100","00100","11111"],
    'T': ["11111","00100","00100","00100","00100","00100","00100"],
    'D': ["11110","10001","10001","10001","10001","10001","11110"],
}


def draw_text(canvas, size):
    text = "ITD"
    glyph_w, glyph_h = 5, 7
    spacing = 2
    total_w = len(text) * glyph_w + (len(text) - 1) * spacing
    scale = max(1, size // (total_w + 8))
    text_w = total_w * scale
    text_h = glyph_h * scale
    start_x = (size - text_w) // 2
    start_y = (size - text_h) // 2
    x = start_x
    for ch in text:
        pattern = FONT[ch]
        for row in range(glyph_h):
            for col in range(glyph_w):
                if pattern[row][col] == '1':
                    for sy in range(scale):
                        for sx in range(scale):
                            cx = x + col * scale + sx
                            cy = start_y + row * scale + sy
                            if 0 <= cx < size and 0 <= cy < size:
                                idx = (cy * size + cx) * 4
                                canvas[idx:idx+4] = FG
        x += (glyph_w + spacing) * scale


def write_png(path, size):
    canvas = bytearray(BG * (size * size))
    draw_text(canvas, size)
    # Add slight rounded corners by masking edges
    radius = max(2, size // 18)
    for y in range(size):
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            if dx < radius and dy < radius:
                # corner circle
                if (dx - radius + 1) ** 2 + (dy - radius + 1) ** 2 > radius ** 2:
                    idx = (y * size + x) * 4
                    canvas[idx:idx+4] = (0, 0, 0, 0)

    # PNG encoding
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(canvas[y * stride:(y + 1) * stride])
    compressor = zlib.compressobj()
    data = compressor.compress(bytes(raw)) + compressor.flush()

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


if __name__ == '__main__':
    base_dirs = [
        '/opt/it-portal/user-portal/public',
        '/opt/it-portal/admin-cms/public'
    ]
    for d in base_dirs:
        os.makedirs(d, exist_ok=True)
        write_png(os.path.join(d, 'apple-touch-icon.png'), 180)
        write_png(os.path.join(d, 'favicon-32.png'), 32)
        write_png(os.path.join(d, 'favicon-16.png'), 16)
        write_png(os.path.join(d, 'favicon-192.png'), 192)
        write_png(os.path.join(d, 'favicon-512.png'), 512)
        # simple SVG favicon
        svg = f"""<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\">\n<rect width=\"100\" height=\"100\" rx=\"14\" fill=\"#0d2445\"/>\n<text x=\"50\" y=\"58\" text-anchor=\"middle\" font-size=\"44\" font-family=\"Arial, sans-serif\" fill=\"#fff\" font-weight=\"700\">ITD</text>\n</svg>"""
        with open(os.path.join(d, 'favicon.svg'), 'w', encoding='utf-8') as f:
            f.write(svg)

    print('Icons generated.')
