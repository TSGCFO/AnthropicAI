# rules/forms.py

from django import forms
from django.core.exceptions import ValidationError
import json
from .models import RuleGroup, Rule, AdvancedRule


class RuleGroupForm(forms.ModelForm):
    class Meta:
        model = RuleGroup
        fields = ['customer_service', 'logic_operator']
        widgets = {
            'customer_service': forms.Select(attrs={'class': 'form-select'}),
            'logic_operator': forms.Select(attrs={'class': 'form-select'})
        }


class RuleForm(forms.ModelForm):
    class Meta:
        model = Rule
        fields = ['field', 'operator', 'value', 'adjustment_amount']
        widgets = {
            'field': forms.Select(attrs={'class': 'form-select'}),
            'operator': forms.Select(attrs={'class': 'form-select'}),
            'value': forms.TextInput(attrs={'class': 'form-control'}),
            'adjustment_amount': forms.NumberInput(
                attrs={
                    'class': 'form-control',
                    'step': '0.01'
                }
            )
        }


class AdvancedRuleForm(forms.ModelForm):
    class Meta:
        model = AdvancedRule
        fields = ['field', 'operator', 'value', 'adjustment_amount', 'conditions', 'calculations']
        widgets = {
            'field': forms.Select(attrs={
                'class': 'form-select',
                'data-controller': 'rule-field'
            }),
            'operator': forms.Select(attrs={
                'class': 'form-select',
                'data-controller': 'rule-operator'
            }),
            'value': forms.TextInput(attrs={
                'class': 'form-control'
            }),
            'adjustment_amount': forms.NumberInput(attrs={
                'class': 'form-control',
                'step': '0.01'
            }),
            'conditions': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'data-controller': 'json-editor',
                'placeholder': '{\n  "field_name": {\n    "operator": "value"\n  }\n}'
            }),
            'calculations': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'data-controller': 'json-editor',
                'placeholder': '[\n  {\n    "type": "calculation_type",\n    "value": 0\n  }\n]'
            })
        }

    def clean_conditions(self):
        """Validate the conditions JSON structure"""
        conditions = self.cleaned_data.get('conditions')

        try:
            if isinstance(conditions, str):
                conditions = json.loads(conditions)

            if not isinstance(conditions, dict):
                raise ValidationError("Conditions must be a JSON object")

            for field, criteria in conditions.items():
                if not isinstance(criteria, dict):
                    raise ValidationError(f"Criteria for field '{field}' must be a JSON object")

                for operator, value in criteria.items():
                    if not isinstance(operator, str):
                        raise ValidationError(f"Invalid operator type in field '{field}'")
                    if not isinstance(value, (str, int, float, bool)):
                        raise ValidationError(f"Invalid value type in field '{field}'")

            return conditions

        except json.JSONDecodeError as e:
            raise ValidationError(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            raise ValidationError(f"Invalid conditions format: {str(e)}")

    def clean_calculations(self):
        """Validate the calculations JSON structure"""
        calculations = self.cleaned_data.get('calculations')

        try:
            if isinstance(calculations, str):
                calculations = json.loads(calculations)

            if not isinstance(calculations, list):
                raise ValidationError("Calculations must be a JSON array")

            valid_types = set(AdvancedRule.CALCULATION_TYPES)

            for calc in calculations:
                if not isinstance(calc, dict):
                    raise ValidationError("Each calculation must be a JSON object")

                if 'type' not in calc:
                    raise ValidationError("Missing 'type' in calculation")
                if 'value' not in calc:
                    raise ValidationError("Missing 'value' in calculation")

                if calc['type'] not in valid_types:
                    raise ValidationError(f"Invalid calculation type: {calc['type']}")

                try:
                    float(calc['value'])
                except (TypeError, ValueError):
                    raise ValidationError(f"Invalid numeric value: {calc['value']}")

                # Validate specific calculation types
                if calc['type'] == 'tiered_percentage':
                    if 'tiers' not in calc:
                        raise ValidationError("Missing 'tiers' for tiered_percentage calculation")
                    for tier in calc['tiers']:
                        if not all(k in tier for k in ('min', 'max', 'percentage')):
                            raise ValidationError("Invalid tier structure")

                elif calc['type'] == 'product_specific':
                    if 'rates' not in calc:
                        raise ValidationError("Missing 'rates' for product_specific calculation")
                    if not isinstance(calc['rates'], dict):
                        raise ValidationError("Rates must be a JSON object")

            return calculations

        except json.JSONDecodeError as e:
            raise ValidationError(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            raise ValidationError(f"Invalid calculations format: {str(e)}")

    def clean(self):
        """Additional validation for the form as a whole"""
        cleaned_data = super().clean()

        # Ensure adjustment_amount is provided if there are no calculations
        calculations = cleaned_data.get('calculations', [])
        adjustment_amount = cleaned_data.get('adjustment_amount')

        if not calculations and not adjustment_amount:
            raise ValidationError(
                "Either adjustment amount or calculations must be provided"
            )

        # Validate field and operator compatibility with conditions
        field = cleaned_data.get('field')
        operator = cleaned_data.get('operator')
        conditions = cleaned_data.get('conditions', {})

        if field and operator and conditions:
            for condition_field, criteria in conditions.items():
                # Check if the condition field exists in the model
                if condition_field not in dict(Rule.FIELD_CHOICES):
                    raise ValidationError(f"Invalid field in conditions: {condition_field}")

                # Check operator compatibility
                for condition_operator in criteria.keys():
                    if condition_operator not in dict(Rule.OPERATOR_CHOICES):
                        raise ValidationError(
                            f"Invalid operator in conditions: {condition_operator}"
                        )

        return cleaned_data

    class Media:
        css = {
            'all': ('css/jsoneditor.min.css',)
        }
        js = (
            'js/jsoneditor.min.js',
            'js/advanced-rule-form.js',
        )