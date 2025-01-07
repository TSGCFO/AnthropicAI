from django.db import models


# Create your models here.
class Customer(models.Model):
    id = models.AutoField(primary_key=True)
    company_name = models.CharField(max_length=100)
    legal_business_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254, unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=200, blank=True, null=True)
    city = models.CharField(max_length=50, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)
    zip = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=50, blank=True, null=True)
    business_type = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['email'], name='email_idx'),
            models.Index(fields=['company_name'], name='company_name_idx'),
        ]

    def __str__(self):
        return self.company_name
