const express = require('express');
const db = require('../../core/db/connection');
const { authenticate } = require('../../core/utils/auth');

const router = express.Router();

// GET /api/service-plans - Get all plans for a group (Public for authenticated users)
router.get('/', authenticate, async (req, res) => {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: group_id'
      });
    }

    const query = `
      SELECT 
        sp.*,
        sg.name_uz as group_name_uz,
        sg.name_ru as group_name_ru,
        sg.slug as group_slug
      FROM service_plans sp
      JOIN service_groups sg ON sp.group_id = sg.id
      WHERE sp.group_id = ? AND sp.is_active = true AND sg.is_active = true
      ORDER BY sp.display_order ASC, sp.created_at DESC
    `;

    const plans = await db.query(query, [group_id]);

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Get Service Plans Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service plans',
      message: error.message
    });
  }
});

// GET /api/service-plans/:id - Get single plan with fields (Public for authenticated users)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get plan details
    const planQuery = `
      SELECT 
        sp.*,
        sg.name_uz as group_name_uz,
        sg.name_ru as group_name_ru,
        sg.slug as group_slug
      FROM service_plans sp
      JOIN service_groups sg ON sp.group_id = sg.id
      WHERE sp.id = ? AND sp.is_active = true AND sg.is_active = true
    `;

    const plans = await db.query(planQuery, [id]);

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service plan not found'
      });
    }

    const plan = plans[0];

    // Get plan fields
    const fieldsQuery = `
      SELECT *
      FROM plan_fields
      WHERE plan_id = ?
      ORDER BY display_order ASC
    `;

    const fields = await db.query(fieldsQuery, [id]);

    res.json({
      success: true,
      data: {
        ...plan,
        fields: fields
      }
    });

  } catch (error) {
    console.error('Get Service Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service plan',
      message: error.message
    });
  }
});

module.exports = router;
