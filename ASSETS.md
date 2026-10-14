# Hero artwork

`public/hero-digital-palms.png` is original artwork created with the built-in image-generation tool for this site. It depicts stylized California palms, electric-blue and coral voxel fragments, and a Pacific sunset. It is an illustration, not a photograph of an exact location or a client project. The previous Unsplash photograph is no longer displayed.

Generation prompt:

> Use case: stylized-concept. Asset type: original website hero illustration, single square artwork, no typography or UI. Primary request: animation-inspired illustrated palm trees in a digitally surreal Southern California coastal sunset, for Cronoverse web development studio. Scene: the Pacific coastline at dusk, a small distant pier as a quiet silhouette, glowing sun above the sea and broad horizontal reflections. Subject: three iconic tall California fan palms with expressive sweeping angular fronds and slender trunks, unmistakably palm trees, graphic animation concept-art shapes, sophisticated illustrated shading, not photographic and not a childish cartoon. Digital surrealism: parts of the outer frond tips subtly become floating rectangular voxel fragments, tiny geometric blocks and delicate electric-blue rim lights; coherent whole palms, a dreamlike suspended digital atmosphere. Palette: predominantly deep midnight navy #0D1628 and electric blue #62C5FF with controlled coral-red #FF5E73 sunset light, a warm peach sun, very little other color. Strong aesthetic connection between natural SoCal sunset and futuristic digital art, polished art-directed editorial illustration. Composition: square 1536x1536 image, two main palm crowns centered at about 30% and 58% of image width in the upper half, a smaller distant palm near 80%; ample dark sky margin above crowns for a small website label, sun around 52% width and 42% height, visible water below; the lower third will be partially covered by a website banner, so keep important crowns and sun in the upper 60%. Medium contrast and rich navy shadows, gentle luminous edges rather than blown-out neon. Restrained pixel wisps, avoid busy circuitry, dense starfields or cyberpunk cities. No people, no text, no letters, no logos, no watermark, no frames, no website mockup.

## Particle accents

The continuous fractal-fume accents are procedural canvas geometry in `components/dust-surface.tsx`, inspired by the user's description of the Abyss trees in Crimson Desert. The electric-blue and signal-red surfaces remain solid while staggered blocks rise, subdivide twice, and fade. No game assets or raster textures are used. The effect respects reduced-motion settings and pauses when offscreen or the tab is hidden.

## Color direction

Midnight navy (#0D1628), electric blue (#62C5FF), and restrained signal red (#FF5E73) define the palette. Cool white (#F3F6FB) and pale blue (#D6EAFF) support the lighter sections. Red is reserved for small accents; continuous particle motion stays calm.

## Brand logo (bilingual)

The active brand is the approved "Cronoverse Horizon" artwork: a blue C (`#20B4FE`) holding a
coral rising sun (`#FB5A58`) split into three horizontal bands. It was supplied as
`Cronoverse-Website-Assets.zip` and its `brand/` folder is installed unchanged at
`public/brand/`, served at `/brand/...`. The SVGs are pure vector paths (no fonts, no
embedded bitmaps); the PNGs in `brand/png/` are transparent raster fallbacks at 800/1600px
(logos) and 64 to 1024px (mark).

| Use | File |
| --- | --- |
| Navbar, navy background (EN and ES) | `/brand/svg/cronoverse-logo-on-dark.svg` |
| Navbar, light background | `/brand/svg/cronoverse-logo-on-light.svg` |
| Footer lockup, English, navy background | `/brand/svg/cronoverse-lockup-on-dark.svg` (descriptor: WEBSITES + BUSINESS SOFTWARE) |
| Footer lockup, English, light background | `/brand/svg/cronoverse-lockup-on-light.svg` |
| Footer lockup, Spanish | **not supplied yet**, see below |
| Standalone icon | `/brand/svg/cronoverse-mark.svg` (square; PNGs in `brand/png/`) |
| Browser and home-screen icons | `/brand/favicon/` (`favicon.svg`, `favicon.ico`, 16/32/48/64px PNGs, `apple-touch-icon.png`, 192/512px app icons, `site.webmanifest`) |

The header and footer are both navy, so the page uses the on-dark files. The image already
contains the word "cronoverse"; no text wordmark is placed beside it. `components/home.tsx`
chooses the footer lockup from the current language (`FOOTER_LOCKUP`), and below a 420px
viewport it shows the descriptor-free logo because the descriptor would be too small to read.

**Spanish lockup.** The delivered pack contains no `cronoverse-lockup-es-on-dark.svg` /
`cronoverse-lockup-es-on-light.svg` (descriptor: SITIOS WEB + SOFTWARE EMPRESARIAL). Until
they are supplied, the Spanish footer uses the descriptor-free logo (the pack README rates it
suitable for both languages), so Spanish visitors never see the English descriptor. To
activate them: copy both files into `public/brand/svg/` and set `es` in `FOOTER_LOCKUP` to
`/brand/svg/cronoverse-lockup-es-on-dark.svg`.

`layout.tsx` declares the favicon set and `/brand/favicon/site.webmanifest` (the site had no
manifest before). Copies of `favicon.ico` and `apple-touch-icon.png` also sit at the site root
because browsers and iOS request those paths without being told to.

Previous mark: `public/cronoverse-saturn-eye-navy.png` (the Saturn eye) and its renditions
`cronoverse-mark-128.png` and `favicon-48.png` are kept for history and old external links,
but no page references them. `cronoverse-og.jpg` still shows the Saturn mark and should be
regenerated with the new logo.

## Served image renditions

The PNG files remain the editable masters. The page serves smaller copies made with sharp
(the image library Wrangler already installs):

| File | Made from | Settings |
| --- | --- | --- |
| `hero-*.webp` | `hero-*.png` (1254×1254) | WebP quality 80, effort 6 |
| `hero-*-800.webp` | `hero-*.png` | resized to 800px wide, WebP quality 78 |
| `cronoverse-mark-128.png`, `favicon-48.png` | `cronoverse-saturn-eye-navy.png` | Previous brand, no longer referenced |
| `cronoverse-og.jpg` | evening palms artwork + brand mark | 1200×630, navy panel with the hero headline, JPEG quality 84 |

The six hero scenes went from about 12.3 MB of PNG to about 1.25 MB of WebP (about 0.6 MB at
800px). Regenerate the renditions whenever a master changes.
