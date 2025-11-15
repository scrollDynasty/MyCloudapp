const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

const STATUS_VALUES = ['draft', 'active', 'inactive', 'archived'];
const BILLING_PERIODS = ['monthly', 'yearly', 'once'];
const DEFAULT_STATUS = 'active';

function normalizeStatus(status) {
  if (!status) return DEFAULT_STATUS;
  const normalized = status.toString().trim().toLowerCase();
  return STATUS_VALUES.includes(normalized) ? normalized : null;
}

function normalizeBillingPeriod(period) {
  if (!period) return 'monthly';
  const normalized = period.toString().trim().toLowerCase();
  return BILLING_PERIODS.includes(normalized) ? normalized : null;
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function valueToString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
  return JSON.stringify(value);
}

function normalizeFieldKey(source, fallbackIndex = 0) {
  if (source) {
    const normalized = source
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (normalized) {
      return normalized.substring(0, 100);
    }
  }
  return `custom_field_${Date.now()}_${fallbackIndex}`;
}

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.name = 'ValidationError';
  return error;
}

function resolveTemplateForField(field, templateById, templateByKey) {
  if (!field) return null;
  if (field.definition_id) {
    const template = templateById.get(Number(field.definition_id));
    if (template) return template;
  }
  if (field.field_key) {
    const lookupKey = normalizeFieldKey(field.field_key);
    if (templateByKey.has(lookupKey)) {
      return templateByKey.get(lookupKey);
    }
  }
  return null;
}

function hydrateTemplateRow(row) {
  return {
    ...row,
    options: safeJsonParse(row.options) || null,
    is_required: Boolean(row.is_required),
    display_order: Number(row.display_order || 0),
    min_value: row.min_value !== null ? Number(row.min_value) : null,
    max_value: row.max_value !== null ? Number(row.max_value) : null,
  };
}

async function preparePlanFieldRows(connection, groupId, fieldsPayload) {
  if (!groupId) {
    throw createValidationError('group_id is required to map dynamic fields');
  }

  const [templateRows] = await connection.execute(
    `
      SELECT *
      FROM service_field_templates
      WHERE group_id = ?
      ORDER BY display_order ASC, created_at ASC
    `,
    [groupId]
  );

  const templates = templateRows.map(hydrateTemplateRow);
  const templateById = new Map();
  const templateByKey = new Map();

  templates.forEach((template) => {
    templateById.set(template.id, template);
    templateByKey.set(template.field_key, template);
  });

  const payloadArray = Array.isArray(fieldsPayload) ? [...fieldsPayload] : [];
  const providedTemplateIds = new Set();

  for (const field of payloadArray) {
    const template = resolveTemplateForField(field, templateById, templateByKey);
    if (template) {
      providedTemplateIds.add(template.id);
    }
  }

  for (const template of templates) {
    if (
      hasValue(template.default_value) &&
      !providedTemplateIds.has(template.id)
    ) {
      payloadArray.push({
        definition_id: template.id,
        field_value_ru: template.default_value,
        field_value_uz: template.default_value,
        __autoDefault: true,
      });
    }
  }

  const entries = [];
  const satisfiedTemplates = new Set();

  payloadArray.forEach((field, index) => {
    const template = resolveTemplateForField(field, templateById, templateByKey);

    let valueRu = valueToString(field?.field_value_ru ?? field?.value_ru ?? field?.value ?? null);
    let valueUz = valueToString(field?.field_value_uz ?? field?.value_uz ?? field?.value ?? null);

    if (!hasValue(valueRu) && !hasValue(valueUz) && hasValue(template?.default_value)) {
      valueRu = valueToString(template.default_value);
      valueUz = valueToString(template.default_value);
    }

    const hasAnyValue = hasValue(valueRu) || hasValue(valueUz);

    if (!hasAnyValue) {
      if (template && template.is_required) {
        throw createValidationError(`Поле "${template.label_ru || template.field_key}" обязательно для заполнения`);
      }
      return;
    }

    const fieldKey = template
      ? template.field_key
      : normalizeFieldKey(field?.field_key || field?.field_label_ru || field?.field_label_uz, index);

    entries.push({
      definition_id: template ? template.id : null,
      field_key: fieldKey,
      field_label_uz: template ? template.label_uz : field?.field_label_uz || field?.field_label_ru || fieldKey,
      field_label_ru: template ? template.label_ru : field?.field_label_ru || field?.field_label_uz || fieldKey,
      field_value_uz: valueUz,
      field_value_ru: valueRu,
      field_type: template ? template.field_type : field?.field_type || 'text',
      display_order: template ? template.display_order : field?.display_order ?? (1000 + index),
    });

    if (template) {
      satisfiedTemplates.add(template.id);
    }
  });

  const missingRequired = templates
    .filter((template) => template.is_required && !satisfiedTemplates.has(template.id))
    .map((template) => template.label_ru || template.field_key);

  if (missingRequired.length > 0) {
    throw createValidationError(`Заполните обязательные поля: ${missingRequired.join(', ')}`);
  }

  return entries;
}

