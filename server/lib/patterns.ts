import { db } from "@db";
import { codePatterns, patternSuggestions } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { analyzeCode } from "./codeai";

interface PatternDetectionResult {
  patterns: string[];
  confidence: number;
  context: Record<string, any>;
}

interface PatternSuggestion {
  id?: number;
  name: string;
  description: string;
  code: string;
  confidence: number;
  context: Record<string, any>;
}

/**
 * Detects potential code patterns in the given code snippet.
 */
export async function detectPatterns(code: string, language: string): Promise<PatternDetectionResult> {
  try {
    // Use code analysis to identify patterns
    const analysis = await analyzeCode(code);

    const patterns = analysis.patterns || [];
    const confidence = patterns.length > 0 ? 0.8 : 0.4;

    return {
      patterns,
      confidence,
      context: {
        language,
        analysisTimestamp: new Date().toISOString(),
        suggestions: analysis.suggestions,
        improvements: analysis.improvements,
      }
    };
  } catch (error) {
    console.error('Error detecting patterns:', error);
    throw new Error('Failed to detect code patterns');
  }
}

/**
 * Stores a new code pattern in the database.
 */
export async function storeCodePattern(
  name: string,
  description: string,
  code: string,
  language: string,
  tags: string[] = [],
  context: Record<string, any> = {}
): Promise<typeof codePatterns.$inferSelect> {
  try {
    const pattern = await db.insert(codePatterns).values({
      name,
      description,
      code,
      language,
      tags,
      context,
    }).returning();

    return pattern[0];
  } catch (error) {
    console.error('Error storing code pattern:', error);
    throw new Error('Failed to store code pattern');
  }
}

/**
 * Suggests relevant code patterns based on the current context.
 */
export async function suggestPatterns(
  currentCode: string,
  language: string,
  limit: number = 5
): Promise<PatternSuggestion[]> {
  try {
    // First, detect patterns in the current code
    const { patterns, context } = await detectPatterns(currentCode, language);

    // Query the database for relevant patterns
    const suggestions = await db.query.codePatterns.findMany({
      where: sql`${codePatterns.language} = ${language}`,
      orderBy: [desc(codePatterns.usageCount), desc(codePatterns.confidence)],
      limit,
    });

    // Transform and return the suggestions with proper typing
    return suggestions.map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      code: pattern.code,
      confidence: calculateConfidence(pattern, patterns),
      context: pattern.context as Record<string, any>,
    }));
  } catch (error) {
    console.error('Error suggesting patterns:', error);
    throw new Error('Failed to suggest code patterns');
  }
}

/**
 * Records when a pattern suggestion is used.
 */
export async function recordPatternUsage(patternId: number, context: string, accepted: boolean) {
  try {
    // Record the suggestion
    await db.insert(patternSuggestions).values({
      patternId,
      context,
      confidence: accepted ? 1 : 0,
      accepted,
    });

    if (accepted) {
      // Update pattern usage count
      await db.update(codePatterns)
        .set({ 
          usageCount: sql`${codePatterns.usageCount} + 1`
        })
        .where(eq(codePatterns.id, patternId));
    }
  } catch (error) {
    console.error('Error recording pattern usage:', error);
    throw new Error('Failed to record pattern usage');
  }
}

/**
 * Calculates confidence score for a pattern suggestion.
 */
function calculateConfidence(
  pattern: typeof codePatterns.$inferSelect,
  detectedPatterns: string[]
): number {
  const baseConfidence = 0.5;
  let confidence = baseConfidence;

  // Increase confidence if the pattern has been used successfully
  if (pattern.usageCount > 0) {
    confidence += Math.min(0.3, pattern.usageCount * 0.1);
  }

  // Increase confidence if pattern tags match detected patterns
  if (pattern.tags) {
    const matchingTags = pattern.tags.filter(tag => 
      detectedPatterns.some(p => p.toLowerCase().includes(tag.toLowerCase()))
    );
    confidence += matchingTags.length * 0.1;
  }

  return Math.min(1, confidence);
}