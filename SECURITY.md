# HomeBrain Security

HomeBrain is a static client-side SPA. There is no SvelteKit server runtime, no server actions, and no private backend secret in the frontend.

## Security Boundary

PocketBase collection rules are the security boundary.

Every user-owned collection must require the authenticated user to own the record:

```text
list/view/create/update: user = @request.auth.id
```

System prompts may also allow reads when `is_system = true`.

The frontend must not contain admin tokens, service keys, private OAuth secrets, or any other privileged credential. All reads and writes use the signed-in user's PocketBase auth token through the PocketBase JavaScript SDK.

## Deletion Policy

HomeBrain is a memory system. Prefer reviewed, dismissed, and archived states over hard delete.

- Notes/events are preserved and use review/dismiss archive-style metadata.
- Dismissed notes remain visible in `/notes` filters.
- Things may use `status = "archived"` instead of delete.
- The UI should not expose permanent delete actions.

The schema snapshot disables delete rules for events, locations, prompt answers, and things. If you apply schema changes manually in PocketBase, keep those delete rules disabled unless the product direction changes.

## OAuth And CORS

Production frontend origin:

```text
https://home.whosane.dev
```

Local development origin:

```text
http://localhost:5173
```

PocketBase OAuth redirect URI:

```text
https://db.home.whosane.dev/api/oauth2-redirect
```
