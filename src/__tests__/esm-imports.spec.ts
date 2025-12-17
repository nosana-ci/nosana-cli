import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const modulePath = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(modulePath, '..');

interface InvalidImport {
  file: string;
  line: number;
  importPath: string;
}

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Exclude directories that are not part of the build (see tsconfig.json exclude)
      const excludedDirs = ['node_modules', '__mocks__', '__tests__', 'tests'];
      if (!excludedDirs.includes(entry.name)) {
        files.push(...getAllTypeScriptFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function findInvalidImports(filePath: string): InvalidImport[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const invalidImports: InvalidImport[] = [];

  // Patterns to match relative imports:
  // - import ... from './path' or '../path'
  // - export ... from './path' or '../path'
  // - import('./path') or import("./path")
  const importPatterns = [
    /from\s+['"](\.[^'"]+)['"]/g,
    /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];

  // Pattern to detect type-only imports (these are erased at compile time)
  const typeOnlyImportPattern = /^\s*(import|export)\s+type\s/;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Skip type-only imports as they don't need .js extension
    if (typeOnlyImportPattern.test(line)) {
      continue;
    }

    for (const pattern of importPatterns) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(line)) !== null) {
        const importPath = match[1];

        // Check if it's a relative import without .js extension
        if (
          (importPath.startsWith('./') || importPath.startsWith('../')) &&
          !importPath.endsWith('.js') &&
          !importPath.endsWith('.json')
        ) {
          invalidImports.push({
            file: path.relative(srcDir, filePath),
            line: lineIndex + 1,
            importPath,
          });
        }
      }
    }
  }

  return invalidImports;
}

describe('ESM Import Extensions', () => {
  it('all relative imports should have .js extension', () => {
    const tsFiles = getAllTypeScriptFiles(srcDir);
    const allInvalidImports: InvalidImport[] = [];

    for (const file of tsFiles) {
      const invalidImports = findInvalidImports(file);
      allInvalidImports.push(...invalidImports);
    }

    if (allInvalidImports.length > 0) {
      const errorMessage = [
        'Found relative imports missing .js extension:',
        '',
        ...allInvalidImports.map(
          ({ file, line, importPath }) => `  ${file}:${line} - "${importPath}"`,
        ),
        '',
        'ESM requires explicit .js extensions for relative imports.',
      ].join('\n');

      expect.fail(errorMessage);
    }

    expect(allInvalidImports).toHaveLength(0);
  });
});
