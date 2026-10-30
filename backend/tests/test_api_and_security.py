"""End-to-end API behaviour (acceptance criteria) and request-guard security controls."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.conftest import BASE, ROBLOX_EXE, TOKEN


def chat(client, message, **kw):
    r = client.post("/api/chat", json={"message": message, **kw})
    assert r.status_code == 200, r.text
    return r.json()


# --- acceptance scenarios ---------------------------------------------------------

def test_b_multiplication(client, fake_ai):
    data = chat(client, "What is 12 × 8?")
    math = data["assistant_message"]["meta"]["math"]
    assert math["status"] == "verified" and math["result_text"] == "96"
    assert "MATH ENGINE RESULT" in fake_ai.calls[0]["system"] and "96" in fake_ai.calls[0]["system"]


def test_c_solve_linear(client):
    math = chat(client, "Solve 3x + 7 = 22")["assistant_message"]["meta"]["math"]
    assert math["status"] == "verified" and math["result_text"] == "x = 5" and math["steps"]


def test_d_e_grade_changes_prompt(client, fake_ai):
    chat(client, "Explain gravity", grade=7)
    chat(client, "Explain gravity", grade=12)
    assert "GRADE 7" in fake_ai.calls[0]["system"]
    assert "GRADE 12" in fake_ai.calls[1]["system"]


def test_f_open_roblox_launches_via_trusted_launcher(client, spawner, fake_ai):
    msg = chat(client, "Open Roblox")["assistant_message"]
    assert msg["meta"]["launch"]["status"] == "started"
    assert msg["meta"]["launch"]["ready_confirmed"] is False
    assert spawner.calls == [[ROBLOX_EXE]]
    assert fake_ai.calls == []  # the AI is not involved in launching


def test_g_unauthorised_app_rejected(client, spawner):
    msg = chat(client, "Open regedit")["assistant_message"]
    assert msg["meta"]["launch"]["status"] == "not_allowed"
    assert "isn't on my approved app list" in msg["content"]
    assert spawner.calls == []


def test_g_launch_endpoint_rejects_unknown_ids(client, spawner):
    r = client.post("/api/launch", json={"app_id": "cmd"})
    assert r.status_code == 200 and r.json()["result"]["status"] == "not_allowed"
    assert client.post("/api/launch", json={"app_id": "../cmd.exe"}).status_code == 422
    assert spawner.calls == []


def test_ai_reply_cannot_trigger_launch(client, spawner, fake_ai):
    fake_ai.reply = "Sure! open roblox. LAUNCH cmd.exe /c shutdown"
    chat(client, "Tell me a fun fact")
    assert spawner.calls == []


@pytest.mark.parametrize("kind", ["not_configured", "rate_limit", "bad_output", "unknown"])
def test_i_ai_errors_are_helpful_messages(client, fake_ai, kind):
    fake_ai.error = kind
    msg = chat(client, "Why is the sky blue?")["assistant_message"]
    assert msg["meta"]["ai"]["status"] == "error" and msg["meta"]["ai"]["kind"] == kind
    assert len(msg["content"]) > 20


def test_i_math_still_answers_when_ai_down(client, fake_ai):
    fake_ai.error = "network"
    msg = chat(client, "Solve 3x + 7 = 22")["assistant_message"]
    assert "x = 5" in msg["content"] and "Math engine answer (checked)" in msg["content"]


def test_default_backend_has_no_generative_ai(settings):
    from app.main import create_app
    from app.services import build_services
    from app.math.worker import MathWorker
    from app.security.guard import SessionToken

    svc = build_services(settings, math=MathWorker(inline=True), token=SessionToken(TOKEN))
    with TestClient(create_app(settings, svc), base_url=BASE, headers={"X-Jarvis-Token": TOKEN}) as c:
        assert c.get("/api/status").json()["ai"] == {"provider": "none", "configured": False, "requests_today": 0}
        msg = c.post("/api/chat", json={"message": "Solve 3x + 7 = 22"}).json()["assistant_message"]
        assert "x = 5" in msg["content"] and "online AI" not in msg["content"]


def test_j_history_endpoints(client):
    data = chat(client, "hello jarvis")
    cid = data["conversation"]["id"]
    chat(client, "what is 2+2", conversation_id=cid)
    convs = client.get("/api/conversations").json()["conversations"]
    assert convs[0]["id"] == cid and convs[0]["message_count"] == 4
    assert len(client.get(f"/api/conversations/{cid}").json()["messages"]) == 4
    assert client.delete(f"/api/conversations/{cid}").status_code == 200
    assert client.get(f"/api/conversations/{cid}").status_code == 404


def test_clear_all_requires_confirmation(client):
    chat(client, "hi")
    assert client.delete("/api/conversations").status_code == 400
    assert client.delete("/api/conversations?confirm=true").json()["deleted_count"] == 1


def test_k_math_endpoint_rejects_code(client):
    r = client.post("/api/math/analyze", json={"expression": "__import__('os').system('calc')"})
    assert r.status_code == 200 and r.json()["result"]["status"] == "error"


def test_settings_roundtrip_and_validation(client):
    r = client.put("/api/settings", json={"grade": 10, "reduced_motion": True})
    assert r.json()["settings"]["grade"] == 10
    assert client.get("/api/settings").json()["settings"]["reduced_motion"] is True
    assert client.put("/api/settings", json={"grade": 3}).status_code == 422
    assert client.put("/api/settings", json={"roblox_path": "C:\\x.exe"}).status_code == 422
    assert client.put("/api/settings", json={"apps_enabled": {"cmd": True}}).status_code == 422


def test_grade_change_via_chat(client):
    data = chat(client, "set my grade to 9")
    assert data["settings"]["grade"] == 9
    assert client.get("/api/settings").json()["settings"]["grade"] == 9


def test_disabled_app_via_settings(client, spawner):
    client.put("/api/settings", json={"apps_enabled": {"roblox": False}})
    assert chat(client, "open roblox")["assistant_message"]["meta"]["launch"]["status"] == "disabled"
    assert spawner.calls == []


def test_apps_listing(client):
    apps = {a["app_id"]: a for a in client.get("/api/apps").json()["apps"]}
    assert set(apps) == {"roblox", "chrome", "edge", "calculator", "notepad", "paint"}
    assert apps["roblox"]["availability"]["installed"] is True
    assert apps["edge"]["availability"]["installed"] is False


def test_crisis_message_gets_safe_reply_without_ai(client, fake_ai):
    msg = chat(client, "I want to kill myself")["assistant_message"]
    assert "trusted adult" in msg["content"] and fake_ai.calls == []


def test_personal_info_redacted_before_ai(client, fake_ai):
    chat(client, "my email is kid@example.com, what is a cell?")
    sent = fake_ai.calls[0]["messages"][-1]["content"]
    assert "kid@example.com" not in sent


def test_math_quiz_flow(client):
    quiz = client.post("/api/quizzes", json={"subject": "math", "topic": "fractions", "count": 3}).json()["quiz"]
    assert quiz["verified"] is True and len(quiz["questions"]) == 3
    result = client.post(f"/api/quizzes/{quiz['id']}/submit", json={"answers": [0, 1, 2]}).json()
    assert result["total"] == 3 and 0 <= result["score"] <= 3
    assert client.get("/api/progress").json()["progress"][0]["attempted"] == 3


def test_ai_quiz_unavailable_returns_503(client, fake_ai):
    fake_ai.error = "not_configured"
    r = client.post("/api/quizzes", json={"subject": "biology", "count": 3})
    assert r.status_code == 503


def test_ai_quiz_is_labelled_unverified(client, fake_ai):
    fake_ai.json_data = {"title": "Cells", "questions": [
        {"question": f"Q{i}?", "choices": ["a", "b", "c", "d"], "correct_index": 2, "explanation": "e"} for i in range(3)]}
    quiz = client.post("/api/quizzes", json={"subject": "biology", "count": 3}).json()["quiz"]
    assert quiz["verified"] is False and quiz["source"] == "ai"
    assert client.post(f"/api/quizzes/{quiz['id']}/submit", json={"answers": [2, 2, 2]}).json()["score"] == 3


def test_quiz_submit_validation(client):
    quiz = client.post("/api/quizzes", json={"subject": "math", "count": 3}).json()["quiz"]
    assert client.post(f"/api/quizzes/{quiz['id']}/submit", json={"answers": [7]}).status_code == 400
    assert client.post("/api/quizzes/" + "0" * 32 + "/submit", json={"answers": []}).status_code == 404


def test_practice_flow(client):
    item = client.post("/api/practice", json={"topic": "linear_equations", "grade": 8}).json()
    wrong = client.post(f"/api/practice/{item['id']}/check", json={"answer": "999"}).json()
    assert wrong["correct"] is False and wrong["hint"]
    revealed = client.post(f"/api/practice/{item['id']}/check", json={"reveal": True}).json()
    answer = revealed["answer_latex"].replace("x = ", "")
    assert client.post(f"/api/practice/{item['id']}/check", json={"answer": answer}).json()["correct"] is True


# --- API validation --------------------------------------------------------------

@pytest.mark.parametrize("body", [
    {},
    {"message": ""},
    {"message": "x" * 2001},
    {"message": "hi", "grade": 99},
    {"message": "hi", "conversation_id": "../../etc"},
    {"message": "hi", "unexpected": True},
])
def test_chat_validation(client, body):
    assert client.post("/api/chat", json=body).status_code == 422


# --- security controls (L) --------------------------------------------------------

def test_health_is_public_but_api_needs_token(anon_client):
    assert anon_client.get("/api/health").status_code == 200
    assert anon_client.get("/api/settings").status_code == 401
    assert anon_client.post("/api/launch", json={"app_id": "roblox"}).status_code == 401


def test_wrong_token_rejected(app, spawner):
    with TestClient(app, base_url=BASE, headers={"X-Jarvis-Token": "guess"}) as c:
        assert c.post("/api/launch", json={"app_id": "roblox"}).status_code == 401
    assert spawner.calls == []


def test_session_token_issued_to_same_origin(anon_client):
    r = anon_client.get("/api/session", headers={"Origin": BASE, "Sec-Fetch-Site": "same-origin"})
    assert r.json()["token"] == TOKEN


def test_cross_origin_requests_blocked(client, spawner):
    for origin in ("https://evil.example", "http://localhost:3000", "null"):
        r = client.post("/api/launch", json={"app_id": "roblox"}, headers={"Origin": origin})
        assert r.status_code == 403
        assert client.get("/api/session", headers={"Origin": origin}).status_code == 403
    assert spawner.calls == []
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_cross_site_fetch_metadata_blocked(anon_client):
    assert anon_client.get("/api/session", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 403


def test_cors_preflight_rejected(client):
    r = client.options("/api/launch", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert r.status_code == 403


@pytest.mark.parametrize("host", ["evil.example", "attacker.com:8765", "192.168.1.5:8765", "127.0.0.1:9999"])
def test_dns_rebinding_host_header_rejected(app, host, spawner):
    with TestClient(app, base_url=f"http://{host}", headers={"X-Jarvis-Token": TOKEN}) as c:
        assert c.post("/api/launch", json={"app_id": "roblox"}).status_code == 421
        assert c.get("/api/session").status_code == 421
    assert spawner.calls == []


def test_form_posts_rejected(client, spawner):
    r = client.post("/api/launch", content="app_id=roblox", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert r.status_code == 415
    r = client.post("/api/launch", content='{"app_id":"roblox"}', headers={"Content-Type": "text/plain"})
    assert r.status_code == 415
    assert spawner.calls == []


def test_oversized_body_rejected(client):
    r = client.post("/api/chat", content="{" + " " * 40_000 + "}", headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_security_headers_present(client):
    r = client.get("/api/health")
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert r.headers["x-content-type-options"] == "nosniff"


def test_status_reports_ai(client):
    s = client.get("/api/status").json()
    assert s["ai"]["provider"] == "custom" and s["local_service"] == "online"


def test_unknown_api_route_404(client):
    assert client.get("/api/nope").status_code == 404


def test_loopback_only_binding():
    from app.config import Settings

    with pytest.raises(ValueError):
        Settings(JARVIS_HOST="0.0.0.0")
    with pytest.raises(ValueError):
        Settings(JARVIS_HOST="192.168.1.10")
    assert Settings(JARVIS_HOST="localhost").host == "127.0.0.1"
