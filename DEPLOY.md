# 🚀 Деплой на Render

Нижче проста і надійна інструкція для Render (Web Service + Managed PostgreSQL).

## Передумови

1. Обліковий запис GitHub
2. Обліковий запис Render

## Кроки

1) Створіть базу даних: Render Dashboard → Databases → Create PostgreSQL

2) Додайте Web Service:
   - New → Web Service → Import з GitHub
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

3) Налаштуйте Environment Variables у Web Service:
   - `NODE_ENV=production`
   - `PORT=3000` (або змінну Render PORT за замовчуванням)
   - `DATABASE_URL` = Internal Connection String бази (Render → DB → Connections)
   - `PGSSL=true`
   - `JWT_SECRET` = сильний випадковий ключ
   - (опціонально) `CORS_ORIGIN=https://<ваш-сервіс>.onrender.com`

4) Деплой. При першому старті бекенд створить таблиці автоматично (`users`, `requests`, `notes`).

## Перевірка

- `GET /healthz` → `ok`
- `GET /api/health` → JSON з лічильниками
- Статика доступна за кореневим URL

## Часті питання

- Сертифікат/SSL: для Render достатньо `PGSSL=true`, окремий CA не потрібен.
- Міграції: базові таблиці створюються автоматично у `server.js`. Для складних змін використовуйте SQL-скрипти з `supabase-*.sql` як референс.
