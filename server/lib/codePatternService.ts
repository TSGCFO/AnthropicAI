import { db } from "@db";
import { codePatterns, patternSuggestions, type CodePattern, type PatternSuggestion } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from 'zod';

// Validation schemas for type safety
const AnalysisContextSchema = z.object({
  language: z.string(),
  patterns: z.array(z.string()).optional(),
  projectContext: z.string().optional(),
  relevantFiles: z.array(z.object({
    path: z.string(),
    snippet: z.string(),
    description: z.string()
  })).optional()
});

const PatternMetadataSchema = z.object({
  complexity: z.number(),
  dependencies: z.array(z.string()),
  securityImplications: z.array(z.string()),
  bestPractices: z.array(z.string()),
  performance: z.object({
    timeComplexity: z.string(),
    spaceComplexity: z.string()
  })
});

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
      throw error;
    }
  }

  // Analyze code to extract patterns
  static async analyzeCode(
    code: string,
    language: string,
    context: Record<string, any>
  ): Promise<CodePattern[]> {
    try {
      // Validate context
      const validatedContext = AnalysisContextSchema.parse(context);

      // Extract potential patterns from the code
      const patterns = await this.extractPatterns(code, validatedContext.language);

      // Store new patterns and update existing ones
      const storedPatterns = await Promise.all(
        patterns.map(async pattern => {
          const existing = await db.query.codePatterns.findFirst({
            where: and(
              eq(codePatterns.name, pattern.name),
              eq(codePatterns.language, language)
            )
          });

          const metadata = PatternMetadataSchema.parse({
            complexity: this.calculateComplexity(pattern.example),
            dependencies: this.extractDependencies(pattern.example),
            securityImplications: this.analyzeSecurityImplications(pattern.example),
            bestPractices: this.analyzeBestPractices(pattern.example, language),
            performance: this.analyzePerformance(pattern.example)
          });

          if (existing) {
            // Update existing pattern
            return await db
              .update(codePatterns)
              .set({
                usageCount: sql`${codePatterns.usageCount} + 1`,
                lastUsed: new Date(),
                context: { ...existing.context, ...context },
                metadata: { ...existing.metadata, ...metadata },
                complexity: metadata.complexity,
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
                context: validatedContext,
                complexity: metadata.complexity,
                dependencies: metadata.dependencies,
                metadata: metadata,
                projectPath: context.projectPath || null
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

      // Score patterns based on context relevance and metadata
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
            const metadata = {
              contextMatch: score,
              suggestionContext: context,
              patternMetadata: pattern.metadata,
              suggestedImprovements: this.generateImprovements(pattern, context),
              implementationGuide: this.generateImplementationGuide(pattern)
            };

            const suggestion = await db.insert(patternSuggestions)
              .values({
                patternId: pattern.id,
                context: JSON.stringify(context),
                confidence: Math.min(100, Math.floor(score * 100)),
                relevanceScore: score,
                metadata,
                suggestedAt: new Date()
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
            confidence: sql`GREATEST(0, LEAST(100, ${codePatterns.confidence} + ${confidenceDelta}))`,
            metadata: {
              ...suggestion.pattern.metadata,
              feedbackHistory: [
                ...(suggestion.pattern.metadata.feedbackHistory || []),
                {
                  timestamp: new Date(),
                  accepted: feedback.accepted,
                  response: feedback.userResponse,
                  responseTime: feedback.responseTime
                }
              ]
            }
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
    const patterns: Array<Partial<CodePattern>> = [];

    try {
      // Language-specific pattern extraction
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          patterns.push(...this.extractJSPatterns(code));
          break;
        case 'python':
          patterns.push(...this.extractPythonPatterns(code));
          break;
        default:
          patterns.push(...this.extractGenericPatterns(code));
      }

      return patterns;
    } catch (error) {
      console.error(`Error extracting patterns from ${language} code:`, error);
      return patterns;
    }
  }

  private static extractJSPatterns(code: string): Array<Partial<CodePattern>> {
    const patterns: Array<Partial<CodePattern>> = [];

    // Function patterns
    const functionMatches = code.match(/(?:function|class|const\s+\w+\s*=\s*(?:function|\([^)]*\)\s*=>))\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        patterns.push({
          name: match,
          description: `${match} pattern`,
          example: this.extractSurroundingCode(code, match),
          tags: ['function', 'definition'],
          complexity: this.calculateComplexity(match)
        });
      });
    }

    // React component patterns
    const reactComponentMatches = code.match(/(?:function|const)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\))?\s*(?:=>)?\s*{\s*(?:return\s*)?</g);
    if (reactComponentMatches) {
      reactComponentMatches.forEach(match => {
        patterns.push({
          name: match,
          description: 'React Component Pattern',
          example: this.extractSurroundingCode(code, match),
          tags: ['react', 'component', 'ui'],
          complexity: this.calculateComplexity(match)
        });
      });
    }

    return patterns;
  }

  private static extractPythonPatterns(code: string): Array<Partial<CodePattern>> {
    const patterns: Array<Partial<CodePattern>> = [];

    // Class and function patterns
    const matches = code.match(/(?:class|def)\s+(\w+)(?:\(.*\))?\s*:/g);
    if (matches) {
      matches.forEach(match => {
        patterns.push({
          name: match,
          description: `${match} pattern`,
          example: this.extractSurroundingCode(code, match),
          tags: ['python', match.startsWith('class') ? 'class' : 'function'],
          complexity: this.calculateComplexity(match)
        });
      });
    }

    return patterns;
  }

  private static extractGenericPatterns(code: string): Array<Partial<CodePattern>> {
    const patterns: Array<Partial<CodePattern>> = [];

    // Basic function pattern
    const functionMatches = code.match(/(?:function|class|def)\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        patterns.push({
          name: match,
          description: `${match} pattern`,
          example: this.extractSurroundingCode(code, match),
          tags: ['function', 'definition'],
          complexity: this.calculateComplexity(match)
        });
      });
    }

    return patterns;
  }

  private static extractSurroundingCode(code: string, pattern: string, context: number = 3): string {
    const lines = code.split('\n');
    const patternIndex = lines.findIndex(line => line.includes(pattern));
    if (patternIndex === -1) return pattern;

    const start = Math.max(0, patternIndex - context);
    const end = Math.min(lines.length, patternIndex + context + 1);
    return lines.slice(start, end).join('\n');
  }

  private static calculateComplexity(code: string): number {
    let complexity = 1;

    // Increment complexity for control structures
    const controlStructures = (code.match(/if|for|while|switch|catch/g) || []).length;
    complexity += controlStructures;

    // Increment for nested functions
    const nestedFunctions = (code.match(/function|=>/g) || []).length - 1;
    complexity += nestedFunctions;

    return Math.min(10, complexity);
  }

  private static calculateRelevanceScore(
    pattern: CodePattern,
    context: Record<string, any>
  ): number {
    let score = 0;

    // Base score from usage and confidence
    score += (pattern.usageCount / 100) * 0.3; // 30% weight
    score += (pattern.confidence / 100) * 0.2; // 20% weight

    // Context matching
    const contextScore = this.calculateContextMatch(pattern.context, context);
    score += contextScore * 0.3; // 30% weight

    // Metadata matching
    const metadataScore = this.calculateMetadataMatch(pattern.metadata, context);
    score += metadataScore * 0.2; // 20% weight

    return Math.min(1, score);
  }

  private static calculateContextMatch(
    patternContext: Record<string, any>,
    currentContext: Record<string, any>
  ): number {
    let matches = 0;
    let total = 0;

    const checkMatch = (pc: any, cc: any): number => {
      if (typeof pc !== typeof cc) return 0;
      if (Array.isArray(pc) && Array.isArray(cc)) {
        return pc.some(p => cc.includes(p)) ? 1 : 0;
      }
      if (typeof pc === 'object' && pc !== null) {
        return this.calculateContextMatch(pc, cc);
      }
      return pc === cc ? 1 : 0;
    };

    for (const key in patternContext) {
      total++;
      matches += checkMatch(patternContext[key], currentContext[key]);
    }

    return total === 0 ? 0 : matches / total;
  }

  private static calculateMetadataMatch(
    metadata: Record<string, any>,
    context: Record<string, any>
  ): number {
    if (!metadata || !context) return 0;

    let score = 0;
    const weights = {
      dependencies: 0.4,
      complexity: 0.3,
      bestPractices: 0.3
    };

    // Check dependencies match
    if (metadata.dependencies && context.dependencies) {
      const matchingDeps = metadata.dependencies.filter(d => 
        context.dependencies.includes(d)
      ).length;
      score += (matchingDeps / metadata.dependencies.length) * weights.dependencies;
    }

    // Check complexity match
    if (typeof metadata.complexity === 'number' && typeof context.complexity === 'number') {
      const complexityDiff = Math.abs(metadata.complexity - context.complexity);
      score += (1 - complexityDiff / 10) * weights.complexity;
    }

    // Check best practices match
    if (metadata.bestPractices && context.bestPractices) {
      const matchingPractices = metadata.bestPractices.filter(p =>
        context.bestPractices.includes(p)
      ).length;
      score += (matchingPractices / metadata.bestPractices.length) * weights.bestPractices;
    }

    return score;
  }

  private static extractDependencies(code: string): string[] {
    const dependencies = new Set<string>();

    // Extract import statements
    const importMatches = code.match(/(?:import|require|from)\s+['"]([^'"]+)['"]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.match(/['"]([^'"]+)['"]/)?.[1];
        if (dep) dependencies.add(dep);
      });
    }

    return Array.from(dependencies);
  }

  private static analyzeSecurityImplications(code: string): string[] {
    const implications: string[] = [];

    // Check for common security concerns
    if (code.includes('eval(')) {
      implications.push('Uses eval() - potential security risk');
    }
    if (code.match(/innerHTML|outerHTML/)) {
      implications.push('Direct DOM manipulation - XSS risk');
    }
    if (code.match(/exec\s*\(/)) {
      implications.push('Executes commands - potential security risk');
    }

    return implications;
  }

  private static analyzeBestPractices(code: string, language: string): string[] {
    const practices: string[] = [];

    // General best practices
    if (code.includes('try') && code.includes('catch')) {
      practices.push('Implements error handling');
    }
    if (code.includes('interface') || code.includes('type ')) {
      practices.push('Uses type definitions');
    }
    if (code.match(/console\.(log|error|warn)/)) {
      practices.push('Includes logging');
    }

    return practices;
  }

  private static analyzePerformance(code: string): { timeComplexity: string, spaceComplexity: string } {
    let timeComplexity = 'O(1)';
    let spaceComplexity = 'O(1)';

    // Simple performance analysis
    const loops = (code.match(/for|while/g) || []).length;
    if (loops > 0) {
      timeComplexity = `O(n${loops > 1 ? '^' + loops : ''})`;
      spaceComplexity = 'O(n)';
    }

    return { timeComplexity, spaceComplexity };
  }

  private static generateImprovements(pattern: CodePattern, context: Record<string, any>): string[] {
    const improvements: string[] = [];

    // Suggest improvements based on pattern analysis
    if (pattern.complexity > 5) {
      improvements.push('Consider breaking down into smaller functions');
    }
    if (pattern.metadata?.bestPractices?.length < 3) {
      improvements.push('Add more documentation and error handling');
    }
    if (pattern.usageCount > 10 && !pattern.metadata?.tests) {
      improvements.push('Add unit tests for this commonly used pattern');
    }

    return improvements;
  }

  private static generateImplementationGuide(pattern: CodePattern): string {
    return `
Implementation Guide:
1. Prerequisites: ${pattern.dependencies?.join(', ') || 'None'}
2. Complexity: ${pattern.complexity}/10
3. Best Practices:
   ${pattern.metadata?.bestPractices?.join('\n   ') || 'None specified'}
4. Security Considerations:
   ${pattern.metadata?.securityImplications?.join('\n   ') || 'None specified'}
5. Example Usage:
\`\`\`${pattern.language}
${pattern.example}
\`\`\`
`;
  }
}