# Tiny House Games

Source for [tinyhousegames.com](https://tinyhousegames.com), home of small indie games from a tiny house.

## What's here

This repository holds only the published static site:

- `index.html`: the landing page skeleton
- `css/`: styles (`base`, `aurora`, `nav`, `sections`)
- `js/`: small ES modules, no build step
  - `nav.js`: scroll to top on tab change
  - `aurora.js` + `aurora-shader.js`: a lightweight animated aurora background (WebGL). It renders at half resolution, caps at 30 fps, pauses in hidden tabs, respects reduced-motion settings, and falls back to a CSS gradient.
  - `games.js`: renders the games list from `games.json`

No trackers, no cookies, no third-party scripts. I don't want your data, I won't sell your data. Keep your filthy data out of my house.

## Support

If you like what we're making, you can [support us on Ko-fi](https://ko-fi.com/nathonlo).

## License

© 2026 Tiny House Games. All rights reserved.
