# Madhusree Private Limited — WebGL site

An Indian spice export site built with Three.js, GSAP and Lenis. Seven pages,
five scroll-scrubbed 3D acts, and a procedurally generated spice library.

> `src/brand.js` holds the company name, tagline, contact details, sourcing
> belts, markets and the product range. Change it there and every page follows.
> It reads optional `VITE_*` overrides via `import.meta.env`, so a deployment
> can set them without touching code — but every value has a working default,
> and there is no `.env` in the repo.

## Claims policy

This is a new business, so the site deliberately makes **no** claim it cannot
support: no years of experience, shipment volumes, countries served,
certifications, laboratory testing, verified product specifications, direct
farmer relationships, or facilities and staff. Future intent is phrased as
intent — "our aim", "we are building", "we focus on".

That policy is enforced in one place. `src/brand.js` holds the product range,
market *categories* (not a destination list), buyer types and process steps, and
`ui/content.js` renders every page section from it. If a grade, percentage,
colour value or heat unit is not in the data, it cannot reach a page by
accident. Add them — and any certification or destination list — only once they
are verified for the product actually being sold.

**Placeholders to replace before launch:** the phone number, email and address
in `CONTACT` are not real.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

## Pages

A real multi-page build — `vite.config.js` lists each HTML file as an entry, so
navigation is a genuine document load rather than a client-side router.

| Page | Contains |
|---|---|
| `index.html` | The five scrubbed acts, product cards, buyer feedback, FAQ |
| `about.html` | Story, sourcing belts, operating principles — globe in the hero |
| `products.html` | The five spices in detail with grades and packing options |
| `markets.html` | Nine export markets and the buyer types we serve |
| `insights.html` | Crop notes and export guidance |
| `careers.html` | Filterable role board with expandable rows |
| `contact.html` | Validated enquiry form, sourcing offices — globe in the hero |

Header, drawer and footer render once from `ui/chrome.js` into `data-chrome`
placeholders, all reading from `brand.js`. `ui/transition.js` wipes a curtain
over each navigation, which also covers the first paint while WebGL warms up.

## Architecture

Every 3D moment shares **one** `WebGLRenderer` on a single fixed canvas. Each
scene is a "view" bound to a transparent stage element; each frame the renderer
walks the views, scissors the canvas to that element's box and draws only that
view. Off-screen views are skipped.

### Acts

The home page is a scroll-scrubbed sequence. Five sections share the same shell
— a tall `.act__track`, a sticky `.act__pin`, a transparent stage, and copy
staged against scroll progress:

| Act | Track | Scene | What scroll drives |
|---|---|---|---|
| Hero | 260vh | `gl/globe.js` | Dot globe on a land mask, export lanes leaving Indian ports with cargo motes riding them, ember field and orbit ring; the back half dives into a warm haze |
| Range | 520vh | `gl/spice.js` | Spice pours onto a heap, crossfading through all five products — grain colour and heap texture together |
| Handling | 420vh | `gl/lift.js` | A reach stacker takes a box off a stack and carries it out |
| Farm to port | 460vh | `gl/road.js` | Highway swept from a spline; the truck is driven along the curve |
| Departure | 620vh | `gl/departure.js` | Dusk apron with a lane streaking out to every market, camera lifting off the deck until the whole fan is in frame |

`ui/page-motion.js` carries the inner pages, which are type and cards rather
than 3D: header parallax, a spine that fills down the sourcing timeline and
lights the belt in view, media that uncovers by clip-path with a counter-moving
photo inside it, and grids that sweep in on a stagger. `ui/tilt.js` leans cards
toward the cursor. All of it no-ops under reduced-motion.

The header is fixed and stays put — it picks up a backing once you leave the
hero but never retracts on scroll.

`ui/stages.js` is the generic driver: anything inside a track carrying
`data-stage="in,out"` fades and lifts across that window of the track's
progress, so copy lands in step with the 3D.

### Stacking model

