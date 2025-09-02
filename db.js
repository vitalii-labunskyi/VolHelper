const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

    console.log('📊 База даних ініціалізована');
  } catch (error) {
    console.error('❌ Помилка ініціалізації бази даних:', error);
  }
}

module.exports = { pool, initDatabase };
