# orders/models.py

from django.db import models
from customers.models import Customer


class Order(models.Model):
    transaction_id = models.IntegerField(primary_key=True)  # Externally assigned
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    close_date = models.DateTimeField(blank=True, null=True)
    reference_number = models.CharField(max_length=100)
    ship_to_name = models.CharField(max_length=100, blank=True, null=True)
    ship_to_company = models.CharField(max_length=100, blank=True, null=True)
    ship_to_address = models.CharField(max_length=200, blank=True, null=True)
    ship_to_address2 = models.CharField(max_length=200, blank=True, null=True)
    ship_to_city = models.CharField(max_length=100, blank=True, null=True)
    ship_to_state = models.CharField(max_length=50, blank=True, null=True)
    ship_to_zip = models.CharField(max_length=20, blank=True, null=True)
    ship_to_country = models.CharField(max_length=50, blank=True, null=True)
    weight_lb = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    line_items = models.IntegerField(blank=True, null=True)
    sku_quantity = models.JSONField(blank=True, null=True)
    total_item_qty = models.IntegerField(blank=True, null=True)
    volume_cuft = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    packages = models.IntegerField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    carrier = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"Order {self.transaction_id} for {self.customer}"
