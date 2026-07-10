from django.urls import path
from . import dev_views
from . import auth_views
from . import ai_views
from . import git_views
from .ar_views import ar_dashboard, ar_raw, ar_save, import_ar
from .arr_views import dashboard, import_bookings
from .middleware import require_session
from .pipeline_views import import_pipeline, pipeline_dashboard, pipeline_movement

app_name = 'kosmos_app'

urlpatterns = [
    path('api/auth/me/', auth_views.me, name='auth-me'),
    path('api/auth/login/', auth_views.local_login, name='auth-login'),
    path('api/auth/logout/', auth_views.local_logout, name='auth-logout'),
    path('api/auth/saml/login/', auth_views.saml_login, name='saml-login'),
    path('api/auth/saml/acs/', auth_views.saml_acs, name='saml-acs'),
    path('api/auth/saml/logout/', auth_views.saml_logout, name='saml-logout'),
    path('api/auth/saml/metadata/', auth_views.saml_metadata, name='saml-metadata'),
    path('api/dashboard/', require_session(dashboard), name='dashboard'),
    path('api/import/', require_session(import_bookings), name='import-bookings'),
    path('api/ar/dashboard/', require_session(ar_dashboard), name='ar-dashboard'),
    path('api/ar/import/', require_session(import_ar), name='import-ar'),
    path('api/ar/raw/', require_session(ar_raw), name='ar-raw'),
    path('api/ar/save/', require_session(ar_save), name='ar-save'),
    path('api/pipeline/', require_session(pipeline_dashboard), name='pipeline-dashboard'),
    path('api/pipeline/import/',    require_session(import_pipeline),   name='import-pipeline'),
    path('api/pipeline/movement/', require_session(pipeline_movement), name='pipeline-movement'),
    path('api/ai/context/', require_session(ai_views.ai_context), name='ai-context'),
    path('api/ai/chat/', require_session(ai_views.ai_chat), name='ai-chat'),
    path('api/dev/source-code/', require_session(dev_views.dev_source_code), name='dev-source-code'),
    path('api/git/status/', require_session(git_views.git_status), name='git-status'),
    path('api/git/push/', require_session(git_views.git_push), name='git-push'),
    path('api/git/pull/', require_session(git_views.git_pull), name='git-pull'),
    path('api/git/restore-previous/', require_session(git_views.git_restore_previous), name='git-restore-previous'),
    path('api/git/revert-previous/', require_session(git_views.git_revert_previous), name='git-revert-previous'),
]
