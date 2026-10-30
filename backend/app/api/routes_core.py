"""System, session, chat, history, settings and launcher endpoints."""

from __future__ import annotations

import sys

import sympy
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from app import __version__
from app.ai.orchestrator import ChatInput
from app.api.deps import get_services
from app.api.schemas import ChatRequest, LaunchRequest, NewConversationRequest, RobloxPathRequest
from app.database.preferences import PreferencesUpdate
from app.education.grades import normalise_grade
from app.education.subjects import MATH_TOPICS, MODES, SUBJECTS, normalise_mode, normalise_subject
from app.launcher.launcher import PathValidationError, RealFileSystem, validate_custom_path
from app.launcher.registry import APPS
from app.services import Services
from app.voice.settings import VOICE_LANGUAGES

router = APIRouter(prefix="/api")


# --- system ----------------------------------------------------------------

@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "jarvis", "version": __version__}


@router.get("/session")
def session(request: Request, svc: Services = Depends(get_services)) -> dict:
    # Only hand the token to JARVIS's own pages (or non-browser local tools).
    site = request.headers.get("sec-fetch-site")
    if site not in (None, "same-origin", "none"):
        raise HTTPException(403, "Session tokens are only issued to the JARVIS page.")
    return {"token": svc.token.value}


@router.get("/status")
def status(svc: Services = Depends(get_services)) -> dict:
    usage = svc.db.ai_usage_today()
    return {
        "version": __version__,
        "local_service": "online",
        "platform": sys.platform,
        "launcher_supported": sys.platform == "win32",
        "math_engine": f"SymPy {sympy.__version__}",
        "ai": {
            "provider": "none" if not svc.ai.configured else "custom",
            "configured": svc.ai.configured,
            "requests_today": usage["requests"],
        },
    }


@router.get("/catalog")
def catalog() -> dict:
    return {
        "subjects": SUBJECTS,
        "modes": MODES,
        "math_topics": MATH_TOPICS,
        "grades": [7, 8, 9, 10, 11, 12],
        "voice_languages": VOICE_LANGUAGES,
    }


# --- chat & history --------------------------------------------------------

@router.post("/chat")
def chat(body: ChatRequest, svc: Services = Depends(get_services)) -> dict:
    return svc.chat.handle(ChatInput(**body.model_dump()))


@router.get("/conversations")
def list_conversations(svc: Services = Depends(get_services)) -> dict:
    return {"conversations": svc.db.list_conversations()}


@router.post("/conversations")
def new_conversation(body: NewConversationRequest, svc: Services = Depends(get_services)) -> dict:
    prefs = svc.prefs.get()
    conv = svc.db.create_conversation(
        body.title or "New mission",
        normalise_grade(body.grade or prefs.grade),
        normalise_subject(body.subject or prefs.subject),
        normalise_mode(body.mode),
    )
    return {"conversation": conv, "messages": []}


def _conversation_or_404(svc: Services, cid: str) -> dict:
    if len(cid) != 32 or not all(c in "0123456789abcdef" for c in cid):
        raise HTTPException(404, "Conversation not found.")
    conv = svc.db.get_conversation(cid)
    if conv is None:
        raise HTTPException(404, "Conversation not found.")
    return conv


@router.get("/conversations/{cid}")
def get_conversation(cid: str, svc: Services = Depends(get_services)) -> dict:
    conv = _conversation_or_404(svc, cid)
    return {"conversation": conv, "messages": svc.db.get_messages(cid)}


@router.delete("/conversations/{cid}")
def delete_conversation(cid: str, svc: Services = Depends(get_services)) -> dict:
    _conversation_or_404(svc, cid)
    svc.db.delete_conversation(cid)
    return {"deleted": cid}


@router.delete("/conversations")
def clear_conversations(confirm: bool = Query(False), svc: Services = Depends(get_services)) -> dict:
    if not confirm:
        raise HTTPException(400, "Add ?confirm=true to delete every conversation.")
    return {"deleted_count": svc.db.clear_conversations()}


# --- settings --------------------------------------------------------------

@router.get("/settings")
def get_settings(svc: Services = Depends(get_services)) -> dict:
    return {"settings": svc.prefs.get().model_dump()}


@router.put("/settings")
def update_settings(body: PreferencesUpdate, svc: Services = Depends(get_services)) -> dict:
    try:
        prefs = svc.prefs.update(body.model_dump(exclude_none=True))
    except (ValidationError, ValueError) as exc:
        raise HTTPException(422, f"Invalid setting: {exc}") from exc
    return {"settings": prefs.model_dump()}


# --- apps / launcher -------------------------------------------------------

@router.get("/apps")
def list_apps(svc: Services = Depends(get_services)) -> dict:
    prefs = svc.prefs.get()
    apps = []
    for app in APPS.values():
        apps.append({
            "app_id": app.app_id,
            "display_name": app.display_name,
            "description": app.description,
            "enabled": prefs.apps_enabled.get(app.app_id, False),
            "supports_custom_path": bool(app.custom_path_names),
            "custom_path": prefs.roblox_path if app.app_id == "roblox" else None,
            "availability": svc.launcher.availability(app.app_id),
        })
    return {"apps": apps}


@router.post("/launch")
def launch(body: LaunchRequest, svc: Services = Depends(get_services)) -> dict:
    if not svc.limiter.allow("launch"):
        raise HTTPException(429, "Too many app launches. Wait a minute and try again.")
    return {"result": svc.launcher.launch(body.app_id).to_dict()}


@router.put("/apps/roblox/path")
def set_roblox_path(body: RobloxPathRequest, svc: Services = Depends(get_services)) -> dict:
    if body.path in (None, ""):
        prefs = svc.prefs.update({"roblox_path": None})
        return {"settings": prefs.model_dump(), "message": "Custom Roblox path cleared."}
    if sys.platform != "win32":
        raise HTTPException(400, "Roblox paths can only be configured on Windows.")
    try:
        path = validate_custom_path(APPS["roblox"], body.path, RealFileSystem())
    except PathValidationError as exc:
        raise HTTPException(400, str(exc)) from exc
    prefs = svc.prefs.update({"roblox_path": path})
    return {"settings": prefs.model_dump(), "message": "Roblox path saved."}
