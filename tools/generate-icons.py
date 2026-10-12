#!/usr/bin/env python3
"""Generate app PNG icons using only Python's standard library."""
import math
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(ROOT, exist_ok=True)


def png_chunk(kind, data):
    payload = kind + data
    return struct.pack('>I', len(data)) + payload + struct.pack('>I', zlib.crc32(payload) & 0xffffffff)


def render(size, maskable=False):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = x / size, y / size
            color = [32, 43, 36]
            # Geometric M monogram; all strokes stay within the maskable safe area.
            segments = [(0.30,0.68,0.30,0.32), (0.30,0.32,0.39,0.32),
                        (0.39,0.32,0.50,0.51), (0.50,0.51,0.61,0.32),
                        (0.61,0.32,0.70,0.32), (0.70,0.32,0.70,0.68)]
            for ax, ay, bx, by in segments:
                t = max(0, min(1, ((px-ax)*(bx-ax)+(py-ay)*(by-ay)) / ((bx-ax)**2+(by-ay)**2)))
                if math.hypot(px-ax-t*(bx-ax), py-ay-t*(by-ay)) < 0.025:
                    color = [214, 239, 120]
            row.extend(color + [255])
        rows.append(bytes(row))
    raw = b''.join(rows)
    return b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', struct.pack('>2I5B', size, size, 8, 6, 0, 0, 0)) + png_chunk(b'IDAT', zlib.compress(raw, 9)) + png_chunk(b'IEND', b'')


for size in (192, 512):
    for maskable in (False, True):
        name = f'icon-maskable-{size}.png' if maskable else f'icon-{size}.png'
        with open(os.path.join(ROOT, name), 'wb') as icon:
            icon.write(render(size, maskable))
        print('created', name)
