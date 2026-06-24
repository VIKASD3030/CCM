"""
Shared OpenAI AI client with retry and fallback handling.
Replaces the previous Google Gemini integration.
"""
import asyncio
import structlog

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from backend.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_client = AsyncOpenAI(api_key=settings.openai_api_key)

EMBEDDING_MODEL = "text-embedding-3-small"


def get_client() -> AsyncOpenAI:
    """Return the shared AsyncOpenAI client."""
    return _client


def get_model(model_name: str = None) -> str:
    """Return the model name string (replaces genai.GenerativeModel factory)."""
    return model_name or settings.generation_model


async def call_openai_async(
    prompt: str,
    model: str = None,
    temperature: float = 0.7,
    max_output_tokens: int = 3000,
    response_format: dict = None,
) -> str:
    """Call OpenAI chat completions with retry and exponential backoff."""
    model = model or settings.generation_model
    response = await _retry_openai_call(prompt, model, temperature, max_output_tokens, response_format)
    return response.choices[0].message.content.strip()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def _retry_openai_call(prompt: str, model: str, temperature: float, max_tokens: int, response_format: dict = None):
    """Inner retry wrapper for OpenAI chat completion calls."""
    kwargs = dict(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if response_format:
        kwargs["response_format"] = response_format
    try:
        return await _client.chat.completions.create(**kwargs)
    except Exception as e:
        logger.warning("openai.call_retry", error=str(e))
        raise


async def call_openai_vision_async(
    text: str,
    image_data: bytes,
    mime_type: str,
    model: str = "gpt-4o",
    temperature: float = 0.1,
    max_output_tokens: int = 4096,
) -> str:
    """Call OpenAI with an image and text prompt (vision), with retry."""
    import base64
    b64_image = base64.b64encode(image_data).decode("utf-8")
    response = await _retry_openai_vision_call(
        text, b64_image, mime_type, model, temperature, max_output_tokens
    )
    return response.choices[0].message.content.strip()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def _retry_openai_vision_call(
    text: str, b64_image: str, mime_type: str, model: str, temperature: float, max_tokens: int
):
    """Inner retry wrapper for OpenAI vision calls."""
    try:
        return await _client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                        },
                    ],
                }
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except Exception as e:
        logger.warning("openai.vision_call_retry", error=str(e))
        raise


async def generate_embedding_async(texts: list[str]) -> list[list[float]]:
    """Generate embeddings using OpenAI text-embedding-3-small with retry."""
    result = await _retry_embedding_call(texts)
    # Sort by index to preserve order
    embeddings = [item.embedding for item in sorted(result.data, key=lambda x: x.index)]
    return embeddings


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
async def _retry_embedding_call(texts: list[str]):
    """Inner retry wrapper for OpenAI embedding calls."""
    return await _client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )


