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

Set your PocketBase URL:

```sh
PUBLIC_POCKETBASE_URL=https://your-pocketbase.example.com
```

PocketBase should have Google OAuth and email/password auth enabled on the `users` collection. The app expects these collections from `pb_schema.json`:

- `locations`
- `things`
- `events`
- `routines`
- `prompts`
- `prompt_answers`

## Development

```sh
npm run dev
```

The development origin `http://localhost:5173` must be allowed in PocketBase CORS settings.

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
