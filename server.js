require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();

// Security + core middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static('public'));

// Basic rate limiting for API
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', apiLimiter);

// PostgreSQL connection (Render/Supabase compatible)
function buildSslConfig() {
  const sslEnv = (process.env.PGSSL || process.env.PG_SSL || '').toLowerCase();
  const caPath = process.env.PG_CA_PATH;
  if (sslEnv === 'false' || sslEnv === 'disable') return false;
  if (caPath && fs.existsSync(caPath)) {
    try {
      const ca = fs.readFileSync(caPath, 'utf8');
      return { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' };
    } catch (e) {
      return { rejectUnauthorized: false };
    }
  }
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : buildSslConfig()
});


// Initialize database tables
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'volunteer',
        skills JSONB DEFAULT '[]',
        location JSONB DEFAULT '{}',
        availability VARCHAR(50) DEFAULT 'flexible',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        priority VARCHAR(50) DEFAULT 'medium',
        location JSONB NOT NULL,
        contact_info JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        assigned_volunteer_id INTEGER REFERENCES users(id),
        deadline TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        author_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('📊 База даних ініціалізована');
  } catch (error) {
    console.error('❌ Помилка ініціалізації бази даних:', error);
  }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'volhelper_demo_secret_key_2024';

// Auth middleware
function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен авторизації відсутній' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недійсний токен' });
  }
}

// API Routes

