/**
 * Database Setup Script for Service Groups Feature
 * Creates tables for service groups and their plans
 */

const mysql = require('mysql2/promise');
const { dbConfig } = require('../core/config/database-extended');

const serializeOptions = (options) => {
  if (!options || !options.length) {
    return null;
  }
  return JSON.stringify(options);
};

async function createTemplateBundle(connection, groupId, definitions) {
  const templates = {};
  for (const def of definitions) {
    const [result] = await connection.execute(
      `
        INSERT INTO service_field_templates
        (group_id, field_key, label_uz, label_ru, description_uz, description_ru, field_type,
         options, is_required, default_value, unit_label, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        groupId,
        def.field_key,
        def.label_uz,
        def.label_ru,
        def.description_uz || null,
        def.description_ru || null,
        def.field_type || 'text',
        serializeOptions(def.options),
        def.is_required ? 1 : 0,
        def.default_value || null,
        def.unit_label || null,
        def.display_order || 0,
      ]
    );

    templates[def.field_key] = { ...def, id: result.insertId };
  }

  return templates;
}

async function insertFieldFromTemplate(connection, planId, template, values = {}) {
  await connection.execute(
    `
      INSERT INTO plan_fields
      (plan_id, definition_id, field_key, field_label_uz, field_label_ru, field_value_uz, field_value_ru, field_type, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      planId,
      template ? template.id : null,
      template ? template.field_key : values.field_key,
      template ? template.label_uz : values.field_label_uz,
      template ? template.label_ru : values.field_label_ru,
      values.field_value_uz || values.field_value || null,
      values.field_value_ru || values.field_value || null,
      template ? template.field_type : values.field_type || 'text',
      values.display_order ?? template?.display_order ?? 0,
    ]
  );
}

async function setupServiceGroupsTables() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Create service_groups table
    console.log('Creating service_groups table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS service_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name_uz VARCHAR(255) NOT NULL COMMENT 'Название на узбекском',
        name_ru VARCHAR(255) NOT NULL COMMENT 'Название на русском',
        description_uz TEXT COMMENT 'Описание на узбекском',
        description_ru TEXT COMMENT 'Описание на русском',
        slug VARCHAR(255) UNIQUE NOT NULL COMMENT 'URL slug',
        icon VARCHAR(255) COMMENT 'Иконка группы',
        display_order INT DEFAULT 0 COMMENT 'Порядок отображения',
        is_active BOOLEAN DEFAULT true COMMENT 'Активна ли группа',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_active_order (is_active, display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Группы сервисов (MC Video, SSL, VPS и т.д.)'
    `);
    console.log('✅ service_groups table created');

    // Create service_plans table (новая версия с связью к группам)
    console.log('Creating service_plans table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS service_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL COMMENT 'ID группы сервисов',
        name_uz VARCHAR(255) NOT NULL COMMENT 'Название тарифа на узбекском',
        name_ru VARCHAR(255) NOT NULL COMMENT 'Название тарифа на русском',
        description_uz TEXT COMMENT 'Описание на узбекском',
        description_ru TEXT COMMENT 'Описание на русском',
        price DECIMAL(12, 2) NOT NULL COMMENT 'Цена',
        discount_price DECIMAL(12, 2) COMMENT 'Цена со скидкой',
        currency VARCHAR(10) DEFAULT 'UZS' COMMENT 'Валюта',
        billing_period VARCHAR(50) DEFAULT 'monthly' COMMENT 'Период оплаты: monthly, yearly, once',
        status VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT 'draft, active, inactive, archived',
        domain_name VARCHAR(255) COMMENT 'Прикрепленный домен',
        notes TEXT COMMENT 'Служебные заметки CRM',
        display_order INT DEFAULT 0 COMMENT 'Порядок отображения',
        is_active BOOLEAN DEFAULT true COMMENT 'Активен ли тариф',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES service_groups(id) ON DELETE CASCADE,
        INDEX idx_group_active (group_id, is_active),
        INDEX idx_group_order (group_id, display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Тарифы внутри групп сервисов'
    `);
    console.log('✅ service_plans table created');

    console.log('Creating service_field_templates table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS service_field_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL COMMENT 'ID группы/типа сервиса',
        field_key VARCHAR(100) NOT NULL COMMENT 'Уникальный ключ поля',
        label_uz VARCHAR(255) NOT NULL COMMENT 'Название поля (UZ)',
        label_ru VARCHAR(255) NOT NULL COMMENT 'Название поля (RU)',
        description_uz TEXT COMMENT 'Описание (UZ)',
        description_ru TEXT COMMENT 'Описание (RU)',
        field_type VARCHAR(50) NOT NULL DEFAULT 'text' COMMENT 'text, number, select, date, price, boolean, textarea',
        options JSON COMMENT 'Опции для select (JSON массив)',
        is_required BOOLEAN NOT NULL DEFAULT false COMMENT 'Обязательность поля',
        default_value VARCHAR(500) COMMENT 'Значение по умолчанию',
        unit_label VARCHAR(50) COMMENT 'Ед. измерения',
        display_order INT NOT NULL DEFAULT 0 COMMENT 'Порядок отображения',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_group_field_key (group_id, field_key),
        INDEX idx_group_order (group_id, display_order),
        FOREIGN KEY (group_id) REFERENCES service_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Шаблоны полей для разных типов сервисов'
    `);
    console.log('✅ service_field_templates table created');

    // Create plan_fields table (динамические поля для тарифов)
    console.log('Creating plan_fields table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS plan_fields (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL COMMENT 'ID тарифа',
        definition_id INT NULL COMMENT 'ID шаблона поля',
        field_key VARCHAR(100) NOT NULL COMMENT 'Ключ поля (cpu, ram, resolution и т.д.)',
        field_label_uz VARCHAR(255) NOT NULL COMMENT 'Название поля на узбекском',
        field_label_ru VARCHAR(255) NOT NULL COMMENT 'Название поля на русском',
        field_value_uz TEXT COMMENT 'Значение на узбекском',
        field_value_ru TEXT COMMENT 'Значение на русском',
        field_type VARCHAR(50) DEFAULT 'text' COMMENT 'Тип поля: text, number, list, boolean',
        display_order INT DEFAULT 0 COMMENT 'Порядок отображения',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES service_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (definition_id) REFERENCES service_field_templates(id) ON DELETE SET NULL,
        INDEX idx_plan_key (plan_id, field_key),
        INDEX idx_plan_order (plan_id, display_order),
        INDEX idx_plan_definition (definition_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Динамические поля характеристик для тарифов'
    `);
    console.log('✅ plan_fields table created');

    // Insert sample data for testing
    console.log('Inserting sample data...');
    
    // Sample group 1: MC Video
    const [mcVideoGroup] = await connection.execute(`
      INSERT INTO service_groups (name_uz, name_ru, slug, display_order, is_active)
      VALUES ('MC Video', 'MC Video', 'mc-video', 1, true)
    `);
    const mcVideoGroupId = mcVideoGroup.insertId;

    // Sample group 2: SSL Certificates
    const [sslGroup] = await connection.execute(`
      INSERT INTO service_groups (name_uz, name_ru, slug, display_order, is_active)
      VALUES ('SSL Sertifikatlari', 'SSL Сертификаты', 'ssl-certificates', 2, true)
    `);
    const sslGroupId = sslGroup.insertId;

    // Sample group 3: VPS
    const [vpsGroup] = await connection.execute(`
      INSERT INTO service_groups (name_uz, name_ru, slug, display_order, is_active)
      VALUES ('VPS', 'VPS', 'vps', 3, true)
    `);
    const vpsGroupId = vpsGroup.insertId;

    // Sample plan for MC Video
    const [mcPlan] = await connection.execute(`
      INSERT INTO service_plans (group_id, name_uz, name_ru, price, discount_price, billing_period, display_order, is_active)
      VALUES (?, 'NVR-D-720-30', 'NVR-D-720-30', 60000, 49000, 'monthly', 1, true)
    `, [mcVideoGroupId]);
    const mcPlanId = mcPlan.insertId;

    // Fields for MC Video plan
    await connection.execute(`
      INSERT INTO plan_fields (plan_id, field_key, field_label_uz, field_label_ru, field_value_uz, field_value_ru, display_order)
      VALUES 
        (?, 'resolution', 'Ruxsatnoma', 'Разрешение', '720P', '720P', 1),
        (?, 'bandwidth', 'Kanal kengligi', 'Ширина канала', '1 Mbit/s', '1 Mbit/s', 2),
        (?, 'storage_type', 'Videoarxiv saqlash', 'Хранение видеоархива', 'Yozuv detektsiyasi bo''yicha', 'Запись по детекции', 3),
        (?, 'retention', 'Kameralar yozuvlarini saqlash', 'Хранение записей с камер', '30 kun', '30 дней', 4)
    `, [mcPlanId, mcPlanId, mcPlanId, mcPlanId]);

    // Sample plan for SSL
    const [sslPlan] = await connection.execute(`
      INSERT INTO service_plans (group_id, name_uz, name_ru, price, billing_period, display_order, is_active)
      VALUES (?, 'AlphaSSL Wildcard', 'AlphaSSL Wildcard', 1250000, 'yearly', 1, true)
    `, [sslGroupId]);
    const sslPlanId = sslPlan.insertId;

    // Fields for SSL plan
    await connection.execute(`
      INSERT INTO plan_fields (plan_id, field_key, field_label_uz, field_label_ru, field_value_uz, field_value_ru, field_type, display_order)
      VALUES 
        (?, 'features', 'Xususiyatlari', 'Характеристики', 'Wildcard himoya, 256-bit shifrlash', 'Wildcard защита, 256-битное шифрование', 'list', 1)
    `, [sslPlanId]);

    // Sample plan for VPS
    const [vpsPlan] = await connection.execute(`
      INSERT INTO service_plans (group_id, name_uz, name_ru, price, billing_period, display_order, is_active)
      VALUES (?, 'VPS-25', 'VPS-25', 142500, 'monthly', 1, true)
    `, [vpsGroupId]);
    const vpsPlanId = vpsPlan.insertId;

    // Fields for VPS plan
    await connection.execute(`
      INSERT INTO plan_fields (plan_id, field_key, field_label_uz, field_label_ru, field_value_uz, field_value_ru, display_order)
      VALUES 
        (?, 'cpu', 'Protsessor', 'Процессор', 'Intel Xeon Gold CPU - 3,5GHz (1-vCore)', 'Intel Xeon Gold CPU - 3,5GHz (1-vCore)', 1),
        (?, 'ram', 'Xotira', 'Память RAM', '1 GB', '1 GB', 2),
        (?, 'disk', 'Disk', 'Диск SSD', '25 GB', '25 GB', 3),
        (?, 'internet', 'Internet', 'Интернет', '100 Mb/s gacha', '100 Mb/s', 4),
        (?, 'tas_ix', 'TAS-IX', 'TAS-IX', '100 Mb/s gacha', '100 Mb/s', 5),
        (?, 'ip', 'IP Manzil', 'IP адреса', '1', '1', 6),
        (?, 'os', 'Operatsion tizim', 'Операционная система', '🐧 Linux / 💻 Windows', '🐧 Linux / 💻 Windows', 7)
    `, [vpsPlanId, vpsPlanId, vpsPlanId, vpsPlanId, vpsPlanId, vpsPlanId, vpsPlanId]);

    console.log('✅ Sample data inserted');
    console.log('\n📊 Summary:');
    console.log('  - Created 3 service groups');
    console.log('  - Created 3 sample plans');
    console.log('  - Added dynamic fields for each plan');
    console.log('\n✅ Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run the setup
if (require.main === module) {
  setupServiceGroupsTables()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to setup database:', error);
      process.exit(1);
    });
}

module.exports = { setupServiceGroupsTables };
