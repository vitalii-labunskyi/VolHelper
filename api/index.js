const express = require('express');
const cors = require('cors');
const { sequelize } = require('../models/database');

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

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('../routes/auth');
const requestRoutes = require('../routes/requests');
const userRoutes = require('../routes/users');

// Mount routes with /api prefix since Vercel routes /api/* to this file
app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Волонтерський портал API', status: 'OK' });
});

// Export for Vercel
module.exports = async (req, res) => {
  // Initialize database on first request
  await initializeDatabase();
  
  // Handle the request
  return app(req, res);
};