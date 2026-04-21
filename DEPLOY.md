# Деплой research-dashboard — за 5 минут

Дашборд живёт на Vercel и читает ObsidianVault через GitHub Contents API.
Единственный write-endpoint — `/api/promote` — пишет в vault через PAT.

---

## Что нужно один раз

### 1. Создать GitHub Personal Access Token

**Рекомендуемый вариант — fine-grained PAT:**

1. Открой: https://github.com/settings/tokens?type=beta
2. "Generate new token" → дай имя `research-dashboard-promote`
3. **Resource owner:** твой аккаунт (`adilalim041`)
4. **Repository access:** Only selected → выбери `adilalim041/ObsidianVault`
5. **Permissions → Contents:** Read and write
6. **Expiration:** 90 дней (GitHub максимум для fine-grained)
7. Generate → скопируй токен `github_pat_...` сразу (он показывается один раз)

> **Fallback — Classic PAT** (если fine-grained недоступен для твоего аккаунта):
> - Открой: https://github.com/settings/tokens (без `?type=beta`)
> - Scope: поставь только `repo`
> - **ВНИМАНИЕ:** classic PAT с `repo` даёт доступ ко ВСЕМ приватным репо на аккаунте — это хуже. Используй только если fine-grained не работает.

### 2. Сгенерировать ADMIN_SECRET

Это пароль, которым дашборд защищает endpoint `/api/promote`.
Должен быть 32+ символа, случайный:

```bash
# Вариант 1 (если есть openssl):
openssl rand -base64 32

# Вариант 2 (Python):
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Сохрани в менеджер паролей (1Password / Bitwarden). Это пароль — не токен GitHub.

### 3. Добавить переменные в Vercel

1. Открой: https://vercel.com/adilalim041/research-dashboard/settings/environment-variables
2. Добавь **только на Production environment** (снять галки Preview и Development):

| Ключ | Значение | Где взять |
|---|---|---|
| `GITHUB_PAT` | `github_pat_...` | шаг 1 выше |
| `ADMIN_SECRET` | случайная строка 32+ символа | шаг 2 выше |
| `DASHBOARD_ORIGIN` | `https://research-dashboard-eight.vercel.app` | фиксированный |
| `DRY_RUN` | `false` | фиксированный |

> **Не добавляй `VITE_GITHUB_TOKEN` в Vercel.**
> Переменные с префиксом `VITE_` попадают в публичный JS-бандл — PAT утечёт.
> Для чтения vault (GET) не нужен токен: репо публичное, лимит 60 req/hr без авторизации.
> С кешем (10 мин в памяти + localStorage) этого хватает.

### 4. Trigger redeploy

В Vercel Dashboard → Deployments → "..." рядом с последним деплоем → **Redeploy**.
Или сделай пустой коммит:

```bash
git commit --allow-empty -m "chore: trigger redeploy after env vars"
git push
```

### 5. Проверка

1. Открой https://research-dashboard-eight.vercel.app
2. Перейди в раздел "Кандидаты"
3. Нажми "Взять в изучение" на любом кандидате
4. Введи ADMIN_SECRET в модалке
5. Проверь что в репо `adilalim041/ObsidianVault` появился файл в `system/queue/pending/`

---

## Ротация токена (каждые 90 дней)

GitHub пришлёт email "Your token is expiring soon" — не игнорируй.

1. Создай **новый** PAT (шаг 1 выше)
2. В Vercel → Environment Variables → замени `GITHUB_PAT` на новое значение
3. Redeploy (шаг 4)
4. Старый PAT → https://github.com/settings/tokens → Revoke

---

## Если secret утёк

**ADMIN_SECRET скомпрометирован:**
1. Сгенери новый (шаг 2)
2. Замени в Vercel → Redeploy
3. Просмотри `system/queue/pending/` на лишние файлы, удали руками через GitHub UI

**GITHUB_PAT скомпрометирован:**
1. GitHub → Settings → Tokens → Revoke скомпрометированный немедленно
2. Создай новый PAT (шаг 1)
3. Замени в Vercel → Redeploy
4. Просмотри `system/queue/pending/` на мусорные команды

---

## Локальный dev

1. Скопируй `.env.example` → `.env.local`:

```bash
cp .env.example .env.local
```

2. Заполни `.env.local`:

```
# Для локального тестирования endpoint /api/promote
GITHUB_PAT=github_pat_...
ADMIN_SECRET=любая-строка-для-теста
DASHBOARD_ORIGIN=http://localhost:5173
DRY_RUN=true
```

> `DRY_RUN=true` — endpoint не пишет в GitHub, только логирует. Безопасно для теста.

3. Запускай через `npx vercel dev` (не `npm run dev`) — только так поднимаются serverless functions локально:

```bash
npx vercel dev
```

Откроется на `http://localhost:3000` (Vercel dev port).

---

## Troubleshooting

| Симптом | Причина | Решение |
|---|---|---|
| 401 в модалке promote | Неверный ADMIN_SECRET | Проверь значение в Vercel env |
| 403 при записи в vault | PAT expired или не те права | Ротируй PAT, проверь scope Contents:write |
| promote работает, файл не появляется | DRY_RUN=true на Prod | Убедись что DRY_RUN=false в Production env |
| Дашборд не загружает данные | Rate limit GitHub (60 req/hr unauth) | Подожди 1 час или проверь кеш |
