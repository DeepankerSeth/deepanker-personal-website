# Newsreader webfont source and reproduction

These local webfonts are subsets of Production Type’s official Newsreader variable TTFs, distributed under the SIL Open Font License 1.1. The license is retained as `newsreader-OFL.txt`.

The source is pinned to commit `1ece6a8bfe5db1a2b90c76cc1fe5d3b2eed5dcf3` of [productiontype/NewsReader](https://github.com/productiontype/NewsReader/tree/1ece6a8bfe5db1a2b90c76cc1fe5d3b2eed5dcf3), the upstream revision recorded by the Google Fonts metadata distributed alongside the original fonts.

- [Regular variable TTF](https://raw.githubusercontent.com/productiontype/NewsReader/1ece6a8bfe5db1a2b90c76cc1fe5d3b2eed5dcf3/fonts/variable/ttf/Newsreader%5Bopsz%2Cwght%5D.ttf)
- [Italic variable TTF](https://raw.githubusercontent.com/productiontype/NewsReader/1ece6a8bfe5db1a2b90c76cc1fe5d3b2eed5dcf3/fonts/variable/ttf/Newsreader-Italic%5Bopsz%2Cwght%5D.ttf)
- [OFL license](https://raw.githubusercontent.com/productiontype/NewsReader/1ece6a8bfe5db1a2b90c76cc1fe5d3b2eed5dcf3/OFL.txt)

## Coverage and shaping

Both delivered faces retain variable `wght` 400–700 and `opsz` 18–48. The complete upstream axes are 200–800 and 6–72. The restricted ranges cover the site’s Newsreader text sizes (20–29px), emphasis weights and optical sizing while avoiding unused variation data. The subset requests Latin, Latin Extended, combining marks, Latin Extended Additional, punctuation, currency and symbols. It retains the source font’s supported characters in these ranges; it does not invent unsupported characters.

The source has no precomposed U+1E41 glyph for `ṁ`. Both delivered faces retain `m`, U+0307 and the mark positioning needed for HarfBuzz to shape the unchanged NFC string `akhilaṁ` through canonical decomposition into this same face. The earlier Google Fonts Latin subsets omitted U+0307. This build also retains the actual essays’ other diacritics, including `ā` and `ṁ`’s combining form; the poem’s white-heart emoji uses normal emoji fallback. No article text is normalized or rewritten.

## Rebuild

Use Python with `fonttools[woff]==4.63.0` and `brotli==1.2.0`. Download the two pinned TTFs above into the working directory, then run:

```sh
python3 -m fontTools.subset 'Newsreader[opsz,wght].ttf' --output-file=newsreader-regular-full.woff2 --unicodes=U+0000-024F,U+02B0-036F,U+1D00-1DBF,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-22FF,U+FEFF,U+FFFD --layout-features+=sups --flavor=woff2 --no-hinting --no-recalc-timestamp
python3 -m fontTools.subset 'Newsreader-Italic[opsz,wght].ttf' --output-file=newsreader-italic-full.woff2 --unicodes=U+0000-024F,U+02B0-036F,U+1D00-1DBF,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-22FF,U+FEFF,U+FFFD --layout-features+=sups --flavor=woff2 --no-hinting --no-recalc-timestamp
python3 -m fontTools.varLib.instancer newsreader-regular-full.woff2 wght=400:400:700 opsz=18:18:48 --output newsreader-regular.woff2 --no-recalc-timestamp --quiet
python3 -m fontTools.varLib.instancer newsreader-italic-full.woff2 wght=400:400:700 opsz=18:18:48 --output newsreader-italic.woff2 --no-recalc-timestamp --quiet
```

The default fontTools layout-feature set plus OpenType `sups` is retained, including standard shaping, mark positioning and superscript substitutions. Hinting is removed. Both axes remain variable within their restricted ranges. Both final builds were repeated and verified byte-for-byte with these commands. HarfBuzz shaping was checked against the full-axis subsets for all four essays and explicit diacritic/superscript probes at weights 400, 600 and 700 and optical sizes 20, 22, 26 and 29: no missing glyphs, identical shaped glyph sequences and a maximum positioning difference of 2/2000 em from instancing roundoff. Source text remains unchanged. The upstream OpenType `sups` feature is explicitly retained in addition to Unicode superscripts and normal CSS superscript sizing. Superscript substitutions were verified at the same twelve axis settings.

## SHA-256

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Newsreader[opsz,wght].ttf` | 451664 | `8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1` |
| `Newsreader-Italic[opsz,wght].ttf` | 495684 | `796668611f80b64d5adf182fde3b6f29ed83b4e7cbec7b96937e84ac01364792` |
| `OFL.txt` | 4394 | `fdfad38143ec470553cae82a1e45320bdd1b9ec70415d37bd0171051d8a4ded8` |
| `newsreader-regular.woff2` | 101044 | `2712b24aa5dd0d8b85e330bb10edcf945dd1d95200762c78582c11d245564461` |
| `newsreader-italic.woff2` | 113540 | `9dcd042c3719dbf88f2779d9f4e8a810f357059116234737d6768724360fef8a` |
