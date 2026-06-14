## Architecture

Each recipe is a self-contained folder under `recipes/` with its own `pyproject.toml` and `uv.lock`.

## Recipe types

- **SDK recipes** — `run.py` orchestrator, `PASS: <id>` on success
- **Agent recipes** — Islo SDK + agent CLI or Claude Agent SDK inside a computer
- **Automation recipes** — GitHub Actions wiring (this repo)

## Review focus areas

- Recipe self-containment (no shared library)
- Correct GitSource paths (`/workspace/islo-recipes/recipes/<id>`)
- Customer-facing docs: no internal paths, no committed secrets
- CI: structure tests in `tests/`, live smoke for SDK recipes
