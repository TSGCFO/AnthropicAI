# inserts/models.py

from django.db import models
from customers.models import Customer


class Insert(models.Model):
    sku = models.CharField(max_length=100)
    insert_name = models.CharField(max_length=100)
    insert_quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.insert_name} ({self.sku})"
