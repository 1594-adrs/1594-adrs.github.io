// PostToolUse hook: run Prettier on files edited under portfolio/src.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const file = input.tool_input?.file_path;
if (!file || !/\.(ts|html|css)$/.test(file)) process.exit(0);

const portfolio = path.join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), 'portfolio');
const rel = path.relative(portfolio, file);
if (rel.startsWith('..') || !rel.startsWith('src')) process.exit(0);

try {
  execSync(`npx prettier --write --log-level silent "${rel}"`, { cwd: portfolio, stdio: 'ignore' });
} catch {
  // Formatting must never block an edit.
}
