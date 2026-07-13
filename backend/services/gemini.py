"""
Compatibility shim that re-exports Knower API functions under legacy names.
All service modules import 'from backend.services import gemini as gemini_client'
and call gemini_client.call_gemini_async(...), etc.
Now routes to the Knower API instead of Gemini or OpenAI.
"""
# from backend.services.knower_client import (
#     get_model,
#     call_knower_async as call_gemini_async,
#     call_knower_vision_async as call_gemini_vision_async,
#     generate_embedding_async,
#     call_knower_async,
#     call_knower_vision_async,
# )
