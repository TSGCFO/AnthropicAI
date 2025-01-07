# rules/models.py

from django.core.exceptions import ValidationError
from django.db import models
from customer_services.models import CustomerService
import re
import json

class RuleGroup(models.Model):
    LOGIC_CHOICES = [
        ('AND', 'All conditions must be true (AND)'),
        ('OR', 'Any condition can be true (OR)'),
        ('NOT', 'Condition must not be true (NOT)'),
        ('XOR', 'Only one condition must be true (XOR)'),
        ('NAND', 'At least one condition must be false (NAND)'),
        ('NOR', 'None of the conditions must be true (NOR)'),
    ]

    customer_service = models.ForeignKey(CustomerService, on_delete=models.CASCADE)
    logic_operator = models.CharField(max_length=5, choices=LOGIC_CHOICES, default='AND')

    def __str__(self):
        return f"Rule Group for {self.customer_service} ({self.get_logic_operator_display()})"


class Rule(models.Model):
    FIELD_CHOICES = [
        ('reference_number', 'Reference Number'),
        ('ship_to_name', 'Ship To Name'),
        ('ship_to_company', 'Ship To Company'),
        ('ship_to_city', 'Ship To City'),
        ('ship_to_state', 'Ship To State'),
        ('ship_to_country', 'Ship To Country'),
        ('weight_lb', 'Weight (lb)'),
        ('line_items', 'Line Items'),
        ('sku_quantity', 'SKU Quantity'),
        ('total_item_qty', 'Total Item Quantity'),
        ('packages', 'Packages'),
        ('notes', 'Notes'),
        ('carrier', 'Carrier'),
        ('volume_cuft', 'Volume (cuft)'),
    ]

    OPERATOR_CHOICES = [
        ('gt', 'Greater than'),
        ('lt', 'Less than'),
        ('eq', 'Equals'),
        ('ne', 'Not equals'),
        ('ge', 'Greater than or equals'),
        ('le', 'Less than or equals'),
        ('in', 'In'),
        ('ni', 'Not in'),
        ('contains', 'Contains'),
        ('ncontains', 'Not contains'),
        ('startswith', 'Starts with'),
        ('endswith', 'Ends with'),
    ]

    rule_group = models.ForeignKey(RuleGroup, on_delete=models.CASCADE, related_name='rules')
    field = models.CharField(max_length=50, choices=FIELD_CHOICES)
    operator = models.CharField(max_length=10, choices=OPERATOR_CHOICES)
    value = models.CharField(max_length=255, help_text="For multiple values, separate them with a semicolon (;)")

    adjustment_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                            help_text="Amount to adjust the price")

    def __str__(self):
        return f"{self.get_field_display()} {self.get_operator_display()} {self.value} -> {self.adjustment_amount}"

    def clean(self):
        """Basic validation to ensure field and operator combination makes sense."""
        values = self.get_values_as_list()

        # String field validation
        if self.field in ['reference_number', 'ship_to_name', 'ship_to_company', 'ship_to_city',
                          'ship_to_state', 'ship_to_zip', 'ship_to_country', 'carrier', 'notes']:
            if self.operator in ['gt', 'lt', 'ge', 'le']:
                raise ValidationError(f"Operator '{self.get_operator_display()}' is not valid for string fields.")

        # Numeric field validation
        elif self.field in ['weight_lb', 'line_items', 'total_item_qty', 'volume_cuft', 'packages']:
            if self.operator in ['contains', 'ncontains', 'startswith', 'endswith']:
                raise ValidationError(f"Operator '{self.get_operator_display()}' is not valid for numeric fields.")
            if self.operator in ['gt', 'lt', 'ge', 'le', 'eq', 'ne']:
                try:
                    [float(v) for v in values]
                except ValueError:
                    raise ValidationError(f"Operator '{self.get_operator_display()}' requires numeric values.")

        # JSON field validation (basic)
        elif self.field == 'sku_quantity':
            if self.operator in ['contains', 'ncontains', 'in', 'ni']:
                # Allow basic list of keys or values
                pass
            elif self.operator in ['gt', 'lt', 'ge', 'le']:
                raise ValidationError(f"Operator '{self.get_operator_display()}' is not valid for JSON fields.")

        super().clean()

    def get_values_as_list(self):
        """Utility method to return the value field as a list of individual items."""
        return [v.strip() for v in self.value.split(';') if v.strip()]


