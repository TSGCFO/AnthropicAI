# materials/models.py

from django.db import models


class Material(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.name


class BoxPrice(models.Model):
    box_type = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    length = models.DecimalField(max_digits=5, decimal_places=2)
    width = models.DecimalField(max_digits=5, decimal_places=2)
    height = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return f"{self.box_type} - {self.price}"
