from django import forms
from .models import CADShipping, USShipping


class CADShippingForm(forms.ModelForm):
    class Meta:
        model = CADShipping
        fields = [
            'transaction', 'customer', 'service_code_description', 'ship_to_name',
            'ship_to_address_1', 'ship_to_address_2', 'shiptoaddress3', 'ship_to_city',
            'ship_to_state', 'ship_to_country', 'ship_to_postal_code', 'tracking_number',
            'pre_tax_shipping_charge', 'tax1type', 'tax1amount', 'tax2type', 'tax2amount',
            'tax3type', 'tax3amount', 'fuel_surcharge', 'reference', 'weight', 'gross_weight',
            'box_length', 'box_width', 'box_height', 'box_name', 'ship_date', 'carrier', 'raw_ship_date'
        ]


class USShippingForm(forms.ModelForm):
    class Meta:
        model = USShipping
        fields = [
            'transaction', 'customer', 'ship_date', 'ship_to_name', 'ship_to_address_1',
            'ship_to_address_2', 'ship_to_city', 'ship_to_state', 'ship_to_zip',
            'ship_to_country_code', 'tracking_number', 'service_name', 'weight_lbs',
            'length_in', 'width_in', 'height_in', 'base_chg', 'carrier_peak_charge',
            'wizmo_peak_charge', 'accessorial_charges', 'rate', 'hst', 'gst', 'current_status',
            'delivery_status', 'first_attempt_date', 'delivery_date', 'days_to_first_deliver'
        ]
