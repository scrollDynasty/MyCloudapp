-- Migration: Add service_plan_id to orders table
-- Date: 2025-10-17
-- Description: Adds support for service plans in orders

-- Add service_plan_id column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS service_plan_id INT NULL COMMENT 'ID тарифа из service_plans' AFTER vps_plan_id;

-- Add index for service_plan_id
ALTER TABLE orders 
ADD INDEX IF NOT EXISTS idx_service_plan (service_plan_id);

-- Add foreign key constraint (only if service_plans table exists)
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS fk_orders_service_plan 
FOREIGN KEY (service_plan_id) REFERENCES service_plans(id) 
ON DELETE SET NULL;

-- Modify vps_plan_id to allow NULL (since now we have two plan types)
ALTER TABLE orders 
MODIFY COLUMN vps_plan_id INT NULL COMMENT 'ID плана VPS';
