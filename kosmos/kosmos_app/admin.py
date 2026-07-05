from django.contrib import admin

from .models import (
    ARAgingRecord,
    ARDataImport,
    ARPaymentRecord,
    ARRenewalRecord,
    BookingRecord,
    DataImport,
)


@admin.register(DataImport)
class DataImportAdmin(admin.ModelAdmin):
    list_display = ("file_name", "row_count", "imported_at")


@admin.register(BookingRecord)
class BookingRecordAdmin(admin.ModelAdmin):
    list_display = (
        "contract_id",
        "end_user",
        "business_unit",
        "current_arr",
        "data_import",
    )
    list_filter = ("data_import", "business_unit", "industry", "product_type")
    search_fields = ("contract_id", "contract_name", "bill_to", "end_user")


@admin.register(ARDataImport)
class ARDataImportAdmin(admin.ModelAdmin):
    list_display = (
        "file_name", "as_of_date", "aging_count", "payment_count",
        "renewal_count", "imported_at",
    )


@admin.register(ARAgingRecord)
class ARAgingRecordAdmin(admin.ModelAdmin):
    list_display = (
        "document_number", "end_user", "region", "due_date", "open_balance",
        "data_import",
    )
    list_filter = ("data_import", "region", "sales_rep")
    search_fields = ("document_number", "customer", "end_user")


@admin.register(ARPaymentRecord)
class ARPaymentRecordAdmin(admin.ModelAdmin):
    list_display = (
        "invoice_number", "end_user", "payment_type", "event_date", "amount",
        "data_import",
    )
    list_filter = ("data_import", "payment_type", "region")
    search_fields = ("invoice_number", "customer", "end_user")


@admin.register(ARRenewalRecord)
class ARRenewalRecordAdmin(admin.ModelAdmin):
    list_display = (
        "end_user", "renewal_status", "status", "amount", "region", "data_import",
    )
    list_filter = ("data_import", "region", "status")
