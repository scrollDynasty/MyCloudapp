const jwt = require('jsonwebtoken');
const db = require('../db/connection');

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    username: user.username
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (error) {
    return null;
  }
}

// Middleware: Verify JWT token from request
async function authenticate(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Authorization header with Bearer token is required'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token is invalid or expired'
      });
    }
    
    // Get user from database
    await db.connect();
    const users = await db.query(
      'SELECT id, username, email, role, status, first_name, last_name FROM users WHERE id = ?',
      [decoded.id]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const user = users[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active',
        status: user.status
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
}

// Middleware: Check if user has required role
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        your_role: req.user.role
      });
    }
    
    next();
  };
}

// Middleware: Admin only
const adminOnly = authorize('admin');

// Middleware: Admin or self (user can access own data)
function adminOrSelf(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }
  
  const targetUserId = parseInt(req.params.id || req.params.user_id);
  
  if (req.user.role === 'admin' || req.user.id === targetUserId) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'You can only access your own data'
    });
  }
}

// Optional authentication (doesn't fail if no token)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded) {
        await db.connect();
        const users = await db.query(
          'SELECT id, username, email, role, status FROM users WHERE id = ?',
          [decoded.id]
        );
        
        if (users.length > 0 && users[0].status === 'active') {
          req.user = users[0];
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  authorize,
  adminOnly,
  adminOrSelf,
  optionalAuth
};