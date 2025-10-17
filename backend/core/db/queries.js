/**
 * SQL Queries для VPS Billing System
 * Все запросы собраны здесь для удобства и читабельности
 */

// ============================================
// USER QUERIES (Пользователи)
// ============================================

// Проверка существования пользователя по email
const CHECK_USER_EXISTS = 'SELECT id FROM users WHERE email = ?';

// Получение полной информации о пользователе
const GET_USER_BY_EMAIL = 'SELECT * FROM users WHERE email = ?';

// Получение пользователя по ID
const GET_USER_BY_ID = 'SELECT id, username, email, first_name, last_name, role, company_name, status FROM users WHERE id = ?';

// Создание нового пользователя
const CREATE_USER = `
  INSERT INTO users 
  (username, email, password_hash, first_name, last_name, phone, role, 
   company_name, tax_id, legal_address, oauth_provider, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
`;

// Обновление времени последнего входа
const UPDATE_LAST_LOGIN = 'UPDATE users SET last_login_at = NOW() WHERE id = ?';

// Обновление информации о пользователе
const UPDATE_USER = `
  UPDATE users 
  SET first_name = ?, last_name = ?, phone = ?, company_name = ?, 
      tax_id = ?, legal_address = ?, updated_at = NOW()
  WHERE id = ?
`;

// Получение всех пользователей (для админа)
const GET_ALL_USERS = `
  SELECT id, username, email, first_name, last_name, role, 
         company_name, status, created_at, last_login_at
  FROM users
  ORDER BY created_at DESC
`;

// ============================================
// VPS PLAN QUERIES (Тарифные планы VPS)
// ============================================

// Получение списка VPS планов с пагинацией
const GET_VPS_PLANS = `
  SELECT 
    v.plan_id, v.provider, v.plan_name, v.cpu_cores, v.ram_gb, 
    v.storage_gb, v.storage_type, v.bandwidth, v.price_per_month, 
    v.currency, v.location, v.virtualization, v.support_level,
    p.description, p.website_url, p.country
  FROM vps_plans v
  LEFT JOIN providers p ON v.provider = p.name
  WHERE 1=1
`;

// Подсчет общего количества VPS планов
const COUNT_VPS_PLANS = 'SELECT COUNT(*) as total FROM vps_plans WHERE 1=1';

// Получение одного VPS плана по ID
const GET_VPS_PLAN_BY_ID = `
  SELECT 
    v.plan_id, v.provider, v.plan_name, v.cpu_cores, v.ram_gb, 
    v.storage_gb, v.storage_type, v.bandwidth, v.price_per_month, 
    v.currency, v.location, v.virtualization, v.support_level,
    v.created_at, v.updated_at,
    p.description, p.website_url, p.country
  FROM vps_plans v
  LEFT JOIN providers p ON v.provider = p.name
  WHERE v.plan_id = ?
`;

// Получение уникальных провайдеров
const GET_UNIQUE_PROVIDERS = `
  SELECT DISTINCT
    v.provider,
    p.description,
    p.website_url,
    p.country
  FROM vps_plans v
  LEFT JOIN providers p ON v.provider = p.name
  ORDER BY v.provider
`;

// Получение уникальных локаций
const GET_UNIQUE_LOCATIONS = `
  SELECT DISTINCT
    location
  FROM vps_plans
  WHERE location IS NOT NULL
  ORDER BY location
`;

// ============================================
// ORDER QUERIES (Заказы)
// ============================================

// Получение заказов пользователя
const GET_USER_ORDERS = `
  SELECT 
    o.id, o.user_id, o.vps_plan_id, o.status, o.amount, o.currency,
    o.notes, o.payment_method, o.payment_status, o.payme_transaction_id,
    o.created_at, o.updated_at,
    v.plan_name, v.provider, v.cpu_cores, v.ram_gb, v.storage_gb
  FROM orders o
  LEFT JOIN vps_plans v ON o.vps_plan_id = v.plan_id
  WHERE o.user_id = ?
  ORDER BY o.created_at DESC
  LIMIT ? OFFSET ?
`;

