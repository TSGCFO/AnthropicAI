from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse, HttpResponse
from django.core.exceptions import ValidationError
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .forms import BillingReportForm
from .billing_calculator import generate_billing_report
import logging

logger = logging.getLogger(__name__)

@method_decorator(ensure_csrf_cookie, name='dispatch')
class BillingReportView(LoginRequiredMixin, TemplateView):
    template_name = 'billing/billing_report.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['form'] = BillingReportForm()
        return context

class GenerateReportAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            logger.info(f"Received data: {request.data}")

            customer_id = request.data.get('customer_id')
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')
            output_format = request.data.get('output_format', 'json')

            if not all([customer_id, start_date, end_date]):
                missing_params = []
                if not customer_id: missing_params.append('customer_id')
                if not start_date: missing_params.append('start_date')
                if not end_date: missing_params.append('end_date')
                error_msg = f"Missing required parameters: {', '.join(missing_params)}"
                logger.error(error_msg)
                return Response(
                    {"error": error_msg},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                customer_id = int(customer_id)
            except (TypeError, ValueError):
                error_msg = f"Invalid customer_id format: {customer_id}"
                logger.error(error_msg)
                return Response(
                    {"error": error_msg},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                report = generate_billing_report(
                    customer_id=customer_id,
                    start_date=start_date,
                    end_date=end_date,
                    output_format=output_format
                )
                logger.info("Report generated successfully")

                # Handle different output formats
                if output_format == 'csv':
                    response = HttpResponse(report, content_type='text/csv')
                    response['Content-Disposition'] = 'attachment; filename="billing_report.csv"'
                    return response
                elif output_format == 'pdf':
                    response = HttpResponse(report, content_type='application/pdf')
                    response['Content-Disposition'] = 'attachment; filename="billing_report.pdf"'
                    return response
                else:
                    return Response({'report': report})

            except Exception as e:
                error_msg = f"Error generating report: {str(e)}"
                logger.error(error_msg)
                return Response(
                    {"error": error_msg},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            return Response(
                {"error": error_msg},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )