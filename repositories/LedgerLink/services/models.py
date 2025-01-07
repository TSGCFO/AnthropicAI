# services/models.py

from django.db import models

class Service(models.Model):
    CHARGE_TYPES = (
        ('single', 'Single Charge'),
        ('quantity', 'Quantity Based'),
    )

    service_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    charge_type = models.CharField(max_length=10, choices=CHARGE_TYPES, default='quantity')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.service_name