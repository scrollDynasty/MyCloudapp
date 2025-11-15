import { Edit, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик', badge: 'bg-gray-100 text-gray-700' },
  { value: 'active', label: 'Активный', badge: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: 'Приостановлен', badge: 'bg-yellow-100 text-yellow-800' },
  { value: 'archived', label: 'Архив', badge: 'bg-slate-100 text-slate-700' },
]

const BILLING_PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Месячный' },
  { value: 'yearly', label: 'Годовой' },
  { value: 'once', label: 'Разовый' },
]

const FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Многострочный текст' },
  { value: 'number', label: 'Число' },
  { value: 'price', label: 'Цена' },
  { value: 'select', label: 'Список (select)' },
  { value: 'date', label: 'Дата' },
  { value: 'boolean', label: 'Да / Нет' },
  { value: 'list', label: 'Список (через запятую)' },
]

const BOOLEAN_OPTIONS = [
  { value: 'true', label: 'Да' },
  { value: 'false', label: 'Нет' },
]

const emptyGroupForm = {
  name_uz: '',
  name_ru: '',
  description_uz: '',
  description_ru: '',
  slug: '',
  icon: '',
  display_order: 1,
  is_active: true,
}

const emptyPlanForm = {
  group_id: '',
  name_uz: '',
  name_ru: '',
  description_uz: '',
  description_ru: '',
  price: '',
  discount_price: '',
  currency: 'UZS',
  billing_period: 'monthly',
  status: 'active',
  domain_name: '',
  notes: '',
  display_order: 1,
  is_active: true,
}

const emptyTemplateForm = {
  group_id: '',
  field_key: '',
  label_uz: '',
  label_ru: '',
  description_uz: '',
  description_ru: '',
  field_type: 'text',
  options: '',
  is_required: false,
  default_value: '',
  unit_label: '',
  min_value: '',
  max_value: '',
  display_order: 0,
}

const slugify = (value) => {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 100)
}

const hasContent = (value) => value !== null && value !== undefined && value !== ''

const formatPrice = (value, currency) => {
  const numeric = Number(value || 0)
  if (Number.isNaN(numeric)) return `0 ${currency || 'UZS'}`
  return `${numeric.toLocaleString()} ${currency || 'UZS'}`
}

const buildOptionsTextareaValue = (options) => {
  if (!Array.isArray(options) || options.length === 0) return ''
  return options
    .map((option) => {
      const value = option.value ?? option.id ?? option.code ?? ''
      const label = option.label_ru ?? option.label ?? option.name_ru ?? option.name ?? value
      return label && label !== value ? `${value}|${label}` : value
    })
    .join('\n')
}

const createCustomField = () => ({
  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  field_key: '',
  field_label_ru: '',
  field_label_uz: '',
  field_value_ru: '',
  field_value_uz: '',
  field_type: 'text',
  display_order: 0,
})