The shared canvas sits at `z-index: 1` — above section backgrounds
(`section::before`, `z-index: 0`) but below copy (`.wrap`, `z-index: 2`).

- `position: sticky` creates a stacking context, so `.act__pin` is lifted to
  `z-index: 2` or its staged copy paints beneath the canvas.
- A GL stage must be transparent all the way up to the root. The service tiles
  draw their dark panel *inside* the Three.js scene; the CSS background is only
  a `has-webgl`-gated fallback.

### Transparent sorting

Three.js sorts transparent objects by their *object origin*, not by where their
geometry sits. The road ribbon bakes absolute world coordinates into its
vertices, so its origin is at (0,0,0) — nowhere near the tarmac it draws, which
let it paint over the truck. The road and lift acts set `renderOrder` explicitly
rather than relying on the sort.

## Assets

**Spices** (`public/assets/spice/*.webp`) are generated procedurally — turmeric
and chilli as dense fine granules over a deep base, cumin/coriander/pepper as
heaped seed fields with per-grain shading and a specular. No stock photography.

**Freight cutouts** (`public/assets/*.webp`) were extracted from the source SVGs
in the repo root: each wrapped an RGB bitmap plus a separate luminance mask,
composited into RGBA and trimmed. The three `container-*.webp` sprites were cut
out of the combined container asset so the lift act can move a single box.
`land-mask.png` is a thresholded equirectangular world map for the globe's dots.

### Sprite orientation

Three cutouts face a fixed direction and the scenes are built around it. Change
an asset and these need revisiting:

- **reach-stacker** — boom reaches LEFT, so the stack sits to its left and the
  machine works in from the right. The spreader beam was measured off the
  artwork (14% across, underside 21.8% down) so the load hangs off it correctly.
- **truck-yard** — cab is at the LEFT, so its nose is -X; the road act adds half
  a turn to the spline tangent.

## Palette

White, black and orange only — no blue anywhere in the CSS or the shaders.
`--primary` is the orange, `--secondary` the warm gold. Large fills are
**black-to-orange gradients** rather than flat colour: the ticker, the CTA
bands, button faces and tile hovers all run from ink into ember, so orange
reads as an accent rather than a wash. The globe's dive warms
into ember rather than cooling to daylight, since it is heading for the growing
belts rather than open water.

## Loading

Three things keep first paint quick:

1. **The stylesheet is linked from the HTML `<head>`**, not imported from JS.
   Importing it from an entry module meant Vite's dev server served it as a
   JS module that injected styles at runtime — a guaranteed flash of unstyled
   HTML in `npm run dev`. As a plain `<link>` it is render-blocking in both dev
   and build.
2. **Fonts are linked in the HTML too**, rather than pulled in by a CSS
   `@import`. An `@import` at the top of the stylesheet forces a second serial
   round-trip before anything can paint; a `<link>` fetches in parallel.
3. **The deferred chunks are not modulepreloaded.** Vite preloads a chunk's
   dependencies by default, which meant ~550kB of three.js was fetched at high
   priority on first paint and starved the stylesheet. `build.modulePreload`
   filters those out — see `vite.config.js`.

Beyond that, `ui/lazy-gl.js` watches the GL stages and only imports the scene
bundle once one comes within ~700px of the viewport. Typical production split:

| Chunk | gzip | When |
|---|---|---|
| page entry + CSS | ~10 kB | immediately |
| `motion` (GSAP + Lenis) | ~50 kB | immediately |
| `three` | ~137 kB | deferred until a stage nears the viewport |
| act bundle (`mount-home`) | ~7 kB | with three |

## Notes

- Honours `prefers-reduced-motion`: smooth scroll off, reveals disabled, lower
  particle counts, shorter tracks.
- Degrades without WebGL via the `has-webgl` class.
- **The contact form has no backend.** It validates and says plainly that
  nothing was sent. Point the form action at your endpoint to go live.
- Fonts are Google-hosted (Archivo / Inter / Space Mono).
