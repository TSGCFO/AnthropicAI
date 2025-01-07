from django import template
import json

register = template.Library()

@register.filter
def parse_json(value):
    try:
        if isinstance(value, str):
            return json.loads(value)
        return value
    except (json.JSONDecodeError, TypeError):
        return []