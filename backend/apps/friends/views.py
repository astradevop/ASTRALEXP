from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import Friendship
from .serializers import FriendshipSerializer, UserSearchSerializer

User = get_user_model()

class UserSearchView(generics.ListAPIView):
    serializer_class = UserSearchSerializer

    def get_queryset(self):
        query = self.request.query_params.get('q', '')
        if len(query) < 3:
            return User.objects.none()
        return User.objects.filter(
            Q(email__icontains=query) | 
            Q(username__icontains=query) | 
            Q(phone__icontains=query) |
            Q(full_name__icontains=query)
        ).exclude(id=self.request.user.id)

class FriendshipViewSet(viewsets.ModelViewSet):
    serializer_class = FriendshipSerializer

    def get_queryset(self):
        return Friendship.objects.filter(
            Q(from_user=self.request.user) | Q(to_user=self.request.user)
        ).order_by('-created_at')

    def perform_create(self, serializer):
        # Check if friendship already exists
        to_user_id = self.request.data.get('to_user')
        if Friendship.objects.filter(
            (Q(from_user=self.request.user, to_user_id=to_user_id) | 
             Q(from_user_id=to_user_id, to_user=self.request.user))
        ).exists():
            return # or raise error
        serializer.save(from_user=self.request.user)

    @action(detail=False, methods=['get'])
    def list_friends(self, request):
        friends = Friendship.objects.filter(
            (Q(from_user=request.user) | Q(to_user=request.user)),
            status='accepted'
        )
        friend_ids = []
        for f in friends:
            if f.from_user == request.user:
                friend_ids.append(f.to_user.id)
            else:
                friend_ids.append(f.from_user.id)
        
        users = User.objects.filter(id__in=friend_ids)
        serializer = UserSearchSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_requests(self, request):
        requests = Friendship.objects.filter(to_user=request.user, status='pending')
        serializer = self.get_serializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def respond(self, request, pk=None):
        friendship = self.get_object()
        if friendship.to_user != request.user:
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        
        new_status = request.data.get('status')
        if new_status not in ['accepted', 'rejected']:
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        
        friendship.status = new_status
        friendship.save()
        return Response(self.get_serializer(friendship).data)
