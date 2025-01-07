import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { db } from '@db';
import { codeSnippets, codePatterns } from '@db/schema';

const BATCH_SIZE = 100;
const SUPPORTED_EXTENSIONS = new Map([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'javascript'],
  ['.jsx', 'javascript'],
  ['.py', 'python'],
  ['.sql', 'sql'],
  ['.css', 'css'],
  ['.html', 'html'],
  ['.md', 'markdown'],
  ['.json', 'json'],
]);

// Schema for code analysis, following OpenAI's schema structure
const CODE_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: ["routes", "models", "services", "views", "utilities", "tests", "documentation", "general"]
    },
    patterns: {
      type: "array",
      items: { type: "string" }
    },
    metadata: {
      type: "object",
      properties: {
        complexity: { type: "number" },
        dependencies: { type: "array", items: { type: "string" } },
        exports: { type: "array", items: { type: "string" } }
      }
    }
  }
};

async function* walkDirectory(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const path = join(dir, file.name);

    if (path.includes('node_modules') || path.includes('.git')) {
      continue;
    }

    if (file.isDirectory()) {
      yield* walkDirectory(path);
    } else {
      const ext = extname(file.name);
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        yield path;
      }
    }
  }
}

async function processBatch(files: string[], rootDir: string) {
  const batchData = await Promise.all(
    files.map(async (filePath) => {
      try {
        const content = await readFile(filePath, 'utf-8');
        const ext = extname(filePath);
        const language = SUPPORTED_EXTENSIONS.get(ext)!;
        const relativePath = filePath.replace(rootDir, '').replace(/^\//, '');

        // Determine category based on path patterns
        let category = 'general';
        if (filePath.includes('routes') || filePath.includes('urls.py')) category = 'routes';
        else if (filePath.includes('models')) category = 'models';
        else if (filePath.includes('services') || filePath.includes('utils')) category = 'services';
        else if (filePath.includes('components') || filePath.includes('templates')) category = 'views';
        else if (filePath.includes('lib')) category = 'utilities';
        else if (filePath.includes('test')) category = 'tests';
        else if (filePath.includes('docs')) category = 'documentation';

        return {
          filePath: relativePath,
          content,
          language,
          category
        };
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        return null;
      }
    })
  );

  // Filter out failed files and batch insert
  const validBatchData = batchData.filter((item): item is NonNullable<typeof item> => item !== null);

  if (validBatchData.length > 0) {
    await db.insert(codeSnippets).values(validBatchData);
  }
}

export async function indexCodebase(rootDir: string = join(process.cwd(), 'repositories')) {
  try {
    console.log('Starting codebase indexing...');
    let batch: string[] = [];
    let totalIndexed = 0;

    for await (const filePath of walkDirectory(rootDir)) {
      batch.push(filePath);

      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch, rootDir);
        totalIndexed += batch.length;
        console.log(`Indexed ${totalIndexed} files...`);
        batch = [];
      }
    }

    // Process remaining files
    if (batch.length > 0) {
      await processBatch(batch, rootDir);
      totalIndexed += batch.length;
    }

    console.log(`Finished indexing ${totalIndexed} files.`);
    return totalIndexed;
  } catch (error) {
    console.error('Error during codebase indexing:', error);
    throw error;
  }
}