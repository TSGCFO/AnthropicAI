# Create your models here.
from django.db import models
from django.core.validators import MinValueValidator
from customers.models import Customer
from orders.models import Order

class BillingReport(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    generated_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    report_data = models.JSONField()

    class Meta:
        ordering = ['-generated_at']
        verbose_name = 'Billing Report'
        verbose_name_plural = 'Billing Reports'

    def __str__(self):
        return f"Report for {self.customer.company_name} ({self.start_date} to {self.end_date})"

class BillingReportDetail(models.Model):
    report = models.ForeignKey(
        BillingReport,
        on_delete=models.CASCADE,
        related_name='details'
    )
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    service_breakdown = models.JSONField()
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    class Meta:
        verbose_name = 'Billing Report Detail'
        verbose_name_plural = 'Billing Report Details'