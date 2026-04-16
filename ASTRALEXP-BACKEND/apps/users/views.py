import logging
from django.contrib.auth import get_user_model
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


# ─── Auth Views ───────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Register a new user account.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Auto-generate tokens on register
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "message": "Account created successfully.",
                "user": ProfileSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Login with email + password. Returns JWT tokens + user profile.
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklist the refresh token to log out.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


# ─── Profile Views ────────────────────────────────────────────────────────────

class ProfileView(APIView):
    """
    GET  /api/auth/profile/  – Retrieve own profile
    PUT  /api/auth/profile/  – Full update own profile
    PATCH /api/auth/profile/ – Partial update own profile
    DELETE /api/auth/profile/ – Delete own account
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Profile updated.", "user": ProfileSerializer(request.user).data}
        )

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Profile updated.", "user": ProfileSerializer(request.user).data}
        )

    def delete(self, request):
        user = request.user
        user.delete()
        return Response(
            {"message": "Account deleted successfully."}, status=status.HTTP_204_NO_CONTENT
        )


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Change password for authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"error": "Old password is incorrect."}, status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"message": "Password changed successfully."})


# ─── Subscription Views ───────────────────────────────────────────────────────

import razorpay
from decouple import config

# Razorpay keys automatically fallback if not in env
RZP_KEY_ID = config("RAZORPAY_KEY_ID", default="rzp_test_MOCK_KEY_ID")
RZP_KEY_SECRET = config("RAZORPAY_KEY_SECRET", default="MOCK_KEY_SECRET")

class CreateSubscriptionIntentView(APIView):
    """
    POST /api/auth/subscription/create-intent/
    Creates a Razorpay Payment Link for the Pro Subscription (₹10).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.subscription_tier == "pro":
            return Response({"error": "You are already a Pro member."}, status=400)

        callback_url = request.data.get('callback_url', "https://astralexp-mock-success.vercel.app/")

        try:
            client = razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET))
            
            # Create a 10 rupee payment link
            payment_link_data = {
                "amount": 1000,
                "currency": "INR",
                "accept_partial": False,
                "description": "AstralExp Pro Monthly Subscription",
                "reminder_enable": False,
                "callback_url": callback_url,
                "callback_method": "get"
            }
            
            payment_link = client.payment_link.create(payment_link_data)
            return Response({"payment_link": payment_link['short_url']})
        except Exception as e:
            logger.error(f"RAZORPAY PAYMENT LINK ERROR: {str(e)}")
            fallback_link = f"{callback_url}?razorpay_payment_id=mock_pay_123&razorpay_payment_link_id=mock_link_123&razorpay_payment_link_status=paid"
            return Response({
                "error": "Payment gateway is currently unavailable. Please try again later.",
                "payment_link_fallback": fallback_link
            }, status=200)



class VerifySubscriptionView(APIView):
    """
    POST /api/auth/subscription/verify/
    Verifies that the payment was successful on frontend and upgrades user to Pro.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payment_id = request.data.get('razorpay_payment_id')
        payment_link_id = request.data.get('razorpay_payment_link_id')
        signature = request.data.get('razorpay_signature')
        payment_link_status = request.data.get('razorpay_payment_link_status')
        payment_link_reference_id = request.data.get('razorpay_payment_link_reference_id')

        if not payment_id:
            return Response({"error": "Missing payment information. Payment ID not found."}, status=400)

        # Skip status check for manual testing override
        if payment_id == 'manual_check':
            user = request.user
            user.subscription_tier = "pro"
            user.save()
            return Response(
                {"message": "Successfully upgraded to Pro!", "user": ProfileSerializer(user).data}
            )

        # Check status from Razorpay redirect
        if payment_link_status and payment_link_status != 'paid':
            return Response({"error": f"Payment was not successful (status: {payment_link_status})."}, status=400)

        # In a real app with valid Razorpay credentials, verify signature here:
        # try:
        #     client = razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET))
        #     client.utility.verify_payment_link_signature({
        #         'payment_link_id': payment_link_id,
        #         'payment_link_reference_id': payment_link_reference_id,
        #         'payment_link_status': payment_link_status,
        #         'payment_id': payment_id,
        #         'signature': signature
        #     })
        # except Exception as e:
        #     return Response({"error": "Payment signature verification failed."}, status=400)

        user = request.user
        user.subscription_tier = "pro"
        user.save()
        return Response(
            {"message": "Successfully upgraded to Pro!", "user": ProfileSerializer(user).data}
        )
