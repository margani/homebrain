# HomeBrain PocketHost Deployment

HomeBrain deploys as a static frontend to PocketHost/PocketBase `pb_public`. The GitHub Actions workflow builds the app, stages the contents of `build/` into a temporary `pb_public/` folder, and deploys that PocketBase project folder with `phio`.

## Production Domains

- Frontend: `https://home.whosane.dev`
- PocketBase backend: same origin as the loaded app
- Public environment variable for PocketHost deploys: `PUBLIC_POCKETBASE_URL=` blank

## Why phio

Use `phio` instead of raw SFTP because it is the PocketHost-oriented deployment CLI. It avoids managing SFTP ports and manual remote paths in GitHub Actions. The workflow authenticates with PocketHost account credentials, selects the target instance, and runs a PocketHost deployment command.

The current phio CLI still uses an Ed25519 deploy key internally for its SFTP sync. In CI, provide a stable phio deploy key so a fresh GitHub runner does not generate a different key on every deploy.

## Automated GitHub Deployment

The workflow at `.github/workflows/deploy.yml` runs on every push to `main`. It can also be run manually from the GitHub Actions tab.

The workflow:

1. Checks out the repository.
2. Sets up Node.js 24 for the current `phio` CLI.
3. Runs `npm ci`.
4. Runs `npm run check`.
5. Runs `npm run build`.
6. Copies the contents of `build/` into a temporary deploy directory containing only `pb_public/`.
7. Installs the `phio` CLI and the `tsx` runner required by the current phio package.
8. Writes the stable phio deploy key from `PHIO_DEPLOY_PRIVATE_KEY` into `PHIO_HOME`.
9. Runs `phio deploy` against the PocketHost instance from `PHIO_INSTANCE`.

The workflow stages `build/*` contents into `pb_public/`, then runs `phio deploy` from that temporary deploy directory. The deployed PocketHost folder contains the app files directly rather than a nested `build` directory.

Because PocketBase serves the SPA from `pb_public`, the browser should call PocketBase on the current origin. The workflow leaves `PUBLIC_POCKETBASE_URL` blank so the app falls back to `window.location.origin` at runtime.

## Required GitHub Secrets

Add these repository secrets in GitHub under Settings -> Secrets and variables -> Actions:

```text
PHIO_USERNAME
PHIO_PASSWORD
PHIO_INSTANCE
PHIO_DEPLOY_PRIVATE_KEY
```

`PHIO_INSTANCE` should be the PocketHost instance name accepted by `phio link <instance>` and `phio deploy <instance>`.

`PHIO_DEPLOY_PRIVATE_KEY` should be an OpenSSH Ed25519 private key. The workflow derives the matching public key with `ssh-keygen -y` and writes it to phio's expected `phio_deploy_ed25519.pub` path.

Do not commit PocketHost credentials or private keys. Do not put them in `.env`.

## phio Deploy Key Setup

Generate an Ed25519 key for GitHub Actions:

```sh
ssh-keygen -t ed25519 -C "github-actions-homebrain-phio" -f ~/.ssh/homebrain_phio_deploy_ed25519
```

Add the private key contents to the GitHub repository secret:

```text
PHIO_DEPLOY_PRIVATE_KEY
```

Install the public key in PocketHost:

1. Open `https://pockethost.io/account/keys`.
2. Add or update the key labeled `Phio`.
3. Paste the contents of:

   ```text
   ~/.ssh/homebrain_phio_deploy_ed25519.pub
   ```

The key label must be `Phio`, because phio looks for that exact account key label during deploy.

If GitHub Actions reports:

```text
Account key "Phio" does not match the local key
```

replace the existing PocketHost Account -> Keys entry labeled `Phio` with the public key that matches `PHIO_DEPLOY_PRIVATE_KEY`, or delete the old `Phio` key and add the matching public key again.

## Local phio Workflow

Install and authenticate with `phio` locally:

```sh
npm install -g phio
phio login
phio link <instance>
```

Run the PocketHost-linked local development workflow:

```sh
phio dev
```

For a local deployment, build the static app and stage the output into a temporary PocketBase project folder before deploying:

```sh
npm run build
deploy_dir=$(mktemp -d)
mkdir -p "$deploy_dir/pb_public"
cp -a build/. "$deploy_dir/pb_public/"
cd "$deploy_dir"
phio deploy <instance>
```

## CI phio Workflow

GitHub Actions uses PocketHost credentials from secrets and runs:

```sh
phio deploy "$PHIO_INSTANCE"
```

The workflow also sets `PHIO_INSTANCE_NAME` from the same secret for phio's CI environment support and sets `PHIO_HOME` to a temporary directory populated from `PHIO_DEPLOY_PRIVATE_KEY`.

## PocketBase CORS

Configure the PocketBase backend at the same origin that serves the app.

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
https://home.whosane.dev/api/oauth2-redirect
```

The OAuth redirect URI points to PocketBase on the same origin that serves the static frontend.

## Smoke Test

- App loads from PocketHost `pb_public`.
- Google login works.
- Email/password login works.
- Refreshing `/today` keeps the browser PocketBase session.
- Refreshing nested routes like `/things/[id]` serves the static app fallback.
- Quick Capture works.
- Inbox review/link/activity actions work.
- Activities page loads.
- Create/edit Thing works.
- Reflection save works.
- Dashboard loads.
- Logout clears the browser auth store.
- No CORS errors appear in the browser console.
