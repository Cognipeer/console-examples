import os
import sys

from openai import OpenAI


def need(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing env var {name}. Export the variables from .env.example first.")
    return value


# The only Console-specific part: base_url + API token as the key.
client = OpenAI(
    base_url=need("CONSOLE_BASE_URL").rstrip("/") + "/api/client/v1",
    api_key=need("CONSOLE_API_TOKEN"),
)
MODEL = need("CONSOLE_CHAT_MODEL")  # a Console model KEY


def describe_error(err: Exception) -> str:
    """Surface Console guardrail blocks (error.type == 'guardrail_block').

    Before streaming starts the block is an HTTP 400 (APIStatusError). Mid-stream it is an
    in-band error frame, which the SDK raises as a plain APIError that has no HTTP status.
    """
    from openai import APIError, APIStatusError

    if isinstance(err, APIError):
        body = err.body if isinstance(err.body, dict) else {}
        status = err.status_code if isinstance(err, APIStatusError) else None
        if body.get("type") == "guardrail_block" and status in (400, None):
            when = " while streaming" if status is None else ""
            action = f" (action: {body.get('action')})" if body.get("action") else ""
            findings = f"\nfindings: {body.get('findings')}" if body.get("findings") else ""
            return f"Blocked by guardrail {body.get('guardrail_key')!r}{when}{action}: {body.get('message')}{findings}"
        if status is not None:
            return f"HTTP {status}: {err.message}"
    return str(err)
