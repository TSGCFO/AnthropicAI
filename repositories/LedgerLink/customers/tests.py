from django.test import TestCase
from django.urls import reverse
from .models import Customer


# Create your tests here.

class CustomerModelTest(TestCase):

    def setUp(self):
        self.customer = Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com',
            phone='1234567890',
            address='123 Test St',
            city='Test City',
            state='Test State',
            zip='12345',
            country='Test Country',
            business_type='Test Business',
        )

    def test_customer_creation(self):
        self.assertEqual(self.customer.company_name, 'Test Company')
        self.assertEqual(self.customer.email, 'test@example.com')
        self.assertIsInstance(self.customer, Customer)


class CustomerListViewTest(TestCase):

    def setUp(self):
        Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com',
        )

    def test_view_url_exists_at_proper_location(self):
        response = self.client.get('/customers/')
        self.assertEqual(response.status_code, 200)

    def test_view_url_accessible_by_name(self):
        response = self.client.get(reverse('customer_list'))
        self.assertEqual(response.status_code, 200)

    def test_view_uses_correct_template(self):
        response = self.client.get(reverse('customer_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'customers/customer_list.html')


class CustomerDetailViewTest(TestCase):

    def setUp(self):
        self.customer = Customer.objects.create(
            company_name='Test Company',
            legal_business_name='Test Legal Name',
            email='test@example.com',
        )

    def test_view_url_exists_at_proper_location(self):
        response = self.client.get(f'/customers/{self.customer.pk}/')
        self.assertEqual(response.status_code, 200)

    def test_view_url_accessible_by_name(self):
        response = self.client.get(reverse('customer_detail', args=[self.customer.pk]))
        self.assertEqual(response.status_code, 200)

    def test_view_uses_correct_template(self):
        response = self.client.get(reverse('customer_detail', args=[self.customer.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'customers/customer_detail.html')

    def test_view_displays_correct_customer(self):
        response = self.client.get(reverse('customer_detail', args=[self.customer.pk]))
        self.assertContains(response, self.customer.company_name)
        self.assertContains(response, self.customer.legal_business_name)
        self.assertContains(response, self.customer.email)
