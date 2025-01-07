from django import forms
from .models import Product


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = [
            'sku', 'customer',
            'labeling_unit_1', 'labeling_quantity_1',
            'labeling_unit_2', 'labeling_quantity_2',
            'labeling_unit_3', 'labeling_quantity_3',
            'labeling_unit_4', 'labeling_quantity_4',
            'labeling_unit_5', 'labeling_quantity_5'
        ]

    def clean_labeling_quantity_1(self):
        quantity = self.cleaned_data.get('labeling_quantity_1')
        if quantity is not None and quantity < 0:
            raise forms.ValidationError("Quantity must be greater than or equal to 0.")
        return quantity

    def clean_labeling_quantity_2(self):
        quantity = self.cleaned_data.get('labeling_quantity_2')
        if quantity is not None and quantity < 0:
            raise forms.ValidationError("Quantity must be greater than or equal to 0.")
        return quantity

    def clean_labeling_quantity_3(self):
        quantity = self.cleaned_data.get('labeling_quantity_3')
        if quantity is not None and quantity < 0:
            raise forms.ValidationError("Quantity must be greater than or equal to 0.")
        return quantity

    def clean_labeling_quantity_4(self):
        quantity = self.cleaned_data.get('labeling_quantity_4')
        if quantity is not None and quantity < 0:
            raise forms.ValidationError("Quantity must be greater than or equal to 0.")
        return quantity

    def clean_labeling_quantity_5(self):
        quantity = self.cleaned_data.get('labeling_quantity_5')
        if quantity is not None and quantity < 0:
            raise forms.ValidationError("Quantity must be greater than or equal to 0.")
        return quantity


class ProductUploadForm(forms.Form):
    file = forms.FileField(
        label='Choose File',
        help_text='Upload a CSV or Excel file containing product information.'
    )

    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            if not file.name.endswith(('.csv', '.xlsx')):
                raise forms.ValidationError('Only CSV and Excel files are supported.')
            if file.size > 10 * 1024 * 1024:  # 10MB limit
                raise forms.ValidationError('File size must be under 10MB.')
        return file