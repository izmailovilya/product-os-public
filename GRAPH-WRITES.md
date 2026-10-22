# Запись продуктовой памяти

Команды выполняются инструментами выбранной установки: `node <tools>/bin/product-os.js`,
где `<tools>` — абсолютный путь к локальному либо общему runtime пользователя.
Папка `<workspace>` содержит данные конкретного продукта и передаётся отдельно.

Сначала сохраните оригинал, затем структурированные сведения. Для обычного
материала используйте `product-os import <workspace> <file>`: команда копирует
байты без изменений, проверяет повторный импорт и регистрирует artifact.

Если нужны дополнения к уже известным сведениям, подготовьте JSON-пакет:

```json
{
  "schemaVersion": 1,
  "expectedRevision": 1,
  "source": "PRODUCT.md",
  "operations": [
    {
      "op": "node",
      "node": {
        "id": "product",
        "type": "product",
        "label": "Название продукта",
        "status": "hypothesis",
        "data": {
          "description": {
            "what": "Описание из паспорта владельца",
            "forWhom": null,
            "outcome": null
          }
        }
      }
    }
  ]
}
```

Возьмите реальную expectedRevision и существующий ID из текущего графа;
число и ID в примере не подставляются вслепую. Источник должен существовать.

```sh
node <tools>/bin/product-os.js graph-write <workspace> <operations.json> --dry
node <tools>/bin/product-os.js graph-write <workspace> <operations.json>
node <tools>/bin/graph-write.js <workspace> --check
```

Поддерживаются типизированные операции node, edge, evidence, transition, move,
receipt и другие совместимые операции writer. Их схемы определены в
`bin/graph/writer.js` и `bin/graph/schema.js`. Для первого сохранения документа
дополнительные узлы, связи и действия не нужны.

- evidence требует конкретного target, text, source и происхождения наблюдения.
  Для исходного файла указывайте точное место: строку, фрагмент или страницу.
- transition ссылается на уже записанные evidenceIds; противоречия сохраняются.
- move создаётся только для выбранного или порученного действия. Не записывайте
  совет как принятую задачу и не редактируйте MOVES.md в обход общего writer.
- receipt нужен для запущенной из консоли задачи: сохраните её runId, nodeId и
  skill; укажите фактический outcome и существующий report либо краткий summary.
  Не выдавайте сохранение файла за выполненный анализ.

Writer выполняет валидацию, блокировку и согласованную запись графа и действий.
При конфликте ревизий перечитайте нужные записи и согласуйте изменение с ними.
Не отключайте проверку и не затирайте более новые сведения.

Простое чтение через product-status не создаёт отчёт, receipt, задачи или записи.
Результат чтения остаётся в ответе владельцу.

## Отчёты навыков

Отчёт навыка — Markdown в `reports/` с frontmatter: `title`, `date` (YYYY-MM-DD),
`skill` (slug навыка), `nodeId` цели, `outcome: completed|partial|failed`, `summary`.
Список исследований в консоли строится из этих полей; `visibility: internal` убирает
рабочие материалы из списка, не удаляя файл. Свяжите отчёт с узлом операцией
`complete`: `{op:"complete", nodeId, skill, report:"reports/…​.md", outcome}`.

## Стратегическая карта работ

У продукта — один действующий `artifact` с `data.artifactKind: "strategic-job-map"`,
`version: 1`, `productId` и `mapPath` на существующий `reports/job-map/<run>/map.json`
(плюс `mapSha256` точных байтов). Прежнюю активную карту отставляйте явно. Формат
карты — в навыке `product-job-map` (`references/map-format.md`); там же скрипт
проверки. Необязательное `scope.edition: "full"|"public"` выбирает охват
предложения; отсутствующее поле читается как `full`. Читается в консоли в разделе
«Карта работ».

## Отложенные идеи аудитории

Обещающие, но пока не выбранные применения сохраняйте как `artifact` с
`data.artifactKind: "audience-ideas"`, `version: 1` и `data.ideas:
[{id, title, focus: "deferred", benefit, deferredReason, report}]`; `report` —
существующий `reports/*.md` этой идеи. Полные профили не выдумывайте; консоль
показывает идеи под картой сегментов.

## Айдентика бренда

`artifact` с `data.kind: "visual-profile"`, `artifactKind: "brand-identity"`,
`productId`, `profileFile` на identity.json, `version`, `decision: proposed|accepted`
(`accepted` — только с `decisionSource` — явным решением владельца). Формат
identity.json и валидатор — в навыке `product-brand-identity`. Консоль читает
профиль в разделе «Библиотека» → «Айдентика»; предложенные и принятые версии
показываются раздельно.

## Библиотека референсов

`artifact` с `data.kind: "content-pack"`, `artifactKind: "product-reference-library"`,
`productId`, `manifestFile` на manifest schemaVersion 1 (`tracks[].cardsPath/
sourcesPath/…`). Формат файлов — контракт навыка `product-reference-library`.
Библиотека без независимой проверки сохраняется с `readiness: "draft"`.
Читается в разделе «Библиотека» → «Референсы» и через `product-os references read`.
