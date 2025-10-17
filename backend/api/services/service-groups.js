const express = require('express');
const db = require('../../core/db/connection');
const { authenticate } = require('../../core/utils/auth');

const router = express.Router();

// GET /api/service-groups - Get all active service groups (Public for authenticated users)
router.get('/', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT 
        sg.*,
        COUNT(DISTINCT sp.id) as plans_count
      FROM service_groups sg
      LEFT JOIN service_plans sp ON sg.id = sp.group_id AND sp.is_active = true
      WHERE sg.is_active = true
      GROUP BY sg.id
      ORDER BY sg.display_order ASC, sg.created_at DESC
    `;

    const groups = await db.query(query);

    res.json({
      success: true,
      data: groups
    });

  } catch (error) {
    console.error('Get Service Groups Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service groups',
      message: error.message
    });
  }
});

// GET /api/service-groups/:id - Get single service group (Public for authenticated users)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        sg.*,
        COUNT(DISTINCT sp.id) as plans_count
      FROM service_groups sg
      LEFT JOIN service_plans sp ON sg.id = sp.group_id AND sp.is_active = true
      WHERE sg.id = ? AND sg.is_active = true
      GROUP BY sg.id
    `;

    const groups = await db.query(query, [id]);

    if (groups.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found'
      });
    }

    res.json({
      success: true,
      data: groups[0]
    });

  } catch (error) {
    console.error('Get Service Group Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service group',
      message: error.message
    });
  }
});

// GET /api/service-groups/slug/:slug - Get service group by slug (Public for authenticated users)
router.get('/slug/:slug', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;

    const query = `
      SELECT 
        sg.*,
        COUNT(DISTINCT sp.id) as plans_count
      FROM service_groups sg
      LEFT JOIN service_plans sp ON sg.id = sp.group_id AND sp.is_active = true
      WHERE sg.slug = ? AND sg.is_active = true
      GROUP BY sg.id
    `;

    const groups = await db.query(query, [slug]);

    if (groups.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found'
      });
    }

    res.json({
      success: true,
      data: groups[0]
    });

  } catch (error) {
    console.error('Get Service Group by Slug Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service group',
      message: error.message
    });
  }
});

module.exports = router;
