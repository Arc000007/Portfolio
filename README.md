# Archit Bagad — Portfolio

Static HTML, CSS and JavaScript portfolio. No runtime dependencies or environment variables.

## Deploy to Vercel

Import this folder's Git repository into Vercel and deploy. The included `vercel.json` selects **Other**, runs `npm run build`, and publishes **dist**. Leave the root directory set to the folder containing this file.

Alternatively, run `vercel` from this folder with the Vercel CLI and follow its account/project prompts. Run `vercel --prod` when ready for a production deployment.

## Local checks

Run `npm run check` and `npm run build`. The build copies only the website, its three photos and résumé into `dist/`; it also checks that every local HTML asset is listed for publication. Open `index.html` directly or serve `dist/` with a local static server.

Edit content in `index.html`, styling in `style.css`, and desktop scroll animation in `main.js`. Images belong in `assets/`. Add any new local asset to `scripts/build.mjs` before deploying.

Small screens use native scrolling; reduced-motion mode displays a static page. Clipboard copying requires a secure context (Vercel provides HTTPS), with an email-link fallback.

Vercel configuration reference: https://vercel.com/docs/project-configuration/vercel-json
