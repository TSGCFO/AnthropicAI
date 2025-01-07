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

export async function indexCodebase(rootDir: string = process.cwd()) {
  try {
    console.log('Starting codebase indexing...');
    let indexed = 0;
    
    for await (const filePath of walkDirectory(rootDir)) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const ext = extname(filePath);
        const language = SUPPORTED_EXTENSIONS.get(ext)!;
        const relativePath = filePath.replace(rootDir, '').replace(/^\//, '');
        
        // Determine category based on file path and content
        let category = 'general';
        if (filePath.includes('routes')) category = 'routes';
        else if (filePath.includes('models')) category = 'models';
        else if (filePath.includes('services')) category = 'services';
        else if (filePath.includes('components')) category = 'components';
        else if (filePath.includes('lib')) category = 'utilities';
        
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
    
    console.log(`Finished indexing ${indexed} files.`);
  } catch (error) {
    console.error('Error during codebase indexing:', error);
    throw error;
  }
}
