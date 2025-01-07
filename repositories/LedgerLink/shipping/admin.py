from django.contrib import admin
from .models import CADShipping, USShipping


# Register your models here.

@admin.register(CADShipping)
class CADShippingAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'customer', 'service_code_description', 'ship_date', 'carrier')
    search_fields = ('transaction__transaction_id', 'customer__company_name')


@admin.register(USShipping)
class USShippingAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'customer', 'ship_date', 'delivery_status')
    search_fields = ('transaction__transaction_id', 'customer__company_name')
