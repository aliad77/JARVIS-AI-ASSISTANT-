"""Math verification, practice problems, quizzes and progress endpoints."""

from __future__ import annotations

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query

from app.ai.prompts import quiz_prompt
from app.ai.provider import AIError
from app.api.deps import get_services
from app.api.schemas import MathRequest, PracticeCheckRequest, PracticeRequest, QuizRequest, QuizSubmitRequest
from app.education.grades import normalise_grade
from app.education.practice import GENERATORS, generate_problem
from app.education.quiz import AI_QUIZ_SCHEMA, QuizQuestion, build_math_quiz, parse_ai_quiz, score_quiz
from app.education.subjects import SUBJECTS
from app.services import Services

router = APIRouter(prefix="/api")


def _limit(svc: Services, bucket: str) -> None:
    if not svc.limiter.allow(bucket):
        raise HTTPException(429, "Slow down a little! Try again in a minute.")


@router.post("/math/analyze")
def analyze(body: MathRequest, svc: Services = Depends(get_services)) -> dict:
    _limit(svc, "math")
    return {"result": svc.math.analyze(body.expression, body.variable)}


# --- practice ----------------------------------------------------------------

@router.post("/practice")
def new_practice(body: PracticeRequest, svc: Services = Depends(get_services)) -> dict:
    if body.topic is not None and body.topic not in GENERATORS:
        raise HTTPException(400, "Unknown practice topic.")
    grade = normalise_grade(body.grade or svc.prefs.get().grade)
    problem = generate_problem(body.topic, grade)
    item_id = uuid.uuid4().hex
    svc.db.save_practice_item(item_id, problem.topic, grade, asdict(problem))
    return {"id": item_id, "topic": problem.topic, "grade": grade, "prompt": problem.prompt,
            "latex": problem.latex, "hint": problem.hint, "verified": True}


@router.post("/practice/{item_id}/check")
def check_practice(item_id: str, body: PracticeCheckRequest, svc: Services = Depends(get_services)) -> dict:
    _limit(svc, "math")
    item = svc.db.get_practice_item(item_id) if len(item_id) == 32 else None
    if item is None:
        raise HTTPException(404, "Practice problem not found.")
    payload = item["payload"]
    if body.reveal:
        return {"correct": False, "revealed": True, "answer_latex": payload["answer_latex"],
                "message": "Here's the answer. Try a new one to keep your streak going!"}
    result = svc.math.check_answer(payload["expected"], body.answer)
    if result.get("status") == "verified" and not item["solved"]:
        svc.db.record_progress("math", item["grade"], int(bool(result.get("correct"))), 1)
        if result.get("correct"):
            svc.db.mark_practice_solved(item_id)
    out = {"correct": bool(result.get("correct")), "status": result.get("status"), "message": result.get("message")}
    if result.get("correct"):
        out["answer_latex"] = payload["answer_latex"]
    else:
        out["hint"] = payload["hint"]
    return out


# --- quizzes -----------------------------------------------------------------

@router.post("/quizzes")
def create_quiz(body: QuizRequest, svc: Services = Depends(get_services)) -> dict:
    _limit(svc, "quiz")
    if body.subject not in SUBJECTS:
        raise HTTPException(400, "Unknown subject.")
    grade = normalise_grade(body.grade or svc.prefs.get().grade)
    topic = (body.topic or "").strip()
    if body.subject == "math":
        if topic and topic not in GENERATORS:
            raise HTTPException(400, "Unknown math topic.")
        quiz = build_math_quiz(grade, topic or None, body.count)
    else:
        system, user = quiz_prompt(body.subject, topic or "mixed", grade, body.count)
        try:
            data = svc.ai.complete_json(system, user, AI_QUIZ_SCHEMA)
            quiz = parse_ai_quiz(data, body.subject, topic or "mixed", grade, body.count)
        except AIError as err:
            raise HTTPException(503, f"{err.user_message} (Math quizzes work without the AI.)") from err
        except ValueError as exc:
            raise HTTPException(502, "The AI made a quiz I couldn't use. Please try again.") from exc
    svc.db.save_quiz(quiz.id, quiz.subject, quiz.topic, quiz.grade, quiz.source, quiz.title, quiz.to_storage())
    return {"quiz": quiz.public()}


@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, body: QuizSubmitRequest, svc: Services = Depends(get_services)) -> dict:
    stored = svc.db.get_quiz(quiz_id) if len(quiz_id) == 32 else None
    if stored is None:
        raise HTTPException(404, "Quiz not found.")
    questions = [QuizQuestion(**q) for q in stored["questions"]]
    if len(body.answers) > len(questions):
        raise HTTPException(400, "Too many answers.")
    if any(a is not None and not 0 <= a <= 3 for a in body.answers):
        raise HTTPException(400, "Answers must be choice numbers 0 to 3.")
    scored = score_quiz(questions, body.answers)
    attempt_id = svc.db.add_quiz_attempt(quiz_id, stored["subject"], stored["grade"], scored["score"],
                                         scored["total"], body.answers)
    return {"attempt_id": attempt_id, "verified": stored["source"] == "engine", **scored}


@router.get("/quizzes/attempts")
def quiz_attempts(svc: Services = Depends(get_services)) -> dict:
    return {"attempts": svc.db.list_quiz_attempts()}


@router.get("/progress")
def progress(svc: Services = Depends(get_services)) -> dict:
    return {"progress": svc.db.get_progress(), "attempts": svc.db.list_quiz_attempts(limit=10)}


@router.delete("/progress")
def clear_progress(confirm: bool = Query(False), svc: Services = Depends(get_services)) -> dict:
    if not confirm:
        raise HTTPException(400, "Add ?confirm=true to reset learning progress.")
    svc.db.clear_learning_data()
    return {"cleared": True}
