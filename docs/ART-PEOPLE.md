# Art for the citizens and the fish

The last two things on the map that are still drawn in code: the **citizens** walking between
their homes and their work, and the **fish** that leap in fish ponds and rivers. Everything follows
the existing art spec ([ART.md](ART.md), [ART-EXPANSION.md](ART-EXPANSION.md)) unless a section
says otherwise: the same papercraft style, light from the upper left, the wildlife frame.

**Status: the fish of every land and the whole cast of 12 citizens, with their winter clothes,
are delivered and in the game.** Until a piece comes the game keeps its code drawings: small figures
in 6 coat colours, all with one skin tone, and grey-silver fish (`src/render/ambient.ts`). The importer takes `art/incoming/people/` (refusing a name that isn't
in the guide) and the fish among the wildlife, and the map uses whatever has come: as soon as one
citizen's first walking frame is in, every walker is drawn from the cast delivered so far, and a
frame not yet painted falls back to that first walking frame. So one citizen can be sent alone and
checked in the game.

## The citizens

### What the game shows

| Part      | Today                                                                                                                        | With art                                                                                                                                 | Source        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Who walks | 1 walker for every 4 citizens, up to 6, each from a home to one of the nearest buildings that employ people, there and back. | The same, each walker one of the cast below, chosen so the same faces don't stand side by side, with a clothing colour of its own.       | `ambientFor`  |
| How       | A two-step leg swing, about 5 seconds each way; still with reduced motion.                                                   | The walk cycle; at each end a short pause in the standing frame (at home) or the working frame (at work).                                | `drawAmbient` |
| Size      | About 13 map units tall, one size for all.                                                                                   | Drawn at their own heights (children small, elders a little shorter), and the game varies each by up to 5% more, so no two adults match. | This guide    |
| Seasons   | The same all year.                                                                                                           | The winter clothing layer in winter, where winter brings snow (not the desert's, lake's or forest's).                                    | This guide    |

### The frame

| Measure      | Value                                                                                                                         | Source                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Frame        | 128 × 128 px, transparent, at tile scale (the tile 400 px wide), as the animals                                               | ART-EXPANSION.md, Wildlife |
| Anchor       | Bottom centre (64, 120): where the feet meet the ground                                                                       | ART-EXPANSION.md, Wildlife |
| Facing       | Right, three-quarter view from the upper left like the buildings; the game mirrors them to walk left                          | ART-EXPANSION.md, Wildlife |
| Adult height | About 64 px from sole to crown (tall 70, short 58). The game draws people 1.5 times tile scale, as the animals, so they read. | `SHOW_SCALE`               |
| Child height | 38 to 46 px; young teens about 52                                                                                             | This guide                 |
| Elder height | 56 to 62 px, some with a slight stoop, a cane or a stick                                                                      | This guide                 |
| Outline      | The same soft dark edge as the animals, so a figure reads against grass, sand and snow                                        | ART.md                     |

### Two layers: the person, and their clothes

Each frame comes as **two images** of the same size, painted to line up exactly:

1. **`citizen.N.frame.png`, the person**: skin, face, hair, head covering, shoes, trousers or skirt
   (in their own colours: denim, brown, dark green, undyed linen), and whatever they carry.
2. **`citizen.N.frame.clothes.png`, the top garment only** (shirt, tunic, smock, jacket, dress
   top): painted in **light greys and white**, with its folds and shadows, and nothing else. The
   game tints it to a colour from the palette below, so each person can walk in many colours
   without more painting.

A **winter clothing layer** (`citizen.N.frame.winter.clothes.png`) is optional: a coat, a scarf
or a knitted hat, painted the same way in greys. Without it, winter uses the summer clothes.

### Clothing colours (the game's palette)

The game gives each walker one of these, tinting the clothes layer (so paint the garment's
lightest light as white). Solarpunk and home-dyed: warm, earthy, a few bright notes.

| Colour     | Hex       | Source                              |
| ---------- | --------- | ----------------------------------- |
| Moss       | `#3F7A3A` | Today's walker coats (`ambient.ts`) |
| Brick      | `#C8553D` | Today's walker coats                |
| Cornflower | `#2A78D6` | Today's walker coats                |
| Ochre      | `#E0A33B` | Today's walker coats                |
| Plum       | `#7B5AA6` | Today's walker coats                |
| Teal       | `#2F6B6B` | Today's walker coats                |
| Rose       | `#D9798A` | New                                 |
| Sand       | `#CDB48A` | New                                 |

### Skin tones

Paint skin in the person layer (it is never tinted). Across the cast, each of these six tones is
used twice, so a settlement of any size shows the range. They are starting points; vary them a
little within the step, with the same warm light as everything else.

| Step | Swatch    | Source     |
| ---- | --------- | ---------- |
| 1    | `#4A2E1F` | This guide |
| 2    | `#6E4429` | This guide |
| 3    | `#9A6440` | This guide |
| 4    | `#C08A60` | This guide |
| 5    | `#DDB08C` | This guide |
| 6    | `#F0D2B8` | This guide |

### The cast

Twelve people, each recognisable at a glance from their outline: height, build, hair and what
they carry. Ages, sizes and skin tones spread across them; head coverings and hair as people wear
them. They are settlers in a hopeful, mended world: practical clothes, patched and cared for,
tools and baskets, nothing military or uniform.

| Id           | Age        | Height and build              | Skin | Hair and head                  | Carries                        | Source     |
| ------------ | ---------- | ----------------------------- | ---- | ------------------------------ | ------------------------------ | ---------- |
| `citizen.1`  | Adult      | Tall (70), lean               | 1    | Short locs                     | A coil of rope over a shoulder | This guide |
| `citizen.2`  | Adult      | Average (64), broad           | 4    | Hair tied back under a sun hat | A basket of vegetables         | This guide |
| `citizen.3`  | Adult      | Short (58), sturdy            | 2    | Headscarf                      | A watering can                 | This guide |
| `citizen.4`  | Adult      | Average (64), slim            | 6    | Red-brown bob                  | A tool bag                     | This guide |
| `citizen.5`  | Adult      | Tall (68), solid              | 3    | Shaved head, beard             | A plank on one shoulder        | This guide |
| `citizen.6`  | Adult      | Average (62), round           | 5    | Black hair in a bun            | A notebook and pencil          | This guide |
| `citizen.7`  | Adult      | Average (64), in a wheelchair | 4    | Short curls                    | A crate on the lap             | This guide |
| `citizen.8`  | Young teen | 52, gangly                    | 3    | Braids                         | A kite                         | This guide |
| `citizen.9`  | Child      | 42                            | 1    | Puffs                          | Nothing: running, arms out     | This guide |
| `citizen.10` | Child      | 38                            | 6    | Fair, tousled                  | A small bucket                 | This guide |
| `citizen.11` | Elder      | 60, slight stoop              | 2    | White hair, cap                | A walking stick                | This guide |
| `citizen.12` | Elder      | 58                            | 5    | Grey plait over a shoulder     | A shawl and a seed tin         | This guide |

### Frames for each person

| Frame                                  | What it shows                                                                                                | Source     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `walk.1`, `walk.2`, `walk.3`, `walk.4` | A four-step walk cycle (contact, passing, contact, passing), the arms swinging; children skip, elders amble. | This guide |
| `stand`                                | Standing at ease, facing right: shown at home between walks, and with reduced motion.                        | This guide |
| `work`                                 | At work: bending to the ground, lifting, or using what they carry. Shown at the workplace between walks.     | This guide |

The wheelchair user (`citizen.7`) has `roll.1`, `roll.2` (the wheels and hands moving) in place of
the walk cycle, with `stand` and `work` as the others.

Each of these comes as the person (`citizen.1.walk.1.png`) and the clothes
(`citizen.1.walk.1.clothes.png`), and optionally the winter clothes
(`citizen.1.walk.1.winter.clothes.png`): 6 frames × 2 layers for each person, so **144 images for
the cast**, and up to 72 more for winter.

## The fish

### What the game shows

| Where                                               | Today                                                                                        | Source       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| Every fish pond, and from Harmony 40, 2 river tiles | A silver fish leaps in an arc now and then, and rings spread where it lands. None in winter. | `ambientFor` |

The rings on the water stay drawn in code. The fish itself becomes art: three frames of one leap,
on the wildlife frame, facing right (the game mirrors it).

| Measure | Value                                                                                                                          | Source                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Frame   | 128 × 128 px, transparent, at tile scale; the fish about 30 px nose to tail                                                    | ART-EXPANSION.md, Wildlife |
| Anchor  | The fish's middle at the frame's centre (64, 64): the game moves it along its arc                                              | This guide                 |
| Frames  | `leap.1` rising out of the water, nose up, a few drops falling; `leap.2` at the top, level, curved; `leap.3` diving, nose down | This guide                 |

### Fish for each land

Each land has its own fish, so a desert oasis doesn't leap with trout. A land without its own uses
the valley's.

| Files                               | Fish                                                                  | Where it leaps                         | Source     |
| ----------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ---------- |
| `fish.leap.1.png` … `.3.png`        | A brown trout: olive-brown back, speckled flanks, silver belly        | The Reach's ponds and river            | This guide |
| `fish.coast.leap.1.png` … `.3.png`  | A sea trout: bright silver with a blue-grey back                      | The coast's ponds and river            | This guide |
| `fish.glen.leap.1.png` … `.3.png`   | An arctic char: dark back, pale spots, orange-red belly               | The Highland's ponds and stream        | This guide |
| `fish.desert.leap.1.png` … `.3.png` | A tilapia: silver-grey with faint bars and a hint of blue on the fins | The desert's ponds and the oasis river | This guide |

12 images for the fish. Deliver them to `art/incoming/wildlife/`, with the animals.

## Files

| Kind             | Files                                                                                                      | Count    | Source     |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| Citizens         | `citizen.1` … `citizen.12`, each `walk.1`–`.4` (or `roll.1`, `.2`), `stand`, `work`, as person and clothes | 144      | This guide |
| Optional: winter | The same frames' `.winter.clothes.png`                                                                     | up to 72 | This guide |
| Fish             | `fish.leap.1`–`.3`, and `.coast`, `.glen`, `.desert`                                                       | 12       | This guide |

Deliver the citizens to `art/incoming/people/` and the fish to `art/incoming/wildlife/`.

Paint in this order:

1. One adult (`citizen.2`) with all six frames and both layers, to settle the size and the
   clothes layer; send it on its own so it can be checked in the game.
2. The other adults, then the children and elders.
3. The valley's fish, then the other lands'.
4. The optional winter clothes.
