const express = require('express');
const router = express.Router();
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

// Создать новый тикет (пользователь)
router.post('/', authenticate, async (req, res) => {
  const logPrefix = 'POST /api/tickets';
  
  try {
    const { subject, message, phone } = req.body;
    const userId = req.user.id;

    // Валидация
    if (!subject || !message || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля: тема, сообщение и номер телефона'
      });
    }

    // Валидация номера телефона (базовая)
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат номера телефона'
      });
    }

    // Создаем тикет
    const result = await db.query(
      `INSERT INTO tickets (user_id, subject, message, phone, status) 
       VALUES (?, ?, ?, ?, 'open')`,
      [userId, subject, message, phone]
    );

    res.status(201).json({
      success: true,
      message: 'Тикет успешно создан',
      data: {
        id: result.insertId,
        subject,
        message,
        phone,
        status: 'open',
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании тикета'
    });
  }
});

// Получить все тикеты пользователя
router.get('/my', authenticate, async (req, res) => {
  const logPrefix = 'GET /api/tickets/my';
  
  try {
    const userId = req.user.id;

    const tickets = await db.query(
      `SELECT 
        t.id,
        t.subject,
        t.message,
        t.phone,
        t.status,
        t.created_at,
        t.updated_at,
        t.answered_at
       FROM tickets t
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке тикетов'
    });
  }
});

// Получить все тикеты (админ)
router.get('/', authenticate, adminOnly, async (req, res) => {
  const logPrefix = 'GET /api/tickets';
  
  try {
    const { status, sort = 'desc' } = req.query;

    let query = `
      SELECT 
        t.id,
        t.user_id,
        t.subject,
        t.message,
        t.phone,
        t.status,
        t.created_at,
        t.updated_at,
        t.answered_at,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as full_name,
        u.email
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
    `;

    const params = [];

    // Фильтр по статусу
    if (status && ['open', 'answered', 'closed'].includes(status)) {
      query += ' WHERE t.status = ?';
      params.push(status);
    }

    // Сортировка по дате
    query += ` ORDER BY t.created_at ${sort === 'asc' ? 'ASC' : 'DESC'}`;

    const tickets = await db.query(query, params);

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке тикетов'
    });
  }
});

// Получить один тикет (админ или владелец)
router.get('/:id', authenticate, async (req, res) => {
  const logPrefix = `GET /api/tickets/${req.params.id}`;
  
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const isAdminUser = req.user.role === 'admin';

    const tickets = await db.query(
      `SELECT 
        t.id,
        t.user_id,
        t.subject,
        t.message,
        t.phone,
        t.status,
        t.created_at,
        t.updated_at,
        t.answered_at,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as full_name,
        u.email
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Тикет не найден'
      });
    }

    const ticket = tickets[0];

    // Проверка прав доступа
    if (!isAdminUser && ticket.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Доступ запрещен'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке тикета'
    });
  }
});

// Обновить статус тикета (админ)
router.patch('/:id/status', authenticate, adminOnly, async (req, res) => {
  const logPrefix = `PATCH /api/tickets/${req.params.id}/status`;
  
  try {
    const ticketId = req.params.id;
    const { status } = req.body;

    // Валидация статуса
    if (!['open', 'answered', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус. Допустимые значения: open, answered, closed'
      });
    }

    // Проверяем существование тикета
    const tickets = await db.query('SELECT id, status FROM tickets WHERE id = ?', [ticketId]);
    
    if (tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Тикет не найден'
      });
    }

    // Обновляем статус
    const updateFields = ['status = ?'];
    const updateParams = [status];

    // Если меняем на "answered", устанавливаем answered_at
    if (status === 'answered' && tickets[0].status !== 'answered') {
      updateFields.push('answered_at = NOW()');
    }

    updateParams.push(ticketId);

    await db.query(
      `UPDATE tickets SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    res.json({
      success: true,
      message: 'Статус тикета обновлен',
      data: { id: ticketId, status }
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса'
    });
  }
});

// Удалить тикет (админ)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  const logPrefix = `DELETE /api/tickets/${req.params.id}`;
  
  try {
    const ticketId = req.params.id;

    const result = await db.query('DELETE FROM tickets WHERE id = ?', [ticketId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Тикет не найден'
      });
    }

    res.json({
      success: true,
      message: 'Тикет удален'
    });
  } catch (error) {
    console.error(`❌ ${logPrefix} - 500:`, error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении тикета'
    });
  }
});

module.exports = router;

