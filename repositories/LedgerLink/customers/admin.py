from django.contrib import admin

from customers.models import Customer


# Register your models here.
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('id', 'company_name', 'legal_business_name', 'email', 'phone', 'created_at')
    search_fields = ('id', 'company_name', 'legal_business_name', 'email')
