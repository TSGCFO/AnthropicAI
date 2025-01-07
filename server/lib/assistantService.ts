import { Anthropic } from '@anthropic-ai/sdk';
import { db } from "@db";
import { messages } from "@db/schema";
import { ContextManager } from "./contextManager";
import { systemPrompts, reasoningSchema, outputSchemas } from './prompts/systemPrompts';
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

      // Apply problem decomposition using PoTh structure
      const decomposedPrompt = await this.decomposeRequest(content, conversationContext);

      // Create the stream with enhanced prompting
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
        system: this.buildSystemMessage(conversationContext),
        stream: true
      });

      // Save message placeholder
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

          // Validate and structure the response
          const validatedResponse = await AssistantService.validateResponse(
            fullResponse,
            conversationContext.context
          );

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

  private static async decomposeRequest(
    content: string, 
    context: { context: Record<string, any>; relevantHistory: any[] }
  ): Promise<string> {
    // Initial thought: Understand the request
    const initialAnalysis = `Let's break this down step by step:

1. Request Analysis:
- User Query: "${content}"
- Context: ${context.context.currentState || 'Initial state'}
- Technical Domain: ${context.context.codeContext?.language || 'General programming'}

2. Prior Context:
${this.extractRelevantHistory(context.relevantHistory)}

3. Problem Decomposition:
- Core Requirements
- Technical Constraints
- Implementation Considerations

Please provide a structured response that shows:
1. Your understanding of the problem
2. Approach and methodology
3. Implementation details with clear steps
4. Validation criteria and testing suggestions`;

    return initialAnalysis;
  }

  private static extractRelevantHistory(history: any[]): string {
    const relevantMessages = history
      .slice(-3) // Get last 3 messages for context
      .map(msg => `- ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);

    return relevantMessages.join('\n');
  }

  private static prepareMessageHistory(history: any[]): any[] {
    return history
      .filter(msg => msg.content?.trim())
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  }

  private static async validateResponse(
    response: string,
    context: Record<string, any>
  ): Promise<string> {
    try {
      // Parse response into structured sections
      const sections = response.split(/\d+\./);

      // Extract and validate each section
      const structured = {
        understanding: sections[1]?.trim() || '',
        approach: sections[2]?.trim() || '',
        implementation: {
          steps: sections[3]?.split('\n').filter(s => s.trim()) || [],
          code: sections[4]?.trim() || '',
          validation: sections[5]?.split('\n').filter(s => s.trim()) || []
        },
        considerations: sections.slice(6, -1).map(s => s.trim()),
        conclusion: sections[sections.length - 1]?.trim() || ''
      };

      // Validate against schema
      const validated = reasoningSchema.parse(structured);

      // Format response with clear sections
      return `Understanding:\n${validated.understanding}\n\n` +
             `Approach:\n${validated.approach}\n\n` +
             `Implementation:\n${validated.implementation.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
             (validated.implementation.code ? `Code:\n\`\`\`\n${validated.implementation.code}\n\`\`\`\n\n` : '') +
             `Validation:\n${validated.implementation.validation.map(v => `- ${v}`).join('\n')}\n\n` +
             `Key Considerations:\n${validated.considerations.map(c => `- ${c}`).join('\n')}\n\n` +
             `Conclusion:\n${validated.conclusion}`;
    } catch (error) {
      console.error('Response validation failed:', error);
      // Fall back to original response if validation fails
      return response;
    }
  }

  private static buildSystemMessage(
    context: { context: Record<string, any>; relevantHistory: any[] }
  ): string {
    // Get base system prompt
    let systemMessage = systemPrompts.codeAssistant;

    // Add technical context
    if (context.context.codeContext) {
      systemMessage += `\n\nTechnical Context:
      - Language: ${context.context.codeContext.language || 'Not specified'}
      - Project: ${context.context.codeContext.projectContext || 'Not specified'}
      - Patterns: ${context.context.codeContext.patterns?.join(', ') || 'None identified'}`;

      // Add relevant code files
      if (context.context.codeContext.relevantFiles?.length) {
        systemMessage += '\n\nRelevant Code:\n';
        for (const file of context.context.codeContext.relevantFiles) {
          systemMessage += `\nFile: ${file.path}\n\`\`\`\n${file.snippet}\n\`\`\``;
        }
      }
    }

    return systemMessage;
  }
}