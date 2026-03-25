from django.urls import path
from .views import (
    ExpenseListCreateView, ExpenseDetailView,
    CreditsGivenListView, CreditsOwedListView, MarkSplitPaidView
)

urlpatterns = [
    path("", ExpenseListCreateView.as_view(), name="expense-list"),
    path("<int:pk>/", ExpenseDetailView.as_view(), name="expense-detail"),
    path("credits-given/", CreditsGivenListView.as_view(), name="credits-given"),
    path("credits-owed/", CreditsOwedListView.as_view(), name="credits-owed"),
    path("splits/<int:pk>/mark-paid/", MarkSplitPaidView.as_view(), name="mark-split-paid"),
]
