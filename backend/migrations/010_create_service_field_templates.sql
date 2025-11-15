-- Migration: Create service field templates and extend service plans
-- Date: 2025-11-15
-- Description: Introduces template-based dynamic fields for service types

CREATE TABLE IF NOT EXISTS service_field_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL COMMENT 'ID группы/типа сервиса',
  field_key VARCHAR(100) NOT NULL COMMENT 'Уникальный ключ поля в рамках группы',
  label_uz VARCHAR(255) NOT NULL COMMENT 'Название поля (UZ)',
  label_ru VARCHAR(255) NOT NULL COMMENT 'Название поля (RU)',
  description_uz TEXT COMMENT 'Описание/подсказка (UZ)',
  description_ru TEXT COMMENT 'Описание/подсказка (RU)',
  field_type VARCHAR(50) NOT NULL DEFAULT 'text' COMMENT 'text, number, select, date, price, boolean, textarea',
  options JSON COMMENT 'Список опций для select/choice (JSON массив)',
  is_required BOOLEAN NOT NULL DEFAULT false COMMENT 'Обязательно ли поле при заполнении',
  default_value VARCHAR(500) COMMENT 'Значение по умолчанию',
  unit_label VARCHAR(50) COMMENT 'Ед. измерения (например, MB/s)',
  min_value DECIMAL(18, 4) COMMENT 'Мин. значение (для чисел и цены)',
  max_value DECIMAL(18, 4) COMMENT 'Макс. значение (для чисел и цены)',
  display_order INT NOT NULL DEFAULT 0 COMMENT 'Порядок отображения',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_group_field_key (group_id, field_key),
  INDEX idx_group_order (group_id, display_order),
  CONSTRAINT fk_field_template_group
    FOREIGN KEY (group_id) REFERENCES service_groups(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Конструктор полей для шаблонов сервисов';

ALTER TABLE plan_fields
  ADD COLUMN IF NOT EXISTS definition_id INT NULL AFTER plan_id,
  ADD INDEX idx_plan_fields_definition (definition_id),
  ADD CONSTRAINT fk_plan_fields_definition
    FOREIGN KEY (definition_id) REFERENCES service_field_templates(id)
    ON DELETE SET NULL;

ALTER TABLE service_plans
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active' COMMENT 'draft, active, inactive, archived' AFTER billing_period,
  ADD COLUMN IF NOT EXISTS domain_name VARCHAR(255) NULL COMMENT 'Прикрепленный домен' AFTER status,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL COMMENT 'Служебные заметки администратора' AFTER domain_name;