// Healthchecks
app.get('/healthz', (req, res) => res.status(200).send('ok')); // ← для Render
app.get('/api/health', async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const requestsResult = await pool.query('SELECT COUNT(*) FROM requests');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      users: parseInt(usersResult.rows[0].count),
      requests: parseInt(requestsResult.rows[0].count),
      environment: process.env.NODE_ENV || 'development',
      database: 'PostgreSQL connected'
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: 'Database connection failed', details: error.message });
  }
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, skills, location, availability } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(`
      INSERT INTO users (name, email, password, phone, role, skills, location, availability, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, role, skills, location, availability, created_at
    `, [
      name,
      email, 
      hashedPassword,
      phone,
      'volunteer',
      JSON.stringify(skills || []),
      JSON.stringify(location || {}),
      availability || 'flexible',
      true
    ]);

    const user = result.rows[0];

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

    const result = await pool.query(
      'SELECT id, name, email, password, role, skills, location, availability FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    const user = result.rows[0];

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

// Get user profile
app.get('/api/auth/profile', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, skills, location, availability FROM users WHERE id = $1 AND is_active = true',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }

    const user = result.rows[0];
    res.json({ 
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
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Requests routes
app.post('/api/requests', async (req, res) => {
  try {
    const { title, description, category, priority, location, contactInfo, deadline } = req.body;

    if (!title || !description || !category || !location?.address || !location?.city || !contactInfo?.name || !contactInfo?.phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    const result = await pool.query(`
      INSERT INTO requests (title, description, category, priority, location, contact_info, status, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title,
      description,
      category,
      priority || 'medium',
      JSON.stringify(location),
      JSON.stringify(contactInfo),
      'new',
      deadline ? new Date(deadline).toISOString() : null
    ]);

    const request = result.rows[0];

    res.status(201).json({
      message: 'Заявка успішно створена',
      request: {
        id: request.id,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        location: request.location,
        contactInfo: request.contact_info,
        status: request.status,
        assignedVolunteerId: request.assigned_volunteer_id,
        deadline: request.deadline,
        createdAt: request.created_at,
        updatedAt: request.updated_at
      }
    });

  } catch (error) {
    console.error('Request creation error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.get('/api/requests', authRequired, async (req, res) => {
  try {
    const { status, assigned } = req.query;
    let query = `
      SELECT 
        r.*,
        u.name as volunteer_name,
        u.email as volunteer_email,
        u.phone as volunteer_phone
      FROM requests r
      LEFT JOIN users u ON r.assigned_volunteer_id = u.id
    `;
    let params = [];
    const whereParts = [];

    if (status) {
      whereParts.push(`r.status = $${params.length + 1}`);
      params.push(status);
    }
    if (assigned === 'true') {
      whereParts.push(`r.assigned_volunteer_id IS NOT NULL`);
    } else if (assigned === 'false') {
      whereParts.push(`r.assigned_volunteer_id IS NULL`);
    } else if (assigned === 'me') {
      whereParts.push(`r.assigned_volunteer_id = $${params.length + 1}`);
      params.push(req.user.id);
    }

    if (whereParts.length) {
      query += ' WHERE ' + whereParts.join(' AND ');
    }
    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);

    const formattedRequests = result.rows.map(req => ({
      id: req.id,
      title: req.title,
      description: req.description,
      category: req.category,
      priority: req.priority,
      location: req.location,
      contactInfo: req.contact_info,
      status: req.status,
      assignedVolunteerId: req.assigned_volunteer_id,
      assignedVolunteer: req.assigned_volunteer_id ? {
        id: req.assigned_volunteer_id,
        name: req.volunteer_name,
        email: req.volunteer_email,
        phone: req.volunteer_phone
      } : null,
      deadline: req.deadline,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
      Notes: [] // Empty for demo
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Get single request
app.get('/api/requests/:id', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        r.*,
        u.name as volunteer_name,
        u.email as volunteer_email,
        u.phone as volunteer_phone
      FROM requests r
      LEFT JOIN users u ON r.assigned_volunteer_id = u.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    const req = result.rows[0];

    // Load notes for request
    const notesRes = await pool.query(
      `SELECT n.id, n.text, n.created_at, u.id as author_id, u.name as author_name
       FROM notes n LEFT JOIN users u ON n.author_id = u.id
       WHERE n.request_id = $1 ORDER BY n.created_at ASC`,
      [id]
    );

    const formattedRequest = {
      id: req.id,
      title: req.title,
      description: req.description,
      category: req.category,
      priority: req.priority,
      location: req.location,
      contactInfo: req.contact_info,
      status: req.status,
      assignedVolunteerId: req.assigned_volunteer_id,
      assignedVolunteer: req.assigned_volunteer_id ? {
        id: req.assigned_volunteer_id,
        name: req.volunteer_name,
        email: req.volunteer_email,
        phone: req.volunteer_phone
      } : null,
      deadline: req.deadline,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
      Notes: notesRes.rows.map(n => ({
        id: n.id,
        text: n.text,
        createdAt: n.created_at,
        author: { id: n.author_id, name: n.author_name }
      }))
    };

    res.json(formattedRequest);
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Assign request to volunteer
app.put('/api/requests/:id/assign', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`
      UPDATE requests 
      SET assigned_volunteer_id = $1, status = 'assigned', updated_at = NOW()
      WHERE id = $2
    `, [req.user.id, id]);

    res.json({ message: 'Заявку призначено' });
  } catch (error) {
    console.error('Assign request error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Update request status
app.put('/api/requests/:id/status', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    // Authorization: only assigned volunteer or admin
    const reqRes = await pool.query('SELECT assigned_volunteer_id FROM requests WHERE id = $1', [id]);
    if (reqRes.rows.length === 0) return res.status(404).json({ error: 'Заявку не знайдено' });
    const assignedId = reqRes.rows[0].assigned_volunteer_id;
    const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const role = userRes.rows[0]?.role || 'volunteer';
    if (role !== 'admin' && assignedId && assignedId !== req.user.id) {
      return res.status(403).json({ error: 'Тільки призначений волонтер або адмін може змінювати статус' });
    }

    await pool.query(`
      UPDATE requests 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, id]);

    res.json({ message: 'Статус оновлено' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Add note to request
app.post('/api/requests/:id/notes', authRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Текст нотатки обов\'язковий' });

    const exists = await pool.query('SELECT id FROM requests WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Заявку не знайдено' });

    await pool.query('INSERT INTO notes (text, request_id, author_id) VALUES ($1, $2, $3)', [text.trim(), id, req.user.id]);
    res.status(201).json({ message: 'Нотатку додано' });
  } catch (error) {
    console.error('Add note error:', error);
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
      'GET /api/requests (auth)',
      'GET /api/requests/:id (auth)',
      'PUT /api/requests/:id/assign (auth)',
      'PUT /api/requests/:id/status (auth)',
      'POST /api/requests/:id/notes (auth)'
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

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущено на порті ${PORT}`);
    console.log(`📱 Портал доступний на http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('❌ Неможливо запустити сервер:', error);
  process.exit(1);
});
