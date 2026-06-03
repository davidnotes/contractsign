# contractsign

Web PDF signing tool built with React, TypeScript, and Vite.

## Development

```bash
npm install
npm run dev
```

## Deploy To Cloudflare Pages

Login once with Wrangler:

```bash
npx wrangler login
```

Then deploy:

```bash
npm run deploy:cloudflare
```

The deploy script runs `npm run build` and publishes `dist` to Cloudflare Pages.
By default it creates a production deployment. Set `CLOUDFLARE_PAGES_BRANCH` only
when you want a preview branch deployment.

Optional environment variables:

```bash
CLOUDFLARE_PAGES_PROJECT_NAME=contractsign
CLOUDFLARE_PAGES_BRANCH=main
CLOUDFLARE_PAGES_DIST_DIR=dist
```

For non-interactive CI deploys, also set Cloudflare credentials such as
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the CI environment.
