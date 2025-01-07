import { CodebaseTools } from './codebaseTools';
import { ContextManager } from './contextManager';
import { generateChatResponse } from './anthropic';

interface AssistantContext {
  topic?: string;
  codeContext?: {
    relevantCode?: Array<{
      filePath: string;
      content: string;
      language: string;
    }>;
    patterns?: string[];
    description?: string;
  };
  conversation?: {
    history: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  };
}

export class AssistantService {
  /**
   * Process a user message with enhanced codebase context
   */
  static async processMessage(
    message: string,
    conversationId: number
  ): Promise<AsyncGenerator<any, void, unknown>> {
    try {
      // First, search for relevant code based on the message
      const codeSearch = await CodebaseTools.findReferences(message, {
        includeContext: true,
        maxResults: 3
      });

      // Get conversation context
      const conversationContext = await ContextManager.getConversationContext(
        conversationId
      );

      // Build comprehensive context
      const context: AssistantContext = {
        topic: codeSearch.context.topic,
        codeContext: {
          relevantCode: codeSearch.references,
          patterns: codeSearch.context.patterns,
          description: 'Code references found based on user query'
        },
        conversation: {
          history: conversationContext.relevantHistory
        }
      };

      // For each referenced file, get detailed analysis
      const fileAnalyses = await Promise.all(
        codeSearch.references.map(ref => 
          CodebaseTools.getFileDetails(ref.filePath)
            .catch(() => null)
        )
      );

      // Format detailed prompt with code context
      const systemPrompt = `You are an AI assistant with access to the LedgerLink codebase.
Current topic: ${context.topic || 'General assistance'}

Relevant code from the codebase:
${codeSearch.references.map((ref, i) => `
File: ${ref.filePath}
Language: ${ref.language}
${fileAnalyses[i] ? `
Analysis:
- Imports: ${fileAnalyses[i]?.analysis.imports.join(', ')}
- Exports: ${fileAnalyses[i]?.analysis.exports.join(', ')}
- Dependencies: ${fileAnalyses[i]?.analysis.dependencies.join(', ')}
- Description: ${fileAnalyses[i]?.analysis.description}
` : ''}
Code:
\`\`\`${ref.language}
${ref.content}
\`\`\`
`).join('\n')}

Code patterns detected: ${context.codeContext?.patterns?.join(', ') || 'None'}

Use this context to provide accurate and relevant responses about the codebase.
Remember to reference specific files and code patterns in your explanations.
`;

      // Generate response stream
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationContext.relevantHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: message }
      ];

      // Update conversation context with code references
      await ContextManager.updateContext(conversationId, {
        topic: context.topic,
        codeContext: {
          relevantFiles: codeSearch.references.map(ref => ({
            path: ref.filePath,
            snippet: ref.content,
            description: fileAnalyses.find(a => a?.content === ref.content)?.analysis.description || ''
          }))
        }
      });

      return generateChatResponse(messages);
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }
}
