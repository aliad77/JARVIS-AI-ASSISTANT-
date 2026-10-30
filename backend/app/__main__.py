"""Start the JARVIS local server: ``python -m app``.

Always binds to a loopback address (validated in :mod:`app.config`).
"""

from __future__ import annotations

import logging

import uvicorn

from app.config import get_settings


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = get_settings()
    print(f"\n  JARVIS is starting at http://{settings.host}:{settings.port}\n")
    uvicorn.run("app.main:create_app", factory=True, host=settings.host, port=settings.port,
                proxy_headers=False, server_header=False, log_level="info")


if __name__ == "__main__":
    main()
