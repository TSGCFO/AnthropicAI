"""
URL configuration for LedgerLink project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static  # Add this
from django.contrib.auth import views as auth_views


urlpatterns = [
    path('admin/', admin.site.urls),
    path('customers/', include('customers.urls')),
    path('products/', include('products.urls')),
    path('orders/', include('orders.urls')),
    path('services/', include('services.urls')),
    path('materials/', include('materials.urls')),
    path('shipping/', include('shipping.urls')),
    path('customer_services/', include('customer_services.urls')),
    path('inserts/', include('inserts.urls')),
    path('rules/', include('rules.urls')),
    path('billing/', include('billing.urls')),  # Include the billing app urls
    path('', include('Main.urls')),  # Include the Main app urls
                  path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
                  path('logout/', auth_views.LogoutView.as_view(), name='logout'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
