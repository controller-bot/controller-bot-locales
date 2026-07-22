const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {spawnSync} = require('child_process')

const {
  compareLocale,
  hasIssues,
  loadLocaleFile,
  validateDirectory,
} = require('../diff')

test('reports missing, extra and type-mismatched locale paths', () => {
  const result = compareLocale(
    {language_name: 'Reference', is_enabled: true, menu: {title: 'Title', count: 1}},
    {language_name: 'Candidate', is_enabled: true, menu: {count: 'one', extra: 'x'}},
  )
  assert.deepEqual(result.missing, ['menu.title'])
  assert.deepEqual(result.extra, ['menu.extra'])
  assert.deepEqual(result.typeMismatches, [
    {path: 'menu.count', expected: 'number', actual: 'string'},
  ])
  assert.equal(hasIssues({'candidate.yaml': result}), true)
})

test('validates enabled locales and ignores disabled translation debt', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-validator-'))
  try {
    fs.writeFileSync(
      path.join(directory, 'ru.yaml'),
      'language_name: Reference\nis_enabled: true\nmenu:\n  title: Title\n',
    )
    fs.writeFileSync(
      path.join(directory, 'en.yaml'),
      'language_name: English\nis_enabled: true\nmenu:\n  title: Title\n',
    )
    fs.writeFileSync(
      path.join(directory, 'off.yaml'),
      'language_name: Disabled\nis_enabled: false\n',
    )
    assert.deepEqual(validateDirectory(directory), {
      'en.yaml': {missing: [], extra: [], typeMismatches: []},
    })
  } finally {
    fs.rmSync(directory, {recursive: true, force: true})
  }
})

test('malformed YAML produces a stable validation error', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-yaml-'))
  const file = path.join(directory, 'broken.yaml')
  try {
    fs.writeFileSync(file, 'root: [broken')
    assert.throws(
      () => loadLocaleFile(file),
      error => error.code === 'INVALID_LOCALE_YAML',
    )
  } finally {
    fs.rmSync(directory, {recursive: true, force: true})
  }
})

test('baseline mode rejects a newly missing translation key', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-baseline-'))
  const baseline = path.join(directory, 'baseline.json')
  const validator = path.resolve(__dirname, '..', 'diff.js')
  const reference = 'language_name: Reference\nis_enabled: true\nmenu:\n  title: Title\n'
  try {
    fs.writeFileSync(path.join(directory, 'ru.yaml'), reference)
    fs.writeFileSync(
      path.join(directory, 'en.yaml'),
      'language_name: English\nis_enabled: true\nmenu:\n  title: Title\n',
    )
    const created = spawnSync(process.execPath, [
      validator,
      `--directory=${directory}`,
      `--write-baseline=${baseline}`,
    ], {encoding: 'utf8'})
    assert.equal(created.status, 0, created.stderr)

    fs.writeFileSync(
      path.join(directory, 'en.yaml'),
      'language_name: English\nis_enabled: true\nmenu: {}\n',
    )
    const checked = spawnSync(process.execPath, [
      validator,
      `--directory=${directory}`,
      `--baseline=${baseline}`,
    ], {encoding: 'utf8'})
    assert.equal(checked.status, 1)
    assert.match(checked.stderr, /Locale differences changed/)
  } finally {
    fs.rmSync(directory, {recursive: true, force: true})
  }
})
