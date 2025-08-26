require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('../models/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return;
  
  try {
    await sequelize.authenticate();
    console.log('Підключено до SQLite бази даних');
    
    await sequelize.sync();
    console.log('Таблиці бази даних синхронізовані');
    dbInitialized = true;
  } catch (error) {
    console.error('Помилка підключення до бази даних:', error);
  }
}

// Routes
const authRoutes = require('../routes/auth');
const requestRoutes = require('../routes/requests');
const userRoutes = require('../routes/users');

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle all API requests
app.all('/api/*', async (req, res, next) => {
  await initializeDatabase();
  next();
});

// Export for Vercel
module.exports = app;