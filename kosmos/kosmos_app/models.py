from django.conf import settings
from django.db import models


class DataImport(models.Model):
    file_name = models.CharField(max_length=255)
    imported_at = models.DateTimeField(auto_now_add=True)
    row_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.file_name} ({self.row_count} rows)"


class BookingRecord(models.Model):
    data_import = models.ForeignKey(
        DataImport, related_name="records", on_delete=models.CASCADE
    )
    key_id = models.CharField(max_length=100, blank=True)
    entity = models.CharField(max_length=100, blank=True)
    currency = models.CharField(max_length=20, blank=True)
    contract_id = models.CharField(max_length=150, blank=True)
    contract_name = models.CharField(max_length=255, blank=True)
    sales_person = models.CharField(max_length=150, blank=True)
    mode = models.CharField(max_length=100, blank=True)
    company_size = models.CharField(max_length=100, blank=True)
    industry = models.CharField(max_length=150, blank=True)
    business_unit = models.CharField(max_length=100, blank=True)
    bill_to = models.CharField(max_length=255, blank=True)
    end_user = models.CharField(max_length=255, blank=True)
    product_type = models.CharField(max_length=150, blank=True)
    sub_product_type = models.CharField(max_length=150, blank=True)
    revenue_method = models.CharField(max_length=100, blank=True)
    tcv_usd = models.FloatField(default=0)
    arr_usd = models.FloatField(default=0)
    booking = models.FloatField(default=0)
    booking_status = models.CharField(max_length=150, blank=True)
    order_status = models.CharField(max_length=150, blank=True)
    revenue_type = models.CharField(max_length=100, blank=True)
    term_start = models.DateField(null=True, blank=True)
    term_end = models.DateField(null=True, blank=True)
    line_of_business = models.CharField(max_length=150, blank=True)
    current_arr = models.FloatField(default=0)

    monthly_arr = models.JSONField(default=dict, blank=True)
    monthly_changes = models.JSONField(default=dict, blank=True)
    attribute1 = models.CharField(max_length=255, blank=True)
    attribute2 = models.CharField(max_length=255, blank=True)
    attribute3 = models.CharField(max_length=255, blank=True)
    attribute4 = models.CharField(max_length=255, blank=True)
    attribute5 = models.CharField(max_length=255, blank=True)
    attribute6 = models.CharField(max_length=255, blank=True)
    attribute7 = models.CharField(max_length=255, blank=True)
    attribute8 = models.CharField(max_length=255, blank=True)
    attribute9 = models.CharField(max_length=255, blank=True)
    attribute10 = models.CharField(max_length=255, blank=True)
    attribute11 = models.CharField(max_length=255, blank=True)
    attribute12 = models.CharField(max_length=255, blank=True)
    attribute13 = models.CharField(max_length=255, blank=True)
    attribute14 = models.CharField(max_length=255, blank=True)
    attribute15 = models.CharField(max_length=255, blank=True)
    
    created_by = models.CharField(max_length=150, blank=True)
    creation_date = models.DateField(null=True, blank=True)
    last_update_by = models.CharField(max_length=150, blank=True)
    last_update_date = models.DateField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["data_import", "business_unit"],
                name="kosmos_app__data_im_77ca7a_idx",
            ),
            models.Index(
                fields=["data_import", "industry"],
                name="kosmos_app__data_im_dd1efc_idx",
            ),
        ]

    def __str__(self):
        return self.contract_name or self.contract_id


class ARDataImport(models.Model):
    file_name = models.CharField(max_length=255)
    imported_at = models.DateTimeField(auto_now_add=True)
    as_of_date = models.DateField(null=True, blank=True)
    aging_count = models.PositiveIntegerField(default=0)
    payment_count = models.PositiveIntegerField(default=0)
    renewal_count = models.PositiveIntegerField(default=0)

    # --attributes--
    attribute1 = models.CharField(max_length=255, blank=True)
    attribute2 = models.CharField(max_length=255, blank=True)
    attribute3 = models.CharField(max_length=255, blank=True)
    attribute4 = models.CharField(max_length=255, blank=True)
    attribute5 = models.CharField(max_length=255, blank=True)

    # --audit fields--
    create_date = models.DateField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    last_update_by = models.CharField(max_length=150, blank=True)
    last_update_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.file_name} ({self.imported_at:%Y-%m-%d})"


