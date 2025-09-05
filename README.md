# Волонтерський портал

Веб-портал для реєстрації волонтерів та обробки заявок на допомогу.

## Функціонал

### Для громадян
- Подача заявок на отримання допомоги (публічний маршрут)

### Для волонтерів
- Реєстрація та вхід (JWT)
- Перегляд заявок (авторизований доступ)
- Самопризначення на заявку, оновлення статусу
- Додавання нотаток до заявок

### Для адміністраторів
- Повний доступ до заявок

## Технології

- Backend: Node.js, Express
- База даних: PostgreSQL (Render/Supabase)
- Frontend: HTML, CSS, JS (Bootstrap)
- Аутентифікація: JWT

## Локальний запуск

Передумови: Node.js 18+, доступний PostgreSQL (локально або керований).

1) Встановити залежності
```bash
npm install
```

2) Налаштувати `.env` (див. `.env.example`)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
PGSSL=false # для локального Postgres
JWT_SECRET=change_me
```

3) Запуск
```bash
npm run dev   # з nodemon
# або
npm start
```

Відкрити: http://localhost:3000

## Структура

```
public/         # Статичні файли фронтенду
server.js       # Єдиний бекенд (Express + pg)
render.yaml     # Конфіг для Render
supabase-*.sql  # SQL схеми (опціонально)
```

Примітка: каталоги `models/`, `routes/`, `middleware/` містять попередні варіанти (Mongo/Sequelize) і не використовуються активним бекендом у `server.js`.

## API (ключове)

- POST `/api/auth/register` — реєстрація волонтера
- POST `/api/auth/login` — вхід
- GET `/api/auth/profile` — профіль (auth)
- POST `/api/requests` — створити публічну заявку (без auth)
- GET `/api/requests` — список заявок (auth)
- GET `/api/requests/:id` — заявка з нотатками (auth)
- PUT `/api/requests/:id/assign` — взяти заявку (auth)
- PUT `/api/requests/:id/status` — оновити статус (auth; призначений волонтер або адмін)
- POST `/api/requests/:id/notes` — додати нотатку (auth)

## Деплой на Render

1) Створити сервіс Web на Render, вказати цей репозиторій
2) Build Command: `npm install`
3) Start Command: `npm start`
4) Додати базу даних (Render Managed PostgreSQL) та підключити `DATABASE_URL`
5) Додати змінні середовища: `NODE_ENV=production`, `JWT_SECRET`, `PGSSL=true`
6) (Опціонально) `CORS_ORIGIN=https://<your-service>.onrender.com`

Сервіс автоматично ініціалізує таблиці при старті.
