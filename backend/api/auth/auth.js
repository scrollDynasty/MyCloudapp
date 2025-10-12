const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('../../core/db/connection');
const { generateToken, authenticate, adminOnly, adminOrSelf } = require('../../core/utils/auth');
const SQL = require('../../core/db/queries');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const {
      email,
      password,
      full_name,
      phone,
      role,
      company_name,
      tax_id,
      legal_address
    } = req.body;

    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['email', 'password', 'full_name']
      });
    }
    
    // Split full_name into first_name and last_name
    const nameParts = full_name.trim().split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || nameParts[0];

    // Validate role
    const validRoles = ['individual', 'legal_entity'];
    const userRole = role || 'individual';
    
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        allowed_roles: validRoles
      });
    }

    // Check if user already exists
    const existing = await db.query(SQL.CHECK_USER_EXISTS, [email]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate username from email
    const username = email.split('@')[0] + '_' + Date.now();

    // Create user
    const result = await db.query(SQL.CREATE_USER, [
      username,
      email,
      passwordHash,
      first_name,
      last_name,
      phone || null,
      userRole,
      company_name || null,
      tax_id || null,
      legal_address || null,
      'local' // oauth_provider
    ]);

    const userId = result.insertId;

    // Get created user
    const newUser = await db.query(SQL.GET_USER_BY_ID, [userId]);

    const user = newUser[0];
    
    // Combine first_name and last_name into full_name for response
    const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user: {
          user_id: user.id,
          username: user.username,
          email: user.email,
          full_name: userFullName,
          role: user.role,
          company_name: user.company_name,
          status: user.status
        },
        token: token,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

// Login with email and password
router.post('/login', async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const users = await db.query(SQL.GET_USER_BY_EMAIL, [email]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check user status
    if (user.status !== 'active') {
      console.log('❌ User status not active:', user.status);
      return res.status(401).json({
        success: false,
        error: 'Account is not active',
        status: user.status
      });
    }

    // Update last login
    await db.query(SQL.UPDATE_LAST_LOGIN, [user.id]);

    // Generate JWT token
    const token = generateToken(user);
    
    // Combine first_name and last_name into full_name for response
    const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.id,
          username: user.username,
          email: user.email,
          full_name: userFullName,
          role: user.role,
          company_name: user.company_name,
          status: user.status
        },
        token: token,
        expires_in: process.env.JWT_EXPIRES_IN || '7d'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

// Google OAuth - Initiate
router.get('/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

// Google OAuth - Callback
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/login' 
  }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user);
      
      // Prepare user data with full_name
      const userFullName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
      const userData = {
        user_id: req.user.id,
        email: req.user.email,
        full_name: userFullName,
        role: req.user.role,
        company_name: req.user.company_name
      };
      
      // Redirect to frontend with token and user data
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const userParam = encodeURIComponent(JSON.stringify(userData));
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${userParam}`);
      
    } catch (error) {
      console.error('Google callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }
);

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const userFullName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    
    res.json({
      success: true,
      data: {
        user_id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        full_name: userFullName,
        role: req.user.role,
        company_name: req.user.company_name,
        status: req.user.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get profile',
      message: error.message
    });
  }
});

// GET /api/auth/users - Get all users (Admin only)
router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { limit = 50, offset = 0, role, status } = req.query;

    let whereConditions = [];
    let params = [];

    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        id,
        username,
        email,
        first_name,
        last_name,
        phone,
        role,
        company_name,
        tax_id,
        status,
        oauth_provider,
        email_verified,
        created_at,
        last_login_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    const users = await db.query(query, params);
    
    // Convert first_name and last_name to full_name for each user
    const usersWithFullName = users.map(user => ({
      user_id: user.id,
      username: user.username,
      email: user.email,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      phone: user.phone,
      role: user.role,
      company_name: user.company_name,
      tax_id: user.tax_id,
      status: user.status,
      oauth_provider: user.oauth_provider,
      email_verified: user.email_verified,
      created_at: user.created_at,
      last_login_at: user.last_login_at
    }));

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = countResult[0].total;

    res.json({
      success: true,
      data: usersWithFullName,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// GET /api/auth/users/:id - Get specific user (Admin or self)
router.get('/users/:id', authenticate, adminOrSelf, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { id } = req.params;

    const users = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.role,
        u.company_name,
        u.tax_id,
        u.legal_address,
        u.status,
        u.oauth_provider,
        u.email_verified,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(CASE WHEN o.status = 'active' THEN 1 ELSE 0 END) as active_orders
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `, [id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details',
      message: error.message
    });
  }
});

// PUT /api/auth/users/:id - Update user (Admin or self)
router.put('/users/:id', authenticate, adminOrSelf, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      company_name,
      tax_id,
      legal_address
    } = req.body;

    // Check if user exists
    const existing = await db.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build update query
    let updates = [];
    let params = [];

    if (first_name) {
      updates.push('first_name = ?');
      params.push(first_name);
    }
    if (last_name) {
      updates.push('last_name = ?');
      params.push(last_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (company_name !== undefined) {
      updates.push('company_name = ?');
      params.push(company_name);
    }
    if (tax_id !== undefined) {
      updates.push('tax_id = ?');
      params.push(tax_id);
    }
    if (legal_address !== undefined) {
      updates.push('legal_address = ?');
      params.push(legal_address);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // Get updated user
    const updatedUser = await db.query(
      'SELECT id, username, email, first_name, last_name, phone, role, company_name, tax_id, legal_address, status FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      data: updatedUser[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message
    });
  }
});

module.exports = router;