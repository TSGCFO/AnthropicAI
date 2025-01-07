from django.contrib import admin
from django.forms import ModelForm
from .models import CustomerService


class CustomerServiceAdminForm(ModelForm):
    class Meta:
        model = CustomerService
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Initialize SKUs queryset
        if self.instance.pk and self.instance.customer:
            # Editing existing instance
            self.fields['skus'].queryset = self.instance.customer.product_set.all()
        elif self.data.get('customer'):
            # Form was submitted with a customer
            from products.models import Product
            self.fields['skus'].queryset = Product.objects.filter(
                customer_id=self.data['customer']
            )
        else:
            # New instance, no customer selected yet
            self.fields['skus'].queryset = self.fields['skus'].queryset.none()


@admin.register(CustomerService)
class CustomerServiceAdmin(admin.ModelAdmin):
    form = CustomerServiceAdminForm
    list_display = ('customer', 'service', 'unit_price', 'sku_count', 'created_at', 'updated_at')
    list_filter = ('service', 'customer')
    search_fields = ('customer__company_name', 'service__service_name', 'skus__sku')
    filter_horizontal = ('skus',)  # Improved interface for selecting multiple SKUs

    def sku_count(self, obj):
        return obj.skus.count()
    sku_count.short_description = 'SKU Count'

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('skus')

    class Media:
        js = ('admin/js/customer_service_admin.js',)

    fieldsets = (
        (None, {
            'fields': ('customer', 'service', 'unit_price')
        }),
        ('SKU Configuration', {
            'fields': ('skus',),
            'description': 'Select SKUs that this service applies to. SKUs are filtered based on the selected customer.'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
            'description': 'Automatically maintained timestamps'
        })
    )

    readonly_fields = ('created_at', 'updated_at')