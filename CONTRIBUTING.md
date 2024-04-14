# Contributing to Domain Digger

> Read [SETUP.md](./SETUP.md) for how to run the app locally or deploy it 👀

Small bug fixes are always very much welcome. For features you're encouraged to open an issue first.

## Code Style

Unless otherwise required by Next.js, components are created as arrow functions annotated with `FC` and exported as named.

Files are named in kebab-case (e.g. `bookmarklet-link.tsx`).

The codebase can and should be formatted with Prettier using `pnpm format`.

## Testing

The UI may remain untested for now, while the core business logic located in `/lib` should have appropriate tests. Tests are run through Vitest.

## Submitting changes

Once submitted as PR, all changes will receive a preview deployment through Vercel.
