from django.urls import path
from .views import BillingReportView, GenerateReportAPIView

app_name = 'billing'

urlpatterns = [
    path('report/', BillingReportView.as_view(), name='report'),
    path('api/generate-report/', GenerateReportAPIView.as_view(), name='generate_report'),
]
