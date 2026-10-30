"""Voice settings bounds.

Speech recognition and speech synthesis run in the browser (Web Speech API),
started only by an explicit push-to-talk click. The backend never records or
receives audio; it only stores these validated preferences.
"""

VOICE_RATE_MIN = 0.5
VOICE_RATE_MAX = 2.0

VOICE_LANGUAGES = {
    "en-US": "English (US)",
    "en-GB": "English (UK)",
    "en-AU": "English (Australia)",
    "en-CA": "English (Canada)",
    "en-IN": "English (India)",
}
