const express = require('express');
const router = express.Router();
const db = require('../core/db/connection');
const { authenticate } = require('../core/utils/auth');
const crypto = require('crypto');

/**
 * @route   GET /api/cards
 * @desc    Get user's saved cards
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const cards = await db.query(
      `SELECT 
        id,
        card_token,
        card_last4,
        card_type,
        card_holder,
        exp_month,
        exp_year,
        is_default,
        created_at
      FROM user_cards
      WHERE user_id = ? AND is_active = 1
      ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: cards
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке карт'
    });
  }
});

/**
 * @route   POST /api/cards/payme-checkout-url
 * @desc    Generate Payme checkout URL for card binding
 * @access  Private
 */
router.post('/payme-checkout-url', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    const merchantId = process.env.PAYME_MERCHANT_ID;
    const returnUrl = `${process.env.RETURN_URL || 'https://apibilling.mycloud.uz'}/payment-success`;
    
    // Генерируем уникальный ID для транзакции
    const transactionId = `card_${userId}_${Date.now()}`;
    
    // Формируем параметры для Payme Checkout
    const params = {
      m: merchantId, // Merchant ID
      ac: {
        user_id: userId,
        transaction_id: transactionId
      },
      a: 1, // Минимальная сумма (1 тийин = 0.01 UZS) для привязки карты
      l: 'ru', // Язык
      c: returnUrl, // URL возврата после успеха
    };
    
    // Кодируем параметры в base64
    const encodedParams = Buffer.from(JSON.stringify(params)).toString('base64');
    
    // Генерируем URL для Payme Checkout
    const paymeUrl = `https://checkout.paycom.uz/${encodedParams}`;
    
    res.json({
      success: true,
      data: {
        url: paymeUrl,
        transaction_id: transactionId
      }
    });
  } catch (error) {
    console.error('Error creating Payme checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании checkout страницы'
    });
  }
});

/**
 * @route   POST /api/cards/save
 * @desc    Save card token after successful Payme binding
 * @access  Private
 */
router.post('/save', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { card_token, card_last4, card_type, card_holder, exp_month, exp_year } = req.body;

    if (!card_token) {
      return res.status(400).json({
        success: false,
        message: 'card_token обязателен'
      });
    }

    // Проверяем, не существует ли уже эта карта
    const existingCards = await db.query(
      'SELECT id FROM user_cards WHERE user_id = ? AND card_token = ? AND is_active = 1',
      [userId, card_token]
    );

    if (existingCards.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Эта карта уже добавлена'
      });
    }

    // Проверяем, первая ли это карта
    const userCards = await db.query(
      'SELECT id FROM user_cards WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    const isDefault = userCards.length === 0 ? 1 : 0;

    // Если это первая карта, делаем ее по умолчанию
    if (isDefault) {
      await db.query(
        'UPDATE user_cards SET is_default = 0 WHERE user_id = ? AND is_active = 1',
        [userId]
      );
    }

    // Определяем тип карты по last4, если не указан
    let finalCardType = card_type || 'unknown';
    if (card_last4 && !card_type) {
      // Пытаемся определить по префиксу (это примерная логика)
      if (card_last4.startsWith('8600')) finalCardType = 'Uzcard';
      else if (card_last4.startsWith('9860')) finalCardType = 'Humo';
      else if (card_last4.startsWith('4')) finalCardType = 'Visa';
      else if (card_last4.startsWith('5')) finalCardType = 'Mastercard';
    }

    // Вставляем карту
    const result = await db.query(
      `INSERT INTO user_cards (
        user_id,
        card_token,
        card_last4,
        card_type,
        card_holder,
        exp_month,
        exp_year,
        is_default,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        userId,
        card_token,
        card_last4 || '****',
        finalCardType,
        card_holder || `${finalCardType} ****${card_last4 || ''}`,
        exp_month || '12',
        exp_year || '2099',
        isDefault
      ]
    );

    // Получаем созданную карту
    const newCard = await db.query(
      `SELECT 
        id,
        card_token,
        card_last4,
        card_type,
        card_holder,
        is_default,
        created_at
      FROM user_cards
      WHERE id = ?`,
      [result.insertId]
    );

    // Логируем транзакцию
    await db.query(
      `INSERT INTO card_transactions (
        user_id,
        card_id,
        transaction_type,
        status
      ) VALUES (?, ?, 'add', 'success')`,
      [userId, result.insertId]
    );

    res.json({
      success: true,
      message: 'Карта успешно привязана',
      data: newCard && newCard.length > 0 ? newCard[0] : null
    });
  } catch (error) {
    console.error('Error saving card:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при сохранении карты'
    });
  }
});

/**
 * @route   DELETE /api/cards/:id
 * @desc    Remove a card
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const cardId = req.params.id;

    // Проверяем, принадлежит ли карта пользователю
    const cards = await db.query(
      'SELECT id, is_default FROM user_cards WHERE id = ? AND user_id = ? AND is_active = 1',
      [cardId, userId]
    );

    if (cards.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Карта не найдена'
      });
    }

    const wasDefault = cards[0].is_default;

    // Soft delete
    await db.query(
      'UPDATE user_cards SET is_active = 0, is_default = 0 WHERE id = ? AND user_id = ?',
      [cardId, userId]
    );

    // Если это была карта по умолчанию, делаем другую карту по умолчанию
    if (wasDefault) {
      const remainingCards = await db.query(
        'SELECT id FROM user_cards WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );

      if (remainingCards.length > 0) {
        await db.query(
          'UPDATE user_cards SET is_default = 1 WHERE id = ?',
          [remainingCards[0].id]
        );
      }
    }

    // Логируем транзакцию
    await db.query(
      `INSERT INTO card_transactions (
        user_id,
        card_id,
        transaction_type,
        status
      ) VALUES (?, ?, 'remove', 'success')`,
      [userId, cardId]
    );

    res.json({
      success: true,
      message: 'Карта успешно удалена'
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении карты'
    });
  }
});

/**
 * @route   PUT /api/cards/:id/default
 * @desc    Set card as default
 * @access  Private
 */
router.put('/:id/default', authenticate, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const cardId = req.params.id;

    // Проверяем, принадлежит ли карта пользователю
    const cards = await db.query(
      'SELECT id FROM user_cards WHERE id = ? AND user_id = ? AND is_active = 1',
      [cardId, userId]
    );

    if (cards.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Карта не найдена'
      });
    }

    // Снимаем флаг "по умолчанию" со всех карт
    await db.query(
      'UPDATE user_cards SET is_default = 0 WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    // Устанавливаем эту карту как по умолчанию
    await db.query(
      'UPDATE user_cards SET is_default = 1 WHERE id = ? AND user_id = ?',
      [cardId, userId]
    );

    res.json({
      success: true,
      message: 'Карта установлена по умолчанию'
    });
  } catch (error) {
    console.error('Error setting default card:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при установке карты по умолчанию'
    });
  }
});

module.exports = router;
