const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

// GET /api/service-plans-admin - Get all plans for a group (Admin)
router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { group_id, include_inactive } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: group_id'
      });
    }

    let whereClause = 'WHERE sp.group_id = ?';
    let params = [group_id];

    if (!include_inactive) {
      whereClause += ' AND sp.is_active = true';
    }

    const query = `
      SELECT 
        sp.*,
        sg.name_uz as group_name_uz,
        sg.name_ru as group_name_ru,
        COUNT(DISTINCT pf.id) as fields_count
      FROM service_plans sp
      JOIN service_groups sg ON sp.group_id = sg.id
      LEFT JOIN plan_fields pf ON sp.id = pf.plan_id
      ${whereClause}
      GROUP BY sp.id
      ORDER BY sp.display_order ASC, sp.created_at DESC
    `;

    const plans = await db.query(query, params);

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

// GET /api/service-plans-admin/:id - Get single plan with fields (Admin)
router.get('/:id', authenticate, adminOnly, async (req, res) => {
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
      WHERE sp.id = ?
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

// POST /api/service-plans-admin - Create new plan with fields (Admin)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      group_id,
      name_uz,
      name_ru,
      description_uz,
      description_ru,
      price,
      discount_price,
      currency = 'UZS',
      billing_period = 'monthly',
      display_order = 0,
      is_active = true,
      fields = [] // Array of field objects
    } = req.body;

    // Validate required fields
    if (!group_id || !name_uz || !name_ru || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: group_id, name_uz, name_ru, price'
      });
    }

    // Verify group exists
    const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [group_id]);
    if (groupExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found'
      });
    }

    // Start transaction
    await db.transaction(async (connection) => {
      // Insert plan
      const [planResult] = await connection.execute(`
        INSERT INTO service_plans 
        (group_id, name_uz, name_ru, description_uz, description_ru, price, 
         discount_price, currency, billing_period, display_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        group_id,
        name_uz,
        name_ru,
        description_uz || null,
        description_ru || null,
        price,
        discount_price || null,
        currency,
        billing_period,
        display_order,
        is_active
      ]);

      const planId = planResult.insertId;

      // Insert fields if provided
      if (fields && fields.length > 0) {
        for (const field of fields) {
          await connection.execute(`
            INSERT INTO plan_fields 
            (plan_id, field_key, field_label_uz, field_label_ru, 
             field_value_uz, field_value_ru, field_type, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            planId,
            field.field_key,
            field.field_label_uz,
            field.field_label_ru,
            field.field_value_uz || null,
            field.field_value_ru || null,
            field.field_type || 'text',
            field.display_order || 0
          ]);
        }
      }

      return planId;
    }).then(planId => {
      res.status(201).json({
        success: true,
        data: {
          id: planId,
          message: 'Service plan created successfully'
        }
      });
    });

  } catch (error) {
    console.error('Create Service Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service plan',
      message: error.message
    });
  }
});

// PUT /api/service-plans-admin/:id - Update plan with fields (Admin)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      group_id,
      name_uz,
      name_ru,
      description_uz,
      description_ru,
      price,
      discount_price,
      currency,
      billing_period,
      display_order,
      is_active,
      fields // Array of field objects (will replace all existing fields)
    } = req.body;

    // Check if plan exists
    const planExists = await db.query('SELECT id FROM service_plans WHERE id = ?', [id]);
    if (planExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service plan not found'
      });
    }

    // Start transaction
    await db.transaction(async (connection) => {
      // Build update query for plan
      let updateFields = [];
      let updateValues = [];

      if (group_id !== undefined) {
        updateFields.push('group_id = ?');
        updateValues.push(group_id);
      }
      if (name_uz !== undefined) {
        updateFields.push('name_uz = ?');
        updateValues.push(name_uz);
      }
      if (name_ru !== undefined) {
        updateFields.push('name_ru = ?');
        updateValues.push(name_ru);
      }
      if (description_uz !== undefined) {
        updateFields.push('description_uz = ?');
        updateValues.push(description_uz);
      }
      if (description_ru !== undefined) {
        updateFields.push('description_ru = ?');
        updateValues.push(description_ru);
      }
      if (price !== undefined) {
        updateFields.push('price = ?');
        updateValues.push(price);
      }
      if (discount_price !== undefined) {
        updateFields.push('discount_price = ?');
        updateValues.push(discount_price);
      }
      if (currency !== undefined) {
        updateFields.push('currency = ?');
        updateValues.push(currency);
      }
      if (billing_period !== undefined) {
        updateFields.push('billing_period = ?');
        updateValues.push(billing_period);
      }
      if (display_order !== undefined) {
        updateFields.push('display_order = ?');
        updateValues.push(display_order);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(is_active);
      }

      // Update plan if there are fields to update
      if (updateFields.length > 0) {
        updateValues.push(id);
        const query = `UPDATE service_plans SET ${updateFields.join(', ')} WHERE id = ?`;
        await connection.execute(query, updateValues);
      }

      // Update fields if provided
      if (fields !== undefined) {
        // Delete all existing fields
        await connection.execute('DELETE FROM plan_fields WHERE plan_id = ?', [id]);

        // Insert new fields
        if (fields.length > 0) {
          for (const field of fields) {
            await connection.execute(`
              INSERT INTO plan_fields 
              (plan_id, field_key, field_label_uz, field_label_ru, 
               field_value_uz, field_value_ru, field_type, display_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              id,
              field.field_key,
              field.field_label_uz,
              field.field_label_ru,
              field.field_value_uz || null,
              field.field_value_ru || null,
              field.field_type || 'text',
              field.display_order || 0
            ]);
          }
        }
      }
    }).then(() => {
      res.json({
        success: true,
        data: {
          message: 'Service plan updated successfully'
        }
      });
    });

  } catch (error) {
    console.error('Update Service Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service plan',
      message: error.message
    });
  }
});

// DELETE /api/service-plans-admin/:id - Delete plan (Admin)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const planExists = await db.query('SELECT id FROM service_plans WHERE id = ?', [id]);
    if (planExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service plan not found'
      });
    }

    // Check if there are any orders with this plan
    const ordersExist = await db.query(
      'SELECT id FROM orders WHERE service_plan_id = ? LIMIT 1',
      [id]
    );
    
    if (ordersExist.length > 0) {
      // Don't delete, just mark as inactive
      await db.query('UPDATE service_plans SET is_active = false WHERE id = ?', [id]);
      return res.json({
        success: true,
        data: {
          message: 'Plan has existing orders. Marked as inactive instead of deleting.'
        }
      });
    }

    // Safe to delete (fields will be deleted automatically by CASCADE)
    await db.query('DELETE FROM service_plans WHERE id = ?', [id]);

    res.json({
      success: true,
      data: {
        message: 'Service plan deleted successfully'
      }
    });

  } catch (error) {
    console.error('Delete Service Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service plan',
      message: error.message
    });
  }
});

// PUT /api/service-plans-admin/:id/reorder - Update display order (Admin)
router.put('/:id/reorder', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_order } = req.body;

    if (new_order === undefined || new_order === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: new_order'
      });
    }

    await db.query('UPDATE service_plans SET display_order = ? WHERE id = ?', [new_order, id]);

    res.json({
      success: true,
      data: {
        message: 'Display order updated successfully'
      }
    });

  } catch (error) {
    console.error('Reorder Service Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update display order',
      message: error.message
    });
  }
});

module.exports = router;
