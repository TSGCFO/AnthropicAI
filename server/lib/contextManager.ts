import { db } from "@db";
import { conversations, messages, conversationTopics, promptTemplates } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

interface ContextData {
  topic?: string;
  entities?: Record<string, any>;
  references?: string[];
  codeContext?: {
    language?: string;
    patterns?: string[];
    projectContext?: string;
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
  static async updateContext(
    conversationId: number,
    newContext: Partial<ContextData>
  ): Promise<ContextData> {
    const [conversation] = await db
      .update(conversations)
      .set({
        context: sql`${conversations.context} || ${JSON.stringify(newContext)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return conversation.context as ContextData;
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

    // Replace variables in template with context values
    let prompt = template.template;
    const variables = template.variables as string[];
    
    for (const variable of variables) {
      const value = getValueFromContext(context, variable);
      if (value) {
        prompt = prompt.replace(`{${variable}}`, value);
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

  return current?.toString();
}
