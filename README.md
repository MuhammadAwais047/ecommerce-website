# 🛍️ NovaShop — Ecommerce Website

A responsive demo e-commerce storefront built with **vanilla JavaScript** — no frameworks, no build step, no API key. Loads 100 real products (with images) from the free DummyJSON API.

🔗 **Live demo:** https://muhammadawais047.github.io/ecommerce-website/

## Features

**Catalog**
- 100 real products with photos, categories, ratings, stock and discounts (DummyJSON API)
- Category filter + search (title / brand / category) with debounce
- Price range filter and 5 sort modes (featured, price ↑↓, top rated, A–Z)
- Quick-view modal with description, stock status and quantity stepper
- Skeleton loading states, offline-friendly error banner with retry

**Cart & checkout**
- Add / increase / decrease / remove — right from the product grid
- Cart persists in `localStorage` (survives reload)
- Slide-in cart drawer with subtotal, shipping rule (free over $50) and total
- Full demo checkout: validated contact / shipping / payment form with inline errors, auto-formatting card number and MM/YY expiry
- Order confirmation screen with generated order number (nothing is charged — it's a demo)
- Toast notifications, focus-trapped dialogs, `Esc` to close, reduced-motion support

## Tech stack

| Layer | Choice |
|---|---|
| Markup | Semantic HTML5, ARIA dialog/combobox patterns |
| Styling | Modern CSS (grid, custom properties, backdrop-filter, aspect-ratio) |
| Logic | Vanilla ES2020 JavaScript — zero dependencies, zero build |
| Data | [DummyJSON](https://dummyjson.com/) REST API (free, no key) |

## Getting started

```bash
# Option 1: just open it
open index.html

# Option 2: serve it (recommended)
python -m http.server 8080
# → http://localhost:8080
```

## Project structure

```
ecommerce-website/
├── index.html   # Catalog, quick-view, cart drawer, checkout + success dialogs
├── styles.css   # Light theme, responsive grid, drawer/modal animations
└── app.js       # Data layer, filtering, cart store, validation, rendering
```

## Notes

- The checkout performs **no network calls and stores nothing** — it exists to demonstrate form validation and state flow.
- XSS-safe rendering: all API strings are inserted via `textContent`, never raw HTML.
- Images fall back to generated placeholders if the CDN is unreachable.

## License

[MIT](LICENSE) © Muhammad Awais
