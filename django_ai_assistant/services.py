from django.conf import settings
from typing import Dict, Any, List, Generator
from anthropic import Anthropic
import json

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
        # Build a comprehensive prompt that includes project context
        prompt = f"""You are an expert programmer specialized in Django and Python development for the LedgerLink project.
        You need to generate code that follows LedgerLink's patterns and best practices.

        Context:
        - LedgerLink is a financial management and accounting system
        - Uses Django for backend with RESTful APIs
        - Follows Django best practices and design patterns
        - Emphasizes clean code and maintainability

        Current file: {file_path}
        Programming Language: {language}

        Code before cursor:
        {code[:cursor]}

        Please provide a completion that:
        1. Matches LedgerLink's existing coding style and patterns
        2. Follows Django best practices
        3. Includes proper error handling
        4. Has comprehensive docstrings
        5. Includes relevant imports
        6. Considers security best practices
        7. Includes any necessary database migrations
        8. Adds appropriate logging

        Respond in JSON format with:
        {{
            "suggestion": "your code suggestion",
            "confidence": 0.0-1.0,
            "explanation": "brief explanation of the suggestion",
            "related_files": ["list of files that might need updates"],
            "tests": "suggested test cases for the code"
        }}
        """

        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract JSON from the response
        content = response.content[0].text
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # If JSON parsing fails, format the response manually
            result = {
                "suggestion": content,
                "confidence": 0.7,
                "explanation": "Generated code suggestion",
                "related_files": [],
                "tests": "No test cases generated"
            }

        return result
    except Exception as e:
        print(f"Error generating code suggestion: {str(e)}")
        return {
            "suggestion": "",
            "confidence": 0.0,
            "explanation": f"Error: {str(e)}",
            "related_files": [],
            "tests": ""
        }

def analyze_code(code: str) -> Dict[str, List[str]]:
    """Analyze code for potential improvements, bugs, and security issues."""
    try:
        prompt = f"""Analyze this Django code in the context of LedgerLink, a financial management system.
        Code to analyze:
        {code}

        Provide a comprehensive analysis including:
        1. Potential bugs or issues
        2. Performance improvements
        3. Security considerations
        4. Django best practices recommendations
        5. Financial data handling improvements
        6. Scalability considerations
        7. Code maintainability suggestions
        8. Integration points with other LedgerLink components

        Format the response as:
        {{
            "suggestions": ["list", "of", "suggestions"],
            "improvements": ["list", "of", "improvements"],
            "security": ["list", "of", "security", "concerns"],
            "patterns": ["list", "of", "detected", "patterns"],
            "database_impact": ["list", "of", "database", "considerations"],
            "api_considerations": ["list", "of", "api", "design", "suggestions"]
        }}"""

        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Extract JSON from the response
        content = response.content[0].text
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {
                "suggestions": ["Error parsing analysis results"],
                "improvements": [],
                "security": [],
                "patterns": [],
                "database_impact": [],
                "api_considerations": []
            }
    except Exception as e:
        print(f"Error analyzing code: {str(e)}")
        return {
            "suggestions": [f"Error: {str(e)}"],
            "improvements": [],
            "security": [],
            "patterns": [],
            "database_impact": [],
            "api_considerations": []
        }

def explain_code(code: str) -> str:
    """Generate a detailed explanation of the code."""
    try:
        response = anthropic.messages.create(
            model=MODEL,
            max_tokens=1000,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert Django developer explaining code for the LedgerLink project.
                    Focus on:
                    1. Code purpose and functionality
                    2. Integration with LedgerLink's architecture
                    3. Best practices implemented
                    4. Potential improvements
                    5. Security considerations"""
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
    """Generate streaming chat responses with LedgerLink context."""
    try:
        messages = [
            {
                "role": "assistant",
                "content": """You are an AI assistant specialized for the LedgerLink project. Your role is to:
                1. Help users understand and work with the LedgerLink codebase
                2. Provide guidance on Django best practices
                3. Assist with accounting and financial software concepts
                4. Maintain a professional and helpful tone
                5. Generate code that follows LedgerLink's patterns
                6. Suggest improvements while maintaining system integrity
                7. Consider security implications for financial data
                8. Explain technical concepts clearly"""
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