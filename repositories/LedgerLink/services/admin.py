from django.contrib import admin
from .models import Service


# Register your models here.

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('service_name', 'description', 'created_at', 'updated_at')
    search_fields = ('service_name',)
