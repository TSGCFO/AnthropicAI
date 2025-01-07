import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { db } from "@db";
import { codeSnippets } from "@db/schema";
import { eq, like, sql } from "drizzle-orm";

interface CodeReference {
  filePath: string;
  content: string;
  language: string;
  relevance: number;
}

interface CodePattern {
  name: string;
  description: string;
  confidence: number;
  suggestions: string[];
}

export class CodebaseTools {
  /**
   * Find code references based on a natural language query
   */
  static async findReferences(query: string, options: {
    language?: string;
    maxResults?: number;
  } = {}): Promise<CodeReference[]> {
    const { language, maxResults = 5 } = options;

    try {
      const searchQuery = db.select({
        filePath: codeSnippets.filePath,
        content: codeSnippets.content,
        language: codeSnippets.language,
        metadata: codeSnippets.metadata,
      }).from(codeSnippets);

      if (language) {
        searchQuery.where(eq(codeSnippets.language, language));
      }

      // Add relevance-based search conditions
      searchQuery.where(sql`
        ${codeSnippets.content} ILIKE ${`%${query}%`} OR
        ${codeSnippets.description} ILIKE ${`%${query}%`}
      `);

      const results = await searchQuery.execute();

      // Calculate relevance scores
      const scoredResults = results.map(result => {
        // Escape special regex characters in query
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const contentMatches = (result.content.match(new RegExp(safeQuery, 'gi')) || []).length;
        const descriptionMatches = ((result.metadata as any).description?.match(new RegExp(safeQuery, 'gi')) || []).length;

        return {
          filePath: result.filePath,
          content: result.content,
          language: result.language,
          relevance: contentMatches * 2 + descriptionMatches
        };
      });

      // Sort by relevance and limit results
      return scoredResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxResults);

    } catch (error) {
      console.error('Error finding code references:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific file
   */
  static async getFileDetails(filePath: string): Promise<{
    content: string;
    language: string;
    analysis: {
      imports: string[];
      exports: string[];
      dependencies: string[];
      description: string;
    };
  }> {
    try {
      const snippet = await db.query.codeSnippets.findFirst({
        where: eq(codeSnippets.filePath, filePath)
      });

      if (!snippet) {
        throw new Error(`File ${filePath} not found in codebase index`);
      }

      // Analyze code structure
      const analysis = {
        imports: this.extractImports(snippet.content, snippet.language),
        exports: this.extractExports(snippet.content, snippet.language),
        dependencies: [],
        description: this.generateDescription(snippet.content, snippet.language)
      };

      // Combine unique dependencies from imports
      analysis.dependencies = Array.from(new Set(analysis.imports));

      return {
        content: snippet.content,
        language: snippet.language,
        analysis
      };
    } catch (error) {
      console.error('Error getting file details:', error);
      throw error;
    }
  }

  /**
   * Detect patterns in code and suggest improvements
   */
  static async detectPatterns(code: string): Promise<CodePattern[]> {
    // This is a simplified pattern detection
    // In a real implementation, you would use more sophisticated analysis
    const patterns: CodePattern[] = [];

    // Example patterns to detect
    if (code.includes('try') && code.includes('catch')) {
      patterns.push({
        name: 'Error Handling',
        description: 'Implements try-catch error handling pattern',
        confidence: 0.9,
        suggestions: [
          'Consider adding specific error types',
          'Add error logging',
          'Consider cleanup in finally block'
        ]
      });
    }

    if (code.includes('async') && code.includes('await')) {
      patterns.push({
        name: 'Async/Await',
        description: 'Uses async/await pattern for asynchronous operations',
        confidence: 0.9,
        suggestions: [
          'Consider adding error boundaries',
          'Use Promise.all for parallel operations',
          'Add timeout handling'
        ]
      });
    }

    return patterns;
  }

  private static extractImports(content: string, language: string): string[] {
    const imports: string[] = [];

    switch(language) {
      case 'typescript':
      case 'javascript': {
        const importRegex = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
        break;
      }
      case 'python': {
        const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1] || match[2]);
        }
        break;
      }
    }

    return imports;
  }

  private static extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    switch(language) {
      case 'typescript':
      case 'javascript': {
        const exportRegex = /export\s+(?:default\s+)?(?:class|const|function|interface|type)\s+(\w+)/g;
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        break;
      }
      case 'python': {
        const exportRegex = /^(?:class|def)\s+([A-Z]\w+)/gm;
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
          exports.push(match[1]);
        }
        break;
      }
    }

    return exports;
  }

  private static generateDescription(content: string, language: string): string {
    let description = '';

    switch(language) {
      case 'typescript':
      case 'javascript': {
        // Get JSDoc comments
        const docComments = content.match(/\/\*\*\s*\n([^*]|\*[^/])*\*\//g) || [];
        description = docComments
          .map(comment => comment.replace(/\/\*\*|\*\/|\*/g, '').trim())
          .join('\n');
        break;
      }
      case 'python': {
        // Get docstrings
        const docstringRegex = /"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3}/g;
        const docstrings = content.match(docstringRegex) || [];
        description = docstrings
          .map(ds => ds.replace(/'{3}|"{3}/g, '').trim())
          .join('\n');
        break;
      }
    }

    return description || 'No description available';
  }
}