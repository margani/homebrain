# HomeBrain

A static SvelteKit + TypeScript SPA for a personal life and home memory app backed by PocketBase.

HomeBrain runs entirely in the browser and uses the PocketBase JavaScript SDK directly. PocketBase collection rules are the security boundary.

## Setup

Install dependencies:

```sh
npm install
```

Create an environment file:

```sh
cp .env.example .env
```

Set your PocketBase URL for local Vite development:

```sh
PUBLIC_POCKETBASE_URL=https://your-pocketbase.example.com
```

When the built app is served by PocketBase from `pb_public`, `PUBLIC_POCKETBASE_URL` can be blank. The browser will use the current origin.

PocketBase should have Google OAuth and email/password auth enabled on the `users` collection. The app expects these collections from `pb_schema.json`:

- `locations`
- `things`
- `events`
- `routines`
- `prompts`
- `prompt_answers`

Things may include a lightweight `category` text field. Metric-style observations are stored as `events` with `event_type = "metric"` and metric value/unit/label in event metadata.

## Development

```sh
npm run dev
```

The development origin `http://localhost:5173` must be allowed in PocketBase CORS settings. For local Google OAuth testing, add `http://localhost:5173` as an Authorized JavaScript origin and `http://localhost:5173/oauth2-redirect` as an Authorized redirect URI.

## Static Build

```sh
npm run build
```

The static app is emitted to `build/`. Deploy that directory to Cloudflare Pages or PocketBase/PocketHost `pb_public` with an `index.html` fallback for nested routes.

## Verification

```sh
npm run check
npm run build
```
