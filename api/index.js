const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://mjriiocqthuojfkqzwsn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
function generateToken(userId) {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'default_secret', 
    { expiresIn: '24h' }
  );
}

async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();
    
    return user;
  } catch (error) {
    return null;
  }
}

// Auth middleware
async function authMiddleware(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Відсутній токен авторизації' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Недійсний токен' });
  }

  req.user = user;
  next();
}

// Routes

// Health check
app.get('/health', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      supabase: error ? 'Error' : 'Connected'
    });
  } catch (error) {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      supabase: 'Not configured'
    });
  }
});

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, skills, location, availability } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        name,
        email,
        password: hashedPassword,
        phone,
        skills: skills || [],
        location: location || {},
        availability: availability || 'flexible'
      }])
      .select()
      .single();

    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Помилка реєстрації' });
    }

    // Generate token
    const token = generateToken(user.id);

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

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!user) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Невірні дані для входу' });
    }

    // Generate token
    const token = generateToken(user.id);

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

app.get('/auth/profile', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      skills: req.user.skills,
      location: req.user.location,
      availability: req.user.availability,
      createdAt: req.user.created_at
    }
  });
});

// Requests routes
app.post('/requests', async (req, res) => {
  try {
    const { title, description, category, priority, location, contactInfo, deadline } = req.body;

    // Validation
    if (!title || !description || !category || !location?.address || !location?.city || !contactInfo?.name || !contactInfo?.phone) {
      return res.status(400).json({ error: 'Всі обов\'язкові поля мають бути заповнені' });
    }

    const { data: request, error } = await supabase
      .from('requests')
      .insert([{
        title,
        description,
        category,
        priority: priority || 'medium',
        location,
        contact_info: contactInfo,
        deadline: deadline ? new Date(deadline).toISOString() : null
      }])
      .select()
      .single();

    if (error) {
      console.error('Request creation error:', error);
      return res.status(500).json({ error: 'Помилка створення заявки' });
    }

    res.status(201).json({
      message: 'Заявка успішно створена',
      request
    });

  } catch (error) {
    console.error('Request creation error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.get('/requests', authMiddleware, async (req, res) => {
  try {
    let query = supabase
      .from('requests')
      .select(`
        *,
        assigned_volunteer:users!assigned_volunteer_id(id, name, phone, email)
      `)
      .order('created_at', { ascending: false });

    // Filter for volunteers - only show new requests or assigned to them
    if (req.user.role === 'volunteer') {
      query = query.or(`status.eq.new,assigned_volunteer_id.eq.${req.user.id}`);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Get requests error:', error);
      return res.status(500).json({ error: 'Помилка отримання заявок' });
    }

    // Format response for frontend compatibility
    const formattedRequests = requests.map(req => ({
      ...req,
      assignedVolunteer: req.assigned_volunteer,
      Notes: [] // TODO: implement notes fetching if needed
    }));

    res.json(formattedRequests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

app.get('/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { data: request, error } = await supabase
      .from('requests')
      .select(`
        *,
        assigned_volunteer:users!assigned_volunteer_id(id, name, phone, email, skills, location, availability),
        notes:notes(*, author:users!author_id(id, name))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !request) {
      return res.status(404).json({ error: 'Заявку не знайдено' });
    }

    // Check permissions for volunteers
    if (req.user.role === 'volunteer' && 
        request.assigned_volunteer_id && 
        request.assigned_volunteer_id !== req.user.id && 
        request.status !== 'new') {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    // Format for frontend compatibility
    const formattedRequest = {
      ...request,
      assignedVolunteer: request.assigned_volunteer,
      Notes: request.notes || []
    };

    res.json(formattedRequest);
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Серверна помилка' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'VolHelper API працює з Supabase!', 
    status: 'OK',
    endpoints: [
      'POST /auth/register',
      'POST /auth/login',
      'GET /auth/profile',
      'POST /requests',
      'GET /requests',
      'GET /requests/:id',
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