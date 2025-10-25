const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

// POST /api/vps-admin - Create new VPS plan (Admin only)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const {
      plan_name,
      provider,
      cpu_cores,
      ram_gb,
      storage_gb,
      storage_type = 'SSD',
      bandwidth_tb,
      price_per_month,
      currency = 'UZS',
      location,
      available = true
    } = req.body;

    // Validate required fields
    if (!plan_name || !cpu_cores || !ram_gb || !storage_gb || !price_per_month) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: plan_name, cpu_cores, ram_gb, storage_gb, price_per_month'
      });
    }

    // Insert new plan
    const result = await db.query(`
      INSERT INTO vps_plans 
      (provider, plan_name, cpu_cores, ram_gb, storage_gb, storage_type,
       bandwidth, price_per_month, currency, location, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      provider || 'Custom',
      plan_name,
      cpu_cores,
      ram_gb,
      storage_gb,
      storage_type,
      bandwidth_tb || null,
      price_per_month,
      currency,
      location || null
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message: 'VPS plan created successfully'
      }
    });
    
  } catch (error) {
    console.error('Create VPS Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create VPS plan',
      message: error.message
    });
  }
});

// PUT /api/vps-admin/:id - Update VPS plan (Admin only)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { id } = req.params;
    const {
      plan_name,
      provider,
      cpu_cores,
      ram_gb,
      storage_gb,
      storage_type,
      bandwidth_tb,
      price_per_month,
      currency,
      location,
      available
    } = req.body;

    // Check if plan exists (check both id and plan_id columns)
    const planExists = await db.query('SELECT plan_id FROM vps_plans WHERE plan_id = ? OR id = ?', [id, id]);
    if (planExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPS plan not found'
      });
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

    if (plan_name !== undefined) {
      updateFields.push('plan_name = ?');
      updateValues.push(plan_name);
    }
    if (provider !== undefined) {
      updateFields.push('provider = ?');
      updateValues.push(provider);
    }
    if (cpu_cores !== undefined) {
      updateFields.push('cpu_cores = ?');
      updateValues.push(cpu_cores);
    }
    if (ram_gb !== undefined) {
      updateFields.push('ram_gb = ?');
      updateValues.push(ram_gb);
    }
    if (storage_gb !== undefined) {
      updateFields.push('storage_gb = ?');
      updateValues.push(storage_gb);
    }
    if (storage_type !== undefined) {
      updateFields.push('storage_type = ?');
      updateValues.push(storage_type);
    }
    if (bandwidth_tb !== undefined) {
      updateFields.push('bandwidth = ?');
      updateValues.push(bandwidth_tb);
    }
    if (price_per_month !== undefined) {
      updateFields.push('price_per_month = ?');
      updateValues.push(price_per_month);
    }
    if (currency !== undefined) {
      updateFields.push('currency = ?');
      updateValues.push(currency);
    }
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    if (available !== undefined) {
      updateFields.push('available = ?');
      updateValues.push(available);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);

    const query = `UPDATE vps_plans SET ${updateFields.join(', ')} WHERE plan_id = ? OR id = ?`;
    updateValues.push(id);
    await db.query(query, updateValues);

    res.json({
      success: true,
      data: {
        message: 'VPS plan updated successfully'
      }
    });
    
  } catch (error) {
    console.error('Update VPS Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update VPS plan',
      message: error.message
    });
  }
});

// DELETE /api/vps-admin/:id - Delete VPS plan (Admin only)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    // Database is already initialized at startup
    
    const { id } = req.params;

    // Check if plan exists (check both id and plan_id columns)
    const planExists = await db.query('SELECT plan_id FROM vps_plans WHERE plan_id = ? OR id = ?', [id, id]);
    if (planExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPS plan not found'
      });
    }

    // Check if there are any orders with this plan
    const ordersExist = await db.query('SELECT id FROM orders WHERE vps_plan_id = ? LIMIT 1', [id]);
    if (ordersExist.length > 0) {
      // Don't delete, just mark as unavailable
      await db.query('UPDATE vps_plans SET available = false WHERE plan_id = ? OR id = ?', [id, id]);
      return res.json({
        success: true,
        data: {
          message: 'Plan has existing orders. Marked as unavailable instead of deleting.'
        }
      });
    }

    // Safe to delete
    await db.query('DELETE FROM vps_plans WHERE plan_id = ? OR id = ?', [id, id]);

    res.json({
      success: true,
      data: {
        message: 'VPS plan deleted successfully'
      }
    });
    
  } catch (error) {
    console.error('Delete VPS Plan Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete VPS plan',
      message: error.message
    });
  }
});

module.exports = router;
