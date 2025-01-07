from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from .models import Material, BoxPrice
from .forms import MaterialForm, BoxPriceForm

# Create your views here.


class MaterialListView(ListView):
    model = Material
    template_name = 'materials/material_list.html'
    context_object_name = 'materials'


class MaterialDetailView(DetailView):
    model = Material
    template_name = 'materials/material_detail.html'
    context_object_name = 'material'


class MaterialCreateView(CreateView):
    model = Material
    form_class = MaterialForm
    template_name = 'materials/material_form.html'
    success_url = reverse_lazy('material_list')


class MaterialUpdateView(UpdateView):
    model = Material
    form_class = MaterialForm
    template_name = 'materials/material_form.html'
    success_url = reverse_lazy('material_list')


class MaterialDeleteView(DeleteView):
    model = Material
    template_name = 'materials/material_confirm_delete.html'
    success_url = reverse_lazy('material_list')


class BoxPriceListView(ListView):
    model = BoxPrice
    template_name = 'materials/boxprice_list.html'
    context_object_name = 'boxprices'


class BoxPriceDetailView(DetailView):
    model = BoxPrice
    template_name = 'materials/boxprice_detail.html'
    context_object_name = 'boxprice'


class BoxPriceCreateView(CreateView):
    model = BoxPrice
    form_class = BoxPriceForm
    template_name = 'materials/boxprice_form.html'
    success_url = reverse_lazy('boxprice_list')


class BoxPriceUpdateView(UpdateView):
    model = BoxPrice
    form_class = BoxPriceForm
    template_name = 'materials/boxprice_form.html'
    success_url = reverse_lazy('boxprice_list')


class BoxPriceDeleteView(DeleteView):
    model = BoxPrice
    template_name = 'materials/boxprice_confirm_delete.html'
    success_url = reverse_lazy('boxprice_list')
