from django.contrib import admin
from .models import Order

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'transaction_id', 'customer', 'reference_number',
        'close_date', 'total_item_qty', 'get_status'
    )
    list_filter = ('customer', 'close_date')
    search_fields = ('transaction_id', 'customer__company_name', 'reference_number')
    ordering = ('-transaction_id',)

    def get_status(self, obj):
        return 'Closed' if obj.close_date else 'Open'
    get_status.short_description = 'Status'