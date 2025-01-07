from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from .models import CADShipping, USShipping
from .forms import CADShippingForm, USShippingForm


# Create your views here.

class CADShippingListView(ListView):
    model = CADShipping
    template_name = 'shipping/cadshipping_list.html'
    context_object_name = 'cadshippings'


class CADShippingDetailView(DetailView):
    model = CADShipping
    template_name = 'shipping/cadshipping_detail.html'
    context_object_name = 'cadshipping'


class CADShippingCreateView(CreateView):
    model = CADShipping
    form_class = CADShippingForm
    template_name = 'shipping/cadshipping_form.html'
    success_url = reverse_lazy('cadshipping_list')


class CADShippingUpdateView(UpdateView):
    model = CADShipping
    form_class = CADShippingForm
    template_name = 'shipping/cadshipping_form.html'
    success_url = reverse_lazy('cadshipping_list')


class CADShippingDeleteView(DeleteView):
    model = CADShipping
    template_name = 'shipping/cadshipping_confirm_delete.html'
    success_url = reverse_lazy('cadshipping_list')


class USShippingListView(ListView):
    model = USShipping
    template_name = 'shipping/usshipping_list.html'
    context_object_name = 'usshippings'


class USShippingDetailView(DetailView):
    model = USShipping
    template_name = 'shipping/usshipping_detail.html'
    context_object_name = 'usshipping'


class USShippingCreateView(CreateView):
    model = USShipping
    form_class = USShippingForm
    template_name = 'shipping/usshipping_form.html'
    success_url = reverse_lazy('usshipping_list')


class USShippingUpdateView(UpdateView):
    model = USShipping
    form_class = USShippingForm
    template_name = 'shipping/usshipping_form.html'
    success_url = reverse_lazy('usshipping_list')


class USShippingDeleteView(DeleteView):
    model = USShipping
    template_name = 'shipping/usshipping_confirm_delete.html'
    success_url = reverse_lazy('usshipping_list')
