from django.urls import path
from .views import (
    CustomerListView, CustomerDetailView, CustomerCreateView,
    CustomerUpdateView, CustomerDeleteView
)

app_name = 'customers'

urlpatterns = [
    path('', CustomerListView.as_view(), name='list'),
    path('<int:pk>/', CustomerDetailView.as_view(), name='detail'),
    path('create/', CustomerCreateView.as_view(), name='add'),
    path('<int:pk>/edit/', CustomerUpdateView.as_view(), name='edit'),
    path('<int:pk>/delete/', CustomerDeleteView.as_view(), name='delete'),
]