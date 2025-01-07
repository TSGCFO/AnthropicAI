import { CodebaseTools } from './codebaseTools';
import { ContextManager } from './contextManager';
import { generateChatResponse } from './anthropic';
import { db } from "@db";
import { messages } from "@db/schema";
import { eq } from "drizzle-orm";

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

interface ToolResult {
  type: string;
  content: any;
}

export class AssistantService {
  static async *processMessage(
    content: string,
    conversationId: number
  ): AsyncGenerator<{ text: string }, void, unknown> {
    try {
      // Get conversation context
      const conversationContext = await ContextManager.getConversationContext(
        conversationId
      );

      // Format the system prompt with tool descriptions
      const systemPrompt = `You are an AI assistant with access to the LedgerLink codebase through these tools:

TOOLS:
- SEARCH_CODE(query: string) - Search codebase for relevant code
- ANALYZE_FILE(filePath: string) - Get detailed file analysis
- GET_PATTERNS(code: string) - Detect code patterns

To use a tool, output a JSON object like this:
{
  "name": "TOOL_NAME",
  "args": {
    "paramName": "value"
  }
}

After each tool call, I will provide the results and you can continue the conversation.

Important:
- Always search the codebase before answering questions
- Reference specific files and code patterns
- Explain architectural decisions with concrete examples

Current conversation:
${conversationContext.relevantHistory
  .slice(-5)
  .map(msg => `${msg.role}: ${msg.content}`)
  .join('\n')}
`;

      let fullResponse = '';
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ];

      try {
        const stream = await generateChatResponse(messages);

        for await (const chunk of stream) {
          // Handle Anthropic's streaming format
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            const text = chunk.delta.text;

            try {
              // Check for tool call
              const toolCall = this.parseToolCall(text);
              if (toolCall) {
                try {
                  const result = await this.executeToolCall(toolCall);

                  // Add tool result to conversation
                  messages.push(
                    { role: 'assistant', content: text },
                    { role: 'system', content: `Tool result: ${JSON.stringify(result)}` }
                  );

                  // Get continuation 
                  const continuationStream = await generateChatResponse(messages);
                  for await (const continuationChunk of continuationStream) {
                    if (continuationChunk.type === 'content_block_delta' && continuationChunk.delta.text) {
                      const continuationText = continuationChunk.delta.text;
                      fullResponse += continuationText;
                      yield { text: continuationText };
                    }
                  }
                } catch (error) {
                  console.error('Tool execution error:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  fullResponse += `\nError executing tool: ${errorMessage}\n`;
                  yield { text: `\nError executing tool: ${errorMessage}\n` };
                }
              } else {
                fullResponse += text;
                yield { text: text };
              }
            } catch (error) {
              console.error('Error processing chunk:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              yield { text: errorMessage };
            }
          }
        }

        // Save assistant message with proper schema values
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: fullResponse,
          contextSnapshot: {},
          createdAt: new Date()
        });

      } catch (error) {
        console.error('Stream processing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        yield { text: `Error: ${errorMessage}` };
      }

    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield { text: `Error: ${errorMessage}` };
    }
  }

  private static parseToolCall(text: string): ToolCall | null {
    try {
      if (text.includes('"name":')) {
        const match = text.match(/\{[^}]+\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.name && parsed.args) {
            return {
              name: parsed.name,
              args: parsed.args
            };
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error parsing tool call:', error);
      return null;
    }
  }

  private static async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    switch (toolCall.name) {
      case 'SEARCH_CODE':
        const searchResults = await CodebaseTools.findReferences(
          toolCall.args.query,
          { maxResults: 3 }
        );
        return {
          type: 'code_search_results',
          content: searchResults
        };

      case 'ANALYZE_FILE':
        const analysis = await CodebaseTools.getFileDetails(toolCall.args.filePath);
        return {
          type: 'file_analysis',
          content: analysis
        };

      case 'GET_PATTERNS':
        const patterns = await CodebaseTools.detectPatterns(toolCall.args.code);
        return {
          type: 'pattern_detection',
          content: patterns
        };

      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }
}