class ARAgingRecord(models.Model):
    data_import = models.ForeignKey(
        ARDataImport, related_name="aging_records", on_delete=models.CASCADE
    )
    customer = models.CharField(max_length=255, blank=True)
    end_user = models.CharField(max_length=255, blank=True)
    region = models.CharField(max_length=100, blank=True)
    sales_rep = models.CharField(max_length=150, blank=True)
    document_type = models.CharField(max_length=50, blank=True)
    document_date = models.DateField(null=True, blank=True)
    document_number = models.CharField(max_length=150, blank=True)
    due_date = models.DateField(null=True, blank=True)
    open_balance = models.FloatField(default=0)

    attribute1 = models.CharField(max_length=255, blank=True)
    attribute2 = models.CharField(max_length=255, blank=True)
    attribute3 = models.CharField(max_length=255, blank=True)
    attribute4 = models.CharField(max_length=255, blank=True)
    attribute5 = models.CharField(max_length=255, blank=True)
    attribute6 = models.CharField(max_length=255, blank=True)
    attribute7 = models.CharField(max_length=255, blank=True)
    attribute8 = models.CharField(max_length=255, blank=True)
    attribute9 = models.CharField(max_length=255, blank=True)
    attribute10 = models.CharField(max_length=255, blank=True)

    create_date = models.DateField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    last_update_by = models.CharField(max_length=150, blank=True)
    last_update_date = models.DateField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["data_import", "region"],
                name="kosmos_app__data_im_f11075_idx",
            ),
            models.Index(
                fields=["data_import", "end_user"],
                name="kosmos_app__data_im_ac6d60_idx",
            ),
        ]


class ARPaymentRecord(models.Model):
    data_import = models.ForeignKey(
        ARDataImport, related_name="payment_records", on_delete=models.CASCADE
    )
    invoice_number = models.CharField(max_length=150, blank=True)
    customer = models.CharField(max_length=255, blank=True)
    end_user = models.CharField(max_length=255, blank=True)
    sales_rep = models.CharField(max_length=150, blank=True)
    region = models.CharField(max_length=100, blank=True)
    payment_type = models.CharField(max_length=50, blank=True)
    event_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    amount = models.FloatField(default=0)

    attribute1 = models.CharField(max_length=255, blank=True)
    attribute2 = models.CharField(max_length=255, blank=True)
    attribute3 = models.CharField(max_length=255, blank=True)
    attribute4 = models.CharField(max_length=255, blank=True)
    attribute5 = models.CharField(max_length=255, blank=True)
    attribute6 = models.CharField(max_length=255, blank=True)
    attribute7 = models.CharField(max_length=255, blank=True)
    attribute8 = models.CharField(max_length=255, blank=True)
    attribute9 = models.CharField(max_length=255, blank=True)
    attribute10 = models.CharField(max_length=255, blank=True)

    create_date = models.DateField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    last_update_by = models.CharField(max_length=150, blank=True)
    last_update_date = models.DateField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["data_import", "invoice_number"],
                name="kosmos_app__data_im_ae1c1f_idx",
            ),
            models.Index(
                fields=["data_import", "region"],
                name="kosmos_app__data_im_72f63d_idx",
            ),
        ]


class ARRenewalRecord(models.Model):
    data_import = models.ForeignKey(
        ARDataImport, related_name="renewal_records", on_delete=models.CASCADE
    )
    end_user = models.CharField(max_length=255, blank=True)
    renewal_status = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=150, blank=True)
    amount = models.FloatField(default=0)
    sales_rep = models.CharField(max_length=150, blank=True)
    region = models.CharField(max_length=100, blank=True)
    remarks = models.TextField(blank=True)

    attribute1 = models.CharField(max_length=255, blank=True)
    attribute2 = models.CharField(max_length=255, blank=True)
    attribute3 = models.CharField(max_length=255, blank=True)
    attribute4 = models.CharField(max_length=255, blank=True)
    attribute5 = models.CharField(max_length=255, blank=True)
    attribute6 = models.CharField(max_length=255, blank=True)
    attribute7 = models.CharField(max_length=255, blank=True)
    attribute8 = models.CharField(max_length=255, blank=True)
    attribute9 = models.CharField(max_length=255, blank=True)
    attribute10 = models.CharField(max_length=255, blank=True)

    create_date = models.DateField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    last_update_by = models.CharField(max_length=150, blank=True)
    last_update_date = models.DateField(null=True, blank=True)


