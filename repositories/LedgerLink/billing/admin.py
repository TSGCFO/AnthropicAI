# Register your models here.
from django.contrib import admin
from .models import BillingReport, BillingReportDetail

@admin.register(BillingReport)
class BillingReportAdmin(admin.ModelAdmin):
    list_display = ('customer', 'start_date', 'end_date', 'total_amount', 'generated_at')
    list_filter = ('customer', 'generated_at')
    search_fields = ('customer__company_name',)
    date_hierarchy = 'generated_at'

@admin.register(BillingReportDetail)
class BillingReportDetailAdmin(admin.ModelAdmin):
    list_display = ('report', 'order', 'total_amount')
    list_filter = ('report__customer',)
    search_fields = ('report__customer__company_name', 'order__transaction_id')
    