from django.urls import path
from .views import (
    OrderListView, OrderDetailView, OrderCreateView,
    OrderUpdateView, OrderDeleteView, OrderDownloadView
)

app_name = 'orders'

urlpatterns = [
    path('', OrderListView.as_view(), name='order_list'),
    path('<int:transaction_id>/', OrderDetailView.as_view(), name='order_detail'),
    path('create/', OrderCreateView.as_view(), name='order_create'),
    path('<int:transaction_id>/edit/', OrderUpdateView.as_view(), name='order_update'),
    path('<int:transaction_id>/delete/', OrderDeleteView.as_view(), name='order_delete'),
    path('<int:transaction_id>/download/', OrderDownloadView.as_view(), name='order_download'),
]