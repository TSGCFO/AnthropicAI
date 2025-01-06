from django.urls import path
from . import views

urlpatterns = [
    path('suggest/', views.code_suggestion, name='code_suggestion'),
    path('analyze/', views.code_analysis, name='code_analysis'),
    path('explain/', views.code_explanation, name='code_explanation'),
]
