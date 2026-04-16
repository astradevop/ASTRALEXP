from datetime import datetime, timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.models import Expense
from apps.expenses.serializers import ExpenseSerializer
from apps.payments.models import PaymentMethod
from apps.friends.models import Friendship
from django.db.models import Q
from .services import parse_expense_from_text


class ParseExpenseView(APIView):
    """
    POST /api/chat/parse/

    Accepts natural language text, parses it via Gemini,
    and optionally saves the expense if all fields are present.

    Request Body:
        {
            "message": "Had biriyani for 180 via GPay yesterday 8pm",
            "save": true   // optional — auto-save if complete (default: false)
        }

    Response (incomplete — needs more info):
        {
            "is_complete": false,
            "parsed": { ... },
            "follow_up": "Which payment method did you use?",
            "expense": null
        }

    Response (complete):
        {
            "is_complete": true,
            "parsed": { ... },
            "follow_up": null,
            "expense": { <saved expense object> }   // if save=true
        }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        image_base64 = request.data.get("image", None)
        auto_save = request.data.get("save", False)
        previous_state = request.data.get("previous_state", None)

        if not message and not image_base64:
            return Response(
                {"error": "Message or image is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch friends for context
        friends = []
        friendships = Friendship.objects.filter(
            (Q(from_user=request.user) | Q(to_user=request.user)),
            status='accepted'
        ).select_related('from_user', 'to_user')
        
        for f in friendships:
            if f.from_user == request.user:
                friends.append(f.to_user)
            else:
                friends.append(f.from_user)

        # ── Call Gemini ──────────────────────────────────────────────────────
        parsed = parse_expense_from_text(
            message, 
            image_base64=image_base64, 
            previous_state=previous_state, 
            friends=friends
        )

        if not parsed.get("success"):
            return Response(
                {"error": parsed.get("error", "Parsing failed.")},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # ── Build follow-up prompt for missing fields ─────────────────────────
        follow_up = _build_follow_up(parsed.get("missing_fields", []))

        # ── Auto-save if requested and data is complete ───────────────────────
        saved_expense = None
        if auto_save and parsed.get("is_complete"):
            saved_expense = _save_expense(request.user, message, parsed)

        return Response(
            {
                "is_complete": parsed["is_complete"],
                "parsed": parsed,
                "follow_up": follow_up,
                "expense": ExpenseSerializer(saved_expense).data if saved_expense else None,
            }
        )


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_follow_up(missing_fields: list) -> str | None:
    """Generate a human-friendly question for missing expense fields."""
    if not missing_fields:
        return None

    prompts = {
        "amount": "How much did you spend?",
        "category": "What category does this fall under? (e.g. food, transport, shopping)",
        "payment_method": "Which payment method did you use? (e.g. GPay, cash, card)",
    }

    if len(missing_fields) == 1:
        return prompts.get(missing_fields[0], "Could you clarify the missing details?")

    questions = [prompts[f] for f in missing_fields if f in prompts]
    return " Also, ".join(questions) if questions else "Could you provide more details?"


def _save_expense(user, raw_input: str, parsed: dict) -> Expense | None:
    """
    Create and save an Expense from parsed LLM data.
    Uses ExpenseSerializer to handle nested splits and balance updates.
    """
    # Resolve payment method — match by name (case-insensitive)
    payment_method = None
    pm_name = parsed.get("payment_method_name")
    if pm_name:
        payment_method = PaymentMethod.objects.filter(
            user=user, name__iexact=pm_name
        ).first()

    # Resolve expense_time
    expense_time_str = parsed.get("expense_time")
    try:
        expense_time = datetime.fromisoformat(
            expense_time_str.replace("Z", "+00:00")
        ) if expense_time_str else datetime.now(timezone.utc)
    except (ValueError, AttributeError):
        expense_time = datetime.now(timezone.utc)

    # Prepare data for serializer
    splits_data = []
    parsed_splits = parsed.get("splits", [])
    total_amount = float(parsed.get("amount") or 0)
    friends_to_split = len(parsed_splits)

    if friends_to_split > 0:
        # Check if we need to auto-calculate equal splits
        calculate_equal = any(s.get("amount") in [None, 0] for s in parsed_splits)
        
        # If equal split: divide total by (number_of_friends + 1 user)
        equal_share = round(total_amount / (friends_to_split + 1), 2) if calculate_equal else 0
        
        for s in parsed_splits:
            fid = s.get("friend_id")
            amt = s.get("amount")
            if fid:
                splits_data.append({
                    "debtor": fid,
                    "amount": equal_share if calculate_equal else (amt or 0)
                })

    data = {
        "amount": parsed["amount"],
        "category": parsed.get("category", "other"),
        "note": parsed.get("note", ""),
        "expense_time": expense_time,
        "payment_method": payment_method.id if payment_method else None,
        "raw_input": raw_input,
        "splits": splits_data
    }

    # We need to pass the request in context for the serializer's validate_payment_method
    class MockRequest:
        def __init__(self, user):
            self.user = user

    serializer = ExpenseSerializer(data=data, context={"request": MockRequest(user)})
    if serializer.is_valid():
        return serializer.save()
    else:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to save expense from chat: {serializer.errors}")
        return None
