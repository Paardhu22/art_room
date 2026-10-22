# Art Room

A warm, quiet gallery for a growing artwork collection. Built with HTML, CSS,
and JavaScript; no package installation, framework, or runtime service is needed.
The collection contains the three earlier portfolio pieces and nine original
JavaScript location studies. The earlier images are local copies; the portfolio
is unchanged. The gallery is static; the optional live atelier uses Canvas 2D.

## Run

Requires Node.js 20 or later.

```sh
cd /home/paardhu/Projects/testing_random_shi/art_work
npm start
```

Open **http://127.0.0.1:4300**. Keep the terminal running while viewing the gallery.
Reload the browser after editing. If that port is occupied, use `PORT=4301 npm start`.

## Features

- Responsive gallery and list layouts.
- Subject filters, title/description search, and curated or alphabetical sorting.
- Full artwork viewer with previous/next controls, zoom, and original-image links.
- Escape to close, arrow keys to browse, focus restoration, and native modal focus containment.
- Pure warm light theme; layout preferences are saved in this browser.
- Art Grid page: an empty, large (finite) dot-grid canvas. Drag JavaScript artworks (drawn live, not images) onto it, add rough hand-drawn equation plots like `y = sin(x)`, type scribbled handwriting (double-click anywhere or use Write), and annotate with a pressure-sensitive pen. Everything snaps to the dots, works with touch and stylus, and the layout is saved in this browser. Export the whole board or one item as SVG.
- Phone pad: write on the Art Grid from a phone (and its pen), connected by USB cable, Bluetooth or Wi‑Fi.
  The phone becomes a dark writing pad with glowing blue dots; the ink lands on the grid. See below.
- Responsive WebP images and reduced-motion support.
- Nine live JavaScript sketches, with editable seeds and full-size PNG export.

The collection is file-based. There is no upload service or backend in this base.

## Add an artwork

1. Add images under `assets/artworks/`. Ideally include square 480, 800, and
   1200-pixel WebP versions; artwork is shown in full without cropping.
2. Add an entry to `artworks.js`: a unique `id`, `title`, `category`, `label`,
   `medium`, short `note`, `description`, descriptive `alt`, `palette`, `image`,
   `original`, and optional `srcset`. Copy an existing entry as a starting point.
3. Use `places`, `botanical`, or `geometry` as the category, or add a matching
   `data-filter` button to `index.html` for a new subject.

Counts, search, filters, sorting, and viewer navigation use this collection.
The artwork code can live separately; the gallery displays the rendered images.

## Nine locations, entirely drawn in JavaScript

The new series includes a Japanese pagoda, Venice, Petra, Santorini,
a Jaipur-inspired palace, an Angkor-inspired temple, Cappadocia, a Scottish
coastal castle, and an Andalusian courtyard. These are imagined studies inspired
by locations, not measured reconstructions of particular monuments.

Open **http://127.0.0.1:4300/artwork/studio.html** to choose a scene, change its
seed, rerender, or save a 1200 × 1200 PNG. The code icon in the artwork viewer
opens that piece in the atelier. `View source` opens its scene file.

- `artwork/scenes/`: nine separate scene compositions.
- `artwork/engine.js`: seeded randomness, paper texture, pigment washes, fine
  ink, cross-hatching, stone joints, foliage, rock contours, and water ripples.
- `artwork/architecture.js`: columns, domes, houses, steps, boats, and blossom.
- `artwork/catalog.js`: titles, palettes, location details, and default seeds.
- `artwork/collection.js`: generated gallery records for the new pieces.

All new geometry, colours, texture, and lettering come from Canvas drawing
commands. There are no photographs, AI-generated image files, external fonts,
or image-generation services involved in rendering the new series. The ordinary
gallery shows pre-rendered WebPs so visitors do not have to execute the drawings.

To regenerate images after editing the sketches (development only):

```sh
npm ci
npx playwright install chromium
npm run render:artwork
npm run build
```

Render only one piece with `npm run render:artwork -- pagoda` (or another ID from
the catalog). Set `CHROMIUM_PATH` to use an installed Chromium executable.
The renderer exports 480, 800, and 1200-pixel WebPs with fixed seeds. Altering a
seed changes small drawn details while preserving the scene's composition.

With the built preview running, `npm run check:artwork` checks all nine sketches,
repeatable output, seeded variation, the 12-piece collection, and viewer controls.
`ART_ROOM_TEST_URL` changes the test server origin.

## Phone pad

On the Art Grid, turn on **Pen** and pick **Phone pad**. Choose how the phone connects, then scan the code
with the phone. The phone becomes a writing pad: a dark copy of the grid's visible area, with blue dots that
glow around the pen. What you write appears on the Art Grid as ordinary ink, in the grid's own colours and
sizes, so undo, the eraser, saving and SVG export treat it like the pen tool's. Pen pressure carries through,
and a small ring on the grid shows where the phone's pen is hovering. With a stylus, fingers pan and pinch the
grid. Without one, one finger writes and two fingers move. The pen's eraser end or side button erases.

```sh
npm run pad      # like npm start, but phones on your network can reach it
```

- **Cable** (Android): turn on USB debugging and plug the phone in. While the Phone pad panel is open on
  Cable, the server runs `adb reverse`, so the phone opens `localhost:4300/pad` over the cable. This is the
  most precise link: the page counts as secure, so the browser hands over every pen sample
  (`pointerrawupdate`) within a few milliseconds. `npm start` is enough for this mode. Without adb, USB
  tethering (Android) or Personal Hotspot over the cable (iPhone) works with `npm run pad`.
- **Bluetooth**: pair the phone, turn on Bluetooth tethering on it and join it from the computer. The panel
  finds the Bluetooth network and shows its address. Browsers can't talk to each other over raw Bluetooth,
  so the link runs over the Bluetooth network instead. It adds some delay.
- **Wi‑Fi**: phone and computer on the same network.

Several phones can write at once. The pairing code stays the same between visits, and the Phone pad stays
on across reloads until you press **Turn off** in its panel. The link is a small dependency-free WebSocket
relay in `scripts/pad-link.mjs`; `grid-pad.js` is the Art Grid's side and `pad/` is the phone's. A static host
has no relay, so the phone pad only works with the local server.

## Build

```sh
npm run check
npm run build
npm run preview
```

`dist/` contains only static files and assets and can be deployed to any static
host. `npm run preview` serves that build at the same local port; stop an existing
development server first. This project has no deployment or account configured.

The Manrope font and its license are included in `assets/fonts/`.
