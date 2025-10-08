const express = require('express');
const db = require('../../core/db/connection');
const SQL = require('../../core/db/queries');

const router = express.Router();

// GET /api/vps - Get all VPS plans
router.get('/', async (req, res) => {
  try {
    await db.connect();
    
    const {
      provider,
      region,
      min_price,
      max_price,
      min_cpu,
      max_cpu,
      min_memory,
      max_memory,
      currency = 'USD',
      limit = 50,
      offset = 0
    } = req.query;

    // Build WHERE clause
    let whereConditions = ['vp.available = ?'];
    let params = [true];

    if (provider) {
      whereConditions.push('p.name LIKE ?');
      params.push(`%${provider}%`);
    }

    if (region) {
      whereConditions.push('vp.region LIKE ?');
      params.push(`%${region}%`);
    }

    if (min_price) {
      whereConditions.push('vp.price_per_month >= ?');
      params.push(parseFloat(min_price));
    }

    if (max_price) {
      whereConditions.push('vp.price_per_month <= ?');
      params.push(parseFloat(max_price));
    }

    if (min_cpu) {
      whereConditions.push('vp.cpu_cores >= ?');
      params.push(parseInt(min_cpu));
    }

    if (max_cpu) {
      whereConditions.push('vp.cpu_cores <= ?');
      params.push(parseInt(max_cpu));
    }

    if (min_memory) {
      whereConditions.push('vp.memory_gb >= ?');
      params.push(parseFloat(min_memory));
    }

    if (max_memory) {
      whereConditions.push('vp.memory_gb <= ?');
      params.push(parseFloat(max_memory));
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Main query
    const query = `
      SELECT 
        vp.id,
        p.name as provider,
        vp.plan_name,
        vp.cpu_cores,
        vp.memory_gb,
        vp.storage_gb,
        vp.bandwidth_tb,
        vp.price_per_month,
        vp.currency,
        vp.region,
        vp.available,
        p.website as provider_website,
        p.country as provider_country
      FROM vps_plans vp
      JOIN providers p ON vp.provider_id = p.id
      ${whereClause}
      ORDER BY vp.price_per_month ASC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    const plans = await db.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vps_plans vp
      JOIN providers p ON vp.provider_id = p.id
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, params.slice(0, -2)); // Remove limit and offset
    const total = countResult[0].total;

    // Format response
    const formattedPlans = plans.map(plan => ({
      plan_id: plan.id, // используем plan_id для совместимости с фронтендом
      id: plan.id,
      provider_name: plan.provider,
      plan_name: plan.plan_name,
      cpu_cores: plan.cpu_cores,
      ram_gb: plan.memory_gb, // совместимость с фронтендом
      memory_gb: plan.memory_gb,
      storage_gb: plan.storage_gb,
      bandwidth_tb: plan.bandwidth_tb,
      price: parseFloat(plan.price_per_month), // совместимость с фронтендом
      price_per_month: parseFloat(plan.price_per_month),
      currency_code: plan.currency, // совместимость с фронтендом
      currency: plan.currency,
      region_name: plan.region, // совместимость с фронтендом
      region: plan.region,
      available: plan.available,
      provider_info: {
        website: plan.provider_website,
        country: plan.provider_country
      }
    }));

    res.json({
      success: true,
      data: formattedPlans,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / limit)
      },
      filters_applied: {
        provider,
        region,
        min_price,
        max_price,
        min_cpu,
        max_cpu,
        min_memory,
        max_memory,
        currency
      }
    });

  } catch (error) {
    console.error('VPS API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPS plans',
      message: error.message
    });
  }
});

// GET /api/vps/:id - Get specific VPS plan
router.get('/:id', async (req, res) => {
  try {
    await db.connect();
    
    const { id } = req.params;

    const query = `
      SELECT 
        vp.*,
        p.name as provider,
        p.website as provider_website,
        p.country as provider_country
      FROM vps_plans vp
      JOIN providers p ON vp.provider_id = p.id
      WHERE vp.id = ?
    `;

    const plans = await db.query(query, [id]);

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'VPS plan not found'
      });
    }

    const plan = plans[0];

    res.json({
      success: true,
      data: {
        id: plan.id,
        provider: plan.provider,
        plan_name: plan.plan_name,
        cpu_cores: plan.cpu_cores,
        memory_gb: plan.memory_gb,
        storage_gb: plan.storage_gb,
        bandwidth_tb: plan.bandwidth_tb,
        price_per_month: parseFloat(plan.price_per_month),
        currency: plan.currency,
        region: plan.region,
        available: plan.available,
        created_at: plan.created_at,
        provider_info: {
          website: plan.provider_website,
          country: plan.provider_country
        }
      }
    });

  } catch (error) {
    console.error('VPS Detail API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPS plan details',
      message: error.message
    });
  }
});

// GET /api/vps/providers - Get all providers
router.get('/providers/list', async (req, res) => {
  try {
    await db.connect();
    
    const query = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.website,
        p.country,
        COUNT(vp.id) as plans_count,
        MIN(vp.price_per_month) as min_price,
        MAX(vp.price_per_month) as max_price
      FROM providers p
      LEFT JOIN vps_plans vp ON p.id = vp.provider_id AND vp.available = true
      GROUP BY p.id, p.name, p.website, p.country
      ORDER BY plans_count DESC, p.name ASC
    `;

    const providers = await db.query(query);

    res.json({
      success: true,
      data: providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        website: provider.website,
        country: provider.country,
        plans_count: provider.plans_count,
        price_range: {
          min: parseFloat(provider.min_price) || 0,
          max: parseFloat(provider.max_price) || 0
        }
      }))
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

// GET /api/vps/regions - Get all regions
router.get('/regions/list', async (req, res) => {
  try {
    await db.connect();
    
    const query = `
      SELECT DISTINCT
        r.name,
        r.country,
        COUNT(vp.id) as plans_count
      FROM regions r
      LEFT JOIN vps_plans vp ON r.name = vp.region AND vp.available = true
      GROUP BY r.name, r.country
      ORDER BY plans_count DESC, r.name ASC
    `;

    const regions = await db.query(query);

    res.json({
      success: true,
      data: regions.map(region => ({
        name: region.name,
        country: region.country,
        plans_count: region.plans_count
      }))
    });

  } catch (error) {
    console.error('Regions API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regions',
      message: error.message
    });
  }
});

module.exports = router;