import { Anthropic } from '@anthropic-ai/sdk';
import { db } from "@db";
import { messages } from "@db/schema";
import { ContextManager } from "./contextManager";

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

      // Prepare system message with context
      const systemMessage = this.buildSystemMessage(conversationContext.context);

      // Prepare conversation history
      const messageHistory = conversationContext.relevantHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Create the stream
      const stream = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          ...messageHistory,
          { role: 'user', content }
        ],
        system: systemMessage,
        stream: true
      });

      // Save assistant message placeholder to get the ID
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
            if (chunk.type === 'content_block_delta' && chunk.delta.text) {
              fullResponse += chunk.delta.text;
              yield { text: chunk.delta.text };
            }
          }

          // Update the complete message in the database
          await db
            .update(messages)
            .set({ content: fullResponse })
            .where({ id: assistantMessage.id });

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

  private static buildSystemMessage(context: Record<string, any>): string {
    let systemMessage = `You are an AI coding assistant helping users with their software development tasks. 
    You have access to the current conversation context and codebase.`;

    // Add code context if available
    if (context.codeContext) {
      systemMessage += `\n\nCurrent technical context:
      - Language: ${context.codeContext.language || 'Not specified'}
      - Project context: ${context.codeContext.projectContext || 'Not specified'}
      ${context.codeContext.patterns ? `- Detected patterns: ${context.codeContext.patterns.join(', ')}` : ''}`;

      // Add relevant files
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