require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple in-memory storage for demo
let users = [];
let requests = [];
let userIdCounter = 1;
let requestIdCounter = 1;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'volhelper_demo_secret_key_2024';

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    users: users.length,
    requests: requests.length,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, skills, location, availability } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      id: userIdCounter++,
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'volunteer',
      skills: skills || [],
      location: location || {},
      availability: availability || 'flexible',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    users.push(user);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Волонтер успішно зареєстрований',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        location: user.location,
        availability: user.availability
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email та пароль обов\'язкові' });
    }

    const user = users.find(u => u.email === email && u.isActive);
    if (!user) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Успішний вхід',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        location: user.location,
        availability: user.availability
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Requests routes
app.post('/api/requests', (req, res) => {
  try {
    const { title, description, category, priority, location, contactInfo, deadline } = req.body;

    if (!title || !description || !category || !location?.address || !location?.city || !contactInfo?.name || !contactInfo?.phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    const request = {
      id: requestIdCounter++,
      title,
      description,
      category,
      priority: priority || 'medium',
      location,
      contactInfo,
      status: 'new',
      assignedVolunteerId: null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    requests.push(request);

    res.status(201).json({
      message: 'Заявка успішно створена',
      request
    });

  } catch (error) {
    console.error('Request creation error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.get('/api/requests', (req, res) => {
  try {
    // Return requests with basic formatting for frontend compatibility
    const formattedRequests = requests.map(req => ({
      ...req,
      assignedVolunteer: req.assignedVolunteerId ? users.find(u => u.id === req.assignedVolunteerId) : null,
      Notes: [] // Empty for demo
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API info
app.get('/api', (req, res) => {
  res.json({
    message: 'VolHelper API працює на Render!',
    status: 'OK',
    version: '1.0',
    endpoints: [
      'GET /api/health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/requests',
      'GET /api/requests'
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Серверна помилка', details: err.message });
});

// 404 handler
app.use('*', (req, res) => {
  if (req.originalUrl.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint не знайдено' });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
  console.log(`📱 Портал доступний на http://localhost:${PORT}`);
});