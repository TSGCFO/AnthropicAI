from django.conf import settings
from typing import Dict, Any, List, Generator
from anthropic import Anthropic

# Initialize Anthropic client
if not settings.ANTHROPIC_API_KEY:
    raise ValueError('ANTHROPIC_API_KEY environment variable is required')

anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
MODEL = "claude-3-5-sonnet-20241022"

def generate_code_suggestion(
    code: str,
    cursor: int,
    language: str,
    file_path: str
) -> Dict[str, Any]:
    """Generate code suggestions using Anthropic's Claude model."""
    try:
        prompt = f"""You are an expert programmer assisting with code completion.
        Language: {language}
        Current file: {file_path}

        Code before cursor:
        {code[:cursor]}

        Please provide a completion that:
        1. Matches the coding style and patterns
        2. Follows Django best practices
        3. Includes relevant imports if needed

        Respond in JSON format with:
        {{
            "suggestion": "your code suggestion",
            "confidence": 0.0-1.0,
            "explanation": "brief explanation of the suggestion"
        }}
        """

        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract JSON from the response
        content = response.content[0].text
        try:
            import json
            result = json.loads(content)
        except json.JSONDecodeError:
            # If JSON parsing fails, format the response manually
            result = {
                "suggestion": content,
                "confidence": 0.7,
                "explanation": "Generated code suggestion"
            }

        return result
    except Exception as e:
        print(f"Error generating code suggestion: {str(e)}")
        return {
            "suggestion": "",
            "confidence": 0.0,
            "explanation": f"Error: {str(e)}"
        }

def analyze_code(code: str) -> Dict[str, List[str]]:
    """Analyze code for potential improvements, bugs, and security issues."""
    try:
        prompt = f"""Analyze this Django code and provide feedback in JSON format:
        {code}

        Include:
        1. Potential bugs or issues
        2. Performance improvements
        3. Security considerations
        4. Django best practices recommendations

        Format the response as:
        {{
            "suggestions": ["list", "of", "suggestions"],
            "improvements": ["list", "of", "improvements"],
            "security": ["list", "of", "security", "concerns"]
        }}"""

        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract JSON from the response
        content = response.content[0].text
        try:
            import json
            return json.loads(content)
        except json.JSONDecodeError:
            return {
                "suggestions": ["Error parsing analysis results"],
                "improvements": [],
                "security": []
            }
    except Exception as e:
        print(f"Error analyzing code: {str(e)}")
        return {
            "suggestions": [f"Error: {str(e)}"],
            "improvements": [],
            "security": []
        }

def explain_code(code: str) -> str:
    """Generate a natural language explanation of the code."""
    try:
        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=500,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert programmer. Explain the following code in a clear and concise manner, focusing on its purpose and key functionality."
                },
                {
                    "role": "user",
                    "content": code
                }
            ]
        )

        return response.content[0].text
    except Exception as e:
        print(f"Error explaining code: {str(e)}")
        return f"Error: {str(e)}"

def generate_chat_response(content: str, conversation_id: int = None) -> Generator[Dict[str, str], None, None]:
    """Generate streaming chat responses."""
    try:
        messages = [
            {
                "role": "assistant",
                "content": """You are an AI assistant specialized for the LedgerLink project. Your role is to:
                1. Help users understand and work with the LedgerLink codebase
                2. Provide guidance on Django best practices
                3. Assist with accounting and financial software concepts
                4. Maintain a professional and helpful tone"""
            },
            {
                "role": "user",
                "content": content
            }
        ]

        stream = anthropic.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=messages,
            stream=True
        )

        for chunk in stream:
            if chunk.type == "content_block_delta":
                yield {"text": chunk.delta.text}

    except Exception as e:
        print(f"Error generating chat response: {str(e)}")
        yield {"error": str(e)}