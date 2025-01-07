from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.contrib import messages
from django.db.models import Q
from django.http import HttpResponse
from django.views import View
import json
import csv
from .models import Order
from .forms import OrderForm
from customers.models import Customer

class OrderListView(ListView):
    template_name = 'orders/order_list.html'
    context_object_name = 'orders'
    model = Order
    paginate_by = 10

    # Define available columns and their properties
    COLUMN_DEFINITIONS = {
        'transaction_id': {
            'label': 'Transaction ID',
            'type': 'number',
            'sortable': True,
            'default_visible': True
        },
        'customer__company_name': {
            'label': 'Customer',
            'type': 'text',
            'sortable': True,
            'default_visible': True
        },
        'reference_number': {
            'label': 'Reference',
            'type': 'text',
            'sortable': True,
            'default_visible': True
        },
        'close_date': {
            'label': 'Close Date',
            'type': 'datetime',
            'sortable': True,
            'default_visible': True
        },
        'ship_to_name': {
            'label': 'Ship To Name',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_company': {
            'label': 'Ship To Company',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_address': {
            'label': 'Address',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_address2': {
            'label': 'Address 2',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_city': {
            'label': 'City',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_state': {
            'label': 'State',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_zip': {
            'label': 'ZIP',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'ship_to_country': {
            'label': 'Country',
            'type': 'text',
            'sortable': True,
            'default_visible': False
        },
        'weight_lb': {
            'label': 'Weight (lb)',
            'type': 'decimal',
            'sortable': True,
            'default_visible': False
        },
        'line_items': {
            'label': 'Line Items',
            'type': 'number',
            'sortable': True,
            'default_visible': True
        },
        'total_item_qty': {
            'label': 'Total Items',
            'type': 'number',
            'sortable': True,
            'default_visible': True
        },
        'volume_cuft': {
            'label': 'Volume (cu ft)',
            'type': 'decimal',
            'sortable': True,
            'default_visible': False
        },
        'packages': {
            'label': 'Packages',
            'type': 'number',
            'sortable': True,
            'default_visible': False
        },
        'carrier': {
            'label': 'Carrier',
            'type': 'text',
            'sortable': True,
            'default_visible': True
        },
        'notes': {
            'label': 'Notes',
            'type': 'text',
            'sortable': False,
            'default_visible': False
        }
    }

    # Define filter operators for each data type
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

    def get_queryset(self):
        queryset = Order.objects.select_related('customer')

        # Apply sorting
        sort_field = self.request.GET.get('sort')
        sort_direction = self.request.GET.get('direction', 'asc')
        if sort_field and sort_field in self.COLUMN_DEFINITIONS:
            if sort_direction == 'desc':
                sort_field = f'-{sort_field}'
            queryset = queryset.order_by(sort_field)

        # Apply filters
        filters = self.request.GET.getlist('filter')
        if filters:
            combined_filter = None
            previous_logic = 'and'  # Default logic

            for filter_data in filters:
                try:
                    filter_dict = json.loads(filter_data)
                    field = filter_dict.get('field')
                    operator = filter_dict.get('operator')
                    value = filter_dict.get('value')
                    value2 = filter_dict.get('value2')
                    logic = filter_dict.get('logic', 'and').lower()

                    if field and operator:
                        current_filter = self._build_filter_condition(field, operator, value, value2)
                        if current_filter:
                            if combined_filter is None:
                                combined_filter = current_filter
                            else:
                                if previous_logic == 'or':
                                    combined_filter = combined_filter | current_filter
                                else:
                                    combined_filter = combined_filter & current_filter

                            previous_logic = logic

                except (json.JSONDecodeError, KeyError):
                    continue

            if combined_filter:
                queryset = queryset.filter(combined_filter)

        # Apply search
        search_query = self.request.GET.get('q')
        if search_query:
            search_fields = [
                'transaction_id__icontains',
                'customer__company_name__icontains',
                'reference_number__icontains',
                'ship_to_name__icontains',
                'ship_to_company__icontains',
                'carrier__icontains'
            ]
            search_filter = Q()
            for field in search_fields:
                search_filter |= Q(**{field: search_query})
            queryset = queryset.filter(search_filter)

        # Apply customer filter
        customer_id = self.request.GET.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        # Apply date range filter
        date_from = self.request.GET.get('date_from')
        date_to = self.request.GET.get('date_to')
        if date_from:
            queryset = queryset.filter(close_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(close_date__lte=date_to)

        return queryset.distinct()

    def _build_filter_condition(self, field, operator, value, value2=None):
        """Build Q object for filtering based on field type and operator."""
        if field not in self.COLUMN_DEFINITIONS:
            return None

        field_type = self.COLUMN_DEFINITIONS[field]['type']

        # Handle empty/not empty operators for all types
        if operator == 'is_empty':
            return Q(**{f"{field}__isnull": True}) | Q(**{field: ''})
        elif operator == 'is_not_empty':
            return ~Q(**{f"{field}__isnull": True}) & ~Q(**{field: ''})

        # Skip other operators if no value provided
        if not value:
            return None

        # Handle different field types
        if field_type in ['text', 'string']:
            return self._build_text_filter(field, operator, value, value2)
        elif field_type in ['number', 'decimal']:
            return self._build_numeric_filter(field, operator, value, value2)
        elif field_type == 'datetime':
            return self._build_datetime_filter(field, operator, value, value2)

        return None

    def _build_text_filter(self, field, operator, value, value2=None):
        """Build filter for text fields."""
        if operator == 'contains':
            return Q(**{f"{field}__icontains": value})
        elif operator == 'not_contains':
            return ~Q(**{f"{field}__icontains": value})
        elif operator == 'equals':
            return Q(**{field: value})
        elif operator == 'not_equals':
            return ~Q(**{field: value})
        elif operator == 'starts_with':
            return Q(**{f"{field}__istartswith": value})
        elif operator == 'ends_with':
            return Q(**{f"{field}__iendswith": value})
        elif operator == 'between' and value2:
            return Q(**{f"{field}__gte": value}) & Q(**{f"{field}__lte": value2})
        return None

    def _build_numeric_filter(self, field, operator, value, value2=None):
        """Build filter for numeric fields."""
        try:
            value = float(value)
            value2 = float(value2) if value2 else None

            if operator == 'equals':
                return Q(**{field: value})
            elif operator == 'not_equals':
                return ~Q(**{field: value})
            elif operator == 'greater_than':
                return Q(**{f"{field}__gt": value})
            elif operator == 'less_than':
                return Q(**{f"{field}__lt": value})
            elif operator == 'greater_equal':
                return Q(**{f"{field}__gte": value})
            elif operator == 'less_equal':
                return Q(**{f"{field}__lte": value})
            elif operator == 'between' and value2 is not None:
                return Q(**{f"{field}__gte": value}) & Q(**{f"{field}__lte": value2})
        except (ValueError, TypeError):
            return None
        return None

    def _build_datetime_filter(self, field, operator, value, value2=None):
        """Build filter for datetime fields."""
        try:
            if operator == 'equals':
                return Q(**{field: value})
            elif operator == 'not_equals':
                return ~Q(**{field: value})
            elif operator == 'before':
                return Q(**{f"{field}__lt": value})
            elif operator == 'after':
                return Q(**{f"{field}__gt": value})
            elif operator == 'between' and value2:
                return Q(**{f"{field}__gte": value}) & Q(**{f"{field}__lte": value2})
        except (ValueError, TypeError):
            return None
        return None

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Add column definitions
        context['columns'] = self.COLUMN_DEFINITIONS

        # Add filter operators
        context['filter_operators'] = self.FILTER_OPERATORS

        # Add customers for dropdown
        context['customers'] = Customer.objects.all()

        # Get selected columns
        default_columns = [
            col for col, props in self.COLUMN_DEFINITIONS.items()
            if props.get('default_visible', False)
        ]
        context['selected_columns'] = self.request.GET.getlist('columns', default_columns)

        # Add current sort information
        context['current_sort'] = {
            'field': self.request.GET.get('sort', ''),
            'direction': self.request.GET.get('direction', 'asc')
        }

        # Add current filters
        context['current_filters'] = []
        for filter_data in self.request.GET.getlist('filter'):
            try:
                filter_dict = json.loads(filter_data)
                field = filter_dict.get('field')
                if field in self.COLUMN_DEFINITIONS:
                    field_label = self.COLUMN_DEFINITIONS[field]['label']
                    field_type = self.COLUMN_DEFINITIONS[field]['type']
                    operator = filter_dict.get('operator')
                    operator_label = next(
                        (op['label'] for op in self.FILTER_OPERATORS[field_type]
                         if op['value'] == operator),
                        operator
                    )
                    value = filter_dict.get('value')
                    value2 = filter_dict.get('value2')

                    filter_display = {
                        'field_label': field_label,
                        'operator_label': operator_label,
                        'value': value
                    }

                    if value2 and operator == 'between':
                        filter_display['value'] = f"{value} - {value2}"

                    context['current_filters'].append(filter_display)
            except (json.JSONDecodeError, KeyError):
                continue

        return context


class OrderDetailView(DetailView):
    model = Order
    template_name = 'orders/order_detail.html'
    context_object_name = 'order'
    pk_url_kwarg = 'transaction_id'

    def get_queryset(self):
        return super().get_queryset().select_related('customer')


class OrderCreateView(CreateView):
    model = Order
    form_class = OrderForm
    template_name = 'orders/order_form.html'
    success_url = reverse_lazy('orders:order_list')

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Order created successfully.')
        return response


class OrderUpdateView(UpdateView):
    model = Order
    form_class = OrderForm
    template_name = 'orders/order_form.html'
    pk_url_kwarg = 'transaction_id'
    success_url = reverse_lazy('orders:order_list')

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Order updated successfully.')
        return response


class OrderDeleteView(DeleteView):
    model = Order
    template_name = 'orders/order_confirm_delete.html'
    success_url = reverse_lazy('orders:order_list')
    pk_url_kwarg = 'transaction_id'

    def delete(self, request, *args, **kwargs):
        response = super().delete(request, *args, **kwargs)
        messages.success(self.request, 'Order deleted successfully.')
        return response

class OrderDownloadView(View):
    def get(self, request, transaction_id):
        order = Order.objects.select_related('customer').get(transaction_id=transaction_id)

        # Create the response with CSV content
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="order_{order.transaction_id}.csv"'

        writer = csv.writer(response)
        writer.writerow(['Order Details'])
        writer.writerow(['Transaction ID', order.transaction_id])
        writer.writerow(['Customer', order.customer.company_name])
        writer.writerow(['Reference Number', order.reference_number])
        writer.writerow(['Close Date', order.close_date.strftime('%Y-%m-%d %H:%M') if order.close_date else 'Open'])
        writer.writerow([])

        writer.writerow(['Shipping Information'])
        writer.writerow(['Name', order.ship_to_name])
        writer.writerow(['Company', order.ship_to_company])
        writer.writerow(['Address', order.ship_to_address])
        writer.writerow(['Address 2', order.ship_to_address2])
        writer.writerow(['City', order.ship_to_city])
        writer.writerow(['State', order.ship_to_state])
        writer.writerow(['ZIP', order.ship_to_zip])
        writer.writerow(['Country', order.ship_to_country])
        writer.writerow([])

        writer.writerow(['Order Details'])
        writer.writerow(['Weight (lb)', order.weight_lb])
        writer.writerow(['Line Items', order.line_items])
        writer.writerow(['Total Items', order.total_item_qty])
        writer.writerow(['Volume (cu ft)', order.volume_cuft])
        writer.writerow(['Packages', order.packages])
        writer.writerow(['Carrier', order.carrier])
        writer.writerow([])

        if order.sku_quantity:
            writer.writerow(['SKU Details'])
            writer.writerow(['SKU', 'Quantity'])
            sku_data = json.loads(order.sku_quantity) if isinstance(order.sku_quantity, str) else order.sku_quantity
            for item in sku_data:
                writer.writerow([item['sku'], item['quantity']])

        return response