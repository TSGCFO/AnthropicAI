from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .services import generate_code_suggestion, analyze_code, explain_code
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def test_code_generation(request):
    """Test endpoint to demonstrate AI code generation capabilities."""
    try:
        # Sample financial transaction endpoint pattern
        code_template = """
        @require_http_methods(["POST"])
        @transaction.atomic
        def process_financial_transaction(request):
            \"\"\"Process a financial transaction with proper validation and security.\"\"\"
            try:
                data = json.loads(request.body)

                # Add validation logic here

                # Add transaction processing here

                # Add audit logging here

                return JsonResponse({"status": "success"})
            except json.JSONDecodeError:
                return JsonResponse({"error": "Invalid JSON"}, status=400)
            except Exception as e:
                logger.error(f"Transaction processing error: {str(e)}")
                return JsonResponse({"error": "Internal server error"}, status=500)
        """

        # Generate code using our AI service
        suggestion = generate_code_suggestion(
            code=code_template,
            cursor=len(code_template),
            language='python',
            file_path='transaction_api.py'
        )

        # Also get code analysis
        analysis = analyze_code(suggestion['suggestion'])

        return JsonResponse({
            'generated_code': suggestion,
            'code_analysis': analysis
        })

    except Exception as e:
        logger.error(f"Error in test code generation: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def code_suggestion(request):
    """Generate code suggestions for the editor."""
    try:
        data = json.loads(request.body)

        # Extract the context from LedgerLink's codebase
        file_path = data.get('file', '')
        code_context = data.get('code', '')
        cursor_position = data.get('cursor', 0)

        # Generate suggestion using Claude
        suggestion = generate_code_suggestion(
            code=code_context,
            cursor=cursor_position,
            language='python',  # We're focusing on Python/Django for LedgerLink
            file_path=file_path
        )

        # Log the suggestion for monitoring
        logger.info(f"Generated suggestion for {file_path}")

        return JsonResponse(suggestion)
    except Exception as e:
        logger.error(f"Error generating code suggestion: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def code_analysis(request):
    """Analyze code for improvements and potential issues."""
    try:
        data = json.loads(request.body)

        # Analyze the code snippet
        analysis = analyze_code(data.get('code', ''))

        # Log the analysis request
        logger.info("Code analysis performed successfully")

        return JsonResponse(analysis)
    except Exception as e:
        logger.error(f"Error analyzing code: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def code_explanation(request):
    """Generate natural language explanations for code."""
    try:
        data = json.loads(request.body)
        code = data.get('code', '')

        # Get an explanation of the code
        explanation = explain_code(code)

        # Log the explanation request
        logger.info("Code explanation generated successfully")

        return JsonResponse({'explanation': explanation})
    except Exception as e:
        logger.error(f"Error explaining code: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def chat_message(request):
    """Handle chat messages with streaming response."""
    try:
        data = json.loads(request.body)
        conversation_id = data.get('conversation_id')
        content = data.get('content')

        if not content:
            raise ValidationError("Message content is required")

        def generate_response():
            try:
                for chunk in generate_chat_response(content, conversation_id):
                    if isinstance(chunk, dict):
                        yield f"data: {json.dumps(chunk)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Error generating chat response: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        response = StreamingHttpResponse(
            generate_response(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['Connection'] = 'keep-alive'
        return response

    except ValidationError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)