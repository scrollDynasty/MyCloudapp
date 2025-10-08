const express = require('express');
const db = require('../../core/db/connection');

const router = express.Router();

// GET /api/providers - Get all providers
router.get('/', async (req, res) => {
  try {
    await db.connect();
    
    const query = `
      SELECT 
        id,
        name,
        website,
        country
      FROM providers
      ORDER BY name ASC
    `;

    const providers = await db.query(query);

    res.json({
      success: true,
      data: providers
    });

  } catch (error) {
    console.error('Providers API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers',
      message: error.message
    });
  }
});

module.exports = router;
