const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

// GET /api/service-groups-admin - Get all service groups (Admin)
router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    let whereClause = '';
    if (!include_inactive) {
      whereClause = 'WHERE sg.is_active = true';
    }

    const query = `
      SELECT 
        sg.*,
        COUNT(DISTINCT sp.id) as plans_count
      FROM service_groups sg
      LEFT JOIN service_plans sp ON sg.id = sp.group_id
      ${whereClause}
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

// GET /api/service-groups-admin/:id - Get single service group (Admin)
router.get('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        sg.*,
        COUNT(DISTINCT sp.id) as plans_count
      FROM service_groups sg
      LEFT JOIN service_plans sp ON sg.id = sp.group_id
      WHERE sg.id = ?
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

// POST /api/service-groups-admin - Create new service group (Admin)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      name_uz,
      name_ru,
      description_uz,
      description_ru,
      slug,
      icon,
      display_order = 0,
      is_active = true
    } = req.body;

    // Validate required fields
    if (!name_uz || !name_ru || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name_uz, name_ru, slug'
      });
    }

    // Check if slug is unique
    const slugExists = await db.query('SELECT id FROM service_groups WHERE slug = ?', [slug]);
    if (slugExists.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Slug already exists. Please use a different slug.'
      });
    }

    // Insert new group
    const result = await db.query(`
      INSERT INTO service_groups 
      (name_uz, name_ru, description_uz, description_ru, slug, icon, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name_uz,
      name_ru,
      description_uz || null,
      description_ru || null,
      slug,
      icon || null,
      display_order,
      is_active
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message: 'Service group created successfully'
      }
    });

  } catch (error) {
    console.error('Create Service Group Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service group',
      message: error.message
    });
  }
});

// PUT /api/service-groups-admin/:id - Update service group (Admin)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name_uz,
      name_ru,
      description_uz,
      description_ru,
      slug,
      icon,
      display_order,
      is_active
    } = req.body;

    // Check if group exists
    const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [id]);
    if (groupExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found'
      });
    }

    // Check if slug is unique (excluding current group)
    if (slug) {
      const slugExists = await db.query(
        'SELECT id FROM service_groups WHERE slug = ? AND id != ?',
        [slug, id]
      );
      if (slugExists.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Slug already exists. Please use a different slug.'
        });
      }
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

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
    if (slug !== undefined) {
      updateFields.push('slug = ?');
      updateValues.push(slug);
    }
    if (icon !== undefined) {
      updateFields.push('icon = ?');
      updateValues.push(icon);
    }
    if (display_order !== undefined) {
      updateFields.push('display_order = ?');
      updateValues.push(display_order);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateValues.push(id);

    const query = `UPDATE service_groups SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(query, updateValues);

    res.json({
      success: true,
      data: {
        message: 'Service group updated successfully'
      }
    });

  } catch (error) {
    console.error('Update Service Group Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service group',
      message: error.message
    });
  }
});

// DELETE /api/service-groups-admin/:id - Delete service group (Admin)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if group exists
    const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [id]);
    if (groupExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found'
      });
    }

    // Check if there are any plans in this group
    const plansExist = await db.query('SELECT id FROM service_plans WHERE group_id = ? LIMIT 1', [id]);
    if (plansExist.length > 0) {
      // Don't delete, just mark as inactive
      await db.query('UPDATE service_groups SET is_active = false WHERE id = ?', [id]);
      return res.json({
        success: true,
        data: {
          message: 'Group has existing plans. Marked as inactive instead of deleting.'
        }
      });
    }

    // Safe to delete
    await db.query('DELETE FROM service_groups WHERE id = ?', [id]);

    res.json({
      success: true,
      data: {
        message: 'Service group deleted successfully'
      }
    });

  } catch (error) {
    console.error('Delete Service Group Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service group',
      message: error.message
    });
  }
});

// PUT /api/service-groups-admin/:id/reorder - Update display order (Admin)
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

    await db.query('UPDATE service_groups SET display_order = ? WHERE id = ?', [new_order, id]);

    res.json({
      success: true,
      data: {
        message: 'Display order updated successfully'
      }
    });

  } catch (error) {
    console.error('Reorder Service Group Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update display order',
      message: error.message
    });
  }
});

module.exports = router;
