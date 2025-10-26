import { Edit, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function VPSPlans() {
  const [vpsPlans, setVpsPlans] = useState([])
  const [serviceGroups, setServiceGroups] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  
  const [editForm, setEditForm] = useState({
    plan_name: '',
    cpu_cores: '',
    ram_gb: '',
    storage_gb: '',
    price_per_month: '',
    currency: 'UZS',
    location: '',
    provider: ''
  })

  useEffect(() => {
    fetchVPSPlans()
    fetchServiceGroups()
  }, [])

  const fetchVPSPlans = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/vps')
      const data = res.data?.data ?? res.data ?? []
      setVpsPlans(data)
    } catch (error) {
      console.error('Ошибка загрузки VPS планов:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchServiceGroups = async () => {
    try {
      const response = await api.get('/service-groups')
      if (response.data.success && Array.isArray(response.data.data)) {
        setServiceGroups(response.data.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки групп сервисов:', error)
    }
  }

  const handleEditPlan = (plan) => {
    setEditingPlan(plan)
    setEditForm({
      plan_name: plan.plan_name || plan.name || '',
      cpu_cores: plan.cpu_cores || plan.cpu_ores || '',
      ram_gb: plan.ram_gb || '',
      storage_gb: plan.storage_gb || '',
      price_per_month: plan.price_per_month || plan.price_monthly || plan.price || '',
      currency: plan.currency || plan.currency_code || 'UZS',
      location: plan.location || plan.region?.name || plan.region || '',
      provider: plan.provider || ''
    })
    setShowEditModal(true)
  }

  const handleCreatePlan = () => {
    setEditingPlan(null)
    setEditForm({
      plan_name: '',
      cpu_cores: '',
      ram_gb: '',
      storage_gb: '',
      price_per_month: '',
      currency: 'UZS',
      location: '',
      provider: ''
    })
    setShowCreateModal(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/vps-admin/${editingPlan.plan_id || editingPlan.id}`, editForm)
      alert('VPS план обновлен!')
      setShowEditModal(false)
      fetchVPSPlans()
    } catch (error) {
      console.error('Ошибка обновления VPS плана:', error)
      alert(error.response?.data?.error || 'Не удалось обновить VPS план')
    }
  }

  const handleSaveCreate = async (e) => {
    e.preventDefault()
    try {
      await api.post('/vps-admin', editForm)
      alert('VPS план создан!')
      setShowCreateModal(false)
      fetchVPSPlans()
    } catch (error) {
      console.error('Ошибка создания VPS плана:', error)
      alert(error.response?.data?.error || 'Не удалось создать VPS план')
    }
  }

  const handleConvertToServicePlan = async (vpsplan, groupId) => {
    if (!groupId) {
      alert('Выберите группу сервисов!')
      return
    }

    try {
      const planData = {
        group_id: groupId,
        name_uz: vpsplan.plan_name || vpsplan.name || 'VPS Plan',
        name_ru: vpsplan.plan_name || vpsplan.name || 'VPS Plan',
        description_uz: `VPS: ${vpsplan.cpu_cores || vpsplan.cpu_ores || 0} CPU, ${vpsplan.ram_gb || 0} GB RAM, ${vpsplan.storage_gb || 0} GB Storage`,
        description_ru: `VPS: ${vpsplan.cpu_cores || vpsplan.cpu_ores || 0} CPU, ${vpsplan.ram_gb || 0} GB RAM, ${vpsplan.storage_gb || 0} GB Storage`,
        price: vpsplan.price_per_month || vpsplan.price_monthly || vpsplan.price || 0,
        currency: vpsplan.currency || vpsplan.currency_code || 'UZS',
        billing_period: 'monthly',
        is_active: true,
        fields: [
          {
            field_key: 'cpu',
            field_label_uz: 'CPU',
            field_label_ru: 'Процессор',
            field_value_uz: `${vpsplan.cpu_cores || vpsplan.cpu_ores || 0} cores`,
            field_value_ru: `${vpsplan.cpu_cores || vpsplan.cpu_ores || 0} ядер`,
            field_type: 'text',
            display_order: 0
          },
          {
            field_key: 'ram',
            field_label_uz: 'RAM',
            field_label_ru: 'Оперативная память',
            field_value_uz: `${vpsplan.ram_gb || 0} GB`,
            field_value_ru: `${vpsplan.ram_gb || 0} ГБ`,
            field_type: 'text',
            display_order: 1
          },
          {
            field_key: 'storage',
            field_label_uz: 'Storage',
            field_label_ru: 'Хранилище',
            field_value_uz: `${vpsplan.storage_gb || 0} GB ${vpsplan.storage_type || 'SSD'}`,
            field_value_ru: `${vpsplan.storage_gb || 0} ГБ ${vpsplan.storage_type || 'SSD'}`,
            field_type: 'text',
            display_order: 2
          },
          {
            field_key: 'location',
            field_label_uz: 'Location',
            field_label_ru: 'Локация',
            field_value_uz: vpsplan.location || vpsplan.region?.name || vpsplan.region || 'N/A',
            field_value_ru: vpsplan.location || vpsplan.region?.name || vpsplan.region || 'Не указана',
            field_type: 'text',
            display_order: 3
          }
        ]
      }

      await api.post('/service-plans-admin', planData)
      alert('VPS план успешно перенесен в Service Plans!')
    } catch (error) {
      console.error('Ошибка переноса VPS плана:', error)
      alert(error.response?.data?.error || 'Не удалось перенести VPS план')
    }
  }

  const handleDeletePlan = async (planId) => {
    if (!confirm('Вы уверены, что хотите удалить этот VPS план?')) return
    
    try {
      await api.delete(`/vps-admin/${planId}`)
      alert('VPS план удален!')
      fetchVPSPlans()
    } catch (error) {
      console.error('Ошибка удаления VPS плана:', error)
      alert(error.response?.data?.error || 'Не удалось удалить VPS план')
    }
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">VPS планы</h1>
          <p className="text-sm text-gray-600 mt-1">
            Всего планов: {vpsPlans.length}
          </p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Создать VPS план
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vpsPlans.map((plan) => {
          const priceRaw = plan.price_monthly ?? plan.price_per_month ?? plan.price ?? 0
          const priceNum = Number(String(priceRaw).replace(/[^0-9.-]+/g, '')) || 0
          const currency = plan.currency || plan.currency_code || 'UZS'
          const location = plan.location || plan.region?.name || plan.region || 'N/A'
          const planId = plan.id || plan.plan_id
          
          return (
            <div key={planId} className="bg-white rounded-lg shadow-lg border hover:shadow-xl transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name || plan.plan_name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Редактировать"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(planId)}
                      className="text-red-600 hover:text-red-800"
                      title="Удалить"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p>
                    <span className="font-medium">CPU:</span> {plan.cpu_cores ?? plan.cpu_ores ?? '—'} ядер
                  </p>
                  <p>
                    <span className="font-medium">RAM:</span> {plan.ram_gb ?? '—'} GB
                  </p>
                  <p>
                    <span className="font-medium">Storage:</span> {plan.storage_gb ?? '—'} GB {plan.storage_type || 'SSD'}
                  </p>
                  <p>
                    <span className="font-medium">Локация:</span> {location}
                  </p>
                  {plan.provider && (
                    <p>
                      <span className="font-medium">Провайдер:</span> {plan.provider}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 mb-4">
                  <p className="text-2xl font-bold text-blue-600">
                    {priceNum.toLocaleString()} {currency}
                    <span className="text-sm text-gray-500 font-normal">/месяц</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">
                    Перенести в группу:
                  </label>
                  <select
                    onChange={(e) => handleConvertToServicePlan(plan, e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>Выберите группу</option>
                    {serviceGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name_ru}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Редактировать VPS план
              </h2>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название плана *</label>
                  <input
                    type="text"
                    value={editForm.plan_name}
                    onChange={(e) => setEditForm({ ...editForm, plan_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Провайдер</label>
                  <input
                    type="text"
                    value={editForm.provider}
                    onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPU (ядер) *</label>
                  <input
                    type="number"
                    value={editForm.cpu_cores}
                    onChange={(e) => setEditForm({ ...editForm, cpu_cores: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">RAM (GB) *</label>
                  <input
                    type="number"
                    value={editForm.ram_gb}
                    onChange={(e) => setEditForm({ ...editForm, ram_gb: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage (GB) *</label>
                  <input
                    type="number"
                    value={editForm.storage_gb}
                    onChange={(e) => setEditForm({ ...editForm, storage_gb: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Цена (месяц) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price_per_month}
                    onChange={(e) => setEditForm({ ...editForm, price_per_month: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Валюта</label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Локация</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: USA, Netherlands"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                Создать VPS план
              </h2>
            </div>

            <form onSubmit={handleSaveCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Название плана *</label>
                  <input
                    type="text"
                    value={editForm.plan_name}
                    onChange={(e) => setEditForm({ ...editForm, plan_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Например: VPS Standard"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Провайдер</label>
                  <input
                    type="text"
                    value={editForm.provider}
                    onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Например: DigitalOcean"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CPU (ядер) *</label>
                  <input
                    type="number"
                    value={editForm.cpu_cores}
                    onChange={(e) => setEditForm({ ...editForm, cpu_cores: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="2"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">RAM (GB) *</label>
                  <input
                    type="number"
                    value={editForm.ram_gb}
                    onChange={(e) => setEditForm({ ...editForm, ram_gb: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="4"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage (GB) *</label>
                  <input
                    type="number"
                    value={editForm.storage_gb}
                    onChange={(e) => setEditForm({ ...editForm, storage_gb: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="80"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Цена (месяц) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price_per_month}
                    onChange={(e) => setEditForm({ ...editForm, price_per_month: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="100000"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Валюта *</label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="UZS">UZS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Локация</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: USA, Netherlands, Germany"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Примечание:</strong> После создания VPS план можно будет перенести в Service Plans, выбрав группу из выпадающего списка на карточке плана.
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Создать план
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
