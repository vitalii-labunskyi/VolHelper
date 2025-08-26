const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage for demo (will be reset on each deployment)
let users = [];
let requests = [];
let notes = [];
let idCounters = { users: 1, requests: 1, notes: 1 };

// Helper functions
function findUserById(id) {
  return users.find(u => u.id === parseInt(id));
}

function findUserByEmail(email) {
  return users.find(u => u.email === email);
}

function findRequestById(id) {
  return requests.find(r => r.id === parseInt(id));
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    users: users.length,
    requests: requests.length 
  });
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, skills, location, availability } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    if (findUserByEmail(email)) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      id: idCounters.users++,
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

    // Generate token
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'default_secret', 
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

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email та пароль обов\'язкові' });
    }

    const user = findUserByEmail(email);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'default_secret', 
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
app.post('/requests', (req, res) => {
  try {
    const { title, description, category, priority, location, contactInfo, deadline } = req.body;

    // Validation
    if (!title || !description || !category || !location?.address || !location?.city || !contactInfo?.name || !contactInfo?.phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    const request = {
      id: idCounters.requests++,
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

app.get('/requests', (req, res) => {
  try {
    // For demo, return all requests with basic info
    const requestsWithVolunteers = requests.map(req => {
      let assignedVolunteer = null;
      if (req.assignedVolunteerId) {
        const volunteer = findUserById(req.assignedVolunteerId);
        if (volunteer) {
          assignedVolunteer = {
            id: volunteer.id,
            name: volunteer.name,
            phone: volunteer.phone,
            email: volunteer.email
          };
        }
      }

      return {
        ...req,
        assignedVolunteer,
        Notes: notes.filter(n => n.requestId === req.id).map(note => ({
          ...note,
          author: { name: findUserById(note.authorId)?.name || 'Unknown' }
        }))
      };
    });

    res.json(requestsWithVolunteers);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'VolHelper API працює!', 
    status: 'OK',
    endpoints: [
      'POST /auth/register',
      'POST /auth/login', 
      'POST /requests',
      'GET /requests',
      'GET /health'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Серверна помилка', details: err.message });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint не знайдено', path: req.originalUrl });
});

// Export for Vercel
module.exports = app;