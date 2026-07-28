from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

PROVIDERS = {
    "gemini": {
        "label": "Google Gemini",
        "default_model": "gemini-2.0-flash",
        "models": ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
        "docs": "https://aistudio.google.com/apikey",
        "free_tier_note": "Generous free tier via Google AI Studio",
    },
    "openai": {
        "label": "OpenAI",
        "default_model": "gpt-4o-mini",
        "models": ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
        "docs": "https://platform.openai.com/api-keys",
        "free_tier_note": "Paid API (mini models are low-cost)",
    },
    "grok": {
        "label": "xAI Grok",
        "default_model": "grok-2-latest",
        "models": ["grok-2-latest", "grok-3-mini"],
        "docs": "https://console.x.ai/",
        "free_tier_note": "Check xAI console for current credits",
    },
}


def provider_catalog() -> list[dict]:
    return [
        {
            "id": pid,
            "label": meta["label"],
            "default_model": meta["default_model"],
            "models": meta["models"],
            "docs": meta["docs"],
            "free_tier_note": meta["free_tier_note"],
        }
        for pid, meta in PROVIDERS.items()
    ]


def build_generation_prompt(account: dict, post_count: int, extra: str = "") -> str:
    today = datetime.now(timezone.utc).date()
    platforms = account.get("platforms") or []
    if isinstance(platforms, str):
        try:
            platforms = json.loads(platforms)
        except Exception:
            platforms = [p.strip() for p in platforms.split(",") if p.strip()]
    platform_list = ", ".join(platforms) if platforms else "instagram, x"
    dates = [(today + timedelta(days=i)).isoformat() for i in range(max(post_count, 1))]

    return f"""You are a social media content strategist. Produce ONLY valid JSON (no markdown fences, no commentary).

Account: {account.get("name")}
Product: {account.get("product")}
Tone: {account.get("tone") or "clear and helpful"}
Audience / notes: {account.get("notes") or "general audience"}
Platforms to use: {platform_list}
Number of posts: {post_count}

Extra instructions from the user:
{extra.strip() or "(none)"}

Return a single JSON object with this exact shape:
{{
  "account": "{account.get("name")}",
  "generated_at": "{datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}",
  "posts": [
    {{
      "platform": "instagram|x|threads|facebook|reddit",
      "post_type": "post|story|reel|carousel",
      "caption": "full caption ready to publish",
      "hashtags": ["tag1", "tag2"],
      "image_prompt": "detailed image generation prompt or null",
      "video_idea": "string or null",
      "posting_tip": "string or null",
      "scheduled_date": "YYYY-MM-DD"
    }}
  ]
}}

Rules:
- Exactly {post_count} posts in the posts array.
- Mix platforms from the allowed list when possible.
- Spread scheduled_date across these dates: {", ".join(dates)}.
- hashtags: 8–15 items without # prefix.
- Captions must be original and on-brand for the product.
"""


def extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("Model did not return JSON")
        return json.loads(match.group(0))


def call_openai_compatible(
    *,
    api_key: str,
    base_url: str,
    model: str,
    prompt: str,
    timeout: float = 120.0,
) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "temperature": 0.7,
        "messages": [
            {
                "role": "system",
                "content": "You output only valid JSON objects for social content queues.",
            },
            {"role": "user", "content": prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.post(url, headers=headers, json=payload)
        if res.status_code >= 400:
            raise ValueError(f"Provider error ({res.status_code}): {res.text[:400]}")
        data = res.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError("Unexpected provider response shape") from e


def call_gemini(*, api_key: str, model: str, prompt: str, timeout: float = 120.0) -> str:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7},
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.post(url, json=payload)
        if res.status_code >= 400:
            raise ValueError(f"Gemini error ({res.status_code}): {res.text[:400]}")
        data = res.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts)
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError("Unexpected Gemini response shape") from e


def generate_queue_json(
    provider: str,
    api_key: str,
    model: Optional[str],
    account: dict,
    post_count: int,
    extra_instructions: str = "",
) -> dict:
    if provider not in PROVIDERS:
        raise ValueError(f"Unsupported provider: {provider}")
    meta = PROVIDERS[provider]
    use_model = (model or "").strip() or meta["default_model"]
    prompt = build_generation_prompt(account, post_count, extra_instructions)

    if provider == "gemini":
        raw = call_gemini(api_key=api_key, model=use_model, prompt=prompt)
    elif provider == "openai":
        raw = call_openai_compatible(
            api_key=api_key,
            base_url="https://api.openai.com/v1",
            model=use_model,
            prompt=prompt,
        )
    elif provider == "grok":
        raw = call_openai_compatible(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            model=use_model,
            prompt=prompt,
        )
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    data = extract_json_object(raw)
    if not isinstance(data.get("posts"), list):
        raise ValueError("JSON missing posts array")
    data["account"] = account.get("name") or data.get("account")
    if not data.get("generated_at"):
        data["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return data
