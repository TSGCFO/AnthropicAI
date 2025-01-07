# rules/admin.py

from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError
from django.utils.html import format_html
from django.urls import reverse
import json
from .models import RuleGroup, Rule, AdvancedRule


class RuleInline(admin.TabularInline):
    model = Rule
    extra = 1
    fields = ['field', 'operator', 'value', 'adjustment_amount']
    classes = ['collapse']

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        form = formset.form

        # Add dynamic choices for operator based on field
        def clean_operator(self):
            field = self.cleaned_data.get('field')
            operator = self.cleaned_data.get('operator')

            if field in ['weight_lb', 'line_items', 'total_item_qty', 'volume_cuft', 'packages']:
                if operator in ['contains', 'ncontains', 'startswith', 'endswith']:
                    raise ValidationError("Invalid operator for numeric field")
            return operator

        form.clean_operator = clean_operator
        return formset


class AdvancedRuleInline(admin.StackedInline):
    model = AdvancedRule
    extra = 0
    fields = [
        'field', 'operator', 'value', 'adjustment_amount',
        ('conditions', 'calculations')
    ]
    classes = ['collapse']

    def get_formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().get_formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name in ['conditions', 'calculations']:
            formfield.widget = forms.Textarea(attrs={
                'rows': 4,
                'class': 'jsoneditor',
                'style': 'font-family: monospace; width: 100%;'
            })
        return formfield


@admin.register(RuleGroup)
class RuleGroupAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'customer_service_link',
        'logic_operator',
        'rule_count',
        'advanced_rule_count'
    ]
    list_filter = ['logic_operator', 'customer_service__customer']
    search_fields = [
        'customer_service__customer__company_name',
        'customer_service__service__service_name'
    ]
    inlines = [RuleInline, AdvancedRuleInline]

    def customer_service_link(self, obj):
        url = reverse('admin:customer_services_customerservice_change',
                      args=[obj.customer_service.id])
        return format_html('<a href="{}">{}</a>', url, obj.customer_service)

    customer_service_link.short_description = 'Customer Service'

    def rule_count(self, obj):
        return obj.rules.filter(advancedrule=None).count()

    rule_count.short_description = 'Rules'

    def advanced_rule_count(self, obj):
        return obj.rules.filter(advancedrule__isnull=False).count()

    advanced_rule_count.short_description = 'Advanced Rules'

    class Media:
        css = {
            'all': ('admin/css/jsoneditor.min.css',)
        }
        js = (
            'admin/js/jsoneditor.min.js',
            'admin/js/rule_admin.js',
        )


@admin.register(Rule)
class RuleAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'rule_group_link',
        'field',
        'operator',
        'value',
        'adjustment_amount'
    ]
    list_filter = [
        'field',
        'operator',
        'rule_group__customer_service__customer'
    ]
    search_fields = [
        'value',
        'rule_group__customer_service__customer__company_name'
    ]

    def rule_group_link(self, obj):
        url = reverse('admin:rules_rulegroup_change', args=[obj.rule_group.id])
        return format_html('<a href="{}">{}</a>', url, obj.rule_group)

    rule_group_link.short_description = 'Rule Group'


@admin.register(AdvancedRule)
class AdvancedRuleAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'rule_group_link',
        'field',
        'operator',
        'value',
        'adjustment_amount',
        'has_conditions',
        'has_calculations'
    ]
    list_filter = [
        'field',
        'operator',
        'rule_group__customer_service__customer'
    ]
    search_fields = [
        'value',
        'conditions',
        'calculations',
        'rule_group__customer_service__customer__company_name'
    ]
    fieldsets = (
        (None, {
            'fields': (
                'rule_group',
                ('field', 'operator', 'value'),
                'adjustment_amount'
            )
        }),
        ('Advanced Settings', {
            'classes': ('collapse',),
            'fields': ('conditions', 'calculations'),
            'description': 'Configure complex conditions and calculations'
        }),
    )

    def rule_group_link(self, obj):
        url = reverse('admin:rules_rulegroup_change', args=[obj.rule_group.id])
        return format_html('<a href="{}">{}</a>', url, obj.rule_group)

    rule_group_link.short_description = 'Rule Group'

    def has_conditions(self, obj):
        return bool(obj.conditions)

    has_conditions.boolean = True
    has_conditions.short_description = 'Has Conditions'

    def has_calculations(self, obj):
        return bool(obj.calculations)

    has_calculations.boolean = True
    has_calculations.short_description = 'Has Calculations'

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)

        # Add JSON validation for conditions and calculations
        def clean_json_field(field_name):
            def clean(self):
                value = self.cleaned_data.get(field_name)
                if value:
                    try:
                        if isinstance(value, str):
                            json.loads(value)
                        elif not isinstance(value, (dict, list)):
                            raise ValidationError(f"Invalid {field_name} format")
                    except json.JSONDecodeError:
                        raise ValidationError(f"Invalid JSON in {field_name}")
                return value

            return clean

        form.clean_conditions = clean_json_field('conditions')
        form.clean_calculations = clean_json_field('calculations')
        return form

    class Media:
        css = {
            'all': (
                'admin/css/jsoneditor.min.css',
                'admin/css/advanced-rule.css',
            )
        }
        js = (
            'admin/js/jsoneditor.min.js',
            'admin/js/advanced-rule-admin.js',
        )

# Register any additional models if needed
# admin.site.register(OtherModel)