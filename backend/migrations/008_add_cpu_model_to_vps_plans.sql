-- Migration: Add cpu_model to vps_plans table
-- Date: 2025-11-12
-- Description: Adds CPU model/name field to VPS plans for better specifications

ALTER TABLE vps_plans 
ADD COLUMN IF NOT EXISTS cpu_model VARCHAR(255) NULL COMMENT 'Название/модель процессора' AFTER cpu_cores;
