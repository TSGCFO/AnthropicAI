# rules/templatetags/rule_filters.py

from django import template
import json

register = template.Library()

@register.filter
def json_script(value):
    """Format JSON for display"""
    try:
        if isinstance(value, str):
            value = json.loads(value)
        return json.dumps(value, indent=2)
    except (json.JSONDecodeError, TypeError):
        return str(value)

@register.filter
def get_calculation_description(calc_type):
    """Get description for calculation type"""
    descriptions = {
        'flat_fee': 'Add a fixed amount to the base price',
        'percentage': 'Add a percentage of the base price',
        'per_unit': 'Multiply by the total quantity',
        'weight_based': 'Multiply by the weight in pounds',
        'volume_based': 'Multiply by the volume in cubic feet',
        'tiered_percentage': 'Apply percentage based on value tiers',
        'product_specific': 'Apply specific rates per product SKU'
    }
    return descriptions.get(str(calc_type), str(calc_type).replace('_', ' ').title())