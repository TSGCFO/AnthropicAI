from django.urls import path
from .views import (
    CADShippingListView, CADShippingDetailView, CADShippingCreateView,
    CADShippingUpdateView, CADShippingDeleteView, USShippingListView,
    USShippingDetailView, USShippingCreateView, USShippingUpdateView,
    USShippingDeleteView
)

urlpatterns = [
    path('cadshipping/', CADShippingListView.as_view(), name='cadshipping_list'),
    path('cadshipping/<int:pk>/', CADShippingDetailView.as_view(), name='cadshipping_detail'),
    path('cadshipping/new/', CADShippingCreateView.as_view(), name='cadshipping_create'),
    path('cadshipping/<int:pk>/edit/', CADShippingUpdateView.as_view(), name='cadshipping_update'),
    path('cadshipping/<int:pk>/delete/', CADShippingDeleteView.as_view(), name='cadshipping_delete'),
    path('usshipping/', USShippingListView.as_view(), name='usshipping_list'),
    path('usshipping/<int:pk>/', USShippingDetailView.as_view(), name='usshipping_detail'),
    path('usshipping/new/', USShippingCreateView.as_view(), name='usshipping_create'),
    path('usshipping/<int:pk>/edit/', USShippingUpdateView.as_view(), name='usshipping_update'),
    path('usshipping/<int:pk>/delete/', USShippingDeleteView.as_view(), name='usshipping_delete'),
]
