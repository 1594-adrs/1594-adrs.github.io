#!/usr/bin/env node
/**
 * Generates robots.txt, sitemap.xml, llms.txt and llms-full.txt into portfolio/public/
 * from the site's own data module (src/app/shared/data/portfolio.data.ts).
 *
 * Node's built-in TypeScript support strips types but does not resolve extensionless
 * TS imports (portfolio.data.ts imports types from '../models/portfolio.models' without
 * an extension), so we bundle the data module with esbuild (already in node_modules via
 * @angular/build) into a temp ESM file and import that instead.
 *
 * Run via `npm run build` (prebuild hook) or standalone: `node scripts/gen-seo.mjs`.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const DATA_ENTRY = join(ROOT, 'src/app/shared/data/portfolio.data.ts');

async function loadData() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'gen-seo-'));
  const outfile = join(tmpDir, 'portfolio-data.mjs');
  try {
    await build({
      entryPoints: [DATA_ENTRY],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function lastmod() {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch {
    // fall through to today
  }
  return new Date().toISOString().slice(0, 10);
}

const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
];

function buildRobotsTxt(site) {
  const lines = ['User-agent: *', 'Allow: /', ''];
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Allow: /', '');
  }
  lines.push(`Sitemap: ${site.url}/sitemap.xml`);
  return lines.join('\n') + '\n';
}

function buildSitemapXml(site, date) {
  const paths = ['/', '/web-projects/', '/web-projects/calculator/', '/cv/'];
  const urls = paths
    .map(
      (path) =>
        `  <url>\n    <loc>${site.url}${path}</loc>\n    <lastmod>${date}</lastmod>\n  </url>`,
    )
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
}

function buildLlmsTxt(site, data) {
  const { PROFILE, WEB_PROJECTS } = data;
  const lines = [
    `# ${PROFILE.shortName}`,
    '',
    `> ${PROFILE.tagline}`,
    '',
    PROFILE.description,
    '',
    '## Profile',
    '',
    `- ${PROFILE.role}`,
    `- ${PROFILE.location} (${PROFILE.timezone})`,
    `- ${PROFILE.availability}`,
    `- Contact: [${PROFILE.email}](mailto:${PROFILE.email})`,
    '',
    '## Experience',
    '',
    ...data.EXPERIENCE.map(
      (item) => `- [${item.role} — ${item.organization}](${site.url}/#experience) (${item.period})`,
    ),
    '',
    '## Projects',
    '',
    ...data.PROJECTS.map((project) => `- [${project.title}](${project.githubUrl})`),
    ...WEB_PROJECTS.map((project) => `- [${project.title}](${site.url}${project.route}/)`),
    '',
    '## Resume',
    '',
    `- [Resume page](${site.url}/cv/)`,
    `- [Resume PDF](${site.url}${PROFILE.resumeUrl})`,
    '',
    '## Contact',
    '',
    `- Email: [${PROFILE.email}](mailto:${PROFILE.email})`,
    ...data.SOCIAL_NETWORKS.filter((s) => s.iconName !== 'envelope').map(
      (s) => `- ${s.label}: ${s.url}`,
    ),
    '',
  ];
  return lines.join('\n');
}

function buildLlmsFullTxt(site, data) {
  const { PROFILE } = data;
  const lines = [
    `# ${PROFILE.name}`,
    '',
    `${PROFILE.role} — ${PROFILE.location} (${PROFILE.timezone})`,
    '',
    PROFILE.description,
    '',
    `Availability: ${PROFILE.availability}`,
    '',
    '## Skills',
    '',
    ...data.SKILLS.flatMap((category) => [
      `### ${category.title}`,
      '',
      category.skills.map((s) => `- ${s}`).join('\n'),
      '',
    ]),
    '## Experience',
    '',
    ...data.EXPERIENCE.flatMap((item) => [
      `### ${item.role} — ${item.organization}`,
      '',
      `${item.period}${item.location ? ` · ${item.location}` : ''}`,
      '',
      ...(item.summary ? [item.summary, ''] : []),
      ...item.highlights.map((h) => `- ${h}`),
      '',
      `Tech: ${item.tech.join(', ')}`,
      ...(item.link ? [`Link: [${item.link.label}](${item.link.url})`] : []),
      '',
    ]),
    '## Education',
    '',
    ...data.EDUCATION.flatMap((edu) => [
      `### ${edu.degree} — ${edu.institution}`,
      '',
      `${edu.period}. ${edu.detail}`,
      '',
    ]),
    '## Courses',
    '',
    ...data.COURSES.map((c) => `- ${c.name}`),
    '',
    '## Projects',
    '',
    ...data.PROJECTS.flatMap((p) => [
      `### ${p.title}`,
      '',
      p.description,
      '',
      `Technologies: ${p.technologies.join(', ')}`,
      `Repository: ${p.githubUrl}`,
      '',
    ]),
    '## Web Projects',
    '',
    ...data.WEB_PROJECTS.flatMap((p) => [
      `### ${p.title}`,
      '',
      p.description,
      '',
      `Technologies: ${p.technologies.join(', ')}`,
      `URL: ${site.url}${p.route}/`,
      '',
    ]),
    '## Contact',
    '',
    `- Email: [${PROFILE.email}](mailto:${PROFILE.email})`,
    ...data.SOCIAL_NETWORKS.filter((s) => s.iconName !== 'envelope').map(
      (s) => `- ${s.label}: ${s.url}`,
    ),
    `- Resume: [PDF](${site.url}${PROFILE.resumeUrl}) · [page](${site.url}/cv/)`,
    '',
  ];
  return lines.join('\n');
}

async function main() {
  const data = await loadData();
  const site = data.SITE;
  const date = lastmod();

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, 'robots.txt'), buildRobotsTxt(site));
  writeFileSync(join(PUBLIC_DIR, 'sitemap.xml'), buildSitemapXml(site, date));
  writeFileSync(join(PUBLIC_DIR, 'llms.txt'), buildLlmsTxt(site, data));
  writeFileSync(join(PUBLIC_DIR, 'llms-full.txt'), buildLlmsFullTxt(site, data));

  console.log('gen-seo: wrote robots.txt, sitemap.xml, llms.txt, llms-full.txt');
}

main().catch((err) => {
  console.error('gen-seo failed:', err);
  process.exit(1);
});
