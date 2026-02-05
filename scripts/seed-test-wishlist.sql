-- Тестовый вишлист: модель и 5 товаров по 1 звезде для теста
UPDATE users SET first_name = 'Тестовая модель', updated_at = CURRENT_TIMESTAMP WHERE id = 1;

INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, item_status, is_active)
SELECT 1, 'Тестовый подарок 1', 'Подарок за 1 звезду для теста', 'https://wishliststars.com', 0.01, 'USD', 1, 0, 1, 'available', true
WHERE NOT EXISTS (SELECT 1 FROM wishlist_items WHERE model_id = 1 AND name = 'Тестовый подарок 1');

INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, item_status, is_active)
SELECT 1, 'Кофе в подарок', 'Чашка кофе — 1 ⭐', 'https://wishliststars.com', 0.01, 'USD', 1, 0, 1, 'available', true
WHERE NOT EXISTS (SELECT 1 FROM wishlist_items WHERE model_id = 1 AND name = 'Кофе в подарок');

INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, item_status, is_active)
SELECT 1, 'Стикерпак', 'Набор стикеров за 1 звезду', 'https://wishliststars.com', 0.01, 'USD', 1, 0, 1, 'available', true
WHERE NOT EXISTS (SELECT 1 FROM wishlist_items WHERE model_id = 1 AND name = 'Стикерпак');

INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, item_status, is_active)
SELECT 1, 'Видео-привет', 'Короткое видео — 1 ⭐', 'https://wishliststars.com', 0.01, 'USD', 1, 0, 1, 'available', true
WHERE NOT EXISTS (SELECT 1 FROM wishlist_items WHERE model_id = 1 AND name = 'Видео-привет');

INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, item_status, is_active)
SELECT 1, 'Мини-донат', 'Поддержать на 1 звезду', 'https://wishliststars.com', 0.01, 'USD', 1, 0, 1, 'available', true
WHERE NOT EXISTS (SELECT 1 FROM wishlist_items WHERE model_id = 1 AND name = 'Мини-донат');
