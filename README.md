# Isol Design

Brand pages and component POCs for Isol, published with GitHub Pages.

- `public/` is the site. `public/brand/` and `public/poc/` are copies, not the source.
- The source lives in the Isol repo (`brand/` and `poc/`). After changing it there, run `./sync.sh` (or `./sync.sh /path/to/Isol`) to refresh `public/`. `public/index.html` is the only page edited here.
- Publish `public/` with GitHub Pages (configured in the repo settings).

Preview locally: `python3 -m http.server -d public` and open http://localhost:8000.
