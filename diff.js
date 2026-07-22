const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const DEFAULT_REFERENCE = 'ru.yaml'

function valueType(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function flatten(value, prefix = '', result = new Map()) {
  if (valueType(value) !== 'object') {
    result.set(prefix, valueType(value))
    return result
  }
  const entries = Object.entries(value)
  if (!entries.length && prefix) result.set(prefix, 'object')
  for (const [key, child] of entries) {
    flatten(child, prefix ? `${prefix}.${key}` : key, result)
  }
  return result
}

function compareLocale(reference, candidate) {
  const referencePaths = flatten(reference)
  const candidatePaths = flatten(candidate)
  const missing = []
  const extra = []
  const typeMismatches = []

  for (const [key, expectedType] of referencePaths) {
    if (!candidatePaths.has(key)) missing.push(key)
    else if (candidatePaths.get(key) !== expectedType) {
      typeMismatches.push({
        path: key,
        expected: expectedType,
        actual: candidatePaths.get(key),
      })
    }
  }
  for (const key of candidatePaths.keys()) {
    if (!referencePaths.has(key)) extra.push(key)
  }

  return {missing, extra, typeMismatches}
}

function loadLocaleFile(filePath) {
  let parsed
  try {
    parsed = yaml.load(fs.readFileSync(filePath, 'utf8'))
  } catch (cause) {
    const error = new Error(`Invalid locale YAML: ${path.basename(filePath)}`, {cause})
    error.code = 'INVALID_LOCALE_YAML'
    throw error
  }
  if (!parsed || valueType(parsed) !== 'object') {
    throw new Error(`Locale must contain a YAML object: ${path.basename(filePath)}`)
  }
  if (typeof parsed.language_name !== 'string' || typeof parsed.is_enabled !== 'boolean') {
    throw new Error(`Locale metadata is invalid: ${path.basename(filePath)}`)
  }
  return parsed
}

function validateDirectory(directory, {referenceFile = DEFAULT_REFERENCE} = {}) {
  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.yaml'))
    .sort()
  if (!files.includes(referenceFile)) {
    throw new Error(`Reference locale is missing: ${referenceFile}`)
  }
  const locales = new Map(
    files.map(file => [file, loadLocaleFile(path.join(directory, file))]),
  )
  const reference = locales.get(referenceFile)
  if (!reference.is_enabled) throw new Error(`Reference locale is disabled: ${referenceFile}`)

  const report = {}
  for (const [file, locale] of locales) {
    if (file === referenceFile || !locale.is_enabled) continue
    report[file] = compareLocale(reference, locale)
  }
  return report
}

function hasIssues(report) {
  return Object.values(report).some(result =>
    result.missing.length || result.extra.length || result.typeMismatches.length,
  )
}

function printReport(report) {
  for (const [file, result] of Object.entries(report)) {
    console.log(
      `${file}: missing=${result.missing.length}, extra=${result.extra.length}, ` +
      `type_mismatches=${result.typeMismatches.length}`,
    )
  }
}

function parseOption(name) {
  const prefix = `${name}=`
  const option = process.argv.find(argument => argument.startsWith(prefix))
  return option?.slice(prefix.length)
}

function main() {
  const directory = path.resolve(__dirname, parseOption('--directory') || 'locales')
  const referenceFile = parseOption('--reference') || DEFAULT_REFERENCE
  const baselinePath = parseOption('--baseline')
  const writeBaselinePath = parseOption('--write-baseline')
  const report = validateDirectory(directory, {referenceFile})
  printReport(report)

  if (writeBaselinePath) {
    fs.writeFileSync(
      path.resolve(__dirname, writeBaselinePath),
      `${JSON.stringify(report, null, 2)}\n`,
    )
    return
  }
  if (baselinePath) {
    const baseline = JSON.parse(fs.readFileSync(path.resolve(__dirname, baselinePath), 'utf8'))
    if (JSON.stringify(report) !== JSON.stringify(baseline)) {
      throw new Error('Locale differences changed; translate keys or update baseline intentionally')
    }
    return
  }
  if (hasIssues(report)) throw new Error('Locale validation found differences')
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`${error.code || 'LOCALE_CHECK_FAILED'}: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  compareLocale,
  flatten,
  hasIssues,
  loadLocaleFile,
  validateDirectory,
  valueType,
}
