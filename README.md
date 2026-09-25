# Chronologos

A living atlas of thought. This first phase is the ambient 3D painting: an engraved Earth (Chronos) suspended inside a slow-moving constellation of notes (Logos).

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite. For a production bundle, run `npm run build`.

## Scene structure

- `src/scene/Chronos.jsx` renders the rotating 3D Earth and armillary rings.
- `src/scene/LivingEarth.jsx` adds slowly traveling golden route lights and coastal shimmer. These routes are decorative placeholders, not historical claims.
- `src/scene/earthTexture.js` draws a procedural antique atlas over real land geometry from `world-atlas`.
- `src/scene/Logos.jsx` draws all stars in one GPU point cloud and all relationships in one line geometry.
- `src/data/universe.js` owns the sample note and relationship records. Replace these records with real note data later; rendering does not need to know where the data came from.
- `src/scene/Planetarium.jsx` composes the scene and restrained bloom.

Quiet Mode has no persistent controls. The current sample data is illustrative, not a claim about historical authors or actual semantic relationships.

## Next milestones

1. Refine the live composition and textures on the intended panel display.
2. Add three works and approximately twenty of your real notes.
3. Add author-to-stars and star-to-source exploration.
4. Add durable note storage and semantic suggestions after the personal content loop is useful.
