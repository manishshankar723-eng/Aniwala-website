# Aniwala

Animation studio site. Astro (static) + Tailwind + GSAP/Lenis, deployed to
Hostinger shared hosting over FTP by GitHub Actions.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server at http://localhost:4321 |
| `npm run build` | Builds to `./dist` — exactly what gets uploaded |
| `npm run preview` | Serves `./dist` locally to check the real build |

## How a change goes live

Push to `main`. GitHub Actions builds and FTPs `dist/` into `public_html`.
Live in roughly 90 seconds. Watch it in the repo's **Actions** tab.

Hostinger runs PHP, not Node — it only ever receives finished HTML.
Never point the workflow at a Node runtime; there isn't one on this plan.

## One-time setup

1. **hPanel → Files → FTP Accounts** — note hostname, username, password.
2. **GitHub → Settings → Secrets and variables → Actions** — add
   `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
3. **hPanel → Websites → aniwala.com → Security → SSL** — install the free
   certificate and enable Force HTTPS.

## Layout

```
src/
├── layouts/Base.astro   Shell: SEO meta, fonts, view transitions, motion boot
├── lib/motion.ts        Lenis + GSAP/ScrollTrigger, reduced-motion guarded
├── pages/               Every file here becomes a route
└── styles/global.css    ALL design tokens — colour and type change here only
public/
├── .htaccess            HTTPS, canonical host, cache headers, 404
└── robots.txt
```

## Conventions

- Add `data-reveal` to any element that should rise and fade in on scroll.
  Add `data-reveal-delay="0.1"` to stagger it.
- Animate only `transform` and `opacity`. Anything else drops frames.
- Every motion feature must no-op under `prefers-reduced-motion`.
  `src/lib/motion.ts` handles this centrally — keep it that way.
- Images go through `astro:assets` so they build to AVIF/WebP.
  Never `<img src="/big.jpg">`.
- Video never lives on Hostinger. Bunny Stream or Vimeo, embed by ID.

## Second site

Goes to `aniwala.com/labs/` from its own repo, with `base: '/labs'` in its
Astro config and `server-dir: /public_html/labs/` in its workflow. This
repo's workflow already excludes `labs/**` so the two never overwrite
each other.
