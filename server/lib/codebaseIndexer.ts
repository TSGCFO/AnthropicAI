import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { ContextManager } from './contextManager';

const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', '__pycache__', 'migrations'];
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

async function* walkDirectory(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const path = join(dir, file.name);

    if (EXCLUDED_DIRS.some(excluded => path.includes(excluded))) {
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

export async function indexCodebase(rootDir: string = join(process.cwd(), 'repositories')) {
  try {
    console.log('Starting codebase indexing...');
    let indexed = 0;

    // Get list of repositories
    const repos = await readdir(rootDir, { withFileTypes: true });

    for (const repo of repos) {
      if (!repo.isDirectory() || EXCLUDED_DIRS.includes(repo.name)) {
        continue;
      }

      const repoPath = join(rootDir, repo.name);
      console.log(`Indexing repository: ${repo.name}`);

      for await (const filePath of walkDirectory(repoPath)) {
        try {
          const content = await readFile(filePath, 'utf-8');
          const ext = extname(filePath);
          const language = SUPPORTED_EXTENSIONS.get(ext)!;
          const relativePath = filePath.replace(rootDir, '').replace(/^\//, '');

          // Determine category based on file path and content
          let category = 'general';
          if (filePath.includes('routes') || filePath.includes('urls.py')) category = 'routes';
          else if (filePath.includes('models')) category = 'models';
          else if (filePath.includes('services') || filePath.includes('utils')) category = 'services';
          else if (filePath.includes('components') || filePath.includes('templates')) category = 'views';
          else if (filePath.includes('lib')) category = 'utilities';
          else if (filePath.includes('test')) category = 'tests';
          else if (filePath.includes('docs')) category = 'documentation';

          await ContextManager.indexCodebase(
            relativePath,
            content,
            language,
            category
          );

          indexed++;
          if (indexed % 10 === 0) {
            console.log(`Indexed ${indexed} files...`);
          }
        } catch (error) {
          console.error(`Error indexing file ${filePath}:`, error);
        }
      }
    }

    console.log(`Finished indexing ${indexed} files across all repositories.`);
    return indexed;
  } catch (error) {
    console.error('Error during codebase indexing:', error);
    throw error;
  }
}