export default function ServicesManagement() {
  const [serviceGroups, setServiceGroups] = useState([])
  const [servicePlans, setServicePlans] = useState([])
  const [fieldTemplates, setFieldTemplates] = useState([])

  const [isGroupsLoading, setIsGroupsLoading] = useState(true)
  const [isPlansLoading, setIsPlansLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const [selectedGroupId, setSelectedGroupId] = useState(null)

  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  const [editingGroup, setEditingGroup] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)

  const [groupForm, setGroupForm] = useState(emptyGroupForm)
  const [planForm, setPlanForm] = useState(emptyPlanForm)
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm)

  const [planFieldValues, setPlanFieldValues] = useState({})
  const [customFields, setCustomFields] = useState([])

  const selectedGroup = useMemo(
    () => serviceGroups.find((group) => group.id === selectedGroupId) || null,
    [serviceGroups, selectedGroupId]
  )

  const fetchServiceGroups = useCallback(async () => {
    setIsGroupsLoading(true)
    try {
      const response = await api.get('/service-groups')
      if (response.data.success && Array.isArray(response.data.data)) {
        setServiceGroups(response.data.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки групп сервисов:', error)
      alert('Не удалось загрузить группы сервисов')
    } finally {
      setIsGroupsLoading(false)
    }
  }, [])

  const fetchServicePlans = useCallback(async (groupId) => {
    if (!groupId) return
    setIsPlansLoading(true)
    try {
      const response = await api.get(`/service-plans-admin?group_id=${groupId}&include_inactive=true`)
      if (response.data.success && Array.isArray(response.data.data)) {
        setServicePlans(response.data.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки планов:', error)
      alert('Не удалось загрузить планы сервиса')
    } finally {
      setIsPlansLoading(false)
    }
  }, [])

  const fetchFieldTemplates = useCallback(async (groupId) => {
    if (!groupId) {
      setFieldTemplates([])
      return []
    }
    setTemplatesLoading(true)
    try {
      const response = await api.get(`/service-field-templates?group_id=${groupId}`)
      const templates = response.data?.data ?? []
      setFieldTemplates(templates)
      return templates
    } catch (error) {
      console.error('Ошибка загрузки шаблонов полей:', error)
      alert('Не удалось загрузить поля для этого сервиса')
      setFieldTemplates([])
      return []
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServiceGroups()
  }, [fetchServiceGroups])

  useEffect(() => {
    if (!selectedGroupId) return
    fetchServicePlans(selectedGroupId)
    fetchFieldTemplates(selectedGroupId)
  }, [selectedGroupId, fetchServicePlans, fetchFieldTemplates])

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm(emptyGroupForm)
    setShowGroupModal(true)
  }

  const handleEditGroup = (group) => {
    setEditingGroup(group)
    setGroupForm({
      name_uz: group.name_uz || '',
      name_ru: group.name_ru || '',
      description_uz: group.description_uz || '',
      description_ru: group.description_ru || '',
      slug: group.slug || '',
      icon: group.icon || '',
      display_order: group.display_order || 1,
      is_active: group.is_active ?? true,
    })
    setShowGroupModal(true)
  }

  const handleSaveGroup = async (event) => {
    event.preventDefault()
    try {
      if (editingGroup) {
        await api.put(`/service-groups-admin/${editingGroup.id}`, groupForm)
        alert('Группа сервисов обновлена!')
      } else {
        await api.post('/service-groups-admin', groupForm)
        alert('Группа сервисов создана!')
      }
      setShowGroupModal(false)
      fetchServiceGroups()
    } catch (error) {
      console.error('Ошибка сохранения группы:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить группу')
    }
  }

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Удалить эту группу сервисов?')) return
    try {
      await api.delete(`/service-groups-admin/${groupId}`)
      alert('Группа сервисов удалена!')
      if (groupId === selectedGroupId) {
        setSelectedGroupId(null)
        setServicePlans([])
        setFieldTemplates([])
      }
      fetchServiceGroups()
    } catch (error) {
      console.error('Ошибка удаления группы:', error)
      alert(error.response?.data?.error || 'Не удалось удалить группу')
    }
  }

  const seedTemplateDefaults = (templates) => {
    const defaults = {}
    templates.forEach((template) => {
      if (hasContent(template.default_value)) {
        defaults[template.id] = {
          value_ru: template.default_value,
          value_uz: template.default_value,
        }
      }
    })
    return defaults
  }

  const openPlanModal = (initialPlanForm, templateDefaults, existingCustomFields = []) => {
    setPlanForm(initialPlanForm)
    setPlanFieldValues(templateDefaults)
    setCustomFields(
      existingCustomFields.length
        ? existingCustomFields.map((field, index) => ({
            id: `${field.id || index}_${Date.now()}`,
            ...field,
            display_order: field.display_order ?? index,
          }))
        : []
    )
    setShowPlanModal(true)
  }

  const handleCreatePlan = async (groupId) => {
    const templates = await fetchFieldTemplates(groupId)
    const defaults = seedTemplateDefaults(templates)
    openPlanModal(
      {
        ...emptyPlanForm,
        group_id: groupId,
        display_order: servicePlans.length + 1,
      },
      defaults
    )
    setEditingPlan(null)
  }

  const handleEditPlan = async (plan) => {
    try {
      const planResponse = await api.get(`/service-plans-admin/${plan.id}`)
      const planData = planResponse.data?.data
      if (!planData) throw new Error('Plan data missing')

      const templates = await fetchFieldTemplates(planData.group_id)
      const defaults = seedTemplateDefaults(templates)
      const templateValues = { ...defaults }
      const adhocFields = []

      ;(planData.fields || []).forEach((field) => {
        if (field.definition_id) {
          templateValues[field.definition_id] = {
            value_ru: field.field_value_ru || '',
            value_uz: field.field_value_uz || '',
          }
        } else {
          adhocFields.push({
            field_key: field.field_key,
            field_label_ru: field.field_label_ru,
            field_label_uz: field.field_label_uz,
            field_value_ru: field.field_value_ru,
            field_value_uz: field.field_value_uz,
            field_type: field.field_type || 'text',
            display_order: field.display_order || 0,
          })
        }
      })

      openPlanModal(
        {
          group_id: planData.group_id,
          name_uz: planData.name_uz || '',
          name_ru: planData.name_ru || '',
          description_uz: planData.description_uz || '',
          description_ru: planData.description_ru || '',
          price: planData.price ?? '',
          discount_price: planData.discount_price ?? '',
          currency: planData.currency || 'UZS',
          billing_period: planData.billing_period || 'monthly',
          status: planData.status || 'active',
          domain_name: planData.domain_name || '',
          notes: planData.notes || '',
          display_order: planData.display_order || 1,
          is_active: planData.is_active ?? true,
        },
        templateValues,
        adhocFields
      )
      setEditingPlan(planData)
    } catch (error) {
      console.error('Ошибка загрузки плана:', error)
      alert('Не удалось загрузить план для редактирования')
    }
  }

  const handleTemplateValueChange = (templateId, locale, value) => {
    setPlanFieldValues((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [locale]: value,
      },
    }))
  }

  const handleAddCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        ...createCustomField(),
        display_order: prev.length,
      },
    ])
  }

  const handleCustomFieldChange = (fieldId, key, value) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
    )
  }

  const handleRemoveCustomField = (fieldId) => {
    setCustomFields((prev) => prev.filter((field) => field.id !== fieldId))
  }

  const buildFieldsPayload = () => {
    const templateFieldsPayload = fieldTemplates
      .map((template) => {
        const entry = planFieldValues[template.id]
        if (!entry) {
          return null
        }
        const hasInput =
          hasContent(entry.value_ru?.toString().trim()) || hasContent(entry.value_uz?.toString().trim())
        if (!hasInput) {
          return null
        }

        return {
          definition_id: template.id,
          field_value_ru: entry.value_ru ?? '',
          field_value_uz: entry.value_uz ?? '',
        }
      })
      .filter(Boolean)

    const customFieldsPayload = customFields
      .filter(
        (field) =>
          field.field_label_ru &&
          (hasContent(field.field_value_ru?.toString().trim()) ||
            hasContent(field.field_value_uz?.toString().trim()))
      )
      .map((field, index) => ({
        field_key: field.field_key || slugify(field.field_label_ru || field.field_label_uz || `custom_${index}`),
        field_label_ru: field.field_label_ru,
        field_label_uz: field.field_label_uz,
        field_value_ru: field.field_value_ru,
        field_value_uz: field.field_value_uz,
        field_type: field.field_type || 'text',
        display_order: 5000 + index,
      }))

    return [...templateFieldsPayload, ...customFieldsPayload]
  }

  const validateRequiredTemplates = () => {
    const missing = fieldTemplates
      .filter((template) => template.is_required)
      .filter((template) => {
        const entry = planFieldValues[template.id]
        if (!entry) {
          return !hasContent(template.default_value)
        }
        const hasInput =
          hasContent(entry.value_ru?.toString().trim()) || hasContent(entry.value_uz?.toString().trim())
        return !hasInput && !hasContent(template.default_value)
      })
    if (missing.length > 0) {
      alert(`Заполните обязательные поля: ${missing.map((item) => item.label_ru).join(', ')}`)
      return false
    }
    return true
  }

  const handleSavePlan = async (event) => {
    event.preventDefault()
    if (!validateRequiredTemplates()) {
      return
    }

    const payload = {
      ...planForm,
      price: planForm.price ? Number(planForm.price) : null,
      discount_price: planForm.discount_price ? Number(planForm.discount_price) : null,
      fields: buildFieldsPayload(),
    }

    try {
      if (editingPlan) {
        await api.put(`/service-plans-admin/${editingPlan.id}`, payload)
        alert('План обновлен!')
      } else {
        await api.post('/service-plans-admin', payload)
        alert('План создан!')
      }
      setShowPlanModal(false)
      fetchServicePlans(planForm.group_id)
    } catch (error) {
      console.error('Ошибка сохранения плана:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить план')
    }
  }

  const handleDeletePlan = async (planId) => {
    if (!confirm('Удалить этот план?')) return
    try {
      await api.delete(`/service-plans-admin/${planId}`)
      alert('План удален!')
      fetchServicePlans(selectedGroupId)
    } catch (error) {
      console.error('Ошибка удаления плана:', error)
      alert(error.response?.data?.error || 'Не удалось удалить план')
    }
  }

  const handleCreateTemplate = () => {
    if (!selectedGroupId) return
    setEditingTemplate(null)
    setTemplateForm({
      ...emptyTemplateForm,
      group_id: selectedGroupId,
      display_order: fieldTemplates.length,
    })
    setShowTemplateModal(true)
  }

  const handleEditTemplate = (template) => {
    setEditingTemplate(template)
    setTemplateForm({
      group_id: template.group_id,
      field_key: template.field_key,
      label_uz: template.label_uz,
      label_ru: template.label_ru,
      description_uz: template.description_uz || '',
      description_ru: template.description_ru || '',
      field_type: template.field_type || 'text',
      options: buildOptionsTextareaValue(template.options),
      is_required: template.is_required ?? false,
      default_value: template.default_value || '',
      unit_label: template.unit_label || '',
      min_value: template.min_value ?? '',
      max_value: template.max_value ?? '',
      display_order: template.display_order || 0,
    })
    setShowTemplateModal(true)
  }

  const handleSaveTemplate = async (event) => {
    event.preventDefault()
    try {
      if (editingTemplate) {
        await api.put(`/service-field-templates/${editingTemplate.id}`, templateForm)
        alert('Поле обновлено!')
      } else {
        await api.post('/service-field-templates', templateForm)
        alert('Поле добавлено!')
      }
      setShowTemplateModal(false)
      fetchFieldTemplates(selectedGroupId)
    } catch (error) {
      console.error('Ошибка сохранения шаблона поля:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить поле')
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Удалить это поле?')) return
    try {
      await api.delete(`/service-field-templates/${templateId}`)
      alert('Поле удалено!')
      fetchFieldTemplates(selectedGroupId)
    } catch (error) {
      console.error('Ошибка удаления шаблона поля:', error)
      alert(error.response?.data?.error || 'Не удалось удалить поле')
    }
  }

  const handleViewPlans = (groupId) => {
    setSelectedGroupId(groupId)
  }

  const statusMeta = (status) => STATUS_OPTIONS.find((option) => option.value === status) || STATUS_OPTIONS[0]

  const renderTemplateField = (template) => {
    const value = planFieldValues[template.id] || { value_ru: '', value_uz: '' }
    const unit = template.unit_label ? ` (${template.unit_label})` : ''
    const description = template.description_ru || template.description_uz

    const inputProps = {
      className:
        'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500',
    }

    const renderInput = (locale, placeholder) => {
      if (template.field_type === 'textarea' || template.field_type === 'list') {
        return (
          <textarea
            rows={template.field_type === 'textarea' ? 3 : 2}
            value={value[locale] || ''}
            placeholder={placeholder}
            onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
            {...inputProps}
          />
        )
      }

      if (template.field_type === 'number' || template.field_type === 'price') {
        return (
          <input
            type="number"
            value={value[locale] || ''}
            placeholder={placeholder}
            onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
            {...inputProps}
          />
        )
      }

      if (template.field_type === 'date') {
        return (
          <input
            type="date"
            value={value[locale] || ''}
            onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
            {...inputProps}
          />
        )
      }

      if (template.field_type === 'boolean') {
        return (
          <select
            value={value[locale] || ''}
            onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
            {...inputProps}
          >
            <option value="">—</option>
            {BOOLEAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
      }

      if (template.field_type === 'select' && Array.isArray(template.options) && template.options.length > 0) {
        return (
          <select
            value={value[locale] || ''}
            onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
            {...inputProps}
          >
            <option value="">Выберите значение</option>
            {template.options.map((option) => (
              <option key={option.value || option.label} value={option.value || option.label}>
                {option.label_ru || option.label || option.value}
              </option>
            ))}
          </select>
        )
      }

      return (
        <input
          type="text"
          value={value[locale] || ''}
          placeholder={placeholder}
          onChange={(event) => handleTemplateValueChange(template.id, locale, event.target.value)}
          {...inputProps}
        />
      )
    }

    return (
      <div key={template.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {template.label_ru}
              {unit}
            </p>
            {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              template.is_required ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {template.is_required ? 'Обязательно' : 'Опционально'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Значение (RU)</label>
            {renderInput('value_ru', 'Значение на русском')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Значение (UZ)</label>
            {renderInput('value_uz', 'Znacheniye (UZ)')}
          </div>
        </div>
      </div>
    )
  }

  const handleClosePlanModal = () => {
    setShowPlanModal(false)
    setEditingPlan(null)
    setPlanForm(emptyPlanForm)
    setPlanFieldValues({})
    setCustomFields([])
  }

  if (isGroupsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Управление сервисами</h1>
          <p className="text-sm text-gray-500 mt-1">Типы услуг, их шаблоны и тарифы</p>
        </div>
        <button
          onClick={handleCreateGroup}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Добавить группу
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {serviceGroups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">{group.name_ru}</p>
                <p className="text-sm text-gray-500">{group.description_ru || '—'}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditGroup(group)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Редактировать"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Удалить"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  group.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {group.is_active ? 'Активна' : 'Скрыта'}
              </span>
              <span>Порядок: {group.display_order}</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleViewPlans(group.id)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  selectedGroupId === group.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {selectedGroupId === group.id ? 'Открыто' : 'Просмотр планов'}
              </button>
              <button
                onClick={() => handleCreatePlan(group.id)}
                className="w-full bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 text-sm"
              >
                + Новый план
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedGroup && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border p-6 space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase text-gray-500">Выбранная группа</p>
              <h2 className="text-2xl font-bold text-gray-900">{selectedGroup.name_ru}</h2>
              {selectedGroup.description_ru && (
                <p className="text-sm text-gray-600">{selectedGroup.description_ru}</p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-500">Тарифов</p>
                <p className="text-lg font-semibold text-gray-900">{servicePlans.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Шаблонов полей</p>
                <p className="text-lg font-semibold text-gray-900">{fieldTemplates.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Статус</p>
                <span
                  className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedGroup.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {selectedGroup.is_active ? 'Активна' : 'Скрыта'}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500">Порядок</p>
                <p className="text-lg font-semibold text-gray-900">{selectedGroup.display_order}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCreatePlan(selectedGroup.id)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus size={16} />
                Добавить план
              </button>
              <button
                onClick={handleCreateTemplate}
                className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-100 text-sm"
              >
                <Plus size={16} />
                Поле (шаблон)
              </button>
              <button
                onClick={() => setSelectedGroupId(null)}
                className="inline-flex items-center gap-2 text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow border p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Тарифы группы</h3>
                  <p className="text-sm text-gray-500">
                    Управляйте тарифами и их отображением в каталоге
                  </p>
                </div>
                <button
                  onClick={() => handleCreatePlan(selectedGroup.id)}
                  className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-100 text-sm"
                >
                  <Plus size={16} />
                  Новый план
                </button>
              </div>

              {isPlansLoading ? (
                <div className="flex items-center justify-center h-40 text-gray-500">Загрузка планов...</div>
              ) : servicePlans.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg">
                  <p className="text-gray-500 mb-4">В этой группе пока нет тарифов</p>
                  <button
                    onClick={() => handleCreatePlan(selectedGroup.id)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus size={18} />
                    Создать первый план
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {servicePlans.map((plan) => {
                    const status = statusMeta(plan.status)
                    const primaryPrice = plan.discount_price && plan.discount_price < plan.price
                      ? plan.discount_price
                      : plan.price
                    const hasDiscount = plan.discount_price && plan.discount_price < plan.price
                    return (
                      <div key={plan.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase text-gray-500">{plan.name_uz}</p>
                            <h4 className="text-lg font-semibold text-gray-900">{plan.name_ru}</h4>
                            {plan.description_ru && (
                              <p className="text-sm text-gray-600 mt-1">{plan.description_ru}</p>
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.badge}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-baseline gap-3 mt-3">
                          <p className="text-2xl font-bold text-indigo-600">
                            {formatPrice(primaryPrice, plan.currency)}
                            <span className="text-sm text-gray-500 font-normal ml-1">
                              /{' '}
                              {plan.billing_period === 'monthly'
                                ? 'мес'
                                : plan.billing_period === 'yearly'
                                  ? 'год'
                                  : 'разово'}
                            </span>
                          </p>
                          {hasDiscount && (
                            <p className="text-sm text-gray-500 line-through">
                              {formatPrice(plan.price, plan.currency)}
                            </p>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {plan.is_active ? 'Опубликован' : 'Скрыт'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-3">
                          <span>Порядок: {plan.display_order}</span>
                          <span>Полей: {plan.fields_count ?? 0}</span>
                          {plan.domain_name && <span>Домен: {plan.domain_name}</span>}
                        </div>

                        {plan.notes && (
                          <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
                            {plan.notes}
                          </p>
                        )}

                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleEditPlan(plan)}
                            className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          >
                            <Edit size={16} />
                            Редактировать
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="inline-flex items-center justify-center gap-2 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 text-sm"
                          >
                            <Trash2 size={16} />
                            Удалить
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Шаблоны полей</h3>
                  <p className="text-sm text-gray-500">
                    Настройте набор характеристик для всех планов группы
                  </p>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-100 text-sm"
                >
                  <Plus size={16} />
                  Поле
                </button>
              </div>

              {templatesLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-500">Загрузка полей...</div>
              ) : fieldTemplates.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-lg">
                  <p className="text-gray-500 mb-2">Нет шаблонов полей</p>
                  <p className="text-xs text-gray-400">
                    Добавьте поле, чтобы быстро создавать VPS, видео и другие услуги
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fieldTemplates.map((template) => {
                    const typeLabel =
                      FIELD_TYPES.find((type) => type.value === template.field_type)?.label ||
                      template.field_type
                    return (
                      <div
                        key={template.id}
                        className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{template.label_ru}</p>
                            <p className="text-xs text-gray-500">
                              Ключ: {template.field_key} · Тип: {typeLabel}
                            </p>
                            {template.description_ru && (
                              <p className="text-xs text-gray-500 mt-1">{template.description_ru}</p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              template.is_required ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {template.is_required ? 'Обязательное' : 'Опциональное'}
                          </span>
                        </div>
                        {template.default_value && (
                          <p className="text-xs text-gray-500">
                            Значение по умолчанию: {template.default_value}
                          </p>
                        )}
                        <div className="flex gap-2 text-sm">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                          >
                            <Edit size={14} />
                            Править
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="inline-flex items-center justify-center gap-2 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
          onClick={() => setShowGroupModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingGroup ? 'Редактировать группу' : 'Создать группу'}
              </h2>
            </div>

            <form onSubmit={handleSaveGroup} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название (UZ) *</label>
                  <input
                    type="text"
                    value={groupForm.name_uz}
                    onChange={(event) => setGroupForm({ ...groupForm, name_uz: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название (RU) *</label>
                  <input
                    type="text"
                    value={groupForm.name_ru}
                    onChange={(event) => setGroupForm({ ...groupForm, name_ru: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание (UZ)</label>
                  <textarea
                    value={groupForm.description_uz}
                    onChange={(event) => setGroupForm({ ...groupForm, description_uz: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание (RU)</label>
                  <textarea
                    value={groupForm.description_ru}
                    onChange={(event) => setGroupForm({ ...groupForm, description_ru: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
                  <input
                    type="text"
                    value={groupForm.slug}
                    onChange={(event) => setGroupForm({ ...groupForm, slug: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
                  <input
                    type="text"
                    value={groupForm.icon}
                    onChange={(event) => setGroupForm({ ...groupForm, icon: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Порядок</label>
                  <input
                    type="number"
                    value={groupForm.display_order}
                    onChange={(event) =>
                      setGroupForm({ ...groupForm, display_order: parseInt(event.target.value, 10) || 0 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={groupForm.is_active}
                  onChange={(event) => setGroupForm({ ...groupForm, is_active: event.target.checked })}
                />
                Активна
              </label>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
          onClick={handleClosePlanModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingPlan ? 'Редактировать план' : 'Создать план'}
              </h2>
              {selectedGroup && (
                <p className="text-sm text-gray-500 mt-1">Группа: {selectedGroup.name_ru}</p>
              )}
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-6">
              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Основная информация</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название (UZ) *</label>
                    <input
                      type="text"
                      value={planForm.name_uz}
                      onChange={(event) => setPlanForm({ ...planForm, name_uz: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название (RU) *</label>
                    <input
                      type="text"
                      value={planForm.name_ru}
                      onChange={(event) => setPlanForm({ ...planForm, name_ru: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Описание (UZ)</label>
                    <textarea
                      value={planForm.description_uz}
                      onChange={(event) => setPlanForm({ ...planForm, description_uz: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Описание (RU)</label>
                    <textarea
                      value={planForm.description_ru}
                      onChange={(event) => setPlanForm({ ...planForm, description_ru: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900">Цены и статус</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Цена *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={planForm.price}
                      onChange={(event) => setPlanForm({ ...planForm, price: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Цена со скидкой</label>
                    <input
                      type="number"
                      step="0.01"
                      value={planForm.discount_price}
                      onChange={(event) => setPlanForm({ ...planForm, discount_price: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Валюта</label>
                    <select
                      value={planForm.currency}
                      onChange={(event) => setPlanForm({ ...planForm, currency: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UZS">UZS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Период оплаты</label>
                    <select
                      value={planForm.billing_period}
                      onChange={(event) => setPlanForm({ ...planForm, billing_period: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {BILLING_PERIOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Статус плана</label>
                    <select
                      value={planForm.status}
                      onChange={(event) => setPlanForm({ ...planForm, status: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Порядок</label>
                    <input
                      type="number"
                      value={planForm.display_order}
                      onChange={(event) =>
                        setPlanForm({ ...planForm, display_order: parseInt(event.target.value, 10) || 0 })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900">Дополнительные параметры</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Домен</label>
                    <input
                      type="text"
                      value={planForm.domain_name}
                      onChange={(event) => setPlanForm({ ...planForm, domain_name: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Заметки админа</label>
                    <textarea
                      value={planForm.notes}
                      onChange={(event) => setPlanForm({ ...planForm, notes: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Шаблонные поля</h3>
                  <button
                    type="button"
                    onClick={handleCreateTemplate}
                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus size={16} />
                    Добавить поле
                  </button>
                </div>
                {templatesLoading ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">Загрузка шаблонов...</div>
                ) : fieldTemplates.length === 0 ? (
                  <div className="text-center py-10 border border-dashed rounded-lg">
                    <p className="text-gray-500">Нет ни одного шаблона. Добавьте поля в разделе группы.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fieldTemplates.map((template) => renderTemplateField(template))}
                  </div>
                )}
              </section>

              <section className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Кастомные поля</h3>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Plus size={16} />
                    Свое поле
                  </button>
                </div>
                {customFields.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500 text-sm">Дополнительные поля не добавлены</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customFields.map((field) => (
                      <div key={field.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium text-gray-700">
                            Поле: {field.field_label_ru || 'без названия'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(field.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Удалить
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Название (RU)</label>
                            <input
                              type="text"
                              value={field.field_label_ru}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_label_ru', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Название (UZ)</label>
                            <input
                              type="text"
                              value={field.field_label_uz}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_label_uz', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Значение (RU)</label>
                            <input
                              type="text"
                              value={field.field_value_ru}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_value_ru', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Значение (UZ)</label>
                            <input
                              type="text"
                              value={field.field_value_uz}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_value_uz', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Ключ поля</label>
                            <input
                              type="text"
                              value={field.field_key}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_key', slugify(event.target.value))
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                              placeholder="auto"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Тип</label>
                            <select
                              value={field.field_type}
                              onChange={(event) =>
                                handleCustomFieldChange(field.id, 'field_type', event.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Порядок</label>
                            <input
                              type="number"
                              value={field.display_order ?? 0}
                              onChange={(event) =>
                                handleCustomFieldChange(
                                  field.id,
                                  'display_order',
                                  parseInt(event.target.value, 10) || 0
                                )
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="border-t pt-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={planForm.is_active}
                    onChange={(event) => setPlanForm({ ...planForm, is_active: event.target.checked })}
                  />
                  Активен
                </label>
              </section>

              <div className="flex gap-4 pt-4 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={handleClosePlanModal}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingPlan ? 'Сохранить изменения' : 'Создать план'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTemplate ? 'Редактировать поле' : 'Новое поле шаблона'}
              </h2>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ключ *</label>
                  <input
                    type="text"
                    value={templateForm.field_key}
                    onChange={(event) => setTemplateForm({ ...templateForm, field_key: slugify(event.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Тип поля *</label>
                  <select
                    value={templateForm.field_type}
                    onChange={(event) => setTemplateForm({ ...templateForm, field_type: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название (UZ) *</label>
                  <input
                    type="text"
                    value={templateForm.label_uz}
                    onChange={(event) => setTemplateForm({ ...templateForm, label_uz: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название (RU) *</label>
                  <input
                    type="text"
                    value={templateForm.label_ru}
                    onChange={(event) => setTemplateForm({ ...templateForm, label_ru: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Подсказка (UZ)</label>
                  <textarea
                    value={templateForm.description_uz}
                    onChange={(event) => setTemplateForm({ ...templateForm, description_uz: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Подсказка (RU)</label>
                  <textarea
                    value={templateForm.description_ru}
                    onChange={(event) => setTemplateForm({ ...templateForm, description_ru: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Опции (для select/list)</label>
                  <textarea
                    value={templateForm.options}
                    onChange={(event) => setTemplateForm({ ...templateForm, options: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder={'value|label\nvalue2|label2'}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Значение по умолчанию</label>
                    <input
                      type="text"
                      value={templateForm.default_value}
                      onChange={(event) => setTemplateForm({ ...templateForm, default_value: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ед. измерения</label>
                    <input
                      type="text"
                      value={templateForm.unit_label}
                      onChange={(event) => setTemplateForm({ ...templateForm, unit_label: event.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="MB/s, шт., GB"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Мин. значение</label>
                  <input
                    type="number"
                    value={templateForm.min_value}
                    onChange={(event) => setTemplateForm({ ...templateForm, min_value: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Макс. значение</label>
                  <input
                    type="number"
                    value={templateForm.max_value}
                    onChange={(event) => setTemplateForm({ ...templateForm, max_value: event.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={templateForm.is_required}
                    onChange={(event) => setTemplateForm({ ...templateForm, is_required: event.target.checked })}
                  />
                  Обязательное поле
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Порядок</span>
                  <input
                    type="number"
                    value={templateForm.display_order}
                    onChange={(event) =>
                      setTemplateForm({ ...templateForm, display_order: parseInt(event.target.value, 10) || 0 })
                    }
                    className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Сохранить поле
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}