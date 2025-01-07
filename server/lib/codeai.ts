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
  related_files?: string[];
  tests?: string;
  security_considerations?: string[];
  audit_points?: string[];
}

export async function generateCodeSuggestion(context: CodeContext): Promise<CodeSuggestion> {
  try {
    const systemPrompt = `You are an expert programmer specialized in generating secure and maintainable code for financial systems.
    Focus on:
    1. Security best practices
    2. Proper error handling
    3. Audit logging
    4. Transaction management
    5. Input validation
    6. Performance optimization`;

    const prompt = `Given the following context:
    File: ${context.currentFile}
    Language: ${context.language}
    Project context: ${context.projectContext || 'No additional context provided'}

    Generate code completion for:
    ${context.fileContent}

    Respond in JSON format with:
    {
      "suggestion": "your code suggestion",
      "confidence": 0.0-1.0,
      "explanation": "brief explanation of the suggestion",
      "related_files": ["list of files that might need updates"],
      "tests": "suggested test cases",
      "security_considerations": ["security aspects considered"],
      "audit_points": ["audit logging points"]
    }`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error("Empty response from OpenAI");
    }

    try {
      return JSON.parse(responseContent) as CodeSuggestion;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Return a basic response if JSON parsing fails
      return {
        suggestion: responseContent,
        confidence: 0.5,
        explanation: "Generated from raw response",
      };
    }
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
    const systemPrompt = "You are a code analysis expert specializing in financial systems security and best practices.";
    const prompt = `Analyze this code and provide feedback in JSON format:
    ${code}

    Consider:
    1. Security vulnerabilities
    2. Performance issues
    3. Error handling
    4. Best practices
    5. Financial data safety

    Format as:
    {
      "suggestions": ["list", "of", "suggestions"],
      "improvements": ["list", "of", "improvements"],
      "security": ["list", "of", "security", "concerns"]
    }`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error("Empty response from OpenAI");
    }

    return JSON.parse(responseContent);
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
          content: "You are an expert programmer. Explain the following code in a clear and concise manner, focusing on its purpose, security implications, and best practices."
        },
        {
          role: "user",
          content: code
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return completion.choices[0].message.content || 'No explanation generated';
  } catch (error) {
    console.error('Code explanation error:', error);
    throw new Error('Failed to explain code');
  }
}