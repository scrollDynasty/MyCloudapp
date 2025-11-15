const express = require('express');
const db = require('../../core/db/connection');
const { authenticate, adminOnly } = require('../../core/utils/auth');

const router = express.Router();

const ALLOWED_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'price',
  'select',
  'date',
  'boolean',
  'list'
];

function normalizeFieldKey(key) {
  if (!key) return null;
  return key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100);
}

function parseOptions(options) {
  if (!options) {
    return null;
  }

  if (Array.isArray(options)) {
    return options
      .map((item) => {
        if (item === null || item === undefined) {
          return null;
        }

        if (typeof item === 'object') {
          const value = item.value ?? item.id ?? item.code ?? null;
          const label = item.label_ru ?? item.label ?? item.name_ru ?? item.name ?? value;
          if (!value) {
            return null;
          }
          return {
            value: value.toString(),
            label_ru: label ? label.toString() : value.toString(),
            label_uz: (item.label_uz || label || value).toString(),
          };
        }

        return {
          value: item.toString(),
          label_ru: item.toString(),
          label_uz: item.toString(),
        };
      })
      .filter(Boolean);
  }

  if (typeof options === 'string') {
    const trimmed = options.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return parseOptions(parsed);
    } catch (_) {
      // Treat as newline separated list, optionally using value|label
      return trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [valuePart, labelPart] = line.split('|');
          const value = valuePart.trim();
          const label = (labelPart || value).trim();
          return {
            value,
            label_ru: label,
            label_uz: label,
          };
        });
    }
  }

  if (typeof options === 'object') {
    return parseOptions([options]);
  }

  return null;
}

function stringifyOptions(options) {
  const normalized = parseOptions(options);
  return normalized ? JSON.stringify(normalized) : null;
}

function hydrateTemplate(row) {
  return {
    ...row,
    is_required: Boolean(row.is_required),
    display_order: Number(row.display_order || 0),
    min_value: row.min_value !== null ? Number(row.min_value) : null,
    max_value: row.max_value !== null ? Number(row.max_value) : null,
    options: row.options
      ? typeof row.options === 'string'
        ? (() => {
            try {
              return JSON.parse(row.options);
            } catch {
              return null;
            }
          })()
        : row.options
      : null,
  };
}

router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { group_id } = req.query;

    let query = `
      SELECT 
        sft.*,
        sg.name_ru as group_name_ru,
        sg.name_uz as group_name_uz
      FROM service_field_templates sft
      JOIN service_groups sg ON sft.group_id = sg.id
    `;
    const params = [];

    if (group_id) {
      query += ' WHERE sft.group_id = ?';
      params.push(group_id);
    }

    query += ' ORDER BY sg.display_order ASC, sft.display_order ASC, sft.created_at ASC';

    const rows = await db.query(query, params);

    res.json({
      success: true,
      data: rows.map(hydrateTemplate),
    });
  } catch (error) {
    console.error('Get Service Field Templates Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch field templates',
      message: error.message,
    });
  }
});

