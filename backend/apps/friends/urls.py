from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FriendshipViewSet, UserSearchView

router = DefaultRouter()
router.register(r'', FriendshipViewSet, basename='friendship')

urlpatterns = [
    path('search/', UserSearchView.as_view(), name='user-search'),
    path('', include(router.urls)),
]
