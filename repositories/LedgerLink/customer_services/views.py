from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Q, Count
from django.core.exceptions import ValidationError
from products.models import Product
from services.models import Service
from customers.models import Customer
from .models import CustomerService
from .forms import CustomerServiceForm


class CustomerServiceListView(ListView):
    model = CustomerService
    template_name = 'customer_services/customer_service_list.html'
    context_object_name = 'customer_services'
    paginate_by = 10

    # Define default columns
    COLUMN_DEFINITIONS = {
        'customer__company_name': {
            'label': 'Customer',
            'type': 'text',
            'sortable': True,
            'default_visible': True
        },
        'service__service_name': {
            'label': 'Service',
            'type': 'text',
            'sortable': True,
            'default_visible': True
        },
        'unit_price': {
            'label': 'Unit Price',
            'type': 'decimal',
            'sortable': True,
            'default_visible': True
        },
        'skus__count': {
            'label': 'SKUs',
            'type': 'number',
            'sortable': False,
            'default_visible': True
        },
        'created_at': {
            'label': 'Created',
            'type': 'datetime',
            'sortable': True,
            'default_visible': True
        },
        'updated_at': {
            'label': 'Updated',
            'type': 'datetime',
            'sortable': True,
            'default_visible': False
        }
    }

    def get_queryset(self):
        queryset = CustomerService.objects.select_related(
            'customer', 'service'
        ).prefetch_related('skus')

        # Apply search if provided
        search_query = self.request.GET.get('q')
        if search_query:
            queryset = queryset.filter(
                Q(customer__company_name__icontains=search_query) |
                Q(service__service_name__icontains=search_query) |
                Q(skus__sku__icontains=search_query)
            ).distinct()

        # Apply customer filter
        customer_id = self.request.GET.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        # Apply service filter
        service_id = self.request.GET.get('service')
        if service_id:
            queryset = queryset.filter(service_id=service_id)

        # Apply sorting
        sort_field = self.request.GET.get('sort')
        sort_direction = self.request.GET.get('direction', 'asc')

        if sort_field and sort_field in self.COLUMN_DEFINITIONS:
            if sort_direction == 'desc':
                sort_field = f'-{sort_field}'
            queryset = queryset.order_by(sort_field)
        else:
            # Default sorting
            queryset = queryset.order_by('-created_at')

        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Add customers and services for filters
        context['customers'] = Customer.objects.all().order_by('company_name')
        context['services'] = Service.objects.all().order_by('service_name')

        # Add column definitions
        context['columns'] = self.COLUMN_DEFINITIONS

        # Get selected columns or use defaults
        selected_columns = self.request.GET.getlist('columns')
        if not selected_columns:
            selected_columns = [
                col for col, props in self.COLUMN_DEFINITIONS.items()
                if props.get('default_visible', False)
            ]
        context['selected_columns'] = selected_columns

        # Add current filters
        context['current_filters'] = []

        # Add sorting information
        context['current_sort'] = {
            'field': self.request.GET.get('sort', ''),
            'direction': self.request.GET.get('direction', 'asc')
        }

        return context


class CustomerServiceDetailView(DetailView):
    model = CustomerService
    template_name = 'customer_services/customer_service_detail.html'
    context_object_name = 'customer_service'

    def get_queryset(self):
        return CustomerService.objects.select_related(
            'customer', 'service'
        ).prefetch_related('skus')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        customer_service = self.get_object()

        # Add billing information flag if service is used in billing
        context['billing_info'] = False  # You can implement actual billing check logic here

        # Add SKU statistics without the active filter
        context['sku_stats'] = {
            'total': customer_service.skus.count(),
            # Remove the active filter since the field doesn't exist
            # 'active': customer_service.skus.filter(active=True).count(),
        }

        return context


