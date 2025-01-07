from django.contrib import admin
from .models import Material, BoxPrice


# Register your models here.

@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'unit_price')
    search_fields = ('name',)


@admin.register(BoxPrice)
class BoxPriceAdmin(admin.ModelAdmin):
    list_display = ('box_type', 'price', 'length', 'width', 'height')
    search_fields = ('box_type',)
