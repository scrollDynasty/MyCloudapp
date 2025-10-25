import { Edit, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function ServicesManagement() {
  const [serviceGroups, setServiceGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [servicePlans, setServicePlans] = useState([])

  const [groupForm, setGroupForm] = useState({
    name_uz: '',
    name_ru: '',
    description_uz: '',
    description_ru: '',
    slug: '',
    icon: '',
    display_order: 1,
    is_active: true
  })

  const [planForm, setPlanForm] = useState({
    group_id: '',
    name_uz: '',
    name_ru: '',
    description_uz: '',
    description_ru: '',
    price: '',
    discount_price: '',
    currency: 'UZS',
    billing_period: 'monthly',
    display_order: 1,
    is_active: true,
    fields: [] // Характеристики плана
  })

  useEffect(() => {
    fetchServiceGroups()
  }, [])

  const fetchServiceGroups = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/service-groups')
      if (response.data.success && Array.isArray(response.data.data)) {
        setServiceGroups(response.data.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки групп сервисов:', error)
      alert('Не удалось загрузить группы сервисов')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchServicePlans = async (groupId) => {
    try {
      const response = await api.get(`/service-plans?group_id=${groupId}`)
      if (response.data.success && Array.isArray(response.data.data)) {
        setServicePlans(response.data.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки планов:', error)
    }
  }

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm({
      name_uz: '',
      name_ru: '',
      description_uz: '',
      description_ru: '',
      slug: '',
      icon: '',
      display_order: 1,
      is_active: true
    })
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
      is_active: group.is_active ?? true
    })
    setShowGroupModal(true)
  }

  const handleSaveGroup = async (e) => {
    e.preventDefault()
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
    if (!confirm('Вы уверены, что хотите удалить эту группу сервисов?')) return
    
    try {
      await api.delete(`/service-groups-admin/${groupId}`)
      alert('Группа сервисов удалена!')
      fetchServiceGroups()
    } catch (error) {
      console.error('Ошибка удаления группы:', error)
      alert(error.response?.data?.error || 'Не удалось удалить группу')
    }
  }

  const handleCreatePlan = (groupId) => {
    setEditingPlan(null)
    setPlanForm({
      group_id: groupId,
      name_uz: '',
      name_ru: '',
      description_uz: '',
      description_ru: '',
      price: '',
      discount_price: '',
      currency: 'UZS',
      billing_period: 'monthly',
      display_order: 1,
      is_active: true,
      fields: []
    })
    setShowPlanModal(true)
  }

  const handleEditPlan = (plan) => {
    setEditingPlan(plan)
    setPlanForm({
      group_id: plan.group_id,
      name_uz: plan.name_uz || '',
      name_ru: plan.name_ru || '',
      description_uz: plan.description_uz || '',
      description_ru: plan.description_ru || '',
      price: plan.price || '',
      discount_price: plan.discount_price || '',
      currency: plan.currency || 'UZS',
      billing_period: plan.billing_period || 'monthly',
      display_order: plan.display_order || 1,
      is_active: plan.is_active ?? true,
      fields: plan.fields || []
    })
    setShowPlanModal(true)
  }

  const handleSavePlan = async (e) => {
    e.preventDefault()
    try {
      if (editingPlan) {
        await api.put(`/service-plans-admin/${editingPlan.id}`, planForm)
        alert('План обновлен!')
      } else {
        await api.post('/service-plans-admin', planForm)
        alert('План создан!')
      }
      setShowPlanModal(false)
      if (selectedGroupId) {
        fetchServicePlans(selectedGroupId)
      }
    } catch (error) {
      console.error('Ошибка сохранения плана:', error)
      alert(error.response?.data?.error || 'Не удалось сохранить план')
    }
  }

  const handleDeletePlan = async (planId) => {
    if (!confirm('Вы уверены, что хотите удалить этот план?')) return
    
    try {
      await api.delete(`/service-plans-admin/${planId}`)
      alert('План удален!')
      if (selectedGroupId) {
        fetchServicePlans(selectedGroupId)
      }
    } catch (error) {
      console.error('Ошибка удаления плана:', error)
      alert(error.response?.data?.error || 'Не удалось удалить план')
    }
  }

  const addPlanField = () => {
    const newField = {
      field_key: `feature_${Date.now()}`,
      field_label_uz: '',
      field_label_ru: '',
      field_value_uz: '',
      field_value_ru: '',
      field_type: 'text',
      display_order: planForm.fields.length
    }
    setPlanForm({ ...planForm, fields: [...planForm.fields, newField] })
  }

  const removePlanField = (index) => {
    const newFields = planForm.fields.filter((_, i) => i !== index)
    setPlanForm({ ...planForm, fields: newFields })
  }

  const updatePlanField = (index, key, value) => {
    const newFields = [...planForm.fields]
    newFields[index] = { ...newFields[index], [key]: value }
    setPlanForm({ ...planForm, fields: newFields })
  }

  const handleViewPlans = (groupId) => {
    setSelectedGroupId(groupId)
    fetchServicePlans(groupId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Управление сервисами</h1>
        <button
          onClick={handleCreateGroup}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Добавить группу
        </button>
      </div>

      {/* Service Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {serviceGroups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow p-6 border hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{group.name_ru}</h3>
                <p className="text-sm text-gray-600 mb-2">{group.description_ru}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditGroup(group)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-1 text-xs rounded-full ${
                group.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {group.is_active ? 'Активен' : 'Неактивен'}
              </span>
              <span className="text-sm text-gray-500">Порядок: {group.display_order}</span>
            </div>

            <button
              onClick={() => handleViewPlans(group.id)}
              className="w-full mt-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm"
            >
              Просмотр планов
            </button>
            <button
              onClick={() => handleCreatePlan(group.id)}
              className="w-full mt-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 text-sm"
            >
              + Добавить план
            </button>
          </div>
        ))}
      </div>

      {/* Service Plans Section */}
      {selectedGroupId && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Планы для группы: {serviceGroups.find(g => g.id === selectedGroupId)?.name_ru}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleCreatePlan(selectedGroupId)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Добавить план
              </button>
              <button
                onClick={() => setSelectedGroupId(null)}
                className="text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Закрыть
              </button>
            </div>
          </div>

          {servicePlans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">Нет планов в этой группе</p>
              <button
                onClick={() => handleCreatePlan(selectedGroupId)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} />
                Создать первый план
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servicePlans.map((plan) => (
              <div key={plan.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-gray-900">{plan.name_ru}</h4>
                    <p className="text-sm text-gray-600">{plan.description_ru}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div>
                    {plan.discount_price && plan.discount_price < plan.price ? (
                      <>
                        <span className="text-lg font-bold text-green-600">
                          {Number(plan.discount_price).toLocaleString()} {plan.currency}
                        </span>
                        <span className="text-sm text-gray-500 line-through ml-2">
                          {Number(plan.price).toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-gray-900">
                        {Number(plan.price).toLocaleString()} {plan.currency}
                      </span>
                    )}
                    <span className="text-sm text-gray-500 ml-1">/{plan.billing_period === 'monthly' ? 'мес' : 'год'}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {plan.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" 
          style={{ zIndex: 9999 }}
          onClick={() => setShowGroupModal(false)}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                    onChange={(e) => setGroupForm({ ...groupForm, name_uz: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название (RU) *</label>
                  <input
                    type="text"
                    value={groupForm.name_ru}
                    onChange={(e) => setGroupForm({ ...groupForm, name_ru: e.target.value })}
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
                    onChange={(e) => setGroupForm({ ...groupForm, description_uz: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Описание (RU)</label>
                  <textarea
                    value={groupForm.description_ru}
                    onChange={(e) => setGroupForm({ ...groupForm, description_ru: e.target.value })}
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
                    onChange={(e) => setGroupForm({ ...groupForm, slug: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
                  <input
                    type="text"
                    value={groupForm.icon}
                    onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Порядок</label>
                  <input
                    type="number"
                    value={groupForm.display_order}
                    onChange={(e) => setGroupForm({ ...groupForm, display_order: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={groupForm.is_active}
                    onChange={(e) => setGroupForm({ ...groupForm, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  Активна
                </label>
              </div>

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

      {/* Plan Modal */}
      {showPlanModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" 
          style={{ zIndex: 9999 }}
          onClick={() => setShowPlanModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingPlan ? 'Редактировать план' : 'Создать план'}
              </h2>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-6">
              {/* Основная информация */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Основная информация</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название (UZ) *</label>
                    <input
                      type="text"
                      value={planForm.name_uz}
                      onChange={(e) => setPlanForm({ ...planForm, name_uz: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Название (RU) *</label>
                    <input
                      type="text"
                      value={planForm.name_ru}
                      onChange={(e) => setPlanForm({ ...planForm, name_ru: e.target.value })}
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
                      onChange={(e) => setPlanForm({ ...planForm, description_uz: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Описание (RU)</label>
                    <textarea
                      value={planForm.description_ru}
                      onChange={(e) => setPlanForm({ ...planForm, description_ru: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows="3"
                    />
                  </div>
                </div>
              </div>

              {/* Ценообразование */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold text-gray-900">Ценообразование</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Цена *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={planForm.price}
                      onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
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
                      onChange={(e) => setPlanForm({ ...planForm, discount_price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Валюта</label>
                    <select
                      value={planForm.currency}
                      onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UZS">UZS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Период</label>
                    <select
                      value={planForm.billing_period}
                      onChange={(e) => setPlanForm({ ...planForm, billing_period: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="monthly">Месячный</option>
                      <option value="yearly">Годовой</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Порядок отображения</label>
                    <input
                      type="number"
                      value={planForm.display_order}
                      onChange={(e) => setPlanForm({ ...planForm, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Характеристики плана */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Характеристики плана</h3>
                  <button
                    type="button"
                    onClick={addPlanField}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Plus size={16} />
                    Добавить характеристику
                  </button>
                </div>

                {planForm.fields.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 mb-2">Нет характеристик</p>
                    <p className="text-sm text-gray-400">Добавьте характеристики плана (CPU, RAM, Storage и т.д.)</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {planForm.fields.map((field, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-medium text-gray-700">Характеристика #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removePlanField(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Название (UZ)</label>
                            <input
                              type="text"
                              value={field.field_label_uz}
                              onChange={(e) => updatePlanField(index, 'field_label_uz', e.target.value)}
                              placeholder="CPU"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Название (RU)</label>
                            <input
                              type="text"
                              value={field.field_label_ru}
                              onChange={(e) => updatePlanField(index, 'field_label_ru', e.target.value)}
                              placeholder="Процессор"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Значение (UZ)</label>
                            <input
                              type="text"
                              value={field.field_value_uz}
                              onChange={(e) => updatePlanField(index, 'field_value_uz', e.target.value)}
                              placeholder="4 cores"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Значение (RU)</label>
                            <input
                              type="text"
                              value={field.field_value_ru}
                              onChange={(e) => updatePlanField(index, 'field_value_ru', e.target.value)}
                              placeholder="4 ядра"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Статус */}
              <div className="pt-4 border-t">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={planForm.is_active}
                    onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Активен</span>
                </label>
              </div>

              {/* Кнопки действий */}
              <div className="flex gap-4 pt-4 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
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
    </div>
  )
}
