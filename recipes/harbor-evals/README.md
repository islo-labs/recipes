# Harbor evals on Islo

Run [Harbor](https://github.com/harbor-framework/harbor) agent evaluations on Islo computers. Harbor is an **eval framework** (from the Terminal-Bench team), not a Docker registry.

## Goal

Confirm Harbor is wired to your Islo account by running the built-in `hello-world` dataset with the `oracle` agent.

## When to use

- Benchmarking coding agents on Islo at scale
- Before running full Terminal-Bench or custom Harbor datasets
- Learning how `--env islo` routes trials to Islo computers

## Prerequisites

- Islo account and API key — sign up at [app.islo.dev](https://app.islo.dev)
- Python 3.10+ and [uv](https://docs.astral.sh/uv/)
- Harbor with the Islo extra: `uv tool install 'harbor[islo]'`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |
| `ISLO_BASE_URL` | No | SDK control-plane URL (default `https://api.islo.dev`) |
| `ISLO_API_URL` | No | Harbor reads this; set to the same value as `ISLO_BASE_URL` |
| `ANTHROPIC_API_KEY` | For real agents | Model provider key when not using `oracle` |

## Quick start

```bash
cd islo-recipes/recipes/harbor-evals
uv sync
uv tool install 'harbor[islo]'

cp .env.example .env
# edit .env

export ISLO_API_KEY=...
export ISLO_BASE_URL=https://api.islo.dev
export ISLO_API_URL=https://api.islo.dev

uv run python run.py
```

### Full benchmark (optional)

```bash
uv run python run_terminal_bench.py
```

Override with `HARBOR_DATASET`, `HARBOR_AGENT`, `HARBOR_CONCURRENCY`.

New Harbor users: apply promo **`HARBOR250`** in [Billing](https://app.islo.dev) for $250 in Islo credits.

## Verify success

```
PASS: harbor-evals
```

Harbor should exit 0 after the `hello-world` task completes (~1 minute).

## How it works

`run.py` invokes:

```bash
harbor run --dataset hello-world --agent oracle --env islo
```

Harbor's Islo environment creates one computer per trial. See [Islo + Harbor docs](https://docs.islo.dev/integrations/harbor).

For anti-cheating egress during evals, see [`gateway-egress.example.yaml`](gateway-egress.example.yaml). For dependency allowlisting without Harbor, see [`gateway-allowlist`](../gateway-allowlist/).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `harbor: command not found` | Run `uv tool install 'harbor[islo]'` and ensure `~/.local/bin` is on PATH |
| Auth errors | Set both `ISLO_API_KEY` and `ISLO_API_URL` |
| Agent errors on full bench | Provide model provider API keys; start with `oracle` agent |

## Related recipes

- [`gateway-allowlist`](../gateway-allowlist/) — standalone egress allowlist for package installs
- [`web-app-e2e`](../web-app-e2e/) — your own app tests on Islo
