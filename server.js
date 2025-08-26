require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Підключено до SQLite бази даних');
    
    await sequelize.sync();
    console.log('Таблиці бази даних синхронізовані');
  } catch (error) {
    console.error('Помилка підключення до бази даних:', error);
  }
}

initializeDatabase();

const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порті ${PORT}`);
}).on('error', (err) => {
  console.error('Помилка запуску сервера:', err);
});