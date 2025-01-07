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

interface CodeSearchResult {
  references: CodeReference[];
  context: {
    topic?: string;
    relatedFiles?: string[];
    patterns?: string[];
  }
}

export class CodebaseTools {
  /**
   * Find code references based on a natural language query
   */
  static async findReferences(query: string, options: {
    language?: string;
    maxResults?: number;
    includeContext?: boolean;
  } = {}): Promise<CodeSearchResult> {
    const { language, maxResults = 5, includeContext = true } = options;

    try {
      // Build search query
      const searchQuery = db.select({
        filePath: codeSnippets.filePath,
        content: codeSnippets.content,
        language: codeSnippets.language,
        metadata: codeSnippets.metadata,
      }).from(codeSnippets)
      .where(sql`
        ${codeSnippets.content} ILIKE ${`%${query}%`} OR
        ${codeSnippets.description} ILIKE ${`%${query}%`}
      `);

      if (language) {
        searchQuery.where(eq(codeSnippets.language, language));
      }

      // Calculate relevance score based on matches
      const results = await searchQuery.execute();
      
      const scoredResults = results.map(result => {
        const contentMatches = (result.content.match(new RegExp(query, 'gi')) || []).length;
        const descriptionMatches = ((result.metadata as any).description?.match(new RegExp(query, 'gi')) || []).length;
        
        return {
          filePath: result.filePath,
          content: result.content,
          language: result.language,
          relevance: contentMatches * 2 + descriptionMatches
        };
      });

      // Sort by relevance and limit results
      const references = scoredResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, maxResults);

      // Build context if requested
      const context = includeContext ? {
        topic: query,
        relatedFiles: references.map(ref => ref.filePath),
        patterns: Array.from(new Set(references.flatMap(ref => {
          const metadata = results.find(r => r.filePath === ref.filePath)?.metadata as any;
          return metadata?.patterns || [];
        })))
      } : undefined;

      return {
        references,
        context: context || {}
      };
    } catch (error) {
      console.error('Error finding code references:', error);
      return { references: [], context: {} };
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

      const analysis = await this.analyzeCode(snippet.content, snippet.language);

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
   * Analyze code structure and dependencies
   */
  private static async analyzeCode(content: string, language: string): Promise<{
    imports: string[];
    exports: string[];
    dependencies: string[];
    description: string;
  }> {
    // Basic analysis based on regex patterns
    const imports = this.extractImports(content, language);
    const exports = this.extractExports(content, language);
    
    return {
      imports,
      exports,
      dependencies: Array.from(new Set([...imports])),
      description: this.generateDescription(content, language)
    };
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
    // Extract comments and generate a basic description
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
