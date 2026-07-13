"""
Knower API client — replaces OpenAI/Gemini as the AI provider.
Uses GPT-5.5 via Knower API endpoint with OpenAI-compatible interface.
"""
# import structlog
# import httpx
#
# from backend.config import get_settings
#
# logger = structlog.get_logger()
# settings = get_settings()
#
# KNOWER_API_BASE = "https://api.knower.ai/v1"
# KNOWER_MODEL = "gpt-5.5"
# EMBEDDING_MODEL = "text-embedding-3-small"
#
# _client = None
#
#
# def _get_http_client() -> httpx.AsyncClient:
#     global _client
#     if _client is None:
#         _client = httpx.AsyncClient(
#             base_url=KNOWER_API_BASE,
#             headers={
#                 "Authorization": f"Bearer {settings.knower_api_key}",
#                 "Content-Type": "application/json",
#             },
#             timeout=120.0,
#         )
#     return _client
#
#
# def get_model(model_name: str = None) -> str:
#     return model_name or KNOWER_MODEL
#
#
# async def call_knower_async(
#     prompt: str,
#     model: str = None,
#     temperature: float = 0.7,
#     max_output_tokens: int = 3000,
#     response_format: dict = None,
# ) -> str:
#     client = _get_http_client()
#     model = model or KNOWER_MODEL
#     body = {
#         "model": model,
#         "messages": [{"role": "user", "content": prompt}],
#         "temperature": temperature,
#         "max_tokens": max_output_tokens,
#     }
#     if response_format:
#         body["response_format"] = response_format
#     try:
#         resp = await client.post("/chat/completions", json=body)
#         resp.raise_for_status()
#         data = resp.json()
#         return data["choices"][0]["message"]["content"].strip()
#     except Exception as e:
#         logger.warning("knower.api_call_failed", error=str(e))
#         raise
#
#
# async def call_knower_vision_async(
#     text: str,
#     image_data: bytes,
#     mime_type: str,
#     model: str = "gpt-5.5",
#     temperature: float = 0.1,
#     max_output_tokens: int = 4096,
# ) -> str:
#     import base64
#     client = _get_http_client()
#     b64_image = base64.b64encode(image_data).decode("utf-8")
#     body = {
#         "model": model,
#         "messages": [
#             {
#                 "role": "user",
#                 "content": [
#                     {"type": "text", "text": text},
#                     {
#                         "type": "image_url",
#                         "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
#                     },
#                 ],
#             }
#         ],
#         "temperature": temperature,
#         "max_tokens": max_output_tokens,
#     }
#     try:
#         resp = await client.post("/chat/completions", json=body)
#         resp.raise_for_status()
#         data = resp.json()
#         return data["choices"][0]["message"]["content"].strip()
#     except Exception as e:
#         logger.warning("knower.vision_call_failed", error=str(e))
#         raise
#
#
# async def generate_embedding_async(texts: list[str]) -> list[list[float]]:
#     client = _get_http_client()
#     body = {
#         "model": EMBEDDING_MODEL,
#         "input": texts,
#     }
#     try:
#         resp = await client.post("/embeddings", json=body)
#         resp.raise_for_status()
#         data = resp.json()
#         items = sorted(data["data"], key=lambda x: x["index"])
#         return [item["embedding"] for item in items]
#     except Exception as e:
#         logger.warning("knower.embedding_call_failed", error=str(e))
#         raise
