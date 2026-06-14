# Copy this folder when adding a new recipe.

## Goal

One sentence describing what this recipe demonstrates.

## When to use

- Bullet points for when a customer should pick this recipe.

## Prerequisites

- Islo account and API key
- Python 3.10+ and [uv](https://docs.astral.sh/uv/)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |

## Quick start

```bash
cd islo-recipes/recipes/<recipe-id>
uv sync
cp .env.example .env
# edit .env

uv run python run.py
```

## Verify success

The last line of output should be:

```
PASS: <recipe-id>
```

## How it works

Brief architecture note. Use **computer** in prose; mention SDK names in code comments only.

## Troubleshooting

Common failures and fixes.

## Related recipes

- Link to related recipes in this repo.
