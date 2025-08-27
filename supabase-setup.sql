-- SQL скрипт для створення таблиць у Supabase
-- Виконати в Supabase Dashboard → SQL Editor

-- Створити таблицю користувачів
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'admin')),
    skills JSONB DEFAULT '[]',
    location JSONB DEFAULT '{}',
    availability VARCHAR(50) DEFAULT 'flexible' CHECK (availability IN ('fulltime', 'parttime', 'weekends', 'flexible')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Створити таблицю заявок
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('medical', 'humanitarian', 'evacuation', 'psychological', 'legal', 'technical', 'translation', 'other')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    location JSONB NOT NULL,
    contact_info JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'completed', 'cancelled')),
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

-- Індекси для кращої продуктивності
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_category ON requests(category);
CREATE INDEX idx_requests_assigned ON requests(assigned_volunteer_id);
CREATE INDEX idx_notes_request ON notes(request_id);

-- Функція для автоматичного оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Тригер для автоматичного оновлення updated_at у таблиці requests
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Включити Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Політики для таблиці users (тільки користувачі можуть читати/оновлювати свої дані)
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Anyone can register" ON users FOR INSERT WITH CHECK (true);

-- Політики для таблиці requests (всі можуть створювати, волонтери можуть читати)
CREATE POLICY "Anyone can create requests" ON requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read requests" ON requests FOR SELECT USING (true);
CREATE POLICY "Admins can update any request" ON requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);
CREATE POLICY "Volunteers can update assigned requests" ON requests FOR UPDATE USING (
  assigned_volunteer_id::text = auth.uid()::text OR 
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);

-- Політики для таблиці notes
CREATE POLICY "Anyone can read notes" ON notes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create notes" ON notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Створити першого адміністратора (замініть дані на свої)
-- INSERT INTO users (name, email, password, phone, role) VALUES 
-- ('Адміністратор', 'admin@volhelper.com', '$2b$10$hashed_password_here', '+380501234567', 'admin');