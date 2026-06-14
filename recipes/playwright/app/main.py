from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

_COUNTER = 0


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return f"""<!DOCTYPE html>
<html>
  <head><title>Islo Recipe Counter</title></head>
  <body>
    <h1 id="title">Counter</h1>
    <p id="count">{_COUNTER}</p>
    <button id="increment" type="button">Increment</button>
    <script>
      document.getElementById('increment').addEventListener('click', async () => {{
        const res = await fetch('/increment', {{ method: 'POST' }});
        const data = await res.json();
        document.getElementById('count').textContent = data.count;
      }});
    </script>
  </body>
</html>"""


@app.post("/increment")
def increment() -> dict[str, int]:
    global _COUNTER
    _COUNTER += 1
    return {"count": _COUNTER}
