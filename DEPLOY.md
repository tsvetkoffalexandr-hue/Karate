# Развёртывание и стоимость

## Текущее состояние

- Бот: https://t.me/BudoTallinnGrowthBot
- CRM: https://karate-growth-ai.karate-growth-ai.workers.dev/
- Cloudflare Worker + D1 опубликованы; HTTPS проверен. DEMO_MODE=false: приём родителей открыт.
- AI Qwen3, RU/UK, реальные Telegram-ответы, назначение и уведомления проверены.
- Фоновая аналитика запускается каждые 5 минут; самостоятельный запуск по Cron зафиксирован 31 октября 2026 в 10:00 UTC.
- Автопубликации выключены. Платные тарифы не подключались.

## Бесплатные квоты

Проверено по официальной документации 31 октября 2026 года:

| Компонент | Бесплатная квота |
|---|---|
| Workers Free | 100 000 запросов/день; 10 мс CPU на вызов |
| D1 | 5 млн прочитанных и 100 000 записанных строк/день; 5 ГБ суммарного хранения |
| Workers AI | 10 000 neurons/день; это не количество сообщений |

Источники: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/d1/platform/pricing/ · https://developers.cloudflare.com/workers-ai/platform/pricing/

Модель: https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/ . Приложение ограничивает FAQ до 100 попыток в сутки и 256 токенов ответа. Это не гарантирует укладывание в neurons; при исчерпании бесплатной квоты используется резервный ответ. Ожидаемая стоимость инфраструктуры — $0/месяц в пределах квот. Домен покупать не требуется.

## Повторное развёртывание в текущем аккаунте

```sh
npm ci
npm test
npm run deploy
```

База и database_id уже настроены. Секреты Cloudflare сохраняются между публикациями. Миграции при появлении новых файлов применяются через `npm run db:remote` до кода, которому они нужны.

Для другого аккаунта сначала выполнить `npx wrangler login`, создать D1, заменить account_id/database_id в wrangler.jsonc, применить миграции и настроить секреты. Не создавать повторную базу в текущем аккаунте.

## Секреты

- ADMIN_TOKEN — пароль доступа к CRM.
- TELEGRAM_BOT_TOKEN — ключ @BudoTallinnGrowthBot.
- WEBHOOK_SECRET — проверка подлинности входящего webhook.
- ADMIN_CHAT_ID — получатель служебных уведомлений тренеру.
- TEST_CHAT_ID — тестовый аккаунт при включённом DEMO_MODE.

Значения не входят в репозиторий, отчёты или URL. Для ввода использовать `wrangler secret put NAME` или secret bulk через stdin. ADMIN_TOKEN и WEBHOOK_SECRET должны быть разными случайными значениями не короче 32 байт. `.dev.vars` предназначен только для локальной разработки и не загружается в production.

## Telegram

Официальный API: https://core.telegram.org/bots/api#setwebhook

Webhook: `https://karate-growth-ai.karate-growth-ai.workers.dev/telegram`, allowed_updates=["message"], max_connections=1. WEBHOOK_SECRET передаётся как secret_token. Старые сообщения при настройке не сбрасывались.

Уведомление тренеру возникает только после заполнения заинтересованной заявки; отдельная строка в исходящей очереди адресована ADMIN_CHAT_ID. Родительский ответ не содержит CRM-ссылок. Перед запуском в новом аккаунте проверить getMe, getWebhookInfo, настоящий диалог, запись в CRM и доставку обоим получателям.

## Что ещё не настроено

Реальное расписание и постоянные цены не предоставлены. Google Calendar, учёт посещений и автоматическое развёртывание из GitHub не подключены. Источник: https://github.com/tsvetkoffalexandr-hue/Karate . CI запускает только тесты. Для автоматических публикаций потребуются конкретные разрешённые площадки и официальные API.
