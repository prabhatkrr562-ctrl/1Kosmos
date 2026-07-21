from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile

from datetime import date

from .models import (
    ARAgingRecord,
    ARDataImport,
    ARPaymentRecord,
    ARRenewalRecord,
    BookingRecord,
    DataImport,
    PipelineImport,
    PipelineRecord,
    AccessRoleAssignment,
)
from .excel import _booking_column_maps, parse_booking_csv


class DashboardApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="arr-test-user")
        AccessRoleAssignment.objects.create(user=user, role="arr")
        self.client.force_login(user)
        data_import = DataImport.objects.create(file_name="bookings.xlsx", row_count=2)
        BookingRecord.objects.create(
            data_import=data_import,
            contract_id="NAM-1",
            end_user="Customer One",
            business_unit="NAM",
            industry="Financial Services",
            product_type="Product",
            sub_product_type="Workforce",
            revenue_type="Recurring",
            booking=125000,
            current_arr=100000,
            monthly_arr={"2026-04": 90000, "2026-05": 100000},
        )
        BookingRecord.objects.create(
            data_import=data_import,
            contract_id="APAC-1",
            end_user="Customer Two",
            business_unit="APAC",
            industry="TMT",
            product_type="Product",
            sub_product_type="Platform",
            revenue_type="Recurring",
            booking=60000,
            current_arr=50000,
            monthly_arr={"2026-04": 40000, "2026-05": 50000},
        )

    def test_dashboard_returns_aggregated_metrics(self):
        response = self.client.get("/api/dashboard/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["kpis"]["total_arr"], 150000)
        self.assertEqual(payload["kpis"]["customers"], 2)
        self.assertEqual(payload["trend"][-1]["value"], 150000)
        self.assertEqual(
            payload["breakdowns"]["average_arr_by_customer"][0]["value"],
            100000,
        )

    def test_dashboard_filters_records(self):
        response = self.client.get("/api/dashboard/?business_unit=NAM")
        payload = response.json()
        self.assertEqual(payload["kpis"]["total_arr"], 100000)
        self.assertEqual(len(payload["records"]), 1)

    def test_dashboard_period_filters_match_reference_ranges(self):
        qtd = self.client.get("/api/dashboard/?period=qtd").json()
        self.assertEqual(qtd["period"]["from"], "2026-04")
        self.assertEqual(qtd["period"]["to"], "2026-05")

        custom = self.client.get(
            "/api/dashboard/?period=custom&from=2026-04&to=2026-04"
        ).json()
        self.assertEqual(custom["period"]["value"], "custom")
        self.assertEqual(custom["period"]["from"], "2026-04")
        self.assertEqual(custom["period"]["to"], "2026-04")
        self.assertEqual(custom["kpis"]["total_arr"], 130000)
        self.assertEqual([row["month"] for row in custom["trend"]], ["2026-04"])

    def test_period_downsell_is_netted_before_kpi_calculation(self):
        data_import = DataImport.objects.latest("id")
        BookingRecord.objects.create(
            data_import=data_import, contract_id="NET-1", end_user="Correction One",
            revenue_type="Recurring", monthly_arr={"2026-04": 1000, "2026-05": 850},
            monthly_changes={"2026-05": {"Downsell": -150}},
        )
        BookingRecord.objects.create(
            data_import=data_import, contract_id="NET-2", end_user="Correction Two",
            revenue_type="Recurring", monthly_arr={"2026-04": 1000, "2026-05": 1100},
            monthly_changes={"2026-05": {"DOWNSELL": 100}},
        )

        payload = self.client.get("/api/dashboard/?period=ytd").json()
        self.assertEqual(payload["kpis"]["ltm_downsell"], 50)

    def test_customer_kpi_counts_only_active_latest_month_customers(self):
        data_import = DataImport.objects.latest("id")
        BookingRecord.objects.create(
            data_import=data_import, contract_id="ENDED-1", end_user="Ended Customer",
            revenue_type="Recurring", monthly_arr={"2026-04": 1000, "2026-05": 0},
        )

        payload = self.client.get("/api/dashboard/").json()
        self.assertEqual(payload["kpis"]["customers"], 2)


class PipelineDashboardApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="pipeline-test-user")
        AccessRoleAssignment.objects.create(user=user, role="pipeline")
        self.client.force_login(user)
        data_import = PipelineImport.objects.create(
            file_name="pipeline.xlsx", row_count=6, weeks=["Week 7", "Week 27"]
        )
        rows = [
            ("A", "Week 7", "40%-Scoping", "Upside", 200, 80, "Q4 26", "NA"),
            ("A", "Week 27", "60%-Propose", "Upside", 300, 180, "Q4 26", "NA"),
            ("B", "Week 27", "90%-Negotiate & Close", "Commit ", 100, 90, "Q3 27", "APAC"),
            ("C", "Week 27", "Business Won", "Closed won", 50, 50, "Q2 26", "NA"),
            ("D", "Week 27", "Business Lost", "Not forecasted", 25, 0, "Q1 26", "NA"),
            ("E", "Week 27", "20%-Discovery", "Not forecasted", 0, 0, "Q1 27", "NA"),
        ]
        for record_id, week, stage, forecast, amount, weighted, quarter, region in rows:
            PipelineRecord.objects.create(
                data_import=data_import,
                record_id=record_id,
                deal_name=f"Deal {record_id}",
                owner="Rep One" if record_id != "B" else "Rep Two",
                team="Direct",
                week=week,
                week_num=int(week.split()[-1]),
                stage=stage,
                forecast_category=forecast,
                amount=amount,
                weighted=weighted,
                close_quarter=quarter,
                region=region,
                order_type="New Business",
                sector="Technology",
            )
        PipelineRecord.objects.filter(record_id="C", week="Week 27").update(
            create_date=date(2026, 1, 1),
            close_date=date(2026, 3, 2),
        )

    def test_pipeline_kpis_and_distributions_use_active_positive_deals(self):
        payload = self.client.get("/api/pipeline/").json()
        self.assertEqual(payload["kpis"]["active_pipeline"], 400)
        self.assertEqual(payload["kpis"]["active_deals"], 2)
        self.assertEqual(payload["kpis"]["weighted_pipeline"], 270)
        self.assertEqual(payload["kpis"]["won_ytd"], 50)
        self.assertEqual(payload["kpis"]["lost_ytd"], 25)
        self.assertEqual(sum(row["amount"] for row in payload["stage_dist"]), 400)
        self.assertEqual(sum(row["amount"] for row in payload["region_dist"]), 400)
        latest = payload["weekly_trend"][-1]
        self.assertEqual(latest["count"], 2)
        self.assertEqual(latest["active_count_all"], 3)
        self.assertEqual(latest["total_count_all"], 5)
        self.assertEqual(latest["won_count"], 1)
        self.assertEqual(payload["commentary"]["new_wins"][0]["record_id"], "C")

    def test_pipeline_html_equivalent_filters_and_rep_history(self):
        payload = self.client.get(
            "/api/pipeline/?forecast=Commit&order_type=New%20Business&year=27"
        ).json()
        self.assertEqual(payload["kpis"]["active_pipeline"], 100)
        self.assertEqual(payload["kpis"]["aop"], 23900000)
        self.assertEqual(payload["kpis"]["sales_target"], 30000000)
        self.assertEqual(payload["rep_weekly_trend"]["Rep Two"][-1]["active"], 100)

    def test_pipeline_reference_view_mode_and_q3_27_plus_filter(self):
        weighted = self.client.get("/api/pipeline/?view_mode=weighted").json()

        self.assertEqual(weighted["view_mode"], "weighted")
        self.assertEqual(weighted["kpis"]["active_pipeline"], 270)
        self.assertEqual(sum(row["amount"] for row in weighted["stage_dist"]), 270)
        self.assertEqual(weighted["weekly_trend"][-1]["active"], 270)

        future = self.client.get("/api/pipeline/?quarter=Q3%2027%2B").json()
        self.assertEqual(future["kpis"]["active_pipeline"], 100)
        self.assertEqual(future["kpis"]["active_deals"], 1)

    def test_pipeline_movement_values_include_their_comparison_period(self):
        payload = self.client.get("/api/pipeline/?week=Week%2027").json()

        self.assertEqual(payload["movement"]["from_week"], "Week 7")
        self.assertEqual(payload["movement"]["prev_week"], "Week 7")
        self.assertEqual(payload["movement"]["to_week"], "Week 27")
        self.assertEqual(len(payload["movement"]["forward"]), 1)

    def test_executive_w26_w27_movement_card_matches_reference(self):
        data_import = PipelineImport.objects.latest("id")

        def add_snapshot(record_id, name, week, stage, quarter="Q2 26"):
            PipelineRecord.objects.create(
                data_import=data_import,
                record_id=record_id,
                deal_name=name,
                owner="Rep One",
                team="Direct",
                week=week,
                week_num=int(week.split()[-1]),
                stage=stage,
                forecast_category="Upside",
                amount=100,
                weighted=40,
                close_quarter=quarter,
                region="North America",
                order_type="New Business",
                sector="Technology",
            )

        changes = [
            ("F1", "Forward 1", "20%-Discovery", "40%-Scoping", "Q2 26"),
            ("F2", "Forward 2", "20%-Discovery", "40%-Scoping", "Q2 26"),
            ("F3", "Forward 3", "40%-Scoping", "60%-Propose", "Q3 26"),
            ("F4", "Forward 4", "60%-Propose", "80%-Validate", "Q4 26"),
            ("F5", "Forward FY27", "5% - Prospecting", "20%-Discovery", "Q1 27"),
            ("W1", "New Win", "90%-Negotiate & Close", "Business Won", "Q2 26"),
        ]
        for record_id, name, old_stage, new_stage, quarter in changes:
            add_snapshot(record_id, name, "Week 26", old_stage, quarter)
            add_snapshot(record_id, name, "Week 27", new_stage, quarter)

        # Two distinct deals share one CRM ID. Neither moved, and they must not
        # be collapsed into a false Business Won -> active regression.
        for week in ("Week 26", "Week 27"):
            add_snapshot("SHARED", "Shared Active", week, "60%-Propose")
            add_snapshot("SHARED", "Shared Won", week, "Business Won")

        payload = self.client.get("/api/pipeline/").json()

        self.assertEqual(payload["executive"]["previous_week_short"], "W26")
        self.assertEqual(payload["executive"]["selected_week_short"], "W27")
        self.assertEqual(payload["executive"]["movement_counts"]["total"], 6)
        self.assertEqual(payload["executive"]["movement_counts"]["forward"], 4)
        self.assertEqual(payload["executive"]["movement_counts"]["backward"], 0)

    def test_industry_benchmark_uses_reference_formulas_and_close_dates(self):
        benchmark = self.client.get("/api/pipeline/").json()["industry_benchmark"]

        self.assertEqual(benchmark["metrics"]["wrcount"], 50.0)
        self.assertEqual(benchmark["metrics"]["wrdollar"], 66.7)
        self.assertEqual(benchmark["metrics"]["wrpipe"], 12.5)
        self.assertEqual(benchmark["metrics"]["commit"], 25.0)
        self.assertEqual(benchmark["metrics"]["late"], 25.0)
        self.assertEqual(benchmark["metrics"]["avgdeal"], 200.0)
        self.assertEqual(benchmark["metrics"]["cycle"], 60)
        self.assertEqual(benchmark["cycle"]["source"], "close_date")
        self.assertEqual(benchmark["cycle"]["details"][0]["cycle_days"], 60)

    def test_movement_matches_deal_name_and_company_when_record_ids_drift(self):
        data_import = PipelineImport.objects.latest("id")
        rows = [
            # The source workbook contains both CRM IDs for this business
            # deal. Name + company exposes the won -> lost transition.
            ("STAPLES-LOST", "Week 7", "Staples | Workforce (1Key)", "Staples", "Business Lost"),
            ("STAPLES-WON", "Week 7", "Staples | Workforce (1Key)", "Staples", "Business Won"),
            ("STAPLES-LOST", "Week 27", "Staples | Workforce (1Key)", "Staples", "Business Lost"),
            ("STAPLES-WON", "Week 27", "Staples | Workforce (1Key)", "Staples", "Business Won"),
            # A reused ID with a changed business name is a new deal, not a
            # forward movement of the old one.
            ("WASHU", "Week 7", "Washington University - New Deal", "Washington University", "80%-Validate"),
            ("WASHU", "Week 27", "WashU | Verify (RCV)", "Washington University", "90%-Negotiate & Close"),
        ]
        for record_id, week, deal_name, company, stage in rows:
            PipelineRecord.objects.create(
                data_import=data_import,
                record_id=record_id,
                deal_name=deal_name,
                company=company,
                week=week,
                week_num=int(week.split()[-1]),
                stage=stage,
                amount=100,
            )

        payload = self.client.get(
            "/api/pipeline/movement/?from_week=Week%207&to_week=Week%2027"
        ).json()["movement"]

        self.assertEqual([row["deal_name"] for row in payload["lost"]], ["Staples | Workforce (1Key)"])
        self.assertNotIn("WashU | Verify (RCV)", [row["deal_name"] for row in payload["forward"]])


class ARDashboardApiTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="ar-test-user")
        AccessRoleAssignment.objects.create(user=user, role="ar")
        self.client.force_login(user)
        data_import = ARDataImport.objects.create(
            file_name="ar.xlsx",
            as_of_date=date(2026, 6, 15),
            aging_count=2,
            payment_count=2,
            renewal_count=1,
        )
        ARAgingRecord.objects.create(
            data_import=data_import,
            customer="Customer One LLC",
            end_user="Customer One",
            region="NAM",
            sales_rep="Rep One",
            document_number="INV-1",
            due_date=date(2026, 3, 1),
            open_balance=100000,
        )
        ARAgingRecord.objects.create(
            data_import=data_import,
            customer="Customer Two LLC",
            end_user="Customer Two",
            region="APAC",
            sales_rep="Rep Two",
            document_number="INV-2",
            due_date=date(2026, 7, 1),
            open_balance=50000,
        )
        ARPaymentRecord.objects.create(
            data_import=data_import,
            invoice_number="OLD-1",
            end_user="Customer One",
            region="NAM",
            payment_type="Invoice",
            event_date=date(2026, 1, 1),
            amount=25000,
        )
        ARPaymentRecord.objects.create(
            data_import=data_import,
            invoice_number="OLD-1",
            end_user="Customer One",
            region="NAM",
            payment_type="Payment",
            event_date=date(2026, 2, 15),
            amount=-25000,
        )
        ARRenewalRecord.objects.create(
            data_import=data_import,
            end_user="Customer One",
            renewal_status="2 Months",
            status="Annual Renewal",
            amount=30000,
            sales_rep="Rep One",
            region="NAM",
        )

    def test_ar_dashboard_calculates_each_source_area(self):
        response = self.client.get("/api/ar/dashboard/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["aging"]["kpis"]["total_ar"], 150000)
        self.assertEqual(payload["aging"]["kpis"]["critical_91_plus"], 100000)
        self.assertEqual(payload["collections"]["kpis"]["total_collected"], 25000)
        self.assertEqual(payload["collections"]["kpis"]["average_cycle"], 45)
        self.assertEqual(payload["renewals"]["kpis"]["pending_total"], 30000)


class DataManagerAccessTests(TestCase):
    protected_endpoints = [
        ("post", "/api/import/"),
        ("post", "/api/ar/import/"),
        ("get", "/api/ar/raw/"),
        ("post", "/api/ar/save/"),
        ("post", "/api/pipeline/import/"),
    ]

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="dashboard-user@example.com",
            email="dashboard-user@example.com",
            password="test-password",
        )
        for role in ("arr", "ar", "pipeline"):
            AccessRoleAssignment.objects.create(user=self.user, role=role)
        self.client.force_login(self.user)

    def _request(self, method, path):
        return getattr(self.client, method)(path)

    def test_dashboard_roles_cannot_use_data_management_endpoints(self):
        for method, path in self.protected_endpoints:
            with self.subTest(path=path):
                response = self._request(method, path)
                self.assertEqual(response.status_code, 403)

    def test_data_manager_permission_passes_the_access_gate(self):
        AccessRoleAssignment.objects.create(user=self.user, role="data_manager")

        for method, path in self.protected_endpoints:
            with self.subTest(path=path):
                response = self._request(method, path)
                self.assertNotEqual(response.status_code, 403)