class CustomerServiceCreateView(CreateView):
    model = CustomerService
    form_class = CustomerServiceForm
    template_name = 'customer_services/customer_service_form.html'
    success_url = reverse_lazy('customer_services:customer_service_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['customers'] = Customer.objects.all().order_by('company_name')
        context['services'] = Service.objects.all().order_by('service_name')
        return context

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
            messages.success(self.request, 'Customer Service created successfully.')
            return response
        except ValidationError as e:
            form.add_error(None, e)
            return self.form_invalid(form)


class CustomerServiceUpdateView(UpdateView):
    model = CustomerService
    form_class = CustomerServiceForm
    template_name = 'customer_services/customer_service_form.html'
    success_url = reverse_lazy('customer_services:customer_service_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['customers'] = Customer.objects.all().order_by('company_name')
        context['services'] = Service.objects.all().order_by('service_name')
        return context

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
            messages.success(self.request, 'Customer Service updated successfully.')
            return response
        except ValidationError as e:
            form.add_error(None, e)
            return self.form_invalid(form)


class CustomerServiceDeleteView(DeleteView):
    model = CustomerService
    template_name = 'customer_services/customer_service_confirm_delete.html'
    success_url = reverse_lazy('customer_services:customer_service_list')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Add billing information flag if service is used in billing
        context['billing_info'] = False  # You can implement actual billing check logic here
        return context

    def delete(self, request, *args, **kwargs):
        try:
            response = super().delete(request, *args, **kwargs)
            messages.success(self.request, 'Customer Service deleted successfully.')
            return response
        except Exception as e:
            messages.error(self.request, f'Error deleting customer service: {str(e)}')
            return self.get(request, *args, **kwargs)


def get_customer_skus(request, customer_id):
    """API endpoint to get SKUs for a specific customer."""
    try:
        skus = Product.objects.filter(
            customer_id=customer_id
        ).values('id', 'sku').order_by('sku')

        return JsonResponse(list(skus), safe=False)
    except Exception as e:
        return JsonResponse(
            {'error': str(e)},
            status=400
        )


# Filter operators for different field types
FILTER_OPERATORS = {
    'text': [
        {'value': 'contains', 'label': 'Contains'},
        {'value': 'not_contains', 'label': 'Does not contain'},
        {'value': 'equals', 'label': 'Equals'},
        {'value': 'not_equals', 'label': 'Does not equal'},
        {'value': 'starts_with', 'label': 'Starts with'},
        {'value': 'ends_with', 'label': 'Ends with'},
        {'value': 'is_empty', 'label': 'Is empty'},
        {'value': 'is_not_empty', 'label': 'Is not empty'}
    ],
    'number': [
        {'value': 'equals', 'label': 'Equals'},
        {'value': 'not_equals', 'label': 'Does not equal'},
        {'value': 'greater_than', 'label': 'Greater than'},
        {'value': 'less_than', 'label': 'Less than'},
        {'value': 'greater_equal', 'label': 'Greater than or equal'},
        {'value': 'less_equal', 'label': 'Less than or equal'},
        {'value': 'between', 'label': 'Between'},
        {'value': 'is_empty', 'label': 'Is empty'},
        {'value': 'is_not_empty', 'label': 'Is not empty'}
    ],
    'decimal': [
        {'value': 'equals', 'label': 'Equals'},
        {'value': 'not_equals', 'label': 'Does not equal'},
        {'value': 'greater_than', 'label': 'Greater than'},
        {'value': 'less_than', 'label': 'Less than'},
        {'value': 'greater_equal', 'label': 'Greater than or equal'},
        {'value': 'less_equal', 'label': 'Less than or equal'},
        {'value': 'between', 'label': 'Between'},
        {'value': 'is_empty', 'label': 'Is empty'},
        {'value': 'is_not_empty', 'label': 'Is not empty'}
    ],
    'datetime': [
        {'value': 'equals', 'label': 'Equals'},
        {'value': 'not_equals', 'label': 'Does not equal'},
        {'value': 'before', 'label': 'Before'},
        {'value': 'after', 'label': 'After'},
        {'value': 'between', 'label': 'Between'},
        {'value': 'is_empty', 'label': 'Is empty'},
        {'value': 'is_not_empty', 'label': 'Is not empty'}
    ]
}