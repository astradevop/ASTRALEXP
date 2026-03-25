"""
Root URL configuration for AstralExp.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth & Profile
    path("api/auth/", include("apps.users.urls")),

    # Expenses
    path("api/expenses/", include("apps.expenses.urls")),

    # Payment Methods
    path("api/payment-methods/", include("apps.payments.urls")),

    # Chat / LLM Parsing
    path("api/chat/", include("apps.chat.urls")),

    # Friends
    path("api/friends/", include("apps.friends.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
