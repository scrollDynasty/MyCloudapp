-- Create user_cards table for storing tokenized card information

CREATE TABLE IF NOT EXISTS user_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_token VARCHAR(255) NOT NULL COMMENT 'Tokenized card reference from Payme',
  card_last4 VARCHAR(4) NOT NULL COMMENT 'Last 4 digits of card',
  card_type ENUM('Uzcard', 'Humo', 'Visa', 'Mastercard') NOT NULL DEFAULT 'Uzcard',
  card_holder VARCHAR(255) DEFAULT NULL COMMENT 'Cardholder name',
  exp_month VARCHAR(2) DEFAULT NULL COMMENT 'Expiry month',
  exp_year VARCHAR(4) DEFAULT NULL COMMENT 'Expiry year',
  is_default TINYINT(1) DEFAULT 0 COMMENT 'Is this the default payment method',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'Soft delete flag',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_cards_user_id (user_id),
  INDEX idx_user_cards_active (is_active),
  UNIQUE KEY unique_active_card (user_id, card_last4, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create card_transactions table for logging card operations
CREATE TABLE IF NOT EXISTS card_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_id INT,
  transaction_type ENUM('verify', 'charge', 'refund') NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'UZS',
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  payme_transaction_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES user_cards(id) ON DELETE SET NULL,
  INDEX idx_card_transactions_user_id (user_id),
  INDEX idx_card_transactions_card_id (card_id),
  INDEX idx_card_transactions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

