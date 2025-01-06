import openai
from django.conf import settings
from typing import Dict, Any, List
import json

# Initialize OpenAI client
openai.api_key = settings.OPENAI_API_KEY

# Use the latest GPT-4 model
MODEL = "gpt-4o"  # the newest OpenAI model is "gpt-4o" which was released May 13, 2024

def generate_code_suggestion(
    code: str,
    cursor: int,
    language: str,
    file_path: str
) -> Dict[str, Any]:
    """
    Generate code suggestions using OpenAI's GPT-4 model.
    """
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

        response = openai.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=500
        )

        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error generating code suggestion: {str(e)}")
        return {
            "suggestion": "",
            "confidence": 0.0,
            "explanation": f"Error: {str(e)}"
        }

def analyze_code(code: str) -> Dict[str, List[str]]:
    """
    Analyze code for potential improvements, bugs, and security issues.
    """
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

        response = openai.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1000
        )

        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error analyzing code: {str(e)}")
        return {
            "suggestions": [f"Error: {str(e)}"],
            "improvements": [],
            "security": []
        }

def explain_code(code: str) -> str:
    """
    Generate a natural language explanation of the code.
    """
    try:
        response = openai.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert programmer. Explain the following code in a clear and concise manner, focusing on its purpose and key functionality."
                },
                {
                    "role": "user",
                    "content": code
                }
            ],
            temperature=0.3,
            max_tokens=500
        )

        return response.choices[0].message.content or ''
    except Exception as e:
        print(f"Error explaining code: {str(e)}")
        return f"Error: {str(e)}"