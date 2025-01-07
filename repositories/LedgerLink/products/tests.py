from django.test import TestCase
from django.urls import reverse
from .models import Product
from customers.models import Customer


# Create your tests here.
# products/tests.py

class ProductModelTest(TestCase):

    def setUp(self):
        self.customer = Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com'
        )
        self.product = Product.objects.create(
            sku='SKU123',
            labeling_unit_1='Unit1',
            labeling_quantity_1=10,
            labeling_unit_2='Unit2',
            labeling_quantity_2=20,
            labeling_unit_3='Unit3',
            labeling_quantity_3=30,
            labeling_unit_4='Unit4',
            labeling_quantity_4=40,
            labeling_unit_5='Unit5',
            labeling_quantity_5=50,
            customer=self.customer
        )

    def test_product_creation(self):
        self.assertEqual(self.product.sku, 'SKU123')
        self.assertEqual(self.product.labeling_quantity_1, 10)
        self.assertIsInstance(self.product, Product)


class ProductListViewTest(TestCase):

    def setUp(self):
        self.customer = Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com'
        )
        Product.objects.create(
            sku='SKU123',
            customer=self.customer
        )

    def test_view_url_exists_at_proper_location(self):
        response = self.client.get('/products/')
        self.assertEqual(response.status_code, 200)

    def test_view_url_accessible_by_name(self):
        response = self.client.get(reverse('product_list'))
        self.assertEqual(response.status_code, 200)

    def test_view_uses_correct_template(self):
        response = self.client.get(reverse('product_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'products/product_list.html')


class ProductDetailViewTest(TestCase):

    def setUp(self):
        self.customer = Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com'
        )
        self.product = Product.objects.create(
            sku='SKU123',
            customer=self.customer
        )

    def test_view_url_exists_at_proper_location(self):
        response = self.client.get(f'/products/{self.product.pk}/')
        self.assertEqual(response.status_code, 200)

    def test_view_url_accessible_by_name(self):
        response = self.client.get(reverse('product_detail', args=[self.product.pk]))
        self.assertEqual(response.status_code, 200)

    def test_view_uses_correct_template(self):
        response = self.client.get(reverse('product_detail', args=[self.product.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'products/product_detail.html')

    def test_view_displays_correct_product(self):
        response = self.client.get(reverse('product_detail', args=[self.product.pk]))
        self.assertContains(response, self.product.sku)
        self.assertContains(response, self.product.customer.company_name)
