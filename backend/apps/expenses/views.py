from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.utils import timezone
from .models import Expense, ExpenseSplit
from .serializers import ExpenseSerializer, ExpenseListSerializer, ExpenseSplitSerializer


class ExpenseListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/expenses/         – List all expenses (with optional filters)
    POST /api/expenses/         – Create a new expense manually

    Query Params:
        ?category=food
        ?payment_method=1
        ?ordering=-expense_time
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["expense_time", "amount", "created_at"]
    ordering = ["-expense_time"]

    def get_queryset(self):
        qs = Expense.objects.filter(user=self.request.user).select_related("payment_method")

        # Filter by category
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)

        # Filter by payment method
        payment_method = self.request.query_params.get("payment_method")
        if payment_method:
            qs = qs.filter(payment_method_id=payment_method)

        return qs

    def get_serializer_class(self):
        if self.request.method == "GET":
            return ExpenseListSerializer
        return ExpenseSerializer


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/expenses/{id}/  – Get expense detail
    PUT    /api/expenses/{id}/  – Full update
    PATCH  /api/expenses/{id}/  – Partial update
    DELETE /api/expenses/{id}/  – Delete
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user).select_related("payment_method")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(
            {"message": "Expense deleted successfully."},
            status=status.HTTP_200_OK,
        )


class CreditsGivenListView(generics.ListAPIView):
    """List credits I have given out to friends."""
    serializer_class = ExpenseSplitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExpenseSplit.objects.filter(expense__user=self.request.user).order_by('-created_at')


class CreditsOwedListView(generics.ListAPIView):
    """List debts I owe to friends."""
    serializer_class = ExpenseSplitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExpenseSplit.objects.filter(debtor=self.request.user).order_by('-created_at')


class MarkSplitPaidView(generics.UpdateAPIView):
    """Mark a split as paid and create an expense for the debtor."""
    queryset = ExpenseSplit.objects.all()
    serializer_class = ExpenseSplitSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        split = self.get_object()
        # Either the payer or the debtor can mark as paid (usually debtor confirms they paid)
        if split.debtor != request.user and split.expense.user != request.user:
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        if split.status == 'paid':
            return Response({"detail": "Already paid"}, status=status.HTTP_400_BAD_REQUEST)

        split.status = 'paid'
        split.paid_at = timezone.now()
        split.save()

        # Create an expense record for the debtor
        # Note: This will deduct from the debtor's selected payment method balance
        from apps.payments.models import PaymentMethod
        
        # Look for the payment method passed in request or use default
        pm_id = request.data.get('payment_method')
        pm = None
        if pm_id:
            pm = PaymentMethod.objects.filter(user=split.debtor, id=pm_id).first()
        if not pm:
            pm = PaymentMethod.objects.filter(user=split.debtor, is_default=True).first()
        
        Expense.objects.create(
            user=split.debtor,
            amount=split.amount,
            category=split.expense.category,
            note=f"Paid to {split.expense.user.full_name or split.expense.user.email}: {split.expense.note}",
            expense_time=split.paid_at,
            payment_method=pm,
            raw_input=f"Settled debt for split {split.id}"
        )

        return Response(self.get_serializer(split).data)
