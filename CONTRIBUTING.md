# Contributing to Local Marketplace

## Who this is for

- **Solo founder + Cursor Auto Mode** (primary workflow)
- Future collaborators after MVP

## Session continuity

After every work session, update **[PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md)** (session log + Now/Next + build checklist).

## How to build a feature

1. Read [PROJECT_BACKLOG.md](./PROJECT_BACKLOG.md) and [docs/INDEX.md](./docs/INDEX.md).
2. Find the matching section in [docs/08-Cursor_Prompts.md](./docs/08-Cursor_Prompts.md).
3. Paste **one** prompt into Cursor Auto Mode with `@docs` references.
4. Run `npm run typecheck` (once app exists).
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`.

## Scope rules

- Check [docs/15-MVP_vs_Future_Features.md](./docs/15-MVP_vs_Future_Features.md) before adding features.
- Update [docs/04-API_Endpoints.md](./docs/04-API_Endpoints.md) and [docs/03-Database_Schemas.md](./docs/03-Database_Schemas.md) when changing contracts.

## Pull requests

1. Branch from `main`
2. Small, focused PRs (one system per PR when possible)
3. Include test notes from [docs/17-Testing_and_QA.md](./docs/17-Testing_and_QA.md)

## Secrets

Never commit `.env`, API keys, or `google-services.json` with real credentials.

## Questions / decisions

Log open product decisions in `PROJECT_BACKLOG.md` (or your own issue tracker).