class BookingImportFormatTests(TestCase):
    def test_source_workbook_headers_split_arr_changes_and_deal_types(self):
        fields, arr_months, change_months, deal_types = _booking_column_maps([
            ("A", "Key id"),
            ("C", "Cur."),
            ("D", "Contract_ID"),
            ("H", "Size"),
            ("S", "ARR Model"),
            ("AF", "2026-05-01"),
            ("HC", "2026-05-01"),
            ("KT", "DealType May-26"),
            ("N", "Sub Product Type"),
            ("KX", "Sub Product Type"),
        ])

        self.assertEqual(fields["C"], "currency")
        self.assertEqual(fields["H"], "company_size")
        self.assertEqual(fields["S"], "arr_usd")
        self.assertEqual(arr_months, {"AF": "2026-05"})
        self.assertEqual(change_months, {"HC": "2026-05"})
        self.assertEqual(deal_types, {"KT": "2026-05"})
        self.assertEqual(fields["N"], "sub_product_type")
        self.assertNotIn("KX", fields)

    def test_csv_import_preserves_arr_and_labeled_movement_amount(self):
        content = (
            "Key id,Cur.,Contract_ID,Size,ARR Model,2026-05-01,"
            "2026-05-01,DealType May-26\n"
            "K001,USD,C-001,Enterprise,100,100,25,Upsell\n"
        )
        upload = SimpleUploadedFile("booking.csv", content.encode("utf-8"))

        record = parse_booking_csv(upload)[0]

        self.assertEqual(record["currency"], "USD")
        self.assertEqual(record["company_size"], "Enterprise")
        self.assertEqual(record["monthly_arr"], {"2026-05": 100.0})
        self.assertEqual(record["monthly_changes"], {"2026-05": {"Upsell": 25.0}})

    def test_2026_06_export_deal_type_backfills_blank_status_columns(self):
        content = (
            "Key id,Cur.,Order Status Booking,Order Status,Rec/Non Rec,Deal Type,Type,"
            "2026-05,2026-06,,2026-05,2026-06,f,FY25,DealType May-26\n"
            "K001,USD,,,,New,Commercial,100,100,,100,0,,,New\n"
        )
        upload = SimpleUploadedFile("Booking_Database_2026-06.csv", content.encode("utf-8"))

        record = parse_booking_csv(upload)[0]

        self.assertEqual(record["booking_status"], "New")
        self.assertEqual(record["order_status"], "New")
        self.assertEqual(record["line_of_business"], "Commercial")
        self.assertEqual(record["monthly_arr"], {"2026-05": 100.0, "2026-06": 100.0})
        self.assertEqual(record["monthly_changes"], {"2026-05": {"New": 100.0}})
        self.assertNotIn("deal_type", record)

    def test_deal_type_does_not_override_populated_status_columns(self):
        content = (
            "Key id,Order Status Booking,Order Status,Deal Type,2026-05\n"
            "K001,Active,Churn/Completed,Upsell,100\n"
        )
        upload = SimpleUploadedFile("booking.csv", content.encode("utf-8"))

        record = parse_booking_csv(upload)[0]

        self.assertEqual(record["booking_status"], "Active")
        self.assertEqual(record["order_status"], "Churn/Completed")