// Подсчет заказов пользователя
const COUNT_USER_ORDERS = 'SELECT COUNT(*) as total FROM orders WHERE user_id = ?';

// Получение всех заказов (для админа)
const GET_ALL_ORDERS = `
  SELECT 
    o.id, o.user_id, o.vps_plan_id, o.status, o.amount, o.currency,
    o.notes, o.payment_method, o.payment_status,
    o.created_at, o.updated_at,
    u.email, u.first_name, u.last_name, u.role,
    v.plan_name, v.provider
  FROM orders o
  LEFT JOIN users u ON o.user_id = u.id
  LEFT JOIN vps_plans v ON o.vps_plan_id = v.plan_id
  ORDER BY o.created_at DESC
  LIMIT ? OFFSET ?
`;

// Подсчет всех заказов
const COUNT_ALL_ORDERS = 'SELECT COUNT(*) as total FROM orders';

// Получение одного заказа по ID
const GET_ORDER_BY_ID = `
  SELECT 
    o.id, o.user_id, o.vps_plan_id, o.status, o.amount, o.currency,
    o.notes, o.payment_method, o.payment_status, o.payme_transaction_id,
    o.created_at, o.updated_at,
    v.plan_name, v.provider, v.cpu_cores, v.ram_gb, v.storage_gb,
    v.price_per_month
  FROM orders o
  LEFT JOIN vps_plans v ON o.vps_plan_id = v.plan_id
  WHERE o.id = ?
`;

// Создание нового заказа
const CREATE_ORDER = `
  INSERT INTO orders 
  (user_id, vps_plan_id, status, amount, currency, notes, created_at, updated_at)
  VALUES (?, ?, 'pending', ?, ?, ?, NOW(), NOW())
`;

// Обновление статуса заказа
const UPDATE_ORDER_STATUS = `
  UPDATE orders 
  SET status = ?, notes = COALESCE(?, notes), updated_at = NOW() 
  WHERE id = ?
`;

// Обновление метода оплаты
const UPDATE_ORDER_PAYMENT_METHOD = `
  UPDATE orders 
  SET payment_method = ?, updated_at = NOW() 
  WHERE id = ?
`;

// ============================================
// PAYMENT QUERIES (Платежи - Payme)
// ============================================

// Получение заказа для оплаты
const GET_ORDER_FOR_PAYMENT = `
  SELECT 
    o.id, o.user_id, o.vps_plan_id, o.amount, o.currency, o.status,
    o.payment_status, o.payment_method,
    v.plan_name, v.provider
  FROM orders o
  LEFT JOIN vps_plans v ON o.vps_plan_id = v.plan_id
  WHERE o.id = ?
`;

// Получение заказа по ID для проверки платежа
const GET_ORDER_FOR_PAYMENT_CHECK = `
  SELECT id, amount, currency, payment_status 
  FROM orders 
  WHERE id = ?
`;

// Проверка существования транзакции Payme
const CHECK_PAYME_TRANSACTION = `
  SELECT id FROM orders 
  WHERE payme_transaction_id = ?
`;

// Создание транзакции Payme
const CREATE_PAYME_TRANSACTION = `
  UPDATE orders 
  SET payme_transaction_id = ?,
      payme_transaction_time = ?,
      payment_status = 'pending',
      updated_at = NOW()
  WHERE id = ?
`;

// Подтверждение оплаты Payme
const CONFIRM_PAYME_PAYMENT = `
  UPDATE orders 
  SET payment_status = 'completed',
      payme_perform_time = ?,
      status = 'confirmed',
      updated_at = NOW()
  WHERE payme_transaction_id = ?
`;

// Отмена транзакции Payme
const CANCEL_PAYME_TRANSACTION = `
  UPDATE orders 
  SET payment_status = 'cancelled',
      payme_cancel_time = ?,
      updated_at = NOW()
  WHERE payme_transaction_id = ?
`;

