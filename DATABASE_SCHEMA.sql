-- =====================================================
-- Wishlist Gift Platform - Database Schema
-- PostgreSQL 14+
-- =====================================================

-- Создание базы данных (выполнить отдельно)
-- CREATE DATABASE wishlist_gift;

-- =====================================================
-- Таблицы
-- =====================================================

-- Пользователи системы
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'model' CHECK (role IN ('model', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Профили моделей
CREATE TABLE IF NOT EXISTS model_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_link VARCHAR(255) UNIQUE NOT NULL,
    bio TEXT,
    banner_url TEXT,
    
    -- Кастомизация профиля
    theme VARCHAR(50) DEFAULT 'blue' CHECK (theme IN ('blue', 'purple', 'pink', 'green', 'orange', 'red')),
    accent_color VARCHAR(7) DEFAULT '#0088cc',
    show_stats BOOLEAN DEFAULT true,
    show_recent_gifts BOOLEAN DEFAULT true,
    items_per_row INTEGER DEFAULT 3 CHECK (items_per_row IN (2, 3, 4)),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Товары в вишлисте
CREATE TABLE IF NOT EXISTS wishlist_items (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'RUB')),
    
    -- Расчет Stars (1 Star = $0.022)
    base_stars INTEGER NOT NULL CHECK (base_stars > 0),
    fee_stars INTEGER NOT NULL CHECK (fee_stars >= 0),
    total_stars INTEGER NOT NULL CHECK (total_stars > 0),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Фотографии товаров
CREATE TABLE IF NOT EXISTS item_photos (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Транзакции (покупки подарков)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES wishlist_items(id),
    model_id INTEGER NOT NULL REFERENCES users(id),
    donor_telegram_id BIGINT,
    donor_name VARCHAR(255),
    
    -- Данные о платеже
    stars_amount INTEGER NOT NULL CHECK (stars_amount > 0),
    base_stars INTEGER NOT NULL CHECK (base_stars > 0),
    fee_stars INTEGER NOT NULL CHECK (fee_stars >= 0),
    
    -- Telegram Payments
    telegram_payment_id VARCHAR(255) UNIQUE,
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP
);

-- Настройки платформы
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Администраторы платформы
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Индексы для оптимизации запросов
-- =====================================================

-- Индексы для таблицы users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Индексы для таблицы model_profiles
CREATE INDEX IF NOT EXISTS idx_model_profiles_user_id ON model_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_model_profiles_public_link ON model_profiles(public_link);

-- Индексы для таблицы wishlist_items
CREATE INDEX IF NOT EXISTS idx_wishlist_items_model_id ON wishlist_items(model_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_active ON wishlist_items(is_active);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_at ON wishlist_items(created_at DESC);

-- Индексы для таблицы item_photos
CREATE INDEX IF NOT EXISTS idx_item_photos_item_id ON item_photos(item_id);
CREATE INDEX IF NOT EXISTS idx_item_photos_display_order ON item_photos(item_id, display_order);

-- Индексы для таблицы transactions
CREATE INDEX IF NOT EXISTS idx_transactions_model_id ON transactions(model_id);
CREATE INDEX IF NOT EXISTS idx_transactions_donor_id ON transactions(donor_telegram_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_telegram_payment_id ON transactions(telegram_payment_id);

-- =====================================================
-- Триггеры для автоматического обновления updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_profiles_updated_at BEFORE UPDATE ON model_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wishlist_items_updated_at BEFORE UPDATE ON wishlist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Начальные данные (seed data)
-- =====================================================

-- Настройки платформы по умолчанию
INSERT INTO platform_settings (key, value, description) VALUES
    ('commission_rate', '10', 'Процент комиссии платформы'),
    ('star_rate_usd', '0.022', 'Курс 1 Star к USD'),
    ('star_rate_eur', '0.020', 'Курс 1 Star к EUR'),
    ('notify_models_on_gift', 'true', 'Уведомлять модели о подарках'),
    ('notify_donors_on_payment', 'true', 'Уведомлять дарителей об успешной оплате')
ON CONFLICT (key) DO NOTHING;

-- Создание супер-администратора (пароль нужно захешировать!)
-- Пароль по умолчанию: admin123 (должен быть захеширован через bcrypt)
-- INSERT INTO admin_users (username, password_hash, email, role) VALUES
--     ('admin', '$2b$10$...', 'admin@wishlistgift.com', 'super_admin');

-- =====================================================
-- Представления (Views) для удобства запросов
-- =====================================================

-- Представление: Полная информация о модели
CREATE OR REPLACE VIEW model_full_info AS
SELECT 
    u.id as user_id,
    u.telegram_id,
    u.username,
    u.first_name,
    u.last_name,
    u.avatar_url,
    mp.public_link,
    mp.bio,
    mp.banner_url,
    mp.theme,
    mp.accent_color,
    COUNT(DISTINCT wi.id) as items_count,
    COUNT(DISTINCT t.id) as gifts_count,
    COALESCE(SUM(CASE WHEN t.payment_status = 'completed' THEN t.base_stars ELSE 0 END), 0) as total_stars_earned
FROM users u
LEFT JOIN model_profiles mp ON u.id = mp.user_id
LEFT JOIN wishlist_items wi ON u.id = wi.model_id AND wi.is_active = true
LEFT JOIN transactions t ON u.id = t.model_id
WHERE u.role = 'model'
GROUP BY u.id, u.telegram_id, u.username, u.first_name, u.last_name, u.avatar_url,
         mp.public_link, mp.bio, mp.banner_url, mp.theme, mp.accent_color;

-- Представление: Статистика транзакций
CREATE OR REPLACE VIEW transaction_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_transactions,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_transactions,
    COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_transactions,
    SUM(CASE WHEN payment_status = 'completed' THEN stars_amount ELSE 0 END) as total_stars,
    SUM(CASE WHEN payment_status = 'completed' THEN base_stars ELSE 0 END) as models_stars,
    SUM(CASE WHEN payment_status = 'completed' THEN fee_stars ELSE 0 END) as platform_stars
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- =====================================================
-- Функции для бизнес-логики
-- =====================================================

-- Функция: Расчет Stars для товара
CREATE OR REPLACE FUNCTION calculate_stars(
    p_price DECIMAL,
    p_currency VARCHAR(3),
    p_commission_rate DECIMAL DEFAULT 0.10
)
RETURNS TABLE (
    base_stars INTEGER,
    fee_stars INTEGER,
    total_stars INTEGER
) AS $$
DECLARE
    star_rate DECIMAL := 0.022; -- 1 Star = $0.022
    usd_price DECIMAL;
    base INTEGER;
    fee INTEGER;
    total INTEGER;
BEGIN
    -- Конвертация в USD (упрощенная, в реальности нужна таблица курсов)
    CASE p_currency
        WHEN 'USD' THEN usd_price := p_price;
        WHEN 'EUR' THEN usd_price := p_price * 1.10; -- Примерный курс
        WHEN 'RUB' THEN usd_price := p_price * 0.011; -- Примерный курс
        ELSE usd_price := p_price;
    END CASE;
    
    -- Расчет Stars
    base := FLOOR(usd_price / star_rate)::INTEGER;
    fee := FLOOR(base * p_commission_rate)::INTEGER;
    total := base + fee;
    
    RETURN QUERY SELECT base, fee, total;
END;
$$ LANGUAGE plpgsql;

-- Пример использования:
-- SELECT * FROM calculate_stars(120, 'USD', 0.10);

-- =====================================================
-- Завершение
-- =====================================================

COMMENT ON DATABASE wishlist_gift IS 'База данных платформы Wishlist Gift';
COMMENT ON TABLE users IS 'Пользователи системы (модели и администраторы)';
COMMENT ON TABLE model_profiles IS 'Профили моделей с кастомизацией';
COMMENT ON TABLE wishlist_items IS 'Товары в вишлистах моделей';
COMMENT ON TABLE item_photos IS 'Фотографии товаров';
COMMENT ON TABLE transactions IS 'Транзакции покупки подарков';
COMMENT ON TABLE platform_settings IS 'Настройки платформы';
COMMENT ON TABLE admin_users IS 'Администраторы платформы';

