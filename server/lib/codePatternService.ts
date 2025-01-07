import { db } from "@db";
import { codePatterns, patternSuggestions, type CodePattern, type PatternSuggestion } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export class CodePatternService {
  // Track active patterns for suggestion optimization
  private static activePatterns: Map<string, CodePattern> = new Map();
  
  // Initialize pattern analysis
  static async initialize() {
    try {
      // Load existing patterns into memory
      const patterns = await db.query.codePatterns.findMany({
        orderBy: [desc(codePatterns.usageCount)]
      });
      
      patterns.forEach(pattern => {
        this.activePatterns.set(`${pattern.language}:${pattern.name}`, pattern);
      });
      
      console.log(`Initialized CodePatternService with ${patterns.length} patterns`);
    } catch (error) {
      console.error('Failed to initialize CodePatternService:', error);
    }
  }

  // Analyze code to extract patterns
  static async analyzeCode(
    code: string,
    language: string,
    context: Record<string, any>
  ): Promise<CodePattern[]> {
    try {
      // Extract potential patterns from the code
      const patterns = await this.extractPatterns(code, language);
      
      // Store new patterns and update existing ones
      const storedPatterns = await Promise.all(
        patterns.map(async pattern => {
          const existing = await db.query.codePatterns.findFirst({
            where: and(
              eq(codePatterns.name, pattern.name),
              eq(codePatterns.language, language)
            )
          });

          if (existing) {
            // Update existing pattern
            return await db
              .update(codePatterns)
              .set({
                usageCount: sql`${codePatterns.usageCount} + 1`,
                lastUsed: new Date(),
                context: { ...existing.context, ...context },
                updatedAt: new Date()
              })
              .where(eq(codePatterns.id, existing.id))
              .returning()
              .then(rows => rows[0]);
          } else {
            // Create new pattern
            return await db.insert(codePatterns)
              .values({
                name: pattern.name,
                description: pattern.description,
                language,
                example: pattern.example,
                tags: pattern.tags,
                context,
                complexity: pattern.complexity
              })
              .returning()
              .then(rows => rows[0]);
          }
        })
      );

      // Update active patterns cache
      storedPatterns.forEach(pattern => {
        this.activePatterns.set(`${pattern.language}:${pattern.name}`, pattern);
      });

      return storedPatterns;
    } catch (error) {
      console.error('Failed to analyze code:', error);
      throw error;
    }
  }

  // Generate suggestions based on context
  static async generateSuggestions(
    context: {
      code?: string;
      language: string;
      projectPath?: string;
      dependencies?: string[];
    }
  ): Promise<PatternSuggestion[]> {
    try {
      // Find relevant patterns based on context
      const relevantPatterns = await db.query.codePatterns.findMany({
        where: eq(codePatterns.language, context.language),
        orderBy: [desc(codePatterns.usageCount), desc(codePatterns.confidence)]
      });

      // Score patterns based on context relevance
      const scoredPatterns = relevantPatterns.map(pattern => ({
        pattern,
        score: this.calculateRelevanceScore(pattern, context)
      }));

      // Get top patterns and create suggestions
      const suggestions = await Promise.all(
        scoredPatterns
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(async ({ pattern, score }) => {
            const suggestion = await db.insert(patternSuggestions)
              .values({
                patternId: pattern.id,
                context: JSON.stringify(context),
                confidence: Math.min(100, Math.floor(score * 100)),
                relevanceScore: score,
                metadata: {
                  contextMatch: score,
                  suggestionContext: context
                }
              })
              .returning();

            return suggestion[0];
          })
      );

      return suggestions;
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      throw error;
    }
  }

  // Process user feedback on suggestions
  static async processFeedback(
    suggestionId: number,
    feedback: {
      accepted: boolean;
      feedback?: number;
      userResponse?: string;
      responseTime?: number;
    }
  ): Promise<void> {
    try {
      // Update suggestion with feedback
      await db
        .update(patternSuggestions)
        .set({
          accepted: feedback.accepted,
          feedback: feedback.feedback,
          userResponse: feedback.userResponse,
          responseTime: feedback.responseTime
        })
        .where(eq(patternSuggestions.id, suggestionId));

      // Update pattern confidence based on feedback
      const suggestion = await db.query.patternSuggestions.findFirst({
        where: eq(patternSuggestions.id, suggestionId),
        with: {
          pattern: true
        }
      });

      if (suggestion?.pattern) {
        const confidenceDelta = feedback.accepted ? 1 : -1;
        await db
          .update(codePatterns)
          .set({
            confidence: sql`GREATEST(0, LEAST(100, ${codePatterns.confidence} + ${confidenceDelta}))`
          })
          .where(eq(codePatterns.id, suggestion.pattern.id));
      }
    } catch (error) {
      console.error('Failed to process feedback:', error);
      throw error;
    }
  }

  // Private helper methods
  private static async extractPatterns(
    code: string,
    language: string
  ): Promise<Array<Partial<CodePattern>>> {
    // This is a placeholder implementation
    // In a real implementation, this would use AST parsing and pattern recognition
    const patterns: Array<Partial<CodePattern>> = [];
    
    // Example pattern extraction
    const functionMatches = code.match(/(?:function|class)\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        patterns.push({
          name: match,
          description: `${match} pattern`,
          language,
          example: match,
          tags: ['function', 'definition'],
          complexity: 1
        });
      });
    }

    return patterns;
  }

  private static calculateRelevanceScore(
    pattern: CodePattern,
    context: Record<string, any>
  ): number {
    let score = 0;

    // Base score from usage and confidence
    score += (pattern.usageCount / 100) * 0.4; // 40% weight
    score += (pattern.confidence / 100) * 0.3; // 30% weight

    // Context matching
    const contextScore = this.calculateContextMatch(pattern.context, context);
    score += contextScore * 0.3; // 30% weight

    return Math.min(1, score);
  }

  private static calculateContextMatch(
    patternContext: Record<string, any>,
    currentContext: Record<string, any>
  ): number {
    // Simple implementation - can be enhanced with more sophisticated matching
    let matches = 0;
    let total = 0;

    for (const key in patternContext) {
      total++;
      if (currentContext[key] === patternContext[key]) {
        matches++;
      }
    }

    return total === 0 ? 0 : matches / total;
  }
}