async function insertPlanFields(connection, planId, groupId, fieldsPayload, { deleteExisting = false } = {}) {
  const rows = await preparePlanFieldRows(connection, groupId, fieldsPayload);

  if (deleteExisting) {
    await connection.execute('DELETE FROM plan_fields WHERE plan_id = ?', [planId]);
  }

  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    await connection.execute(
      `
        INSERT INTO plan_fields 
        (plan_id, definition_id, field_key, field_label_uz, field_label_ru, 
         field_value_uz, field_value_ru, field_type, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        planId,
        row.definition_id,
        row.field_key,
        row.field_label_uz,
        row.field_label_ru,
        row.field_value_uz,
        row.field_value_ru,
        row.field_type,
        row.display_order,
      ]
    );
  }
}

function formatFieldsResponse(rows) {
  return rows.map((field) => {
    const template = field.definition_id
      ? {
          id: field.definition_id,
          label_ru: field.template_label_ru || field.field_label_ru,
          label_uz: field.template_label_uz || field.field_label_uz,
          field_type: field.template_field_type || field.field_type,
          options: safeJsonParse(field.template_options),
          is_required: Boolean(field.template_is_required),
          description_ru: field.template_description_ru,
          description_uz: field.template_description_uz,
          display_order: field.template_display_order,
          unit_label: field.template_unit_label,
        }
      : null;

    return {
      id: field.id,
      plan_id: field.plan_id,
      definition_id: field.definition_id,
      field_key: field.field_key,
      field_label_uz: field.field_label_uz,
      field_label_ru: field.field_label_ru,
      field_value_uz: field.field_value_uz,
      field_value_ru: field.field_value_ru,
      field_type: field.field_type,
      display_order: field.display_order,
      template,
    };
  });
}

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

    const fieldsQuery = `
      SELECT 
        pf.*,
        sft.label_ru as template_label_ru,
        sft.label_uz as template_label_uz,
        sft.field_type as template_field_type,
        sft.options as template_options,
        sft.is_required as template_is_required,
        sft.description_ru as template_description_ru,
        sft.description_uz as template_description_uz,
        sft.display_order as template_display_order,
        sft.unit_label as template_unit_label
      FROM plan_fields pf
      LEFT JOIN service_field_templates sft ON pf.definition_id = sft.id
      WHERE pf.plan_id = ?
      ORDER BY COALESCE(sft.display_order, pf.display_order), pf.id
    `;

    const fields = await db.query(fieldsQuery, [id]);

    res.json({
      success: true,
      data: {
        ...plan,
        fields: formatFieldsResponse(fields)
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
      status = DEFAULT_STATUS,
      domain_name,
      notes,
      fields = []
    } = req.body;

    if (!group_id || !name_uz || !name_ru || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: group_id, name_uz, name_ru, price'
      });
    }

    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values: ${STATUS_VALUES.join(', ')}`
      });
    }

    const normalizedPeriod = normalizeBillingPeriod(billing_period);
    if (!normalizedPeriod) {
      return res.status(400).json({
        success: false,
        error: `Invalid billing_period. Allowed values: ${BILLING_PERIODS.join(', ')}`
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

    await db.transaction(async (connection) => {
      const [planResult] = await connection.execute(`
        INSERT INTO service_plans 
        (group_id, name_uz, name_ru, description_uz, description_ru, price, 
         discount_price, currency, billing_period, status, domain_name, notes,
         display_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        group_id,
        name_uz,
        name_ru,
        description_uz || null,
        description_ru || null,
        price,
        discount_price || null,
        currency,
        normalizedPeriod,
        normalizedStatus,
        domain_name || null,
        notes || null,
        display_order,
        is_active
      ]);

      const planId = planResult.insertId;

      await insertPlanFields(connection, planId, group_id, fields);

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
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Failed to create service plan',
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
      status,
      domain_name,
      notes,
      display_order,
      is_active,
      fields
    } = req.body;

    const planRecords = await db.query('SELECT id, group_id FROM service_plans WHERE id = ?', [id]);
    if (planRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service plan not found'
      });
    }

    const currentPlan = planRecords[0];
    const targetGroupId = group_id || currentPlan.group_id;

    if (group_id !== undefined) {
      const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [group_id]);
      if (groupExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Service group not found'
        });
      }
    }

    let normalizedStatus;
    if (status !== undefined) {
      normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Allowed values: ${STATUS_VALUES.join(', ')}`
        });
      }
    }

    let normalizedPeriod;
    if (billing_period !== undefined) {
      normalizedPeriod = normalizeBillingPeriod(billing_period);
      if (!normalizedPeriod) {
        return res.status(400).json({
          success: false,
          error: `Invalid billing_period. Allowed values: ${BILLING_PERIODS.join(', ')}`
        });
      }
    }

    await db.transaction(async (connection) => {
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
        updateValues.push(normalizedPeriod);
      }
      if (status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(normalizedStatus);
      }
      if (domain_name !== undefined) {
        updateFields.push('domain_name = ?');
        updateValues.push(domain_name || null);
      }
      if (notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(notes || null);
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

      if (fields !== undefined) {
        await insertPlanFields(connection, id, targetGroupId, fields, { deleteExisting: true });
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
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Failed to update service plan',
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
