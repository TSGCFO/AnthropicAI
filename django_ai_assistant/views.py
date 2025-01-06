from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .services import generate_code_suggestion, analyze_code, explain_code

@csrf_exempt
@require_http_methods(["POST"])
def code_suggestion(request):
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
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def code_analysis(request):
    try:
        data = json.loads(request.body)
        analysis = analyze_code(data.get('code', ''))
        return JsonResponse(analysis)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def code_explanation(request):
    try:
        data = json.loads(request.body)
        explanation = explain_code(data.get('code', ''))
        return JsonResponse({'explanation': explanation})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)