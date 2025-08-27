-- Простий SQL без RLS для швидкого тесту
-- Виконати в Supabase SQL Editor

-- Видалити існуючі таблиці якщо є
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS requests CASCADE; 
DROP TABLE IF EXISTS users CASCADE;

-- Створити таблицю користувачів
CREATE TABLE users (
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
);

-- Створити таблицю заявок
CREATE TABLE requests (
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
);

-- Створити таблицю нотаток
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекси
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_requests_status ON requests(status);

-- ВИМКНУТИ RLS для тесту
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;