class AdvancedRule(Rule):
    """
    Extended Rule model that supports complex conditions and calculations.
    Inherits all basic rule functionality and adds advanced features.
    """
    conditions = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON object containing additional conditions: {'field': {'operator': 'value'}}"
    )
    calculations = models.JSONField(
        default=list,
        blank=True,
        help_text="JSON array of calculation steps: [{'type': 'calculation_type', 'value': numeric_value}]"
    )

    CALCULATION_TYPES = [
        'flat_fee',  # Add fixed amount
        'percentage',  # Add percentage of base price
        'per_unit',  # Multiply by quantity
        'weight_based',  # Multiply by weight
        'volume_based',  # Multiply by volume
        'tiered_percentage',  # Apply percentage based on value tiers
        'product_specific'  # Apply specific rates per product
    ]

    def clean(self):
        """Validate the advanced rule's conditions and calculations"""
        super().clean()

        # Validate conditions structure
        if self.conditions:
            if not isinstance(self.conditions, dict):
                raise ValidationError({'conditions': 'Conditions must be a JSON object'})

            for field, criteria in self.conditions.items():
                if not isinstance(criteria, dict):
                    raise ValidationError({'conditions': f'Criteria for field {field} must be a JSON object'})

                if not all(isinstance(k, str) and isinstance(v, (str, int, float))
                           for k, v in criteria.items()):
                    raise ValidationError(
                        {'conditions': f'Invalid criteria format for field {field}'}
                    )

        # Validate calculations structure
        if self.calculations:
            if not isinstance(self.calculations, list):
                raise ValidationError({'calculations': 'Calculations must be a JSON array'})

            for calc in self.calculations:
                if not isinstance(calc, dict):
                    raise ValidationError({'calculations': 'Each calculation must be a JSON object'})

                if 'type' not in calc or 'value' not in calc:
                    raise ValidationError(
                        {'calculations': 'Each calculation must have "type" and "value" fields'}
                    )

                if calc['type'] not in self.CALCULATION_TYPES:
                    raise ValidationError(
                        {'calculations': f'Invalid calculation type: {calc["type"]}'}
                    )

                try:
                    float(calc['value'])
                except (TypeError, ValueError):
                    raise ValidationError(
                        {'calculations': f'Invalid numeric value in calculation: {calc["value"]}'}
                    )

    def evaluate_conditions(self, order):
        """
        Evaluate all conditions against the order.
        Returns True if all conditions are met, False otherwise.
        """
        try:
            # First evaluate the base rule conditions
            if not super().clean():  # This calls the parent Rule's validation
                return False

            # Then evaluate the advanced conditions
            for field, criteria in self.conditions.items():
                if not hasattr(order, field):
                    return False

                order_value = getattr(order, field)
                for operator, value in criteria.items():
                    if not self.compare(order_value, operator, value):
                        return False

            return True

        except Exception as e:
            return False

    @staticmethod
    def compare(actual, operator, expected):
        """
        Compare actual value with expected value using the specified operator.
        Supports various comparison operations for different data types.
        """
        if operator == 'eq':
            return actual == expected
        elif operator == 'ne':
            return actual != expected
        elif operator == 'gt':
            return actual > expected
        elif operator == 'lt':
            return actual < expected
        elif operator == 'ge':
            return actual >= expected
        elif operator == 'le':
            return actual <= expected
        elif operator == 'in':
            return actual in expected
        elif operator == 'ni':
            return actual not in expected
        elif operator == 'contains':
            return expected in actual
        elif operator == 'ncontains':
            return expected not in actual
        elif operator == 'starts_with':
            return actual.startswith(expected)
        elif operator == 'ends_with':
            return actual.endswith(expected)
        elif operator == 'is_empty':
            return not actual
        elif operator == 'is_not_empty':
            return bool(actual)
        elif operator == 'is_null':
            return actual is None
        elif operator == 'is_not_null':
            return actual is not None
        elif operator == 'in_range':
            return expected[0] <= actual <= expected[1]
        elif operator == 'not_in_range':
            return actual < expected[0] or actual > expected[1]
        elif operator == 'regex':
            return bool(re.search(expected, actual))
        return False

    def apply_calculations(self, order, base_amount):
        """
        Apply the rule's calculations to determine the final amount.
        Returns the calculated amount based on the rule's calculation steps.
        """
        try:
            amount = base_amount

            for calc in self.calculations:
                calc_type = calc['type']
                value = float(calc['value'])

                if calc_type == 'flat_fee':
                    amount += value
                elif calc_type == 'percentage':
                    amount += amount * (value / 100)
                elif calc_type == 'per_unit':
                    amount += order.total_item_qty * value
                elif calc_type == 'weight_based':
                    if order.weight_lb:
                        amount += float(order.weight_lb) * value
                elif calc_type == 'volume_based':
                    if order.volume_cuft:
                        amount += float(order.volume_cuft) * value
                elif calc_type == 'tiered_percentage':
                    for tier in value:
                        if amount >= tier['min'] and amount <= tier['max']:
                            amount += amount * (tier['percentage'] / 100)
                            break
                elif calc_type == 'product_specific':
                    if order.sku_quantity:
                        sku_data = json.loads(order.sku_quantity)
                        for item in sku_data:
                            sku = item['sku']
                            if sku in calc['rates']:
                                amount += item['quantity'] * calc['rates'][sku]

            return amount

        except Exception as e:
            return base_amount

    class Meta:
        verbose_name = "Advanced Rule"
        verbose_name_plural = "Advanced Rules"