import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const srcRoot = path.resolve('src')
const resourcePath = path.join(srcRoot, 'i18n', 'translations', 'en.ts')
const resourceSource = fs.readFileSync(resourcePath, 'utf8')
const resourceFile = ts.createSourceFile(resourcePath, resourceSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const resourceKeys = new Set()
const failures = []

const hasHangul = (value) => /[가-힣]/.test(value)
const normalizeKey = (value) => value.replace(/\r\n/g, '\n')

function visitResources(node) {
  if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) {
    resourceKeys.add(normalizeKey(node.name.text))
    if (ts.isStringLiteral(node.initializer) && hasHangul(node.initializer.text)) {
      failures.push(`English resource still contains Korean: ${node.name.text}`)
    }
  }
  ts.forEachChild(node, visitResources)
}

visitResources(resourceFile)

function inspectFile(file) {
  const source = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'tr') {
      const key = node.arguments[0]
      if (key && ts.isStringLiteral(key) && !resourceKeys.has(normalizeKey(key.text))) {
        const line = sourceFile.getLineAndCharacterOfPosition(key.getStart(sourceFile)).line + 1
        failures.push(`${path.relative(process.cwd(), file)}:${line} missing English translation: ${key.text}`)
      }
      return
    }

    if (ts.isJsxText(node) && hasHangul(node.text.trim())) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
      failures.push(`${path.relative(process.cwd(), file)}:${line} contains untranslated JSX text`)
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && hasHangul(node.text)) {
      const isPropertyName = (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent))
        && node.parent.name === node
      if (!isPropertyName && !ts.isLiteralTypeNode(node.parent)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
        failures.push(`${path.relative(process.cwd(), file)}:${line} contains untranslated Korean string`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') walk(fullPath)
      continue
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue
    if (/Admin/.test(entry.name) || fullPath.endsWith(`${path.sep}lib${path.sep}admin.ts`)) continue
    inspectFile(fullPath)
  }
}

walk(srcRoot)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`i18n check passed: ${resourceKeys.size} English messages cover all non-admin UI literals.`)
