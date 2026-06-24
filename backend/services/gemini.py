"""
Compatibility shim — re-exports OpenAI client under the legacy 'gemini' module name.
All callers that do `from backend.services import gemini as gemini_client` continue to work.
"""
from backend.services.openai_client import (  # noqa: F401
    get_client,
    get_model,
    call_openai_async as call_gemini_async,
    call_openai_vision_async as call_gemini_vision_async,
    generate_embedding_async,
    call_openai_async,
    call_openai_vision_async,
)
