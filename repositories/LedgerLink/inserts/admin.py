from django.contrib import admin
from .models import Insert


# Register your models here.

@admin.register(Insert)
class InsertAdmin(admin.ModelAdmin):
    list_display = ('sku', 'insert_name', 'insert_quantity', 'customer', 'created_at', 'updated_at')
    search_fields = ('sku', 'insert_name', 'customer__company_name')
