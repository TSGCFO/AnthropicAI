from django import forms
from .models import Insert


class InsertForm(forms.ModelForm):
    class Meta:
        model = Insert
        fields = [
            'sku', 'insert_name', 'insert_quantity', 'customer'
        ]
