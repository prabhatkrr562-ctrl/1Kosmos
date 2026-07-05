from django.conf import settings
import json

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .saml import (
    build_saml_settings,
    first_attribute,
    idp_is_configured,
    prepare_django_request,
)


def _saml_auth(request):
    from onelogin.saml2.auth import OneLogin_Saml2_Auth

    return OneLogin_Saml2_Auth(prepare_django_request(request), build_saml_settings())


def _me_response(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False}, status=401)
    return JsonResponse(
        {
            "authenticated": True,
            "user": {
                "username": request.user.get_username(),
                "email": request.user.email,
                "name": request.user.get_full_name() or request.user.get_username(),
            },
        }
    )


@require_GET
def me(request):
    return _me_response(request)


@csrf_exempt
@require_POST
def local_login(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid login payload."}, status=400)

    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        return JsonResponse({"error": "Enter a username and password."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid username or password."}, status=401)
    if not user.is_staff and not user.is_superuser:
        return JsonResponse({"error": "Only Django staff or superusers can use local login."}, status=403)

    login(request, user)
    return _me_response(request)


@require_GET
def saml_login(request):
    if not idp_is_configured():
        return JsonResponse(
            {
                "error": (
                    "SAML is not configured. Set SAML_IDP_ENTITY_ID, "
                    "SAML_IDP_SSO_URL, and SAML_IDP_X509_CERT."
                )
            },
            status=503,
        )
    return redirect(_saml_auth(request).login())


@csrf_exempt
@require_POST
def saml_acs(request):
    auth = _saml_auth(request)
    auth.process_response()
    errors = auth.get_errors()
    if errors or not auth.is_authenticated():
        return JsonResponse(
            {
                "error": "SAML login failed.",
                "details": errors,
                "reason": auth.get_last_error_reason(),
            },
            status=401,
        )

    attributes = auth.get_attributes()
    email = first_attribute(
        attributes,
        settings.SAML_EMAIL_ATTRIBUTE,
        "email",
        "mail",
        "EmailAddress",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    )
    name_id = auth.get_nameid() or ""
    username = (email or name_id).strip().lower()
    if not username:
        return JsonResponse({"error": "SAML response did not include an email or NameID."}, status=400)

    first_name = first_attribute(attributes, settings.SAML_FIRST_NAME_ATTRIBUTE, "firstName", "givenName")
    last_name = first_attribute(attributes, settings.SAML_LAST_NAME_ATTRIBUTE, "lastName", "sn", "surname")

    User = get_user_model()
    user, created = User.objects.get_or_create(
        username=username[:150],
        defaults={"email": email[:254], "first_name": first_name[:150], "last_name": last_name[:150]},
    )
    if not created:
        updates = []
        for field, value, max_length in (
            ("email", email, 254),
            ("first_name", first_name, 150),
            ("last_name", last_name, 150),
        ):
            value = value[:max_length]
            if value and getattr(user, field) != value:
                setattr(user, field, value)
                updates.append(field)
        if updates:
            user.save(update_fields=updates)

    login(request, user)
    return redirect(settings.FRONTEND_URL)


@require_GET
def saml_metadata(request):
    from onelogin.saml2.settings import OneLogin_Saml2_Settings

    saml_settings = OneLogin_Saml2_Settings(build_saml_settings(), sp_validation_only=True)
    metadata = saml_settings.get_sp_metadata()
    errors = saml_settings.validate_metadata(metadata)
    if errors:
        return JsonResponse({"errors": errors}, status=500)
    return HttpResponse(metadata, content_type="text/xml")


@require_POST
@csrf_exempt
def local_logout(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def saml_logout(request):
    logout(request)
    return redirect(settings.FRONTEND_URL)
