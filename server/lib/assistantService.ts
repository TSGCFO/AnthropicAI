import { Anthropic } from '@anthropic-ai/sdk';
import { db } from "@db";
import { messages } from "@db/schema";
import { ContextManager } from "./contextManager";
import { systemPrompts, reasoningSchema } from './prompts/systemPrompts';
import { eq } from "drizzle-orm";
import { z } from "zod";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = "claude-3-5-sonnet-20241022";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export class AssistantService {
  static async processMessage(content: string, conversationId: number) {
    try {
      // Get conversation context
      const conversationContext = await ContextManager.getConversationContext(conversationId);

      // Decompose the user's request into clear steps using chain-of-thought
      const decomposedPrompt = this.decomposeRequest(content, conversationContext.context);

      // Create the stream with improved context and prompting
      const stream = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          ...this.prepareMessageHistory(conversationContext.relevantHistory),
          { 
            role: 'user', 
            content: decomposedPrompt 
          }
        ],
        system: this.buildSystemMessage(conversationContext.context),
        stream: true
      });

      // Save assistant message placeholder
      const [assistantMessage] = await db.insert(messages).values({
        conversationId,
        role: 'assistant',
        content: '',
        contextSnapshot: conversationContext.context,
        createdAt: new Date()
      }).returning();

      let fullResponse = '';

      // Return an async generator that yields message chunks
      const streamGenerator = async function* () {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && 'text' in chunk.delta) {
              fullResponse += chunk.delta.text;
              yield { text: chunk.delta.text };
            }
          }

          // Validate response structure
          const validatedResponse = await AssistantService.validateResponse(fullResponse);

          // Update message with validated response
          await db
            .update(messages)
            .set({ content: validatedResponse })
            .where(eq(messages.id, assistantMessage.id));

        } catch (error) {
          console.error('Error in stream processing:', error);
          throw error;
        }
      };

      return streamGenerator();
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  private static decomposeRequest(content: string, context: Record<string, any>): string {
    // Use problem decomposition to break down complex requests
    return `Let's solve this step by step:

1. Understanding the Request:
- Analyze the user's question: "${content}"
- Consider the current context and codebase state
- Identify key technical concepts involved

2. Relevant Context:
- Current application state: ${context.currentState || 'Not specified'}
- Language/Framework: ${context.codeContext?.language || 'Not specified'}
- Project focus: ${context.codeContext?.projectContext || 'Not specified'}

3. Solution Approach:
- Break down the solution into clear steps
- Reference specific patterns when applicable
- Consider best practices and potential edge cases

Please respond in a structured format:
1. First explain your understanding
2. Then outline your approach
3. Finally provide the implementation or answer
4. Include any necessary verification steps`;
  }

  private static prepareMessageHistory(history: any[]): any[] {
    return history
      .filter(msg => msg.content && msg.content.trim() !== '')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  }

  private static async validateResponse(response: string): Promise<string> {
    try {
      // Ensure response follows reasoning structure
      const parts = response.split(/\d+\./);
      const structured = {
        understanding: parts[1]?.trim() || '',
        approach: parts[2]?.trim() || '',
        considerations: parts.slice(3, -1).map(p => p.trim()),
        conclusion: parts[parts.length - 1]?.trim() || ''
      };

      // Validate using zod schema
      const validated = reasoningSchema.parse(structured);

      // Return formatted response
      return `Understanding: ${validated.understanding}\n\n` +
             `Approach: ${validated.approach}\n\n` +
             `Key Considerations:\n${validated.considerations.map(c => `- ${c}`).join('\n')}\n\n` +
             `Conclusion: ${validated.conclusion}`;
    } catch (error) {
      console.error('Response validation failed:', error);
      return response; // Fall back to original response if validation fails
    }
  }

  private static buildSystemMessage(context: Record<string, any>): string {
    // Get base system prompt based on context
    let systemMessage = systemPrompts.codeAssistant;

    // Add code context if available
    if (context.codeContext) {
      systemMessage += `\n\nCurrent technical context:
      - Language: ${context.codeContext.language || 'Not specified'}
      - Project context: ${context.codeContext.projectContext || 'Not specified'}
      ${context.codeContext.patterns ? `- Detected patterns: ${context.codeContext.patterns.join(', ')}` : ''}`;

      // Add relevant files with their code patterns
      if (context.codeContext.relevantFiles?.length) {
        systemMessage += '\n\nRelevant code files:';
        for (const file of context.codeContext.relevantFiles) {
          systemMessage += `\n\nFile: ${file.path}\n\`\`\`\n${file.snippet}\n\`\`\``;
        }
      }
    }

    return systemMessage;
  }
}