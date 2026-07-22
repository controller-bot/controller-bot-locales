# controller-bot-locales

Localization of Controller Bot (t.me/ControllerBot)

## Проверка переводов

```bash
npm ci
npm test
npm run check
```

`ru.yaml` — reference locale. Обычный `check` проверяет YAML, metadata, типы и отсутствие изменений относительно зафиксированного переводческого baseline. `npm run check:strict` требует полного совпадения всех enabled locales с reference и сейчас полезен для просмотра оставшегося долга. После осознанного добавления/удаления reference keys baseline можно обновить командой `npm run baseline:update`, проверить diff и закоммитить его вместе с переводами.
