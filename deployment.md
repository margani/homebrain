# HomeBrain Static Deployment

HomeBrain is now a static SvelteKit SPA. The frontend is built with `@sveltejs/adapter-static`, `ssr = false`, and an `index.html` fallback for nested route refreshes.

## Production Domains

- Frontend: `https://home.whosane.dev`
- PocketBase backend: `https://db.home.whosane.dev`
- Public environment variable: `PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev`

## Cloudflare Pages

Cloudflare Pages is the primary deployment target.

1. Push the HomeBrain repository to GitHub.
2. In Cloudflare, create a Pages project from the GitHub repository.
3. Set the build command:

   ```sh
   npm run build
   ```

4. Set the build output directory:

   ```text
   build
   ```

5. Add the production environment variable:

   ```text
   PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev
   ```

6. Optionally add the repository URL so the footer version hash links to GitHub:

   ```text
   PUBLIC_REPOSITORY_URL=https://github.com/margani/homebrain
   ```

   `PUBLIC_GIT_COMMIT` and `PUBLIC_BUILD_TIME` are populated during `npm run build`. Cloudflare Pages provides the commit SHA as `CF_PAGES_COMMIT_SHA`; local builds fall back to git.

7. Add the production custom domain:

   ```text
   home.whosane.dev
   ```

8. Configure Pages fallback/rewrite behavior so all app routes serve `index.html`. This is required for refreshes like `/today`, `/things/:id`, and `/notes/:id`.

## PocketHost `pb_public`

Because the app is static, the built files can also be copied to PocketHost/PocketBase `pb_public`.

1. Run:

   ```sh
   npm run build
   ```

2. Upload or copy the contents of `build/` into the PocketBase `pb_public` directory.
3. Ensure the static server falls back to `index.html` for nested routes.

The earlier generic PocketHost placeholder `https://YOUR-INSTANCE.pockethost.io` referred to the original backend target. Production now uses `https://db.home.whosane.dev`.

## PocketBase CORS

Configure the PocketBase backend at `https://db.home.whosane.dev`.

Allowed origins:

```text
https://home.whosane.dev
http://localhost:5173
```

Confirm the `users` collection supports the intended login methods:

```text
users.oauth2.enabled = true
email/password auth enabled if you want the fallback login form
```

## Google OAuth

Configure Google OAuth for the production frontend and PocketBase redirect.

Authorized JavaScript origin:

```text
https://home.whosane.dev
```

Authorized redirect URI:

```text
https://db.home.whosane.dev/api/oauth2-redirect
```

The OAuth redirect URI points to PocketBase, not Cloudflare.

## Smoke Test

- App loads from static files.
- Google login works.
- Email/password login works.
- Refreshing `/today` keeps the browser PocketBase session.
- Refreshing nested routes like `/things/[id]` serves `index.html`.
- Quick Capture works.
- Inbox review/link/activity actions work.
- Activities page loads.
- Create/edit Thing works.
- Reflection save works.
- Dashboard loads.
- Logout clears the browser auth store.
- No CORS errors appear in the browser console.
