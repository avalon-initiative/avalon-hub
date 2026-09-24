# avalon-hub

The Avalon Hub client applications, as one npm workspace:

| App | What it is |
|---|---|
| [`apps/hub`](apps/hub) | The web app (Vue 3 + Vite + TypeScript): identity setup, friends, guilds, achievements, integrator discovery and connections. |
| [`apps/hub-app`](apps/hub-app) | A Tauri shell (desktop and mobile) around the same UI, for guild and friend presence without a game client open. Its `src-tauri/` is its own standalone Cargo package. |

Both talk to an `avalon-server` only through the published TypeScript SDK
(`@avalon-initiative/protocol-sdk`) and share the component library
`@avalon-initiative/common-ui`. The server, protocol and documentation of the
network live in [`avalon-protocol`](https://github.com/avalon-initiative/avalon-protocol); these
apps were moved here from its `apps/` directory, and the earlier history stays there.

Docs: [`docs/hub/`](docs/hub/README.md) and [`docs/hub-app/`](docs/hub-app/README.md).

## Install

Both packages come from GitHub Packages, which requires a token with `read:packages`
for the `@avalon-initiative` scope (the root `.npmrc` maps the scope and reads
`NODE_AUTH_TOKEN`):

```bash
export NODE_AUTH_TOKEN=<token with read:packages>   # or: $(gh auth token)
make install                                        # npm ci
```

## Develop

```bash
make hub-dev    # web app on http://localhost:5173
make app-dev    # desktop/mobile app (needs Tauri's system dependencies)
make check      # lint, type-check, tests, builds, cargo check for both apps
make help       # everything else
```

The apps default to `http://127.0.0.1:8080` for the server. If your node listens
elsewhere, set the server URL in a git-ignored `apps/hub/.env.local`:

```bash
echo 'VITE_AVALON_SERVER_URL=http://<node-address>:8080' > apps/hub/.env.local
```

For WebAuthn to work locally, the server's `AVALON_WEBAUTHN_ORIGIN` and
`AVALON_HUB_ORIGIN` must match the origin the app is served from
(`http://localhost:5173` by default).

## Release

Each product releases on its own, with its own tag prefix:

```bash
make release-hub VER=0.2.0 TITLE="Optional title"   # tag hub-v0.2.0-Optional-title
make release-app VER=0.2.0 TITLE="Optional title"   # tag app-v0.2.0-Optional-title
git push origin main --follow-tags
```

Each target runs that product's checks first and changes nothing if they fail, then
bumps only that product's version files (`apps/hub/package.json`, or for the app also
`Cargo.toml` and `tauri.conf.json`), commits, and creates the annotated tag. Pushing a
`hub-v*` tag builds the web bundle and attaches it to a GitHub Release; an `app-v*` tag
builds the Tauri bundles for Linux and attaches them.

## CI

`.github/workflows/` holds the pull-request CI and the two release workflows. GitHub
Actions is currently disabled on this repository, so they do not run yet. When it is
enabled, the install step needs to read the private `@avalon-initiative` packages:
either grant this repository access in those packages' settings, or add a
`PACKAGES_READ_TOKEN` secret with `read:packages`.

## License

Apache-2.0. See `LICENSE`.
