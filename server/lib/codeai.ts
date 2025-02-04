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
    6. Performance optimization
    7. Code patterns recognition
    8. Context awareness
    9. Type safety
    10. Memory efficiency`;

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
  patterns?: string[];
  performance?: string[];
  maintainability?: string[];
}> {
  try {
    const systemPrompt = `You are a code analysis expert specializing in:
    1. Code quality assessment
    2. Security vulnerability detection
    3. Performance optimization
    4. Design pattern recognition
    5. Best practices enforcement
    6. Code smell detection
    7. Complexity analysis
    8. Type safety verification
    9. Memory leak detection
    10. Runtime optimization opportunities`;

    const prompt = `Analyze this code and provide detailed feedback in JSON format:
    ${code}

    Consider:
    1. Security vulnerabilities
    2. Performance bottlenecks
    3. Error handling patterns
    4. Code organization
    5. Type safety
    6. Memory management
    7. API design
    8. Scalability concerns
    9. Testing strategies
    10. Documentation needs

    Format as:
    {
      "suggestions": ["list", "of", "suggestions"],
      "improvements": ["list", "of", "improvements"],
      "security": ["list", "of", "security", "concerns"],
      "patterns": ["list", "of", "detected", "patterns"],
      "performance": ["list", "of", "performance", "considerations"],
      "maintainability": ["list", "of", "maintainability", "issues"]
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
          content: `You are an expert programmer. Explain the following code in a clear and concise manner, focusing on:
          1. Purpose and functionality
          2. Security implications
          3. Performance characteristics
          4. Best practices followed
          5. Potential improvements
          6. Design patterns used
          7. Error handling strategy
          8. Type safety considerations
          9. Memory management approach
          10. API design principles`
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