# HomeBrain

A SvelteKit + TypeScript foundation for a personal life and home memory app backed by PocketBase.

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

## Verification

```sh
npm run check
npm run build
```
