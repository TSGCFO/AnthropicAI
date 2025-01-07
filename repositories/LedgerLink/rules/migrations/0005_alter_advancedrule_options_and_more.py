# Generated by Django 5.1.4 on 2025-01-04 21:52

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rules', '0004_advancedrule'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='advancedrule',
            options={'verbose_name': 'Advanced Rule', 'verbose_name_plural': 'Advanced Rules'},
        ),
        migrations.AlterField(
            model_name='advancedrule',
            name='calculations',
            field=models.JSONField(blank=True, default=list, help_text="JSON array of calculation steps: [{'type': 'calculation_type', 'value': numeric_value}]"),
        ),
        migrations.AlterField(
            model_name='advancedrule',
            name='conditions',
            field=models.JSONField(blank=True, default=dict, help_text="JSON object containing additional conditions: {'field': {'operator': 'value'}}"),
        ),
    ]