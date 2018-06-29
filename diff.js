// checking locales

f = (...args) => console.log(...args)

const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const diff = require('deep-diff')
const yaml = require('js-yaml')

const directory = './locales'

const files = fs.readdirSync(directory)
const languages = []
files.forEach(file => {
  let data = yaml.safeLoad(fs.readFileSync(directory + '/' + file))
  if (data.is_enabled) {
    languages.push({
      locale: file,
      data: data
    })
  }
})

const fallback = 'ru.yaml'
f('checking locales...')
languages.forEach(locale => {
  if (locale.locale == fallback) {
    return false
  }
  let check = diff(_.find(languages, {locale: fallback}).data, locale.data)
  f('')
  f(`=== start check ${locale.locale} - ${locale.data.language_name}`)
  if (!check) {
    return f(locale.locale + ' is ok!')
  }
  check.forEach(map => {
    if (map.kind == 'D') {
      f(map.path.join('.'))
    }
  })
})