from rest_framework import serializers
from .models import Expense, ExpenseSplit
from apps.payments.serializers import PaymentMethodSerializer
from apps.friends.serializers import UserSearchSerializer


class ExpenseSplitSerializer(serializers.ModelSerializer):
    """Serializer for expense splits."""

    debtor_detail = UserSearchSerializer(source="debtor", read_only=True)
    expense_payer_detail = UserSearchSerializer(source="expense.user", read_only=True)
    expense_note = serializers.CharField(source="expense.note", read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ("id", "debtor", "debtor_detail", "expense_payer_detail", "expense_note", "amount", "status", "paid_at", "created_at")
        read_only_fields = ("id", "debtor_detail", "expense_payer_detail", "expense_note", "paid_at", "created_at")


class ExpenseSerializer(serializers.ModelSerializer):
    """Full expense serializer for read operations."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)
    payment_method_detail = PaymentMethodSerializer(source="payment_method", read_only=True)
    splits = ExpenseSplitSerializer(many=True, required=False)

    class Meta:
        model = Expense
        fields = (
            "id",
            "amount",
            "category",
            "category_display",
            "note",
            "expense_time",
            "logged_time",
            "raw_input",
            "payment_method",
            "payment_method_detail",
            "splits",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "logged_time", "category_display", "payment_method_detail", "created_at", "updated_at")

    def validate_payment_method(self, value):
        """Ensure the payment method belongs to the authenticated user."""
        if value and value.user != self.context["request"].user:
            raise serializers.ValidationError("Invalid payment method.")
        return value

    def create(self, validated_data):
        splits_data = validated_data.pop("splits", [])
        validated_data["user"] = self.context["request"].user
        expense = Expense.objects.create(**validated_data)
        for split_data in splits_data:
            ExpenseSplit.objects.create(expense=expense, **split_data)
        return expense

    def update(self, instance, validated_data):
        splits_data = validated_data.pop("splits", None)
        instance = super().update(instance, validated_data)
        
        if splits_data is not None:
            # For simplicity in this implementation, we replace all splits on update
            # In a production app, you'd match by ID and update/delete/create selectively
            instance.splits.all().delete()
            for split_data in splits_data:
                ExpenseSplit.objects.create(expense=instance, **split_data)
        
        return instance


class ExpenseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing expenses."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)
    payment_method_name = serializers.CharField(
        source="payment_method.name", read_only=True, default=None
    )
    is_shared = serializers.SerializerMethodField()
    splits = ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "amount",
            "category",
            "category_display",
            "note",
            "expense_time",
            "payment_method",
            "payment_method_name",
            "is_shared",
            "splits",
        )

    def get_is_shared(self, obj):
        return obj.splits.exists()