class PipelineImport(models.Model):
    file_name = models.CharField(max_length=255)
    imported_at = models.DateTimeField(auto_now_add=True)
    row_count = models.PositiveIntegerField(default=0)
    weeks = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.file_name} ({self.row_count} rows)"


class PipelineRecord(models.Model):
    data_import = models.ForeignKey(
        PipelineImport, related_name="records", on_delete=models.CASCADE
    )
    record_id = models.CharField(max_length=150, blank=True)
    deal_name = models.CharField(max_length=500, blank=True)
    company = models.CharField(max_length=500, blank=True)
    stage = models.CharField(max_length=150, blank=True)
    forecast_category = models.CharField(max_length=100, blank=True)
    owner = models.CharField(max_length=150, blank=True)
    team = models.CharField(max_length=150, blank=True)
    amount = models.FloatField(default=0)
    weighted = models.FloatField(default=0)
    term = models.CharField(max_length=100, blank=True)
    order_type = models.CharField(max_length=100, blank=True)
    source = models.CharField(max_length=150, blank=True)
    week = models.CharField(max_length=30, blank=True)
    week_num = models.IntegerField(default=0)
    close_quarter = models.CharField(max_length=20, blank=True)
    region = models.CharField(max_length=100, blank=True)
    sector = models.CharField(max_length=150, blank=True)
    create_date = models.DateField(null=True, blank=True)
    last_activity_date = models.DateField(null=True, blank=True)
    next_step = models.TextField(blank=True)
    partner_owner = models.CharField(max_length=150, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["data_import", "week"]),
            models.Index(fields=["data_import", "stage"]),
            models.Index(fields=["data_import", "owner"]),
        ]

    def __str__(self):
        return self.deal_name or self.record_id


class AccessRoleAssignment(models.Model):
    ROLE_ADMINISTRATOR = "administrator"
    ROLE_DEVELOPER = "developer"
    ROLE_PIPELINE = "pipeline"
    ROLE_AR = "ar"
    ROLE_ARR = "arr"

    ROLE_CHOICES = [
        (ROLE_ADMINISTRATOR, "Administrator"),
        (ROLE_DEVELOPER, "Developer"),
        (ROLE_PIPELINE, "Pipeline Dashboard"),
        (ROLE_AR, "A/R Dashboard"),
        (ROLE_ARR, "ARR Dashboard"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="access_role_assignments",
        on_delete=models.CASCADE,
    )
    role = models.CharField(max_length=40, choices=ROLE_CHOICES)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    last_updated_by = models.CharField(max_length=150, blank=True)
    last_updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_updated_date", "user__username", "role"]
        indexes = [
            models.Index(fields=["user", "role", "end_date"]),
            models.Index(fields=["role", "start_date", "end_date"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.role}"


class AccessUserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="access_profile",
        on_delete=models.CASCADE,
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_by = models.CharField(max_length=150, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    last_updated_by = models.CharField(max_length=150, blank=True)
    last_updated_date = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self):
        return f"{self.user} access profile"


class AccessAuditLog(models.Model):
    ACTION_USER_CREATED = "user_created"
    ACTION_USER_UPDATED = "user_updated"
    ACTION_ACCESS_CHANGED = "access_changed"
    ACTION_ROLE_GRANTED = "role_granted"
    ACTION_ROLE_REVOKED = "role_revoked"
    ACTION_USER_ACTIVATED = "user_activated"
    ACTION_USER_DEACTIVATED = "user_deactivated"
    ACTION_USER_REVOKED = "user_revoked"

    ACTION_CHOICES = [
        (ACTION_USER_CREATED, "User Created"),
        (ACTION_USER_UPDATED, "User Updated"),
        (ACTION_ACCESS_CHANGED, "Access Changed"),
        (ACTION_ROLE_GRANTED, "Role Granted"),
        (ACTION_ROLE_REVOKED, "Role Revoked"),
        (ACTION_USER_ACTIVATED, "User Activated"),
        (ACTION_USER_DEACTIVATED, "User Deactivated"),
        (ACTION_USER_REVOKED, "User Revoked"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="access_audit_logs",
        on_delete=models.CASCADE,
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    role = models.CharField(max_length=40, blank=True)
    description = models.TextField()
    created_by = models.CharField(max_length=150, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_date"]
        indexes = [
            models.Index(fields=["user", "created_date"]),
            models.Index(fields=["action", "created_date"]),
            models.Index(fields=["role", "created_date"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.action}"
