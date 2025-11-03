-- Migration: Add phone_number column to users table
-- Date: 2025-01-27
-- Description: Add phone authentication support for Uzbekistan numbers (+998)

-- Add phone_number column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE DEFAULT NULL 
AFTER email;

-- Add index for faster phone lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number 
ON users(phone_number);

-- Add last_login_at column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at DATETIME DEFAULT NULL 
AFTER updated_at;

-- Make email nullable for phone-only authentication
ALTER TABLE users 
MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;

-- Update oauth_provider to be nullable
ALTER TABLE users 
MODIFY COLUMN oauth_provider VARCHAR(50) DEFAULT NULL;

-- Add comment
ALTER TABLE users 
COMMENT = 'Users table with support for email and phone authentication';