// Получение транзакции Payme
const GET_PAYME_TRANSACTION = `
  SELECT id, payme_transaction_time 
  FROM orders 
  WHERE payme_transaction_id = ?
`;

// Получение информации о платеже для отмены
const GET_PAYME_PAYMENT_INFO = `
  SELECT id, payment_status, payme_transaction_time 
  FROM orders 
  WHERE payme_transaction_id = ?
`;

// ============================================
// SERVICE GROUPS QUERIES (Группы сервисов)
// ============================================

// Получение всех групп сервисов
const GET_SERVICE_GROUPS = `
  SELECT *
  FROM service_groups
  WHERE is_active = true
  ORDER BY display_order ASC
`;

// Получение одной группы по ID
const GET_SERVICE_GROUP_BY_ID = `
  SELECT *
  FROM service_groups
  WHERE id = ? AND is_active = true
`;

// Получение одной группы по slug
const GET_SERVICE_GROUP_BY_SLUG = `
  SELECT *
  FROM service_groups
  WHERE slug = ? AND is_active = true
`;

// ============================================
// SERVICE PLANS QUERIES (Тарифы)
// ============================================

// Получение всех тарифов группы
const GET_SERVICE_PLANS_BY_GROUP = `
  SELECT 
    sp.*,
    sg.name_uz as group_name_uz,
    sg.name_ru as group_name_ru
  FROM service_plans sp
  JOIN service_groups sg ON sp.group_id = sg.id
  WHERE sp.group_id = ? AND sp.is_active = true
  ORDER BY sp.display_order ASC
`;

// Получение одного тарифа по ID
const GET_SERVICE_PLAN_BY_ID = `
  SELECT 
    sp.*,
    sg.name_uz as group_name_uz,
    sg.name_ru as group_name_ru,
    sg.slug as group_slug
  FROM service_plans sp
  JOIN service_groups sg ON sp.group_id = sg.id
  WHERE sp.id = ? AND sp.is_active = true
`;

// Получение полей тарифа
const GET_PLAN_FIELDS = `
  SELECT *
  FROM plan_fields
  WHERE plan_id = ?
  ORDER BY display_order ASC
`;

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // User queries
  CHECK_USER_EXISTS,
  GET_USER_BY_EMAIL,
  GET_USER_BY_ID,
  CREATE_USER,
  UPDATE_LAST_LOGIN,
  UPDATE_USER,
  GET_ALL_USERS,
  
  // VPS plan queries
  GET_VPS_PLANS,
  COUNT_VPS_PLANS,
  GET_VPS_PLAN_BY_ID,
  GET_UNIQUE_PROVIDERS,
  GET_UNIQUE_LOCATIONS,
  
  // Order queries
  GET_USER_ORDERS,
  COUNT_USER_ORDERS,
  GET_ALL_ORDERS,
  COUNT_ALL_ORDERS,
  GET_ORDER_BY_ID,
  CREATE_ORDER,
  UPDATE_ORDER_STATUS,
  UPDATE_ORDER_PAYMENT_METHOD,
  
  // Payment queries
  GET_ORDER_FOR_PAYMENT,
  GET_ORDER_FOR_PAYMENT_CHECK,
  CHECK_PAYME_TRANSACTION,
  CREATE_PAYME_TRANSACTION,
  CONFIRM_PAYME_PAYMENT,
  CANCEL_PAYME_TRANSACTION,
  GET_PAYME_TRANSACTION,
  GET_PAYME_PAYMENT_INFO,
  
  // Service groups queries
  GET_SERVICE_GROUPS,
  GET_SERVICE_GROUP_BY_ID,
  GET_SERVICE_GROUP_BY_SLUG,
  
  // Service plans queries
  GET_SERVICE_PLANS_BY_GROUP,
  GET_SERVICE_PLAN_BY_ID,
  GET_PLAN_FIELDS
};
