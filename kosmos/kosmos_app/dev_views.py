from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET


PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Keys must match the `name` prop passed to <DevOverlay name="..."> in JSX.
DEV_SOURCE_FILES = {
    # ── Shared layout ──────────────────────────────────────────────────────
    "Navbar": {
        "frontend": [
            "kosmos_frontend/src/components/Navbar/Navbar.js",
            "kosmos_frontend/src/components/Navbar/Navbar.css",
            "kosmos_frontend/src/layouts/MainLayout.js",
        ],
        "backend": [
            "kosmos/kosmos_app/auth_views.py",
            "kosmos/kosmos_app/middleware.py",
            "kosmos/kosmos_app/urls.py",
        ],
    },
    "TabNavigation": {
        "frontend": [
            "kosmos_frontend/src/pages/ARMain.js",
            "kosmos_frontend/src/pages/ARR_Main.js",
            "kosmos_frontend/src/pages/PipelineMain.js",
        ],
        "backend": [],
    },
    "FilterBar": {
        "frontend": [
            "kosmos_frontend/src/pages/ARMain.js",
            "kosmos_frontend/src/pages/ARR_Main.js",
            "kosmos_frontend/src/pages/PipelineMain.js",
        ],
        "backend": [],
    },

    # ── ARR Dashboard (/arr) ───────────────────────────────────────────────
    "ARRDashboard": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Main.js",
            "kosmos_frontend/src/pages/ARR_Elements/ARRDashboard.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/arr_views/shared.py",
            "kosmos/kosmos_app/models.py",
            "kosmos/kosmos_app/excel.py",
        ],
    },
    "BUAnalytics": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/BUAnalytics.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "Intelligence": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/Intelligence.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "QuotaVsAOP": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/QuotaVsAOP.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "Customer360": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/Customer360.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/arr_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "Rep360": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/Rep360.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/dashboard.py",
            "kosmos/kosmos_app/arr_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "ManageData": {
        "frontend": [
            "kosmos_frontend/src/pages/ARR_Elements/ManageArrData.js",
            "kosmos_frontend/src/pages/ARR_Elements/arrShared.js",
            "kosmos_frontend/src/pages/ARR_Main.css",
        ],
        "backend": [
            "kosmos/kosmos_app/arr_views/import_bookings.py",
            "kosmos/kosmos_app/excel.py",
            "kosmos/kosmos_app/models.py",
        ],
    },

    # ── AR Dashboard (/ar) ─────────────────────────────────────────────────
    "AgingView": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/ArAging.js",
            "kosmos_frontend/src/pages/AR_Elements/arShared.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/dashboard.py",
            "kosmos/kosmos_app/ar_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "ARShared": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/arShared.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/dashboard.py",
            "kosmos/kosmos_app/ar_views/shared.py",
        ],
    },
    "CollectionHistory": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/CollectionHistory.js",
            "kosmos_frontend/src/pages/AR_Elements/arShared.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/dashboard.py",
            "kosmos/kosmos_app/ar_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "PendingInvoice": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/PendingInvoice.js",
            "kosmos_frontend/src/pages/AR_Elements/arShared.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "LiveEditor": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/LiveEditor.js",
            "kosmos_frontend/src/pages/ARMain.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/save.py",
            "kosmos/kosmos_app/ar_views/raw.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "ArMaster": {
        "frontend": [
            "kosmos_frontend/src/pages/AR_Elements/ArMaster.js",
            "kosmos_frontend/src/pages/AR_Elements/arShared.js",
            "kosmos_frontend/src/pages/ARMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/ar_views/import_ar.py",
            "kosmos/kosmos_app/ar_excel.py",
            "kosmos/kosmos_app/models.py",
        ],
    },

    # ── Pipeline Dashboard (/pipeline) ─────────────────────────────────────
    "Executive": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/Executive.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/pipeline_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "PipelineTrend": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/PipelineTrend.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/pipeline_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "DealMovement": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/DealMovement.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/pipeline_views/shared.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "RepKPIs": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/RepKpis.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "Forecast": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/Forecast.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "Region": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/Region.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "DealExplorer": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/DealExplorer.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/dashboard.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
    "PipelineMaster": {
        "frontend": [
            "kosmos_frontend/src/pages/Pipeline_Elements/PipelineMaster.js",
            "kosmos_frontend/src/pages/Pipeline_Elements/plShared.js",
            "kosmos_frontend/src/pages/PipelineMain.css",
        ],
        "backend": [
            "kosmos/kosmos_app/pipeline_views/import_pipeline.py",
            "kosmos/kosmos_app/pipeline_excel.py",
            "kosmos/kosmos_app/models.py",
        ],
    },
}

DEV_SOURCE_ALIASES = {
    "AR KPI:": "ARShared",
    "AR Chart:": "ARShared",
    "AR Bar List:": "ARShared",
    "Aging Section:": "AgingView",
    "KPI:": "ARRDashboard",
    "LOB:": "ARRDashboard",
    "BU:": "BUAnalytics",
    "ARR ": "ARRDashboard",
    "YTD Growth": "ARRDashboard",
    "GRR% Gross Revenue Retention": "ARRDashboard",
    "NRR% Net Revenue Retention": "ARRDashboard",
    "New ARR by Quarter": "ARRDashboard",
    "Churn & Downsell Trend": "ARRDashboard",
    "Sub-Product Table": "ARRDashboard",
    "Customer ARR Table": "ARRDashboard",
    "BU Breakdown Chart": "BUAnalytics",
    "Industry Breakdown Chart": "BUAnalytics",
}


def _resolve_component(component):
    if component in DEV_SOURCE_FILES:
        return component
    for prefix, target in DEV_SOURCE_ALIASES.items():
        if component.startswith(prefix):
            return target
    return None


def _read_file(relative_path):
    full_path = (PROJECT_ROOT / relative_path).resolve()
    if PROJECT_ROOT not in full_path.parents:
        return {"file": relative_path, "error": "Path is outside the project."}
    try:
        return {"file": relative_path, "code": full_path.read_text(encoding="utf-8")}
    except UnicodeDecodeError:
        return {"file": relative_path, "code": full_path.read_text(encoding="utf-8-sig")}
    except OSError as exc:
        return {"file": relative_path, "error": str(exc)}


@require_GET
def dev_source_code(request):
    if not settings.DEBUG:
        return JsonResponse(
            {"error": "Developer source code is only available when DEBUG=True."},
            status=403,
        )

    component = request.GET.get("component", "").strip()
    resolved_component = _resolve_component(component)
    file_groups = DEV_SOURCE_FILES.get(resolved_component)
    if not file_groups:
        return JsonResponse(
            {"error": f"No source files registered for component: {component!r}"},
            status=404,
        )

    return JsonResponse({
        "component": component,
        "resolved_component": resolved_component,
        "frontend": [_read_file(p) for p in file_groups.get("frontend", [])],
        "backend":  [_read_file(p) for p in file_groups.get("backend",  [])],
    })
