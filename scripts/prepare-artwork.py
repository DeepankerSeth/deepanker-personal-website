#!/usr/bin/env python3
"""Encode an approved transparent master; never generate or creatively edit artwork."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

import PIL
from PIL import Image, features


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Approved transparent PNG master (at least1536px wide)')
    parser.add_argument('--slug', required=True, help='Stable lowercase artwork filename stem')
    parser.add_argument('--out', type=Path, required=True, help='Output directory; use a staging directory to inspect new work')
    parser.add_argument('--replace', action='store_true', help='Explicitly replace this slug\'s existing generated files')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.slug):
        parser.error('--slug must contain lowercase letters/digits separated by single hyphens')
    source = args.source.resolve(strict=True)
    target = args.out.resolve()
    names = [f'{args.slug}-{width}.webp' for width in (320, 960, 1536)] + [f'{args.slug}-assets.json']
    if not args.replace and any((target / name).exists() for name in names):
        parser.error('output exists; use an unused directory or explicit --replace after review')
    if any((target / name).resolve() == source for name in names):
        parser.error('the master cannot be an output file')
    with Image.open(source) as opened:
        if opened.format != 'PNG' or 'A' not in opened.getbands():
            parser.error('source must be a PNG with a real alpha channel')
        if opened.width < 1536:
            parser.error('source must be at least1536px wide; this tool does not invent detail by upscaling')
        image = opened.convert('RGBA')
        profile = opened.info.get('icc_profile')
        metadata = {'icc_profile': profile} if profile else {}
        low, high = image.getchannel('A').getextrema()
        if low == 255 or high == 0:
            parser.error('source must contain both visible material and transparent pixels')
    target.mkdir(parents=True, exist_ok=True)
    report = {'source': source.name, 'sourceSHA256': digest(source),
              'sourceDimensions': list(image.size), 'Pillow': PIL.__version__,
              'libwebp': features.version('webp'), 'resampling': 'Lanczos', 'assets': []}
    # Encode everything before replacing any requested output. The original master is read-only.
    with tempfile.TemporaryDirectory(prefix='.artwork-', dir=target) as staging:
        staging = Path(staging)
        for width in (320, 960, 1536):
            resized = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
            path = staging / f'{args.slug}-{width}.webp'
            resized.save(path, 'WEBP', quality=85 if width == 1536 else 83, method=6, exact=True, **metadata)
            report['assets'].append({'file': path.name, 'dimensions': list(resized.size),
                                     'bytes': path.stat().st_size, 'sha256': digest(path)})
        (staging / names[-1]).write_text(json.dumps(report, indent=2) + '\n')
        for name in names:
            if args.replace:
                os.replace(staging / name, target / name)
            else:
                # Exclusive creation also protects a file that appeared after the initial check.
                os.link(staging / name, target / name)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
