from django.urls import path
from .views import (
    CustomerServiceListView, CustomerServiceDetailView, CustomerServiceCreateView,
    CustomerServiceUpdateView, CustomerServiceDeleteView, get_customer_skus
)

app_name = 'customer_services'

urlpatterns = [
    # Main CRUD URLs
    path('', CustomerServiceListView.as_view(), name='customer_service_list'),  # Changed from 'list'
    path('<int:pk>/', CustomerServiceDetailView.as_view(), name='customer_service_detail'),  # Changed from 'detail'
    path('new/', CustomerServiceCreateView.as_view(), name='customer_service_create'),  # Changed from 'create'
    path('<int:pk>/edit/', CustomerServiceUpdateView.as_view(), name='customer_service_edit'),  # Changed from 'edit'
    path('<int:pk>/delete/', CustomerServiceDeleteView.as_view(), name='customer_service_delete'),  # Changed from 'delete'

    # API endpoints
    path('api/customer-skus/<int:customer_id>/', get_customer_skus, name='get_customer_skus'),
]