const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage
let users = [];
let requests = [];
let userIdCounter = 1;
let requestIdCounter = 1;

// Basic routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    users: users.length,
    requests: requests.length
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'VolHelper API працює!', 
    status: 'OK',
    version: '1.0'
  });
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Всі поля обов\'язкові' });
    }

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Користувач вже існує' });
    }

    // Create user
    const user = {
      id: userIdCounter++,
      name,
      email,
      phone,
      role: 'volunteer',
      createdAt: new Date().toISOString()
    };

    users.push(user);

    res.status(201).json({
      message: 'Волонтер зареєстрований',
      token: 'demo_token_' + user.id,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Серверна помилка: ' + error.message });
  }
});

// Requests routes  
app.post('/requests', (req, res) => {
  try {
    const { title, description, category, location, contactInfo } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Обов\'язкові поля відсутні' });
    }

    const request = {
      id: requestIdCounter++,
      title,
      description,
      category,
      location,
      contactInfo,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    requests.push(request);

    res.status(201).json({
      message: 'Заявка створена',
      request
    });

  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Серверна помилка: ' + error.message });
  }
});

app.get('/requests', (req, res) => {
  try {
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Помилка: ' + error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Серверна помилка', 
    details: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = app;