# 🚀 Розміщення на Vercel

Детальна інструкція для розміщення волонтерського порталу на Vercel.

## 📋 Передумови

1. Акаунт на [GitHub](https://github.com)
2. Акаунт на [Vercel](https://vercel.com)
3. Git встановлений на вашому комп'ютері

## 🏗️ Крок 1: Підготовка коду

Код вже підготовлений для Vercel з необхідними конфігураціями:
- ✅ `vercel.json` - конфігурація для Vercel
- ✅ `api/index.js` - serverless функція
- ✅ Оптимізована база даних для serverless
- ✅ Правильні роути та middleware

## 📤 Крок 2: Завантаження на GitHub

```bash
# 1. Ініціалізувати git репозиторій
git init

# 2. Додати всі файли
git add .

# 3. Зробити перший комміт
git commit -m "Initial commit: Volunteer portal for Vercel"

# 4. Додати remote репозиторій (замініть YOUR_USERNAME та YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 5. Завантажити код
git push -u origin main
```

## 🌍 Крок 3: Деплой на Vercel

### Варіант A: Через веб-інтерфейс (Рекомендується)

1. **Зайти на [vercel.com](https://vercel.com)**
2. **Увійти через GitHub**
3. **Натиснути "New Project"**
4. **Імпортувати ваш репозиторій**
5. **Налаштування проекту:**
   - Framework Preset: **Other**
   - Root Directory: **./** (за замовчуванням)
   - Build Command: **npm run vercel-build**
   - Output Directory: **public**
6. **Додати змінні середовища (Environment Variables):**
   ```
   NODE_ENV = production
   JWT_SECRET = your_super_secure_secret_key_here
   DATABASE_URL = /tmp/database.sqlite
   ```
7. **Натиснути "Deploy"**

### Варіант B: Через CLI

```bash
# 1. Встановити Vercel CLI
npm install -g vercel

# 2. Увійти в акаунт
vercel login

# 3. Деплой
vercel

# 4. Налаштувати змінні середовища
vercel env add NODE_ENV production
vercel env add JWT_SECRET your_super_secure_secret_key_here
vercel env add DATABASE_URL /tmp/database.sqlite

# 5. Повторний деплой з новими змінними
vercel --prod
```

## ⚙️ Крок 4: Налаштування змінних середовища

У Vercel Dashboard:

1. Відкрити ваш проект
2. Перейти в **Settings** → **Environment Variables**
3. Додати змінні:

| Назва | Значення | Environment |
|-------|----------|-------------|
| `NODE_ENV` | `production` | Production, Preview, Development |
| `JWT_SECRET` | `ваш_секретний_ключ_тут` | Production, Preview, Development |
| `DATABASE_URL` | `/tmp/database.sqlite` | Production, Preview, Development |

**⚠️ Важливо:** Використовуйте складний JWT_SECRET для безпеки!

## 🎯 Крок 5: Тестування

Після успішного деплою:

1. **Отримати URL:** https://your-project.vercel.app
2. **Перевірити функціонал:**
   - Відкривається головна сторінка ✅
   - Працює реєстрація волонтерів ✅
   - Працює створення заявок ✅
   - Працює авторизація ✅

## 🔧 Налаштування домену (Опціонально)

1. У Vercel Dashboard → **Settings** → **Domains**
2. Додати власний домен
3. Налаштувати DNS записи згідно з інструкціями

## 📊 Моніторинг

Vercel надає вбудовані інструменти:
- **Analytics** - статистика відвідувань
- **Functions** - логи serverless функцій
- **Speed Insights** - швидкість завантаження

## 🔄 Оновлення сайту

Для оновлення сайту:
```bash
git add .
git commit -m "Update: описание изменений"
git push
```

Vercel автоматично задеплоїть зміни!

## ❗ Важливі нотатки

1. **База даних:** SQLite зберігається в `/tmp/` і очищається при кожному деплої
2. **Обмеження:** Vercel має ліміти на безкоштовному плані
3. **Логи:** Дивитися логи можна в Vercel Dashboard → Functions
4. **Бекапи:** Для production рекомендується зовнішня БД (PostgreSQL, MongoDB Atlas)

## 🆘 Розв'язання проблем

### Помилка: "Module not found"
```bash
# Перевірити package.json dependencies
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### База даних не зберігає дані
- Це нормально для SQLite в `/tmp/`
- Для продакшн використовуйте зовнішню БД

### API не відповідає
- Перевірити змінні середовища в Vercel
- Дивитися логи в Vercel Dashboard

---

**🎉 Готово!** Ваш волонтерський портал тепер доступний у всьому світі!

URL: **https://your-project.vercel.app**