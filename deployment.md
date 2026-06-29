# HomeBrain Cloudflare Deployment

HomeBrain keeps its SvelteKit SSR architecture on Cloudflare. Do not convert it to a SPA for this deployment path: server loads, server actions, auth sync endpoints, and PocketBase writes continue to run through SvelteKit.

## Production Domains

- Frontend: `https://home.whosane.dev`
- PocketBase backend: `https://db.home.whosane.dev`
- SvelteKit public environment variable: `PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev`

The earlier generic PocketHost placeholder `https://YOUR-INSTANCE.pockethost.io` is replaced by the production backend domain `https://db.home.whosane.dev`.

## Cloudflare Pages

Use Cloudflare Pages as the primary deployment target.

1. Push the HomeBrain repository to GitHub.
2. In Cloudflare, create a Pages project from the GitHub repository.
3. Use Cloudflare's SvelteKit support with `@sveltejs/adapter-cloudflare`.
4. Set the build command:

   ```sh
   npm run build
   ```

5. Set the build output directory:

   ```text
   .svelte-kit/cloudflare
   ```

6. Add the production environment variable:

   ```text
   PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev
   ```

7. Add the production custom domain:

   ```text
   home.whosane.dev
   ```

8. Deploy from the connected GitHub repo.

After deployment, visit `https://home.whosane.dev` and confirm login, quick capture, inbox conversion, thing editing, search, and reflection saves still use the SvelteKit SSR/server-action flow.

## PocketBase And PocketHost

Configure the PocketBase backend at `https://db.home.whosane.dev` before testing production login.

1. Add the Cloudflare frontend URL to PocketBase allowed origins/CORS:

   ```text
   https://home.whosane.dev
   ```

2. Confirm the `users` collection has OAuth2 enabled:

   ```text
   users.oauth2.enabled = true
   ```

3. Keep the backend reachable at:

   ```text
   https://db.home.whosane.dev
   ```

## Google OAuth

Configure Google OAuth for the production frontend and PocketBase redirect.

1. Authorized JavaScript origin:

   ```text
   https://home.whosane.dev
   ```

2. Authorized redirect URI:

   ```text
   https://db.home.whosane.dev/api/oauth2-redirect
   ```

The OAuth redirect URI should point to PocketBase, not Cloudflare.

## Workers

Cloudflare Workers can also run `@sveltejs/adapter-cloudflare`, but treat this as optional and advanced. Use Cloudflare Pages first unless there is a specific need for a standalone Worker deployment or a custom Wrangler workflow.
