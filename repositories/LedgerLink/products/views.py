import pandas as pd
from django.shortcuts import render, redirect
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, View
from django.http import HttpResponse
from django.contrib import messages
from .models import Product
from .forms import ProductForm, ProductUploadForm
from customers.models import Customer
from django.db.models import Q


class ProductListView(ListView):
    model = Product
    template_name = 'products/product_list.html'
    context_object_name = 'products'
    paginate_by = 10

    def get_queryset(self):
        query = self.request.GET.get('q')
        if query:
            return Product.objects.filter(
                Q(sku__icontains=query) |
                Q(labeling_unit_1__icontains=query) |
                Q(labeling_unit_2__icontains=query) |
                Q(labeling_unit_3__icontains=query) |
                Q(labeling_unit_4__icontains=query) |
                Q(labeling_unit_5__icontains=query)
            ).select_related('customer')
        return Product.objects.all().select_related('customer')


class ProductDetailView(DetailView):
    model = Product
    template_name = 'products/product_detail.html'
    context_object_name = 'product'

    def get_queryset(self):
        return super().get_queryset().select_related('customer')


class ProductCreateView(CreateView):
    model = Product
    form_class = ProductForm
    template_name = 'products/product_form.html'
    success_url = reverse_lazy('products:product_list')

    def form_valid(self, form):
        messages.success(self.request, 'Product created successfully.')
        return super().form_valid(form)


class ProductUpdateView(UpdateView):
    model = Product
    form_class = ProductForm
    template_name = 'products/product_form.html'
    success_url = reverse_lazy('products:product_list')

    def form_valid(self, form):
        messages.success(self.request, 'Product updated successfully.')
        return super().form_valid(form)


class ProductUploadView(View):
    form_class = ProductUploadForm
    template_name = 'products/product_upload.html'

    def get(self, request):
        form = self.form_class()
        return render(request, self.template_name, {'form': form})

    def post(self, request):
        form = self.form_class(request.POST, request.FILES)
        if form.is_valid():
            file = request.FILES['file']
            result = []
            try:
                if file.name.endswith('.csv'):
                    data = pd.read_csv(file)
                elif file.name.endswith('.xlsx'):
                    data = pd.read_excel(file)
                else:
                    raise ValueError('Unsupported file type')

                # Process data
                for _, row in data.iterrows():
                    try:
                        product, created = Product.objects.update_or_create(
                            sku=row['sku'],
                            customer_id=row['customer_id'],
                            defaults={
                                'labeling_unit_1': row.get('labeling_unit_1', ''),
                                'labeling_quantity_1': row.get('labeling_quantity_1', 0),
                                'labeling_unit_2': row.get('labeling_unit_2', ''),
                                'labeling_quantity_2': row.get('labeling_quantity_2', 0),
                                'labeling_unit_3': row.get('labeling_unit_3', ''),
                                'labeling_quantity_3': row.get('labeling_quantity_3', 0),
                                'labeling_unit_4': row.get('labeling_unit_4', ''),
                                'labeling_quantity_4': row.get('labeling_quantity_4', 0),
                                'labeling_unit_5': row.get('labeling_unit_5', ''),
                                'labeling_quantity_5': row.get('labeling_quantity_5', 0),
                            }
                        )
                        result.append({
                            'sku': row['sku'],
                            'status': 'success',
                            'message': 'Product updated' if not created else 'Product created'
                        })
                    except Exception as e:
                        result.append({
                            'sku': row.get('sku', 'Unknown'),
                            'status': 'error',
                            'message': str(e)
                        })

                messages.success(request, f'Successfully processed {len(result)} products.')
            except Exception as e:
                messages.error(request, f'Error processing file: {str(e)}')

            return render(request, self.template_name, {'form': form, 'result': result})
        return render(request, self.template_name, {'form': form})


class ProductTemplateDownloadView(View):
    def get(self, request):
        # Create a sample DataFrame with the required columns
        df = pd.DataFrame(columns=[
            'sku', 'customer_id',
            'labeling_unit_1', 'labeling_quantity_1',
            'labeling_unit_2', 'labeling_quantity_2',
            'labeling_unit_3', 'labeling_quantity_3',
            'labeling_unit_4', 'labeling_quantity_4',
            'labeling_unit_5', 'labeling_quantity_5'
        ])

        # Create the Excel response
        response = HttpResponse(content_type='application/vnd.ms-excel')
        response['Content-Disposition'] = 'attachment; filename="product_template.xlsx"'

        # Save the DataFrame to the response
        df.to_excel(response, index=False)
        return response