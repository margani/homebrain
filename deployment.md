# HomeBrain PocketHost Deployment

HomeBrain deploys as a static frontend to PocketHost/PocketBase `pb_public`. The deployment workflow builds the app, then uploads the contents of `build/` to the remote `pb_public/` directory over SFTP with SSH key authentication.

## Production Domains

- Frontend: `https://home.whosane.dev`
- PocketBase backend: `https://db.home.whosane.dev`
- Public environment variable: `PUBLIC_POCKETBASE_URL=https://db.home.whosane.dev`

## Automated GitHub Deployment

The workflow at `.github/workflows/deploy.yml` runs on every push to `main`. It can also be run manually from the GitHub Actions tab.

The workflow:

1. Checks out the repository.
2. Sets up Node.js.
3. Runs `npm ci`.
4. Runs `npm run check`.
5. Runs `npm run build`.
6. Writes the SSH private key from GitHub Secrets to `~/.ssh/id_ed25519`.
7. Adds the PocketHost host key with `ssh-keyscan`.
8. Uploads the contents of `build/` to `pb_public/` with SFTP.
9. Removes obsolete remote files so old hashed assets do not remain in `pb_public/`.

The workflow uploads `build/*` contents, not the `build` folder itself.

## SSH Key Setup

Generate an ed25519 deploy key on your local machine:

```sh
ssh-keygen -t ed25519 -C "github-actions-homebrain-pockethost"
```

Save it somewhere specific for this deployment, for example:

```text
~/.ssh/homebrain_pockethost_ed25519
```

Install the public key in PocketHost. In the PocketHost dashboard for the HomeBrain instance, add the contents of the `.pub` file to the instance's SSH/SFTP public keys or authorized keys area for the SFTP user.

Only install the public key in PocketHost. Do not upload the private key there.

## Required GitHub Secrets

Add these repository secrets in GitHub under Settings -> Secrets and variables -> Actions:

```text
POCKETHOST_SFTP_HOST
POCKETHOST_SFTP_PORT
POCKETHOST_SFTP_USERNAME
POCKETHOST_SSH_PRIVATE_KEY
```

Use the SFTP host, port, and username from PocketHost. Store the full private key contents in `POCKETHOST_SSH_PRIVATE_KEY`, including the begin and end lines.

Example private key shape:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Do not commit SFTP credentials or SSH private keys. Do not put them in `.env`.

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

The OAuth redirect URI points to PocketBase, not the static frontend.

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
