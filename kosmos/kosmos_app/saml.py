from django.conf import settings


def idp_is_configured():
    return all(
        [
            settings.SAML_IDP_ENTITY_ID,
            settings.SAML_IDP_SSO_URL,
            settings.SAML_IDP_X509_CERT,
        ]
    )


def build_saml_settings():
    idp_settings = {
        "entityId": settings.SAML_IDP_ENTITY_ID,
        "singleSignOnService": {
            "url": settings.SAML_IDP_SSO_URL,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        },
        "x509cert": settings.SAML_IDP_X509_CERT,
    }
    if settings.SAML_IDP_SLO_URL:
        idp_settings["singleLogoutService"] = {
            "url": settings.SAML_IDP_SLO_URL,
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        }

    return {
        "strict": settings.SAML_STRICT,
        "debug": settings.SAML_DEBUG,
        "sp": {
            "entityId": settings.SAML_SP_ENTITY_ID,
            "assertionConsumerService": {
                "url": settings.SAML_SP_ACS_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "singleLogoutService": {
                "url": settings.SAML_SP_SLO_URL,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        },
        "idp": idp_settings,
        "security": {
            "authnRequestsSigned": False,
            "logoutRequestSigned": False,
            "logoutResponseSigned": False,
            "wantMessagesSigned": False,
            "wantAssertionsSigned": True,
            "wantNameId": True,
            "wantNameIdEncrypted": False,
            "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
            "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
        },
    }


def prepare_django_request(request):
    return {
        "https": "on" if request.is_secure() else "off",
        "http_host": request.get_host(),
        "script_name": request.path,
        "server_port": request.get_port(),
        "get_data": request.GET.copy(),
        "post_data": request.POST.copy(),
    }


def first_attribute(attributes, *names):
    for name in names:
        values = attributes.get(name)
        if values:
            return values[0]
    return ""
