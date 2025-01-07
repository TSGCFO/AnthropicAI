import { db } from "@db";
import { conversations, messages, conversationTopics, promptTemplates, codeSnippets, codePatterns } from "@db/schema";
import { eq, desc, sql, like } from "drizzle-orm";
import { detectPatterns } from "./patterns";

interface ContextData {
  topic?: string;
  entities?: Record<string, any>;
  references?: string[];
  codeContext?: {
    language?: string;
    patterns?: string[];
    projectContext?: string;
    relevantFiles?: Array<{
      path: string;
      snippet: string;
      description: string;
    }>;
  };
  metadata?: Record<string, any>;
}

interface ConversationContext {
  conversationId: number;
  context: ContextData;
  relevantHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    contextSnapshot: Record<string, any>;
  }>;
}

export class ContextManager {
  static async indexCodebase(filePath: string, content: string, language: string, category: string) {
    try {
      // Detect patterns in the code
      const { patterns, confidence } = await detectPatterns(content, language);

      // Store the code snippet
      await db.insert(codeSnippets).values({
        filePath,
        content,
        language,
        category,
        description: `Code from ${filePath}, containing patterns: ${patterns.join(', ')}`,
        metadata: {
          patterns,
          confidence,
          indexedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error(`Error indexing codebase: ${error}`);
    }
  }

  static async findRelevantCode(topic: string, language?: string): Promise<typeof codeSnippets.$inferSelect[]> {
    try {
      const query = db.select().from(codeSnippets);

      if (language) {
        query.where(eq(codeSnippets.language, language));
      }

      // Search in file paths, content and descriptions
      query.where(sql`
        ${codeSnippets.filePath} ILIKE ${`%${topic}%`} OR
        ${codeSnippets.content} ILIKE ${`%${topic}%`} OR
        ${codeSnippets.description} ILIKE ${`%${topic}%`}
      `);

      return await query.execute();
    } catch (error) {
      console.error(`Error finding relevant code: ${error}`);
      return [];
    }
  }

  static async updateContext(
    conversationId: number,
    newContext: Partial<ContextData>
  ): Promise<ContextData> {
    // Get current conversation to check if topic changed
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId)
    });

    if (conversation && newContext.topic && newContext.topic !== conversation.topic) {
      // Topic changed, find relevant code snippets
      const relevantCode = await this.findRelevantCode(
        newContext.topic,
        newContext.codeContext?.language
      );

      // Update code context with relevant files
      if (relevantCode.length > 0) {
        if (!newContext.codeContext) newContext.codeContext = {};
        newContext.codeContext.relevantFiles = relevantCode.map(code => ({
          path: code.filePath,
          snippet: code.content,
          description: code.description || '',
        }));
      }
    }

    const [updated] = await db
      .update(conversations)
      .set({
        context: sql`${conversations.context} || ${JSON.stringify(newContext)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated.context as ContextData;
  }

  static async getConversationContext(conversationId: number): Promise<ConversationContext> {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: {
        messages: {
          orderBy: [desc(messages.createdAt)],
          limit: 10,
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // If the conversation has a topic, ensure we have relevant code context
    if (conversation.topic) {
      const context = conversation.context as ContextData;
      if (!context.codeContext?.relevantFiles?.length) {
        const relevantCode = await this.findRelevantCode(
          conversation.topic,
          context.codeContext?.language
        );

        if (relevantCode.length > 0) {
          await this.updateContext(conversationId, {
            codeContext: {
              ...context.codeContext,
              relevantFiles: relevantCode.map(code => ({
                path: code.filePath,
                snippet: code.content,
                description: code.description || '',
              }))
            }
          });
        }
      }
    }

    return {
      conversationId,
      context: conversation.context as ContextData,
      relevantHistory: conversation.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        contextSnapshot: msg.contextSnapshot as Record<string, any>,
      })),
    };
  }

  static async updateTopicContext(
    topic: string,
    contextData: Record<string, any>
  ): Promise<void> {
    const existingTopic = await db.query.conversationTopics.findFirst({
      where: eq(conversationTopics.name, topic),
    });

    if (existingTopic) {
      await db
        .update(conversationTopics)
        .set({
          contextData: sql`${conversationTopics.contextData} || ${JSON.stringify(contextData)}::jsonb`,
          usageCount: sql`${conversationTopics.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversationTopics.id, existingTopic.id));
    } else {
      await db.insert(conversationTopics).values({
        name: topic,
        contextData,
        usageCount: 1,
      });
    }
  }

  static async getEffectivePrompt(
    templateName: string,
    context: ContextData
  ): Promise<string> {
    const template = await db.query.promptTemplates.findFirst({
      where: eq(promptTemplates.name, templateName),
    });

    if (!template) {
      throw new Error(`Prompt template '${templateName}' not found`);
    }

    // Update usage statistics
    await db
      .update(promptTemplates)
      .set({
        usageCount: sql`${promptTemplates.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promptTemplates.id, template.id));

    // Include code context in variable replacement
    let prompt = template.template;
    const variables = template.variables as string[];

    for (const variable of variables) {
      const value = getValueFromContext(context, variable);
      if (value) {
        prompt = prompt.replace(`{${variable}}`, value);
      }
    }

    // If there are relevant files, append them to the prompt
    if (context.codeContext?.relevantFiles?.length) {
      prompt += "\n\nRelevant code from the project:\n";
      for (const file of context.codeContext.relevantFiles) {
        prompt += `\nFile: ${file.path}\n\`\`\`\n${file.snippet}\n\`\`\`\n`;
      }
    }

    return prompt;
  }

  static async recordPromptEffectiveness(
    templateName: string,
    effectiveness: number
  ): Promise<void> {
    await db
      .update(promptTemplates)
      .set({
        effectiveness: sql`${promptTemplates.effectiveness} + ${effectiveness}`,
        updatedAt: new Date(),
      })
      .where(eq(promptTemplates.name, templateName));
  }
}

// Helper function to get nested values from context
function getValueFromContext(context: ContextData, path: string): string | undefined {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  if (Array.isArray(current)) {
    return JSON.stringify(current);
  }

  return current?.toString();
}