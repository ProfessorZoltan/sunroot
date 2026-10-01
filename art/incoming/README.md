# Sunroot — option C artwork

96 individual transparent RGBA PNGs, all on the same untrimmed **512 × 640 pixel frame**. The art is warm storybook papercraft, softly lit from the upper left. No magenta keying or sheet slicing is required.

## Shared geometry

- Tile width: **400 px**.
- Tile top vertex: **(256, 168)**. This is the top vertex, not the tile center.
- Tile center on its top face: **(256, 373.5)**; use y=374 if an integer is required.
- Top-face vertices, clockwise: `(256,168), (456,283.47), (456,463.47), (256,579), (56,463.47), (56,283.47)`.
- Slanted edges: approximately **30°**; straight sides **180 px**, or 45% of tile width.
- Paper side band: **32 px**; its lowest nominal point is **y=611**.
- Keep the full frame. Align every frame at the same origin so groundless buildings reveal their underlying terrain.

Ground hexes were mechanically scaled and framed to these shared anchors. Generated painted contours retain small natural edge variations of a pixel or two. Scaling and sheet separation preserved the generated alpha; no background color guessing was used.

## Files

`tiles/` contains nine terrain types, each with two summer variants (`id.png`, `id-2.png`) and one winter version (`id.winter.png`): river, reservoir, floodplain, hill, ruin, barren, scrub, meadow, woodland.

`buildings/` contains all 31 building IDs, each with a summer `id.png` and winter `id.winter.png`. Most buildings are groundless. Wind Spire, Pumped Reservoir, Salvage Yard, Rewilded Ruin and Weir include their specific terrain. Floodplain Farm and Agrivoltaic Field include their crop-cover footprint. Ordinary building contact bases are near y=440; the Cottage's stepping stones extend to about y=455. Crop-cover plots extend to about y=545.

The Founders' Camp, Cottage and Treehouse Commons also have `id.lit.png`: full replacement sprites with glowing windows. Switch between the day and night sprite rather than drawing both on top of one another. Summer/night/winter versions use the same framing and family scale.

## Rotating parts

Wind Spire and River Wheel base sprites contain only their stationary structure. Draw their rotor layer afterward, using the same frame origin:

| Base | Rotor | Rotation pivot in the shared frame |
|---|---|---|
| `windSpire.png` | `windSpire.rotor.png` | **(254, 181)** |
| `riverWheel.png` | `riverWheel.rotor.png` | **(222, 309)** |
| `windSpire.winter.png` | `windSpire.rotor.winter.png` | **(254, 181)** |
| `riverWheel.winter.png` | `riverWheel.rotor.winter.png` | **(222, 309)** |

Rotate around these explicit pivots, keeping the common frame origin. The rotor's pivot is not the center of the image canvas. Winter rotors are included as a bonus. Composite previews at 0°, 90° and 180° confirmed aligned axles and adequate frame margins.

`manifest.json` lists every file, shared geometry, rotor pivots, dimensions and SHA-256 hashes. All PNGs are tagged sRGB with an embedded ICC profile and retain their original RGB pixel values and alpha channel; no lossy conversion was used.

## Verification

All 96 files are 512 × 640 RGBA PNGs. No significant sprite pixels touch any extraction boundary or are clipped by an output frame. The minimum significant-alpha frame margin is 26 px. Light and dark background previews, source extraction checks, and rotor composites were reviewed. This workspace contains artwork exports, not the game source; live game integration was not run.
