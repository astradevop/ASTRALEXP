from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Friendship

User = get_user_model()

class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'full_name', 'avatar')

class FriendshipSerializer(serializers.ModelSerializer):
    from_user_detail = UserSearchSerializer(source='from_user', read_only=True)
    to_user_detail = UserSearchSerializer(source='to_user', read_only=True)

    class Meta:
        model = Friendship
        fields = ('id', 'from_user', 'to_user', 'status', 'created_at', 'from_user_detail', 'to_user_detail')
        read_only_fields = ('from_user', 'status', 'created_at')
