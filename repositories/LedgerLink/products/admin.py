from django.contrib import admin
from .models import Product


# Register your models here.

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('sku', 'customer', 'labeling_unit_1', 'labeling_quantity_1', 'labeling_unit_2', 'labeling_quantity_2',
                    'labeling_unit_3', 'labeling_quantity_3', 'labeling_unit_4', 'labeling_quantity_4',
                    'labeling_unit_5', 'labeling_quantity_5')
    search_fields = ('sku', 'customer')
