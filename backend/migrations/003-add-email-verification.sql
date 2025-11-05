-- Migration: Add email verification support
-- Date: 2025-01-28
-- Description: Add table for email verification tokens

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add verified_at column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified_at DATETIME DEFAULT NULL 
AFTER email_verified;

-- Add index for email_verified for faster queries
CREATE INDEX IF NOT EXISTS idx_users_email_verified 
ON users(email_verified);

-- Update existing Google OAuth users to have email_verified = TRUE
UPDATE users 
SET email_verified = TRUE, 
    verified_at = NOW() 
WHERE oauth_provider = 'google' 
AND email_verified IS NULL;

-- Add comment
ALTER TABLE email_verification_tokens 
COMMENT = 'Tokens for email verification with 10 minute expiry';

