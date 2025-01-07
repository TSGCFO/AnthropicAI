import { Anthropic } from '@anthropic-ai/sdk';
import { db } from "@db";
import { messages } from "@db/schema";
import { ContextManager } from "./contextManager";
import { CodePatternService } from "./codePatternService";
import { systemPrompts, reasoningSchema, taskBreakdownSchema } from './prompts/systemPrompts';
import { eq } from "drizzle-orm";

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const MODEL = "claude-3-5-sonnet-20241022";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export class AssistantService {
  private static activeContext: {
    files: { path: string; content: string; }[];
    currentFile?: string;
    language?: string;
    projectScope?: string[];
  } = {
    files: [],
    projectScope: []
  };

  static async processMessage(content: string, conversationId: number) {
    try {
      // Get conversation context
      const conversationContext = await ContextManager.getConversationContext(conversationId);

      // Analyze code patterns and get suggestions
      const patterns = await CodePatternService.analyzeCode(
        content,
        conversationContext.context.codeContext?.language || 'typescript',
        conversationContext.context
      );

      const suggestions = await CodePatternService.generateSuggestions({
        code: content,
        language: conversationContext.context.codeContext?.language || 'typescript',
        projectPath: conversationContext.context.codeContext?.projectPath,
        dependencies: conversationContext.context.codeContext?.dependencies
      });

      // Break down the task and analyze requirements
      const taskBreakdown = await this.analyzeTask(content, conversationContext);

      // Update active context based on task analysis and patterns
      await this.updateActiveContext(taskBreakdown);

      // Apply problem decomposition with pattern awareness
      const decomposedPrompt = await this.decomposeRequest(
        content, 
        conversationContext, 
        taskBreakdown,
        { patterns, suggestions }
      );

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
        system: this.buildSystemMessage(conversationContext, taskBreakdown, { patterns, suggestions }),
        stream: true
      });

      // Save message placeholder
      const [assistantMessage] = await db.insert(messages).values({
        conversationId,
        role: 'assistant',
        content: '',
        contextSnapshot: {
          ...conversationContext.context,
          activeContext: this.activeContext,
          patterns,
          suggestions
        },
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

          // Process user feedback on suggestions
          if (suggestions.length > 0) {
            const acceptedSuggestions = suggestions.filter(s => 
              fullResponse.toLowerCase().includes(s.context.toLowerCase())
            );

            await Promise.all(acceptedSuggestions.map(suggestion =>
              CodePatternService.processFeedback(suggestion.id, {
                accepted: true,
                responseTime: Date.now() - new Date(suggestion.suggestedAt).getTime()
              })
            ));
          }

          // Validate and structure the response
          const validatedResponse = await AssistantService.validateResponse(
            fullResponse,
            conversationContext.context,
            taskBreakdown
          );

          // Update message with validated response
          await db
            .update(messages)
            .set({ content: validatedResponse })
            .where(eq(messages.id, assistantMessage.id));

        } catch (error) {
          console.error('Error in stream processing:', error);
          const errorMessage = `Error processing response: ${error.message}`;
          await db
            .update(messages)
            .set({ content: errorMessage })
            .where(eq(messages.id, assistantMessage.id));
          throw error;
        }
      };

      return streamGenerator();
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  private static async analyzeTask(content: string, conversationContext: any): Promise<any> {
    //Implementation for task analysis
    return {}; // Placeholder, replace with actual implementation
  }

  private static async decomposeRequest(content: string, conversationContext: any, taskBreakdown: any, patternData: any): Promise<string> {
    //Implementation for request decomposition
    return content; // Placeholder, replace with actual implementation

  }

  private static async updateActiveContext(taskBreakdown: any): Promise<void> {
    //Implementation to update active context
  }

  private static prepareMessageHistory(history: any[]): any[] {
    //Implementation to prepare message history
    return []; // Placeholder, replace with actual implementation
  }

  private static buildSystemMessage(conversationContext: any, taskBreakdown: any, patternData: any): string {
    //Implementation to build system message
    return ''; // Placeholder, replace with actual implementation
  }

  private static async validateResponse(response: string, context: any, taskBreakdown: any): Promise<string> {
    //Implementation for response validation
    return response; // Placeholder, replace with actual implementation
  }
}