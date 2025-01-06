from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .services import generate_code_suggestion, analyze_code, explain_code, generate_chat_response
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def code_suggestion(request):
    """Generate code suggestions for the editor."""
    try:
        data = json.loads(request.body)
        suggestion = generate_code_suggestion(
            code=data.get('code', ''),
            cursor=data.get('cursor', 0),
            language=data.get('language', 'python'),
            file_path=data.get('file', '')
        )
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
        analysis = analyze_code(data.get('code', ''))
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
        explanation = explain_code(data.get('code', ''))
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