"""Request guard for the local JARVIS service (pure ASGI middleware).

Defences, in order:

1. **Host allowlist** — only ``127.0.0.1:<port>``, ``localhost:<port>`` and
   ``[::1]:<port>`` are accepted. This defeats DNS-rebinding attacks, where a
   malicious site points its own domain at 127.0.0.1.
2. **Origin / Fetch-Metadata checks** on ``/api`` — a request carrying an
   ``Origin`` that is not JARVIS's own is rejected, as are cross-site
   ``Sec-Fetch-Site`` requests and CORS preflights. JARVIS sends no CORS
   headers, so other websites cannot read responses either.
3. **Session token** — every ``/api`` call except ``/api/health`` and
   ``/api/session`` must send ``X-Jarvis-Token``. The token is random per
   server start and is only handed to same-origin pages. A custom header also
   forces browsers to preflight cross-origin requests, which step 2 rejects.
4. **JSON-only bodies** with a size cap, so HTML forms cannot post to the API
   and oversized payloads are refused before parsing.
5. **Security headers** (CSP, no framing, no sniffing, no referrer).
"""

from __future__ import annotations

import json
import secrets
from typing import Any, Awaitable, Callable

MAX_BODY_BYTES = 32 * 1024
PUBLIC_API_PATHS = {"/api/health", "/api/session"}
TOKEN_HEADER = "x-jarvis-token"

SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"cross-origin-opener-policy", b"same-origin"),
    (b"cross-origin-resource-policy", b"same-origin"),
    (b"permissions-policy", b"camera=(), geolocation=(), microphone=(self)"),
    (b"content-security-policy",
     b"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
     b"font-src 'self' data:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co "
     b"https://raw.githubusercontent.com; worker-src 'self' blob:; manifest-src 'self'; media-src 'self'; "
     b"object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"),
]

Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


class SessionToken:
    def __init__(self, token: str | None = None):
        self.value = token or secrets.token_urlsafe(32)

    def matches(self, candidate: str | None) -> bool:
        return bool(candidate) and secrets.compare_digest(candidate.encode(), self.value.encode())


class BodyTooLarge(Exception):
    pass


async def _reject(send: Send, status: int, message: str) -> None:
    body = json.dumps({"detail": message}).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *SECURITY_HEADERS]
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class LocalGuardMiddleware:
    def __init__(self, app: Callable, *, allowed_hosts: set[str], allowed_origins: set[str],
                 token: SessionToken, max_body: int = MAX_BODY_BYTES):
        self.app = app
        self.allowed_hosts = {h.lower() for h in allowed_hosts}
        self.allowed_origins = {o.lower() for o in allowed_origins}
        self.token = token
        self.max_body = max_body

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        host = headers.get("host", "").lower()
        if host not in self.allowed_hosts:
            await _reject(send, 421, "JARVIS only answers requests addressed to localhost.")
            return

        path: str = scope.get("path", "")
        method: str = scope.get("method", "GET").upper()
        if path == "/api" or path.startswith("/api/"):
            origin = headers.get("origin")
            if origin is not None and origin.lower() not in self.allowed_origins:
                await _reject(send, 403, "Cross-origin requests are not allowed.")
                return
            fetch_site = headers.get("sec-fetch-site")
            if fetch_site in ("cross-site", "same-site") and origin is None:
                await _reject(send, 403, "Cross-site requests are not allowed.")
                return
            if method == "OPTIONS":
                await _reject(send, 403, "CORS is not supported by JARVIS.")
                return
            if path not in PUBLIC_API_PATHS and not self.token.matches(headers.get(TOKEN_HEADER)):
                await _reject(send, 401, "Missing or invalid JARVIS session token. Reload the page.")
                return
            if method in ("POST", "PUT", "PATCH", "DELETE"):
                length = headers.get("content-length")
                if length is not None:
                    try:
                        if int(length) > self.max_body:
                            await _reject(send, 413, "That request is too large.")
                            return
                    except ValueError:
                        await _reject(send, 400, "Invalid Content-Length.")
                        return
                has_body = (length not in (None, "0")) or "transfer-encoding" in headers
                ctype = headers.get("content-type", "").split(";")[0].strip().lower()
                if has_body and ctype != "application/json":
                    await _reject(send, 415, "JARVIS only accepts JSON requests.")
                    return
            receive = self._limited_receive(receive)

        async def send_with_headers(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                existing = {k.lower() for k, _ in message.get("headers", [])}
                message.setdefault("headers", [])
                message["headers"] = list(message["headers"]) + [h for h in SECURITY_HEADERS if h[0] not in existing]
            await send(message)

        try:
            await self.app(scope, receive, send_with_headers)
        except BodyTooLarge:
            await _reject(send, 413, "That request is too large.")

    def _limited_receive(self, receive: Receive) -> Receive:
        seen = 0

        async def wrapped() -> dict[str, Any]:
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_body:
                    raise BodyTooLarge()
            return message

        return wrapped
