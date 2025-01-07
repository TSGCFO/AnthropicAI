from django.urls import path
from .views import (
    MaterialListView, MaterialDetailView, MaterialCreateView, MaterialUpdateView, MaterialDeleteView,
    BoxPriceListView, BoxPriceDetailView, BoxPriceCreateView, BoxPriceUpdateView, BoxPriceDeleteView
)

urlpatterns = [
    path('', MaterialListView.as_view(), name='material_list'),
    path('material/<int:pk>/', MaterialDetailView.as_view(), name='material_detail'),
    path('material/new/', MaterialCreateView.as_view(), name='material_create'),
    path('material/<int:pk>/edit/', MaterialUpdateView.as_view(), name='material_update'),
    path('material/<int:pk>/delete/', MaterialDeleteView.as_view(), name='material_delete'),
    path('boxprice/', BoxPriceListView.as_view(), name='boxprice_list'),
    path('boxprice/<int:pk>/', BoxPriceDetailView.as_view(), name='boxprice_detail'),
    path('boxprice/new/', BoxPriceCreateView.as_view(), name='boxprice_create'),
    path('boxprice/<int:pk>/edit/', BoxPriceUpdateView.as_view(), name='boxprice_update'),
    path('boxprice/<int:pk>/delete/', BoxPriceDeleteView.as_view(), name='boxprice_delete'),
]
