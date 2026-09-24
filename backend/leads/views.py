from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .serializers import LeadCreateSerializer
from .throttles import LeadCreateThrottle


class LeadCreateView(generics.CreateAPIView):
    """POST /api/leads/ — public lead intake from landing-page forms.

    Intentionally offers no list/retrieve/update/delete: anonymous visitors
    may only create a lead, never read the lead database. Lead management
    happens in Django Admin (Jazzmin), by authenticated staff only.
    """

    serializer_class = LeadCreateSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LeadCreateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
