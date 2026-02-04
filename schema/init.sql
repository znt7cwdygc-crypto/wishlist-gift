-- Wishlist Gift - Инициализация БД для хранения всех данных
-- Выполнить: psql wishlist_gift < schema/init.sql

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'model',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Профили моделей
CREATE TABLE IF NOT EXISTS model_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    public_slug VARCHAR(16) UNIQUE,
    public_link VARCHAR(255),
    bio TEXT,
    banner_url TEXT,
    privacy_mode VARCHAR(20) DEFAULT 'public',
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
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    base_stars INTEGER NOT NULL,
    fee_stars INTEGER NOT NULL,
    total_stars INTEGER NOT NULL,
    photos JSONB DEFAULT '[]',
    item_status VARCHAR(20) DEFAULT 'available',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Заказы
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id INTEGER NOT NULL REFERENCES wishlist_items(id),
    model_id INTEGER NOT NULL REFERENCES users(id),
    donor_telegram_id BIGINT NOT NULL,
    donor_username VARCHAR(255),
    amount_xtr INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    reserved_at TIMESTAMP,
    reserved_until TIMESTAMP,
    telegram_payment_charge_id VARCHAR(255) UNIQUE,
    telegram_invoice_payload VARCHAR(255),
    gift_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_model ON wishlist_items(model_id);
CREATE INDEX IF NOT EXISTS idx_orders_item ON orders(item_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_reserved 
    ON orders(item_id) WHERE status IN ('created', 'reserved');

-- Доступ (allowlist)
CREATE TABLE IF NOT EXISTS wishlist_allowed_users (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES users(id),
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS wishlist_access_requests (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES users(id),
    requester_telegram_id BIGINT NOT NULL,
    requester_username VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_id, requester_telegram_id)
);

-- Инвайт-токены
CREATE TABLE IF NOT EXISTS invite_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    model_id INTEGER NOT NULL REFERENCES users(id),
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    allowed_telegram_id BIGINT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Простые донаты Stars (без вишлиста)
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload VARCHAR(255) UNIQUE NOT NULL,
    amount_xtr INTEGER NOT NULL,
    donor_telegram_id BIGINT NOT NULL,
    donor_username VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    telegram_payment_charge_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- Баланс
CREATE TABLE IF NOT EXISTS model_balances (
    model_id INTEGER PRIMARY KEY REFERENCES users(id),
    total_stars_earned INTEGER DEFAULT 0,
    available_for_withdrawal INTEGER DEFAULT 0,
    pending_21_days INTEGER DEFAULT 0,
    withdrawn INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Сид: дефолтный пользователь и профиль (требует явной вставки id для SERIAL)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = 1) THEN
        INSERT INTO users (id, telegram_id, username, first_name, role) 
        VALUES (1, 0, 'default', 'Модель', 'model');
        PERFORM setval(pg_get_serial_sequence('users', 'id'), 1);
    END IF;
END $$;

INSERT INTO model_profiles (user_id, public_slug, public_link, bio)
SELECT 1, 'me', 'me', 'Вишлист'
WHERE NOT EXISTS (SELECT 1 FROM model_profiles WHERE user_id = 1);

INSERT INTO model_balances (model_id) VALUES (1) ON CONFLICT (model_id) DO NOTHING;
