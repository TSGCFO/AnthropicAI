from django import forms
from django.core.exceptions import ValidationError
from .models import CustomerService
from products.models import Product


class CustomerServiceForm(forms.ModelForm):
    skus = forms.ModelMultipleChoiceField(
        queryset=Product.objects.none(),
        required=False,
        widget=forms.SelectMultiple(attrs={
            'class': 'form-select',
            'size': '5',  # Show 5 options at once
        }),
        help_text='Select one or more SKUs (optional). Hold Ctrl/Cmd to select multiple.'
    )

    class Meta:
        model = CustomerService
        fields = ['customer', 'service', 'unit_price', 'skus']
        widgets = {
            'customer': forms.Select(attrs={
                'class': 'form-select',
                'data-controller': 'customer-skus'
            }),
            'service': forms.Select(attrs={
                'class': 'form-select'
            }),
            'unit_price': forms.NumberInput(attrs={
                'class': 'form-control',
                'step': '0.01',
                'min': '0'
            })
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Initialize SKUs queryset
        if self.instance.pk:
            # Editing existing instance
            if self.instance.customer:
                self.fields['skus'].queryset = Product.objects.filter(
                    customer=self.instance.customer
                ).order_by('sku')
                self.initial['skus'] = self.instance.skus.all()
        elif self.data.get('customer'):
            # Form was submitted with a customer
            self.fields['skus'].queryset = Product.objects.filter(
                customer_id=self.data['customer']
            ).order_by('sku')

        # Add required indicator to required fields
        for field in self.fields:
            if self.fields[field].required:
                self.fields[field].label = f"{self.fields[field].label}*"

    def clean(self):
        cleaned_data = super().clean()
        customer = cleaned_data.get('customer')
        skus = cleaned_data.get('skus')

        if skus and customer:
            # Verify all selected SKUs belong to the selected customer
            invalid_skus = [sku for sku in skus if sku.customer != customer]
            if invalid_skus:
                sku_list = ', '.join([sku.sku for sku in invalid_skus])
                raise ValidationError(
                    f"The following SKUs do not belong to the selected customer: {sku_list}"
                )

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        if commit:
            instance.save()
            self.save_m2m()  # Save the many-to-many relations
        return instance