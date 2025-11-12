const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

// POST /api/vps-admin - Create new VPS plan (Admin only)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      plan_name,
      provider,
      cpu_cores,
      cpu_model,
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

    let provider_id;

    // If provider name is provided, find or create provider
    if (provider && provider.trim()) {
      // Check if provider exists
      const existingProvider = await db.query('SELECT id FROM providers WHERE name = ?', [provider.trim()]);
      
      if (existingProvider.length > 0) {
        provider_id = existingProvider[0].id;
      } else {
        // Create new provider with auto-generated code
        const providerCode = provider.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
        const providerResult = await db.query(
          'INSERT INTO providers (name, code, website, country) VALUES (?, ?, ?, ?)',
          [provider.trim(), providerCode, null, null]
        );
        provider_id = providerResult.insertId;
      }
    } else {
      // Use or create "Custom" provider
      const customProvider = await db.query('SELECT id FROM providers WHERE name = ?', ['Custom']);
      
      if (customProvider.length > 0) {
        provider_id = customProvider[0].id;
      } else {
        const providerResult = await db.query(
          'INSERT INTO providers (name, code, website, country) VALUES (?, ?, ?, ?)',
          ['Custom', 'custom', null, null]
        );
        provider_id = providerResult.insertId;
      }
    }

    // Insert new VPS plan
    const result = await db.query(`
      INSERT INTO vps_plans 
      (provider_id, name, cpu_cores, cpu_model, ram_gb, storage_gb, 
       bandwidth_gb, price_monthly, available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      provider_id,
      plan_name,
      cpu_cores,
      cpu_model || null,
      ram_gb,
      storage_gb,
      bandwidth_tb ? bandwidth_tb * 1000 : null,
      price_per_month,
      available
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
    const { id } = req.params;
    const {
      plan_name,
      provider,
      cpu_cores,
      cpu_model,
      ram_gb,
      storage_gb,
      bandwidth_tb,
      price_per_month,
      available
    } = req.body;

    // Check if plan exists
    const planExists = await db.query('SELECT id, provider_id FROM vps_plans WHERE id = ?', [id]);
    if (planExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPS plan not found'
      });
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

    // Handle provider update
    if (provider !== undefined && provider !== null) {
      // Check if provider exists
      const existingProvider = await db.query('SELECT id FROM providers WHERE name = ?', [provider.trim()]);
      
      let provider_id;
      if (existingProvider.length > 0) {
        provider_id = existingProvider[0].id;
      } else {
        // Create new provider with auto-generated code
        const providerCode = provider.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
        const providerResult = await db.query(
          'INSERT INTO providers (name, code, website, country) VALUES (?, ?, ?, ?)',
          [provider.trim(), providerCode, null, null]
        );
        provider_id = providerResult.insertId;
      }
      
      updateFields.push('provider_id = ?');
      updateValues.push(provider_id);
    }

    if (plan_name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(plan_name);
    }
    if (cpu_cores !== undefined) {
      updateFields.push('cpu_cores = ?');
      updateValues.push(cpu_cores);
    }
    if (cpu_model !== undefined) {
      updateFields.push('cpu_model = ?');
      updateValues.push(cpu_model || null);
    }
    if (ram_gb !== undefined) {
      updateFields.push('ram_gb = ?');
      updateValues.push(ram_gb);
    }
    if (storage_gb !== undefined) {
      updateFields.push('storage_gb = ?');
      updateValues.push(storage_gb);
    }
    if (bandwidth_tb !== undefined) {
      updateFields.push('bandwidth_gb = ?');
      updateValues.push(bandwidth_tb ? bandwidth_tb * 1000 : null);
    }
    if (price_per_month !== undefined) {
      updateFields.push('price_monthly = ?');
      updateValues.push(price_per_month);
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

    const query = `UPDATE vps_plans SET ${updateFields.join(', ')} WHERE id = ?`;
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
    const { id } = req.params;

    // Check if plan exists
    const planExists = await db.query('SELECT id FROM vps_plans WHERE id = ?', [id]);
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
      await db.query('UPDATE vps_plans SET available = false WHERE id = ?', [id]);
      return res.json({
        success: true,
        data: {
          message: 'Plan has existing orders. Marked as unavailable instead of deleting.'
        }
      });
    }

    // Safe to delete
    await db.query('DELETE FROM vps_plans WHERE id = ?', [id]);

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
