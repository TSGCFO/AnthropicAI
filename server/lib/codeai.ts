import OpenAI from "openai";
import type { CompletionCreateParams } from "openai/resources/chat/completions";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const MODEL = "gpt-4o";

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CodeContext {
  currentFile: string;
  fileContent: string;
  cursor: number;
  language: string;
  projectContext?: string;
}

export interface CodeSuggestion {
  suggestion: string;
  confidence: number;
  explanation?: string;
}

export async function generateCodeSuggestion(context: CodeContext): Promise<CodeSuggestion> {
  try {
    const prompt = `You are an expert programmer assisting with code completion. 
    Language: ${context.language}
    Current file: ${context.currentFile}
    Project context: ${context.projectContext || 'No additional context provided'}
    
    Code before cursor:
    ${context.fileContent.slice(0, context.cursor)}
    
    Please provide a completion that:
    1. Matches the coding style and patterns
    2. Considers the project context
    3. Follows best practices for ${context.language}
    4. Includes relevant imports if needed
    
    Respond in JSON format with:
    {
      "suggestion": "your code suggestion",
      "confidence": 0.0-1.0,
      "explanation": "brief explanation of the suggestion"
    }`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500,
    });

    const response = JSON.parse(completion.choices[0].message.content);
    return {
      suggestion: response.suggestion,
      confidence: response.confidence,
      explanation: response.explanation,
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate code suggestion');
  }
}

export async function analyzeCode(code: string): Promise<{
  suggestions: string[];
  improvements: string[];
  security: string[];
}> {
  try {
    const prompt = `Analyze this code and provide feedback in JSON format:
    ${code}
    
    Include:
    1. Potential bugs or issues
    2. Performance improvements
    3. Security considerations
    4. Best practices recommendations
    
    Format the response as:
    {
      "suggestions": ["list", "of", "suggestions"],
      "improvements": ["list", "of", "improvements"],
      "security": ["list", "of", "security", "concerns"]
    }`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000,
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Code analysis error:', error);
    throw new Error('Failed to analyze code');
  }
}

export async function explainCode(code: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an expert programmer. Explain the following code in a clear and concise manner, focusing on its purpose and key functionality."
        },
        {
          role: "user",
          content: code
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Code explanation error:', error);
    throw new Error('Failed to explain code');
  }
}
