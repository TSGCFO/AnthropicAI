import { db } from "@db";
import { conversations, messages, conversationTopics, promptTemplates, codeSnippets, codePatterns } from "@db/schema";
import { eq, desc, sql, like, and, or } from "drizzle-orm";
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
      // Enhanced pattern detection with more specific patterns
      const { patterns, confidence } = await detectPatterns(content, language);

      // Extract meaningful code segments
      const segments = content.split('\n\n').filter(segment => 
        segment.trim().length > 0 && 
        !segment.trim().startsWith('//') && 
        !segment.trim().startsWith('/*') &&
        !segment.trim().startsWith('#')
      );

      // Store each meaningful segment separately
      for (const segment of segments) {
        const description = `${category} code from ${filePath}${patterns.length ? `, implementing patterns: ${patterns.join(', ')}` : ''}`;

        await db.insert(codeSnippets).values({
          filePath,
          content: segment,
          language,
          category,
          description,
          metadata: {
            patterns,
            confidence,
            indexedAt: new Date().toISOString(),
            lineCount: segment.split('\n').length,
            complexity: calculateComplexity(segment)
          }
        });
      }

      // Store pattern associations
      for (const pattern of patterns) {
        await db.insert(codePatterns).values({
          name: pattern,
          description: `Pattern detected in ${filePath}`,
          example: content,
          language,
          metadata: {
            confidence,
            detectedIn: filePath,
            category
          }
        }).onConflictDoUpdate({
          target: [codePatterns.name, codePatterns.language],
          set: {
            usageCount: sql`${codePatterns.usageCount} + 1`,
            updatedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error(`Error indexing codebase: ${error}`);
    }
  }

  static async findRelevantCode(topic: string, language?: string): Promise<typeof codeSnippets.$inferSelect[]> {
    try {
      const query = db.select().from(codeSnippets);
      const searchTerms = topic.toLowerCase().split(' ');

      if (language) {
        query.where(eq(codeSnippets.language, language));
      }

      // Improved search with multiple term matching and pattern consideration
      query.where(
        or(
          ...searchTerms.map(term => 
            or(
              like(sql`LOWER(${codeSnippets.filePath})`, `%${term}%`),
              like(sql`LOWER(${codeSnippets.content})`, `%${term}%`),
              like(sql`LOWER(${codeSnippets.description})`, `%${term}%`),
              sql`${codeSnippets.metadata}->>'patterns' ILIKE ${`%${term}%`}`
            )
          )
        )
      );

      // Order by relevance and limit results
      query.orderBy(desc(sql`
        (CASE 
          WHEN ${codeSnippets.category} = 'models' THEN 5
          WHEN ${codeSnippets.category} = 'routes' THEN 4
          WHEN ${codeSnippets.category} = 'services' THEN 3
          WHEN ${codeSnippets.category} = 'utilities' THEN 2
          ELSE 1
        END)
      `));
      query.limit(10);

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
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId)
    });

    if (conversation && newContext.topic && newContext.topic !== conversation.topic) {
      // Find relevant code snippets when topic changes
      const relevantCode = await this.findRelevantCode(
        newContext.topic,
        newContext.codeContext?.language
      );

      if (relevantCode.length > 0) {
        if (!newContext.codeContext) newContext.codeContext = {};
        newContext.codeContext.relevantFiles = relevantCode.map(code => ({
          path: code.filePath,
          snippet: code.content,
          description: code.description || '',
        }));

        // Extract patterns from relevant code
        const patterns = new Set<string>();
        relevantCode.forEach(code => {
          const codePatterns = code.metadata?.patterns || [];
          codePatterns.forEach(pattern => patterns.add(pattern));
        });

        newContext.codeContext.patterns = Array.from(patterns);
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

// Helper function to calculate code complexity
function calculateComplexity(code: string): number {
  const lines = code.split('\n');
  let complexity = 1;

  // Increase complexity for control structures and function definitions
  const patterns = [
    /\b(if|else|for|while|switch|case)\b/,
    /\b(function|class|interface|enum)\b/,
    /\b(try|catch|finally)\b/,
    /\b(async|await)\b/,
    /\b(map|filter|reduce|forEach)\b/
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        complexity++;
      }
    }
  }

  return complexity;
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