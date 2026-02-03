-- =====================================================
-- Wishlist Gift - Схема V2: Публичный / По приглашению
-- Расширение к DATABASE_SCHEMA.sql
-- =====================================================

-- =====================================================
-- 1. Вишлисты (у модели один вишлист)
-- =====================================================

-- Добавляем колонки в model_profiles (если таблица уже есть)
ALTER TABLE model_profiles 
  ADD COLUMN IF NOT EXISTS public_slug VARCHAR(16) UNIQUE,
  ADD COLUMN IF NOT EXISTS privacy_mode VARCHAR(20) DEFAULT 'public' 
    CHECK (privacy_mode IN ('public', 'invite_token', 'allowlist'));

-- Генерируем public_slug для существующих (10-16 символов: a-z 0-9 _ -)
-- В приложении: генерация через nanoid/crypto.randomBytes

COMMENT ON COLUMN model_profiles.public_slug IS 'Короткий токен для ссылки t.me/bot?start=SLUG';
COMMENT ON COLUMN model_profiles.privacy_mode IS 'public | invite_token | allowlist';

-- =====================================================
-- 2. Статусы позиций вишлиста
-- =====================================================

ALTER TABLE wishlist_items 
  ADD COLUMN IF NOT EXISTS item_status VARCHAR(20) DEFAULT 'available'
    CHECK (item_status IN ('available', 'reserved', 'gifted'));

COMMENT ON COLUMN wishlist_items.item_status IS 'available | reserved (5-10 мин) | gifted';

-- =====================================================
-- 3. Заказы (ордера) — резерв + оплата
-- =====================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id INTEGER NOT NULL REFERENCES wishlist_items(id),
    model_id INTEGER NOT NULL REFERENCES users(id),
    donor_telegram_id BIGINT NOT NULL,
    donor_username VARCHAR(255),
    
    amount_xtr INTEGER NOT NULL CHECK (amount_xtr > 0),
    
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'reserved', 'paid', 'cancelled')),
    
    -- Резерв: 5-10 минут после создания инвойса
    reserved_at TIMESTAMP,
    reserved_until TIMESTAMP,
    
    -- Идемпотентность: по этому ID не начисляем дважды
    telegram_payment_charge_id VARCHAR(255) UNIQUE,
    telegram_invoice_payload VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- Только один активный резерв на позицию
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_reservation_per_item 
    ON orders(item_id) WHERE status IN ('created', 'reserved');

-- Один item — один активный заказ (reserved/created). gifted = item уже подарен
CREATE INDEX IF NOT EXISTS idx_orders_item_id ON orders(item_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_telegram_charge ON orders(telegram_payment_charge_id);
CREATE INDEX IF NOT EXISTS idx_orders_reserved_until ON orders(reserved_until) WHERE status = 'reserved';

COMMENT ON TABLE orders IS 'Заказы: резерв позиции + фиксация оплаты Stars';

-- =====================================================
-- 4. Invite-токены (схема 2.1 — одноразовая ссылка)
-- =====================================================

CREATE TABLE IF NOT EXISTS invite_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    model_id INTEGER NOT NULL REFERENCES users(id),
    
    max_uses INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    
    -- Опционально: токен только для конкретного пользователя
    allowed_telegram_id BIGINT,
    
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_model ON invite_tokens(model_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON invite_tokens(expires_at);

COMMENT ON TABLE invite_tokens IS 'Одноразовые токены для приватного вишлиста (схема 2.1)';

-- =====================================================
-- 5. Allowlist (схема 2.2 — владелец утверждает доступ)
-- =====================================================

CREATE TABLE IF NOT EXISTS wishlist_allowed_users (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES users(id),
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(model_id, telegram_id)
);

-- Запросы на доступ (пока владелец не одобрил)
CREATE TABLE IF NOT EXISTS wishlist_access_requests (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES users(id),
    requester_telegram_id BIGINT NOT NULL,
    requester_username VARCHAR(255),
    
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    
    UNIQUE(model_id, requester_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_allowed_users_model ON wishlist_allowed_users(model_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_model ON wishlist_access_requests(model_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON wishlist_access_requests(status);

COMMENT ON TABLE wishlist_allowed_users IS 'Разрешённые дарители (схема 2.2 allowlist)';
COMMENT ON TABLE wishlist_access_requests IS 'Запросы доступа к приватному вишлисту';

-- =====================================================
-- 6. Баланс владельца (Stars: всего / доступно / в ожидании)
-- =====================================================

CREATE TABLE IF NOT EXISTS model_balances (
    model_id INTEGER PRIMARY KEY REFERENCES users(id),
    total_stars_earned INTEGER DEFAULT 0,
    available_for_withdrawal INTEGER DEFAULT 0,
    pending_21_days INTEGER DEFAULT 0,
    withdrawn INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stars становятся available через 21 день
-- Минималка на вывод (часто 1000 Stars) — в platform_settings

COMMENT ON TABLE model_balances IS 'Баланс модели: total / available / pending (21 days)';

-- =====================================================
-- 7. Функция: проверка доступа к вишлисту
-- =====================================================

CREATE OR REPLACE FUNCTION check_wishlist_access(
    p_model_id INTEGER,
    p_visitor_telegram_id BIGINT,
    p_invite_token VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    has_access BOOLEAN,
    access_type VARCHAR(20),
    message TEXT
) AS $$
DECLARE
    v_privacy VARCHAR(20);
    v_slug VARCHAR(16);
BEGIN
    SELECT privacy_mode, public_slug INTO v_privacy, v_slug
    FROM model_profiles WHERE user_id = p_model_id;
    
    IF v_privacy IS NULL OR v_privacy = 'public' THEN
        RETURN QUERY SELECT true, 'public'::VARCHAR, NULL::TEXT;
        RETURN;
    END IF;
    
    IF v_privacy = 'invite_token' AND p_invite_token IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM invite_tokens it
            WHERE it.token = p_invite_token AND it.model_id = p_model_id
              AND it.expires_at > NOW() AND it.used_count < it.max_uses
              AND (it.allowed_telegram_id IS NULL OR it.allowed_telegram_id = p_visitor_telegram_id)
        ) THEN
            RETURN QUERY SELECT true, 'invite_token'::VARCHAR, NULL::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT false, 'invite_expired'::VARCHAR, 'Ссылка устарела. Попросите новую у владельца.'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    IF v_privacy = 'allowlist' THEN
        IF EXISTS (SELECT 1 FROM wishlist_allowed_users WHERE model_id = p_model_id AND telegram_id = p_visitor_telegram_id) THEN
            RETURN QUERY SELECT true, 'allowlist'::VARCHAR, NULL::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT false, 'request_access'::VARCHAR, 'Это приватный вишлист. Запросить доступ?'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    RETURN QUERY SELECT false, 'no_access'::VARCHAR, 'Доступ закрыт'::TEXT;
END;
$$ LANGUAGE plpgsql;
