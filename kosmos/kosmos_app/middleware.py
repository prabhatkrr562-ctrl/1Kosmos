from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


class CorsMiddleware:
    """Small development CORS layer for the React dev server."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            from django.http import HttpResponse

            response = HttpResponse()
        else:
            response = self.get_response(request)

        origin = request.headers.get("Origin")
        if origin in {"http://localhost:3000", "http://127.0.0.1:3000"}:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            response["Access-Control-Allow-Credentials"] = "true"
        return response


def require_session(view_func):
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=401)
        return view_func(request, *args, **kwargs)

    if getattr(view_func, "csrf_exempt", False):
        wrapped.csrf_exempt = True
        return csrf_exempt(wrapped)
    return wrapped
