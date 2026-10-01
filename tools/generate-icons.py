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
    margin = 0.15 if maskable else 0.0
    pill_scale = size * (0.42 if maskable else 0.48)
    cx = cy = (size - 1) / 2
    angle = -math.pi / 4
    ca, sa = math.cos(angle), math.sin(angle)
    radius = size * (0.5 - margin)
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            t = (x + y) / max(1, 2 * (size - 1))
            color = [int(244 * (1-t) + 188*t), int(182 * (1-t) + 167*t), int(159 * (1-t) + 232*t)]
            dx, dy = x - cx, y - cy
            # Rounded-square silhouette for regular icon, circular-safe background for maskable.
            if maskable:
                inside = dx*dx + dy*dy <= radius*radius
            else:
                r = size * 0.27
                qx, qy = abs(dx) - (size/2-r), abs(dy) - (size/2-r)
                inside = math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) <= r
            if inside:
                u, v = dx*ca + dy*sa, -dx*sa + dy*ca
                along = abs(u) <= pill_scale/2
                across = abs(v) <= size*0.105
                cap = math.hypot(max(abs(u)-pill_scale/2+size*0.105, 0), v) <= size*0.105
                if along and across or cap:
                    color = [255, 255, 255]
                elif abs(u) < 1.5 and abs(v) < size*0.105:
                    color = [221, 204, 235]
            row.extend(color + [255 if inside else 0])
        rows.append(bytes(row))
    raw = b''.join(rows)
    return b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', struct.pack('>2I5B', size, size, 8, 6, 0, 0, 0)) + png_chunk(b'IDAT', zlib.compress(raw, 9)) + png_chunk(b'IEND', b'')


for size in (192, 512):
    for maskable in (False, True):
        name = f'icon-maskable-{size}.png' if maskable else f'icon-{size}.png'
        with open(os.path.join(ROOT, name), 'wb') as icon:
            icon.write(render(size, maskable))
        print('created', name)
