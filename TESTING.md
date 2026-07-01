# Testing HomeBrain

HomeBrain uses a practical test suite focused on the capture, review, activity, Things, notes, and dashboard flows.

## Commands

```sh
npm run test:unit
npm run test:e2e
npm run test:ci
```

- `npm run test:unit` runs Vitest unit and component tests.
- `npm run test:e2e` runs Playwright browser smoke tests.
- `npm run test:ci` runs check, unit tests, build, then E2E tests.

## What Is Mocked

Unit tests use a lightweight PocketBase mock in `tests/utils/mockPocketBase.ts`. It supports the collection methods HomeBrain helpers use: `getList`, `getFullList`, `getOne`, `create`, `update`, and auth store state.

Playwright tests route all PocketBase API calls to an in-memory mock at `http://127.0.0.1:8090`. They do not call production PocketBase and do not require Google login.

## Current Coverage

- Date, formatting, activity duration, note metadata, and Things filtering helpers.
- Core PocketBase mutations: quick capture, log as activity, link to thing, add a need, add a metric observation, and routine done.
- Cache invalidation for inbox count, Things, and note/activity archive.
- Component behavior for Quick Capture, Inbox triage expansion, and Things list/tile mode.
- Browser smoke tests for login guard, Today, Inbox activity/need/metric logging, Activities, Things, Metrics, Notes, and Dashboard.

## Not Covered Yet

- Real PocketBase collection rules.
- Real Google OAuth.
- Visual regression tests.
- Full form coverage for every Thing and Reflection field.

## When To Add A Test

Add or update a test when changing:

- Quick Capture, Inbox, Notes, Activities, Things, Dashboard, or Reflection flows.
- Metadata semantics such as reviewed, dismissed, linked, or activity fields.
- Client caches or invalidation.
- PocketBase helper filters, sorts, or mutations.

Prefer small behavior tests over snapshots. Tests should protect product rules without depending on production data.
