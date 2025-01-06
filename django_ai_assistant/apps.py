from django.apps import AppConfig

class DjangoAiAssistantConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'django_ai_assistant'
    verbose_name = 'AI Assistant'

    def ready(self):
        # Import signals and register any app-specific startup code
        pass