router.get('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.query(
      `
      SELECT 
        sft.*,
        sg.name_ru as group_name_ru,
        sg.name_uz as group_name_uz
      FROM service_field_templates sft
      JOIN service_groups sg ON sft.group_id = sg.id
      WHERE sft.id = ?
    `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field template not found',
      });
    }

    res.json({
      success: true,
      data: hydrateTemplate(rows[0]),
    });
  } catch (error) {
    console.error('Get Service Field Template Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch field template',
      message: error.message,
    });
  }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const {
      group_id,
      field_key,
      label_uz,
      label_ru,
      description_uz,
      description_ru,
      field_type = 'text',
      options,
      is_required = false,
      default_value,
      unit_label,
      min_value,
      max_value,
      display_order = 0,
    } = req.body;

    if (!group_id || !field_key || !label_uz || !label_ru) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: group_id, field_key, label_uz, label_ru',
      });
    }

    const normalizedKey = normalizeFieldKey(field_key);
    if (!normalizedKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field_key value',
      });
    }

    if (!ALLOWED_FIELD_TYPES.includes(field_type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported field_type. Allowed values: ${ALLOWED_FIELD_TYPES.join(', ')}`,
      });
    }

    const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [group_id]);
    if (groupExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service group not found',
      });
    }

    const optionsJson = stringifyOptions(options);

    const result = await db.query(
      `
      INSERT INTO service_field_templates
      (group_id, field_key, label_uz, label_ru, description_uz, description_ru, field_type,
       options, is_required, default_value, unit_label, min_value, max_value, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        group_id,
        normalizedKey,
        label_uz,
        label_ru,
        description_uz || null,
        description_ru || null,
        field_type,
        optionsJson,
        is_required ? 1 : 0,
        default_value || null,
        unit_label || null,
        min_value !== undefined && min_value !== null ? min_value : null,
        max_value !== undefined && max_value !== null ? max_value : null,
        display_order,
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message: 'Field template created successfully',
      },
    });
  } catch (error) {
    console.error('Create Service Field Template Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create field template',
      message: error.message,
    });
  }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const templateExists = await db.query('SELECT id, field_key FROM service_field_templates WHERE id = ?', [id]);
    if (templateExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field template not found',
      });
    }

    const {
      group_id,
      field_key,
      label_uz,
      label_ru,
      description_uz,
      description_ru,
      field_type,
      options,
      is_required,
      default_value,
      unit_label,
      min_value,
      max_value,
      display_order,
    } = req.body;

    let updateFields = [];
    let updateValues = [];

    if (group_id !== undefined) {
      const groupExists = await db.query('SELECT id FROM service_groups WHERE id = ?', [group_id]);
      if (groupExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Service group not found',
        });
      }
      updateFields.push('group_id = ?');
      updateValues.push(group_id);
    }

    if (field_key !== undefined) {
      const normalizedKey = normalizeFieldKey(field_key);
      if (!normalizedKey) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field_key value',
        });
      }
      updateFields.push('field_key = ?');
      updateValues.push(normalizedKey);
    }

    if (label_uz !== undefined) {
      updateFields.push('label_uz = ?');
      updateValues.push(label_uz);
    }

    if (label_ru !== undefined) {
      updateFields.push('label_ru = ?');
      updateValues.push(label_ru);
    }

    if (description_uz !== undefined) {
      updateFields.push('description_uz = ?');
      updateValues.push(description_uz);
    }

    if (description_ru !== undefined) {
      updateFields.push('description_ru = ?');
      updateValues.push(description_ru);
    }

    if (field_type !== undefined) {
      if (!ALLOWED_FIELD_TYPES.includes(field_type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported field_type. Allowed values: ${ALLOWED_FIELD_TYPES.join(', ')}`,
        });
      }
      updateFields.push('field_type = ?');
      updateValues.push(field_type);
    }

    if (options !== undefined) {
      updateFields.push('options = ?');
      updateValues.push(stringifyOptions(options));
    }

    if (is_required !== undefined) {
      updateFields.push('is_required = ?');
      updateValues.push(is_required ? 1 : 0);
    }

    if (default_value !== undefined) {
      updateFields.push('default_value = ?');
      updateValues.push(default_value);
    }

    if (unit_label !== undefined) {
      updateFields.push('unit_label = ?');
      updateValues.push(unit_label);
    }

    if (min_value !== undefined) {
      updateFields.push('min_value = ?');
      updateValues.push(min_value !== null ? min_value : null);
    }

    if (max_value !== undefined) {
      updateFields.push('max_value = ?');
      updateValues.push(max_value !== null ? max_value : null);
    }

    if (display_order !== undefined) {
      updateFields.push('display_order = ?');
      updateValues.push(display_order);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    updateValues.push(id);

    const query = `UPDATE service_field_templates SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(query, updateValues);

    res.json({
      success: true,
      data: {
        message: 'Field template updated successfully',
      },
    });
  } catch (error) {
    console.error('Update Service Field Template Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update field template',
      message: error.message,
    });
  }
});

router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const templateExists = await db.query('SELECT id FROM service_field_templates WHERE id = ?', [id]);
    if (templateExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Field template not found',
      });
    }

    await db.query('DELETE FROM service_field_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      data: {
        message: 'Field template deleted successfully',
      },
    });
  } catch (error) {
    console.error('Delete Service Field Template Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete field template',
      message: error.message,
    });
  }
});

module.exports = router;

