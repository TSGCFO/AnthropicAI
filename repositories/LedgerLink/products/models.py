from django.db import models
from django.utils import timezone
from customers.models import Customer  # Assuming Customer model is in the customers app


# Create your models here.
class Product(models.Model):
    id = models.BigAutoField(primary_key=True)
    sku = models.CharField(max_length=100)
    labeling_unit_1 = models.CharField(max_length=50, blank=True, null=True)
    labeling_quantity_1 = models.PositiveIntegerField(blank=True, null=True)
    labeling_unit_2 = models.CharField(max_length=50, blank=True, null=True)
    labeling_quantity_2 = models.PositiveIntegerField(blank=True, null=True)
    labeling_unit_3 = models.CharField(max_length=50, blank=True, null=True)
    labeling_quantity_3 = models.PositiveIntegerField(blank=True, null=True)
    labeling_unit_4 = models.CharField(max_length=50, blank=True, null=True)
    labeling_quantity_4 = models.PositiveIntegerField(blank=True, null=True)
    labeling_unit_5 = models.CharField(max_length=50, blank=True, null=True)
    labeling_quantity_5 = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['sku', 'customer'], name='billing_product_sku_customer_id_uniq'),
            models.CheckConstraint(check=models.Q(labeling_quantity_1__gte=0), name='billing_product_labeling_quantity_1_check'),
            models.CheckConstraint(check=models.Q(labeling_quantity_2__gte=0), name='billing_product_labeling_quantity_2_check'),
            models.CheckConstraint(check=models.Q(labeling_quantity_3__gte=0), name='billing_product_labeling_quantity_3_check'),
            models.CheckConstraint(check=models.Q(labeling_quantity_4__gte=0), name='billing_product_labeling_quantity_4_check'),
            models.CheckConstraint(check=models.Q(labeling_quantity_5__gte=0), name='billing_product_labeling_quantity_5_check'),
        ]

    def __str__(self):
        return self.sku
