from django.test import TestCase

from datetime import date

from .models import (
    ARAgingRecord,
    ARDataImport,
    ARPaymentRecord,
    ARRenewalRecord,
    BookingRecord,
    DataImport,
)


class DashboardApiTests(TestCase):
    def setUp(self):
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


class ARDashboardApiTests(TestCase):
    def setUp(self):
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
