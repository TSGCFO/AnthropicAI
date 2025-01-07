# rules/views.py

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy, reverse
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

import json
import logging

from .models import RuleGroup, Rule, AdvancedRule
from .forms import RuleGroupForm, RuleForm, AdvancedRuleForm
from customer_services.models import CustomerService

logger = logging.getLogger(__name__)

# Rule Group Views
class RuleGroupListView(LoginRequiredMixin, ListView):
    model = RuleGroup
    template_name = 'rules/rule_group_list.html'
    context_object_name = 'rule_groups'
    paginate_by = 10

    def get_queryset(self):
        queryset = super().get_queryset()
        search_query = self.request.GET.get('q')
        customer_service = self.request.GET.get('customer_service')

        if search_query:
            queryset = queryset.filter(
                Q(customer_service__customer__company_name__icontains=search_query) |
                Q(customer_service__service__service_name__icontains=search_query)
            )

        if customer_service:
            queryset = queryset.filter(customer_service_id=customer_service)

        return queryset.select_related('customer_service',
                                     'customer_service__customer',
                                     'customer_service__service')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['customer_services'] = CustomerService.objects.all()
        return context

class RuleGroupDetailView(LoginRequiredMixin, DetailView):
    model = RuleGroup
    template_name = 'rules/rule_group_detail.html'
    context_object_name = 'rule_group'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['basic_rules'] = self.object.rules.filter(advancedrule=None)
        context['advanced_rules'] = self.object.rules.filter(advancedrule__isnull=False)
        return context

class RuleGroupCreateView(LoginRequiredMixin, CreateView):
    model = RuleGroup
    form_class = RuleGroupForm
    template_name = 'rules/rule_group_form.html'

    def get_success_url(self):
        return reverse('rules:rule_group_detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Rule group created successfully.')
        return response

class RuleGroupUpdateView(LoginRequiredMixin, UpdateView):
    model = RuleGroup
    form_class = RuleGroupForm
    template_name = 'rules/rule_group_form.html'

    def get_success_url(self):
        return reverse('rules:rule_group_detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Rule group updated successfully.')
        return response

class RuleGroupDeleteView(LoginRequiredMixin, DeleteView):
    model = RuleGroup
    success_url = reverse_lazy('rules:rule_group_list')

    def delete(self, request, *args, **kwargs):
        response = super().delete(request, *args, **kwargs)
        messages.success(request, 'Rule group deleted successfully.')
        return response

# Basic Rule Views
class RuleCreateView(LoginRequiredMixin, CreateView):
    model = Rule
    form_class = RuleForm
    template_name = 'rules/rule_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['group'] = get_object_or_404(RuleGroup, pk=self.kwargs['group_id'])
        return context

    def form_valid(self, form):
        form.instance.rule_group_id = self.kwargs['group_id']
        response = super().form_valid(form)
        messages.success(self.request, 'Rule created successfully.')
        return response

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.kwargs['group_id']})

class RuleUpdateView(LoginRequiredMixin, UpdateView):
    model = Rule
    form_class = RuleForm
    template_name = 'rules/rule_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['group'] = self.object.rule_group
        return context

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Rule updated successfully.')
        return response

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.object.rule_group.pk})

class RuleDeleteView(LoginRequiredMixin, DeleteView):
    model = Rule
    template_name = 'rules/rule_confirm_delete.html'

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.object.rule_group.pk})

    def delete(self, request, *args, **kwargs):
        response = super().delete(request, *args, **kwargs)
        messages.success(request, 'Rule deleted successfully.')
        return response

# Advanced Rule Views
class AdvancedRuleCreateView(LoginRequiredMixin, CreateView):
    model = AdvancedRule
    form_class = AdvancedRuleForm
    template_name = 'rules/advanced_rule_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['group'] = get_object_or_404(RuleGroup, pk=self.kwargs['group_id'])
        context['calculation_types'] = AdvancedRule.CALCULATION_TYPES
        return context

    def form_valid(self, form):
        form.instance.rule_group_id = self.kwargs['group_id']
        try:
            response = super().form_valid(form)
            messages.success(self.request, 'Advanced rule created successfully.')
            return response
        except ValidationError as e:
            form.add_error(None, e)
            return self.form_invalid(form)

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.kwargs['group_id']})

class AdvancedRuleUpdateView(LoginRequiredMixin, UpdateView):
    model = AdvancedRule
    form_class = AdvancedRuleForm
    template_name = 'rules/advanced_rule_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['group'] = self.object.rule_group
        context['calculation_types'] = AdvancedRule.CALCULATION_TYPES
        return context

    def form_valid(self, form):
        try:
            response = super().form_valid(form)
            messages.success(self.request, 'Advanced rule updated successfully.')
            return response
        except ValidationError as e:
            form.add_error(None, e)
            return self.form_invalid(form)

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.object.rule_group.pk})

