from django import template
import json

register = template.Library()

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

@register.filter
def map(sequence, attribute):
    """
    Maps a sequence of objects to a list of values for a specific attribute
    Example usage: {{ my_list|map:'field_name' }}
    """
    if sequence:
        return [getattr(item, attribute) if hasattr(item, attribute)
                else item.get(attribute) if isinstance(item, dict)
        else None
                for item in sequence]
    return []

@register.filter
def get_field(obj, field):
    """
    Gets a field value from an object, handling nested attributes with dot notation
    Example usage: {{ object|get_field:'customer.name' }}
    """
    if not obj or not field:
        return ''

    parts = field.split('__')
    current = obj

    for part in parts:
        if hasattr(current, part):
            current = getattr(current, part)
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return ''

        if callable(current):
            current = current()

    return current

@register.filter
def parse_json(value):
    """Parse JSON string into Python object"""
    try:
        if isinstance(value, str):
            return json.loads(value)
        return value
    except (json.JSONDecodeError, TypeError):
        return []