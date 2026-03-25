"""
Gemini AI Service for expense parsing.

Converts natural language expense messages into structured JSON data.
"""

import json
import re
import logging
import base64
from datetime import datetime, timezone

from google import genai
from google.genai import types
from django.conf import settings

logger = logging.getLogger(__name__)


# ─── Configure Gemini ─────────────────────────────────────────────────────────

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


# ─── Category Map ─────────────────────────────────────────────────────────────

VALID_CATEGORIES = [
    "food", "transport", "shopping", "entertainment",
    "health", "utilities", "education", "travel",
    "groceries", "rent", "subscription", "other",
]

VALID_PAYMENT_TYPES = ["upi", "bank", "card", "cash", "wallet", "other"]


# ─── Prompt Template ─────────────────────────────────────────────────────────

PARSE_PROMPT = """
You are an intelligent expense parser. Extract structured expense information from the user's message.

Current datetime (UTC): {current_datetime}
Previous extracted state (if any): {previous_state}
User message: "{user_message}"

Extract and return ONLY a valid JSON object with these fields:
{{
  "amount": <number or null>,
  "category": <one of: food, transport, shopping, entertainment, health, utilities, education, travel, groceries, rent, subscription, other — or null if unclear>,
  "payment_method_name": <string name like "GPay", "Cash", "SBI Card", or null if not mentioned>,
  "payment_method_type": <one of: upi, bank, card, cash, wallet, other — or null>,
  "expense_time": <ISO 8601 datetime string based on context like "yesterday", "last night", "8pm", now if not specified — or null>,
  "note": <short description of what was purchased, or null>,
  "is_complete": <true if amount, category and payment_method_name are all present; false otherwise>,
  "missing_fields": <list of field names that are missing or unclear, e.g. ["payment_method", "category"]>,
  "splits": [
    {{
      "friend_id": <id of the friend from the provided list, or null>,
      "amount": <the amount this friend owes, or null if to be split equally>
    }}
  ],
  "needs_friend_selection": <true if the user mentioned "friends" or splitting but didn't specify who from the list, or names were not found in the list>
}}

Friends list for matching: {friends_context}

Rules:
- If User says "split with [Friend Name]", find the friend in the provided list.
- If total amount is 1000 and user says "split with Rahul", then amount should be 500 (user share) and one split for Rahul for 500.
- If specific amounts are mentioned (e.g. "Rahul owes 300"), use those.
- If Previous State has non-null values, KEEP them unless the User Message explicitly overrides them. Merge the User Message details into the Previous State.
- If amount has a calculation (e.g. "2 items 50 each"), compute the total.
- Be smart about category: "biriyani" → food, "Uber" → transport, "Netflix" → subscription.
- Be smart about payment_method_type: "GPay" → upi, "HDFC card" → card, "cash" → cash.
- Return ONLY the JSON. No explanation, no markdown, no extra text.
"""


# ─── Parser ───────────────────────────────────────────────────────────────────

def parse_expense_from_text(user_message: str, image_base64: str = None, previous_state: dict = None, friends: list = None) -> dict:
    """
    Send user message and/or image to Gemini and get structured expense data back.
    """
    current_datetime = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    
    friends_context = "[]"
    if friends:
        friends_context = json.dumps([
            {"id": f.id, "name": f.full_name or f.username, "email": f.email} 
            for f in friends
        ])

    # If there's an image, we still provide context to the bot
    if not user_message and image_base64:
        user_message = "Extract the expense details from the attached receipt/bill."
        
    prompt = PARSE_PROMPT.format(
        user_message=user_message,
        current_datetime=current_datetime,
        previous_state=json.dumps(previous_state or {}),
        friends_context=friends_context
    )

    contents = []
    
    if image_base64:
        # Check if the base64 string includes MimeType prefix (e.g. data:image/jpeg;base64,...)
        img_data = image_base64
        mime_type = "image/jpeg"
        if ";base64," in image_base64:
            meta, img_data = image_base64.split(";base64,", 1)
            if "image/" in meta:
                mime_type = meta.replace("data:", "")
        try:
            image_bytes = base64.b64decode(img_data)
            contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))
        except Exception as e:
            logger.error(f"Failed to decode image base64: {e}")

    contents.append(prompt)

    try:
        response = _client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
        )
        raw_text = response.text.strip()

        # Strip markdown code blocks if Gemini wraps JSON in them
        raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
        raw_text = re.sub(r"\n?```$", "", raw_text)

        parsed = json.loads(raw_text)
        
        # Hard-merge from python to prevent AI dropping context
        if previous_state and isinstance(previous_state, dict):
            for key in ["amount", "category", "payment_method_name", "expense_time", "note"]:
                if previous_state.get(key) is not None and not previous_state.get(key) == "other":
                    if not parsed.get(key) or parsed.get(key) == "other":
                        parsed[key] = previous_state[key]

        return _validate_and_clean(parsed)

    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned invalid JSON: {e}\nRaw: {raw_text}")
        return _error_response("Could not parse the AI response. Please try again.")

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return _error_response(str(e))


def _validate_and_clean(data: dict) -> dict:
    """Sanitize and validate the parsed fields."""

    # Clamp category
    if data.get("category") not in VALID_CATEGORIES:
        data["category"] = "other"

    # Clamp payment type
    if data.get("payment_method_type") not in VALID_PAYMENT_TYPES:
        data["payment_method_type"] = "other"

    # Ensure amount is a positive number
    try:
        amount = float(data.get("amount") or 0)
        data["amount"] = round(amount, 2) if amount > 0 else None
    except (TypeError, ValueError):
        data["amount"] = None

    # Validate expense_time ISO format
    expense_time = data.get("expense_time")
    if expense_time:
        try:
            datetime.fromisoformat(expense_time.replace("Z", "+00:00"))
        except ValueError:
            data["expense_time"] = None

    # Ensure missing_fields is a list
    if not isinstance(data.get("missing_fields"), list):
        data["missing_fields"] = []

    # Re-evaluate is_complete
    data["is_complete"] = bool(
        data.get("amount")
        and data.get("category")
        and data.get("payment_method_name")
    )

    if not data["is_complete"]:
        missing = []
        if not data.get("amount"):
            missing.append("amount")
        if not data.get("category") or data.get("category") == "other":
            missing.append("category")
        if not data.get("payment_method_name"):
            missing.append("payment_method")
        data["missing_fields"] = missing

    # Handle splits sanitization
    splits = data.get("splits", [])
    if not isinstance(splits, list):
        splits = []
    
    cleaned_splits = []
    for s in splits:
        fid = s.get("friend_id")
        amt = s.get("amount")
        if fid:
            try:
                amt = float(amt) if amt else 0
                cleaned_splits.append({"friend_id": fid, "amount": round(amt, 2)})
            except (TypeError, ValueError):
                pass
    data["splits"] = cleaned_splits

    # Flag if user mentioned friends/splitting but no friends were successfully matched
    needs_selection = False
    lower_msg = user_message.lower()
    if ("friend" in lower_msg or "split" in lower_msg or "share" in lower_msg) and not cleaned_splits:
        needs_selection = True
    data["needs_friend_selection"] = needs_selection

    data["success"] = True
    return data


def _error_response(message: str) -> dict:
    return {
        "success": False,
        "error": message,
        "amount": None,
        "category": None,
        "payment_method_name": None,
        "payment_method_type": None,
        "expense_time": None,
        "note": None,
        "is_complete": False,
        "missing_fields": [],
    }
