from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from .models import Insert
from .forms import InsertForm


# Create your views here.

class InsertListView(ListView):
    model = Insert
    template_name = 'inserts/insert_list.html'
    context_object_name = 'inserts'


class InsertDetailView(DetailView):
    model = Insert
    template_name = 'inserts/insert_detail.html'
    context_object_name = 'insert'


class InsertCreateView(CreateView):
    model = Insert
    form_class = InsertForm
    template_name = 'inserts/insert_form.html'
    success_url = reverse_lazy('insert_list')


class InsertUpdateView(UpdateView):
    model = Insert
    form_class = InsertForm
    template_name = 'inserts/insert_form.html'
    success_url = reverse_lazy('insert_list')


class InsertDeleteView(DeleteView):
    model = Insert
    template_name = 'inserts/insert_confirm_delete.html'
    success_url = reverse_lazy('insert_list')
