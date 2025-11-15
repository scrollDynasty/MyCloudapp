const express = require('express');
const db = require('../../core/db/connection');
const { authenticate } = require('../../core/utils/auth');

const router = express.Router();

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
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
          unit_label: field.template_unit_label,
          display_order: field.template_display_order,
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

// GET /api/service-plans/all - Get all service plans (for CRM)
router.get('/all', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT 
        sp.*,
        sg.name_uz as group_name_uz,
        sg.name_ru as group_name_ru,
        sg.slug as group_slug
      FROM service_plans sp
      JOIN service_groups sg ON sp.group_id = sg.id
      WHERE sp.is_active = true AND sg.is_active = true
      ORDER BY sg.display_order ASC, sp.display_order ASC
    `;

    const plans = await db.query(query);

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Get All Service Plans Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service plans',
      message: error.message
    });
  }
});

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

module.exports = router;
