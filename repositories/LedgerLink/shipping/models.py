# shipping/models.py (or a separate module if needed for organization)

from django.db import models
from orders.models import Order
from customers.models import Customer


class CADShipping(models.Model):
    transaction = models.OneToOneField(Order, on_delete=models.CASCADE, primary_key=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    service_code_description = models.CharField(max_length=255, blank=True, null=True)
    ship_to_name = models.CharField(max_length=255, blank=True, null=True)
    ship_to_address_1 = models.CharField(max_length=255, blank=True, null=True)
    ship_to_address_2 = models.CharField(max_length=255, blank=True, null=True)
    shiptoaddress3 = models.CharField(max_length=255, blank=True, null=True)
    ship_to_city = models.CharField(max_length=255, blank=True, null=True)
    ship_to_state = models.CharField(max_length=255, blank=True, null=True)
    ship_to_country = models.CharField(max_length=255, blank=True, null=True)
    ship_to_postal_code = models.CharField(max_length=20, blank=True, null=True)
    tracking_number = models.CharField(max_length=50, blank=True, null=True)
    pre_tax_shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tax1type = models.CharField(max_length=50, blank=True, null=True)
    tax1amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tax2type = models.CharField(max_length=50, blank=True, null=True)
    tax2amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tax3type = models.CharField(max_length=50, blank=True, null=True)
    tax3amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    fuel_surcharge = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    reference = models.CharField(max_length=255, blank=True, null=True)
    weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    gross_weight = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    box_length = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    box_width = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    box_height = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    box_name = models.CharField(max_length=255, blank=True, null=True)
    ship_date = models.DateTimeField(blank=True, null=True)
    carrier = models.CharField(max_length=50, blank=True, null=True)
    raw_ship_date = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"CAD Shipping for Order {self.transaction_id}"


class USShipping(models.Model):
    transaction = models.OneToOneField(Order, on_delete=models.CASCADE, primary_key=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    ship_date = models.DateField(blank=True, null=True)
    ship_to_name = models.CharField(max_length=255, blank=True, null=True)
    ship_to_address_1 = models.CharField(max_length=255, blank=True, null=True)
    ship_to_address_2 = models.CharField(max_length=255, blank=True, null=True)
    ship_to_city = models.CharField(max_length=255, blank=True, null=True)
    ship_to_state = models.CharField(max_length=255, blank=True, null=True)
    ship_to_zip = models.CharField(max_length=20, blank=True, null=True)
    ship_to_country_code = models.CharField(max_length=10, blank=True, null=True)
    tracking_number = models.CharField(max_length=50, blank=True, null=True)
    service_name = models.CharField(max_length=255, blank=True, null=True)
    weight_lbs = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    length_in = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    width_in = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    height_in = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    base_chg = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    carrier_peak_charge = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    wizmo_peak_charge = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    accessorial_charges = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    rate = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    hst = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    gst = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    current_status = models.CharField(max_length=255, blank=True, null=True)
    delivery_status = models.CharField(max_length=255, blank=True, null=True)
    first_attempt_date = models.DateField(blank=True, null=True)
    delivery_date = models.DateField(blank=True, null=True)
    days_to_first_deliver = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"US Shipping for Order {self.transaction_id}"