class AdvancedRuleDeleteView(LoginRequiredMixin, DeleteView):
    model = AdvancedRule
    template_name = 'rules/advanced_rule_confirm_delete.html'

    def get_success_url(self):
        return reverse('rules:rule_group_detail',
                      kwargs={'pk': self.object.rule_group.pk})

    def delete(self, request, *args, **kwargs):
        response = super().delete(request, *args, **kwargs)
        messages.success(request, 'Advanced rule deleted successfully.')
        return response

# API Views
@api_view(['GET'])
def get_operator_choices(request):
    """Return valid operators for a given field type"""
    field = request.GET.get('field')
    if not field:
        return Response(
            {'error': 'Field parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    numeric_fields = ['weight_lb', 'line_items', 'total_item_qty', 'volume_cuft', 'packages']
    string_fields = ['reference_number', 'ship_to_name', 'ship_to_company',
                    'ship_to_city', 'ship_to_state', 'ship_to_country',
                    'carrier', 'notes']
    json_fields = ['sku_quantity']

    if field in numeric_fields:
        valid_operators = ['gt', 'lt', 'eq', 'ne', 'ge', 'le']
    elif field in string_fields:
        valid_operators = ['eq', 'ne', 'contains', 'ncontains', 'startswith', 'endswith']
    elif field in json_fields:
        valid_operators = ['contains', 'ncontains']
    else:
        valid_operators = [op[0] for op in Rule.OPERATOR_CHOICES]

    operators = [
        {'value': op[0], 'label': op[1]}
        for op in Rule.OPERATOR_CHOICES
        if op[0] in valid_operators
    ]

    return Response({'operators': operators})

@api_view(['POST'])
def validate_conditions(request):
    """Validate conditions JSON structure"""
    try:
        conditions = request.data.get('conditions')
        if not conditions:
            return Response(
                {'error': 'Conditions are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create temporary advanced rule for validation
        rule = AdvancedRule(conditions=conditions)
        rule.clean()
        return Response({'valid': True})
    except ValidationError as e:
        return Response({'valid': False, 'errors': e.messages},
                       status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)},
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def validate_calculations(request):
    """Validate calculations JSON structure"""
    try:
        calculations = request.data.get('calculations')
        if not calculations:
            return Response(
                {'error': 'Calculations are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create temporary advanced rule for validation
        rule = AdvancedRule(calculations=calculations)
        rule.clean()
        return Response({'valid': True})
    except ValidationError as e:
        return Response({'valid': False, 'errors': e.messages},
                       status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)},
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_conditions_schema(request):
    """Return JSON schema for conditions"""
    schema = {
        "type": "object",
        "properties": {
            "field_name": {
                "type": "object",
                "properties": {
                    "operator": {"type": "string"},
                    "value": {"type": ["string", "number", "boolean"]}
                },
                "required": ["operator", "value"]
            }
        },
        "additionalProperties": True
    }
    return Response(schema)

@api_view(['GET'])
def get_calculations_schema(request):
    """Return JSON schema for calculations"""
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": AdvancedRule.CALCULATION_TYPES
                },
                "value": {"type": "number"}
            },
            "required": ["type", "value"]
        }
    }
    return Response(schema)

@api_view(['GET'])
def get_available_fields(request):
    """Return available fields and their types"""
    fields = {field[0]: {
        'label': field[1],
        'type': 'numeric' if field[0] in ['weight_lb', 'line_items', 'total_item_qty',
                                        'volume_cuft', 'packages']
        else 'json' if field[0] == 'sku_quantity'
        else 'string'
    } for field in Rule.FIELD_CHOICES}
    return Response(fields)

@api_view(['GET'])
def get_calculation_types(request):
    """Return available calculation types and their descriptions"""
    types = {
        'flat_fee': 'Add a fixed amount',
        'percentage': 'Add a percentage of the base price',
        'per_unit': 'Multiply by quantity',
        'weight_based': 'Multiply by weight',
        'volume_based': 'Multiply by volume',
        'tiered_percentage': 'Apply percentage based on value tiers',
        'product_specific': 'Apply specific rates per product'
    }
    return Response(types)

@api_view(['POST'])
def validate_rule_value(request):
    """Validate a rule value for a given field and operator"""
    try:
        field = request.data.get('field')
        operator = request.data.get('operator')
        value = request.data.get('value')

        if not all([field, operator, value]):
            return Response(
                {'error': 'All parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create a temporary rule for validation
        rule = Rule(field=field, operator=operator, value=value)
        try:
            rule.clean()
            return Response({'valid': True})
        except ValidationError as e:
            return Response(
                {'valid': False, 'errors': e.messages},
                status=status.HTTP_400_BAD_REQUEST
            )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )