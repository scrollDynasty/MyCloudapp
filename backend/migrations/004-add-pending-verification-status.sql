-- Migration: Add pending_verification to users.status enum
-- Date: 2025-01-28
-- Description: Add 'pending_verification' status for email verification flow

ALTER TABLE users 
MODIFY COLUMN status ENUM('active','inactive','banned','pending_verification') 
DEFAULT 'active';

