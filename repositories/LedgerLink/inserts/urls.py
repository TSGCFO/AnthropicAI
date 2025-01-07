from django.urls import path
from .views import InsertListView, InsertDetailView, InsertCreateView, InsertUpdateView, InsertDeleteView

urlpatterns = [
    path('', InsertListView.as_view(), name='insert_list'),
    path('insert/<int:pk>/', InsertDetailView.as_view(), name='insert_detail'),
    path('insert/new/', InsertCreateView.as_view(), name='insert_create'),
    path('insert/<int:pk>/edit/', InsertUpdateView.as_view(), name='insert_update'),
    path('insert/<int:pk>/delete/', InsertDeleteView.as_view(), name='insert_delete'),
]
