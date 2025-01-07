from django.urls import path
from .views import ServiceListView, ServiceDetailView, ServiceCreateView, ServiceUpdateView, ServiceDeleteView

urlpatterns = [
    path('', ServiceListView.as_view(), name='service_list'),
    path('service/<int:pk>/', ServiceDetailView.as_view(), name='service_detail'),
    path('service/new/', ServiceCreateView.as_view(), name='service_create'),
    path('service/<int:pk>/edit/', ServiceUpdateView.as_view(), name='service_update'),
    path('service/<int:pk>/delete/', ServiceDeleteView.as_view(), name='service_delete'),
]
