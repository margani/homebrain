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

## Automated PocketHost Deployments

The GitHub Actions workflow at `.github/workflows/deploy.yml` deploys to PocketHost on every push to `main`. It can also be started manually with `workflow_dispatch`.

The workflow:

1. Checks out the repo.
2. Sets `PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev`.
3. Runs:

   ```sh
   npm ci && npm run build
   ```

4. Installs `lftp`.
5. Uploads the contents of `build/` to the remote `pb_public/` directory over SFTP.

It uploads `build/*` contents, not the `build` folder itself.

Add these repository secrets in GitHub under Settings -> Secrets and variables -> Actions:

```text
POCKETHOST_SFTP_HOST
POCKETHOST_SFTP_USERNAME
POCKETHOST_SFTP_PASSWORD
POCKETHOST_SFTP_PORT
```

Use the SFTP values from PocketHost. If PocketHost does not specify a custom port, set `POCKETHOST_SFTP_PORT` to `22`.

Do not commit SFTP credentials or put them in `.env`; keep them only in GitHub Actions secrets.

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
