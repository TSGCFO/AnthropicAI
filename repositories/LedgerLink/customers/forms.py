from django import forms
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Row, Column, Submit
from .models import Customer

class CustomerForm(forms.ModelForm):
    class Meta:
        model = Customer
        fields = [
            'company_name',
            'legal_business_name',
            'email',
            'phone',
            'address',
            'city',
            'state',
            'zip',
            'country',
            'business_type'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.layout = Layout(
            Row(
                Column('company_name', css_class='form-group col-md-6 mb-3'),
                Column('legal_business_name', css_class='form-group col-md-6 mb-3'),
            ),
            Row(
                Column('email', css_class='form-group col-md-6 mb-3'),
                Column('phone', css_class='form-group col-md-6 mb-3'),
            ),
            'address',
            Row(
                Column('city', css_class='form-group col-md-4 mb-3'),
                Column('state', css_class='form-group col-md-4 mb-3'),
                Column('zip', css_class='form-group col-md-4 mb-3'),
            ),
            Row(
                Column('country', css_class='form-group col-md-6 mb-3'),
                Column('business_type', css_class='form-group col-md-6 mb-3'),
            ),
        )