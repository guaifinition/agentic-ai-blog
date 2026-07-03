import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sourceRoot = path.join(root, 'agentic-ai')
const outRoot = path.join(root, 'src', 'content', 'generated')
const publicImages = path.join(root, 'public', 'images')
const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '')

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

function cleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  ensureDir(dir)
}

function titleFromName(name) {
  return name
    .replace(/\.md$/i, '')
    .replace(/\[(.*?)\]/g, ' $1')
    .replace(/\((.*?)\)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim()
}

function numericParts(name) {
  const match = name.match(/^(\d+(?:\.\d+)*)/)
  return match ? match[1].split('.').map(Number) : []
}

function compareByNumberThenName(a, b) {
  const aa = numericParts(a)
  const bb = numericParts(b)
  for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
    const diff = (aa[index] ?? 0) - (bb[index] ?? 0)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b, 'zh-CN')
}

function orderFromName(name, fallback) {
  const parts = numericParts(name)
  if (parts.length === 0) return fallback
  return parts.reduce((total, part) => total * 1000 + part, 0)
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function escapeYaml(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function copyImages() {
  cleanDir(publicImages)
  const imagesRoot = path.join(sourceRoot, 'images')
  const stack = [imagesRoot]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(imagesRoot, absolute)
      if (entry.isDirectory()) {
        stack.push(absolute)
      } else {
        const target = path.join(publicImages, relative)
        ensureDir(path.dirname(target))
        copyFileSync(absolute, target)
      }
    }
  }
}

function rewriteMarkdown(body) {
  return body
    .replace(/^#\s+.+\r?\n+/, '')
    .replace(/\]\(\.\.\/images\//g, `](${basePath}/images/`)
    .replace(/\]\(\.\.\\images\\/g, `](${basePath}/images/`)
    .replace(/\]\(\.\/images\//g, `](${basePath}/images/`)
    .replace(/src="\.\.\/images\//g, `src="${basePath}/images/`)
    .replace(/src="\.\/images\//g, `src="${basePath}/images/`)
}

function firstHeading(body, fallback) {
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function writeGeneratedPage({ sourcePath, outputPath, title, navTitle, section, sectionOrder, order, slug, isReadme = false }) {
  const raw = readFileSync(sourcePath, 'utf8')
  const body = rewriteMarkdown(raw)
  const frontmatter = [
    '---',
    `title: "${escapeYaml(title)}"`,
    `navTitle: "${escapeYaml(navTitle)}"`,
    `section: "${escapeYaml(section)}"`,
    `sectionOrder: ${sectionOrder}`,
    `order: ${order}`,
    `slug: "${escapeYaml(slug)}"`,
    `sourcePath: "${escapeYaml(path.relative(sourceRoot, sourcePath).replaceAll('\\', '/'))}"`,
    `isReadme: ${isReadme}`,
    '---',
    '',
  ].join('\n')

  ensureDir(path.dirname(outputPath))
  writeFileSync(outputPath, frontmatter + body.trimStart(), 'utf8')
}

cleanDir(outRoot)
copyImages()

const readmePath = path.join(sourceRoot, 'README.md')
if (existsSync(readmePath)) {
  const readmeBody = readFileSync(readmePath, 'utf8')
  writeGeneratedPage({
    sourcePath: readmePath,
    outputPath: path.join(outRoot, '00-home.md'),
    title: firstHeading(readmeBody, 'Agentic AI'),
    navTitle: '项目首页',
    section: '概览',
    sectionOrder: 0,
    order: 0,
    slug: 'home',
    isReadme: true,
  })
}

const sections = readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d+\./.test(entry.name))
  .map((entry) => entry.name)
  .sort(compareByNumberThenName)

for (const sectionName of sections) {
  const sectionPath = path.join(sourceRoot, sectionName)
  const sectionOrder = numericParts(sectionName)[0] ?? 999
  const sectionSlug = slugify(sectionName)
  const files = readdirSync(sectionPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort(compareByNumberThenName)

  for (const fileName of files) {
    const sourcePath = path.join(sectionPath, fileName)
    const raw = readFileSync(sourcePath, 'utf8')
    const fileOrder = orderFromName(fileName, files.indexOf(fileName) + 1)
    const pageSlug = `${sectionSlug}/${slugify(fileName.replace(/\.md$/i, ''))}`
    const outputPath = path.join(outRoot, sectionSlug, `${slugify(fileName.replace(/\.md$/i, ''))}.md`)
    writeGeneratedPage({
      sourcePath,
      outputPath,
      title: firstHeading(raw, titleFromName(fileName)),
      navTitle: titleFromName(fileName),
      section: titleFromName(sectionName),
      sectionOrder,
      order: fileOrder,
      slug: pageSlug,
    })
  }
}

console.log('Astro content generated.')
