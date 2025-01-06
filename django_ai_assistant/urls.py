from django.urls import path
from . import views

app_name = 'django_ai_assistant'

urlpatterns = [
    path('code/suggest/', views.code_suggestion, name='code_suggestion'),
    path('code/analyze/', views.code_analysis, name='code_analysis'),
    path('code/explain/', views.code_explanation, name='code_explanation'),
    path('chat/message/', views.chat_message, name='chat_message'),
    path('code/test-generation/', views.test_code_generation, name='test_code_generation'),
]