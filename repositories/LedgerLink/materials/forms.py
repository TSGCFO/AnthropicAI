from django import forms
from .models import Material, BoxPrice


class MaterialForm(forms.ModelForm):
    class Meta:
        model = Material
        fields = [
            'name', 'description', 'unit_price'
        ]


class BoxPriceForm(forms.ModelForm):
    class Meta:
        model = BoxPrice
        fields = [
            'box_type', 'price', 'length', 'width', 'height'
        ]
