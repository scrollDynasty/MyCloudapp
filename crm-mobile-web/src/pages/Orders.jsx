import { CheckCircle, Clock, DollarSign, Eye, Search, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/orders')
      const data = response.data
      // API returns { success: true, data: [...] }
      if (data.success && Array.isArray(data.data)) {
        setOrders(data.data)
      } else if (Array.isArray(data)) {
        setOrders(data)
      } else if (data && Array.isArray(data.orders)) {
        setOrders(data.orders)
      } else {
        setOrders([])
      }
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error)
      setOrders([])
      if (error.response?.status === 429) {
        alert('Слишком много запросов. Подождите немного и попробуйте снова.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setShowModal(true)
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus })
      alert('Статус заказа обновлен!')
      fetchOrders()
      setShowModal(false)
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
      alert('Не удалось обновить статус заказа')
    }
  }

  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    const matchesSearch = 
      (order.order_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.user_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.id?.toString().includes(searchTerm)) ||
      (order.order_id?.toString().includes(searchTerm))
    
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus
    const matchesPayment = filterPaymentStatus === 'all' || order.payment_status === filterPaymentStatus
    
    return matchesSearch && matchesStatus && matchesPayment
  }) : []

  const stats = {
    total: Array.isArray(orders) ? orders.length : 0,
    pending: Array.isArray(orders) ? orders.filter(o => o?.payment_status === 'pending').length : 0,
    paid: Array.isArray(orders) ? orders.filter(o => o?.payment_status === 'paid').length : 0,
    active: Array.isArray(orders) ? orders.filter(o => o?.status === 'active').length : 0,
    revenue: Array.isArray(orders) ? orders
      .filter(o => o?.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o?.amount || 0), 0) : 0
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Загрузка заказов...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Управление заказами</h1>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Поиск по номеру заказа или email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Все статусы</option>
          <option value="pending">В ожидании</option>
          <option value="active">Активный</option>
          <option value="suspended">Приостановлен</option>
          <option value="cancelled">Отменен</option>
        </select>

        <select
          value={filterPaymentStatus}
          onChange={(e) => setFilterPaymentStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Все платежи</option>
          <option value="pending">Ожидает оплаты</option>
          <option value="paid">Оплачено</option>
          <option value="cancelled">Отменено</option>
          <option value="refunded">Возврат</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего заказов</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <ShoppingCart className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ожидают оплату</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Оплачено</p>
              <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            </div>
            <CheckCircle className="text-green-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Активные</p>
              <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
            </div>
            <CheckCircle className="text-blue-500" size={32} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Общий доход</p>
              <p className="text-2xl font-bold text-green-600">{stats.revenue.toLocaleString()} UZS</p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">№ Заказа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Услуга</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сумма</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Оплата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    Заказы не найдены
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.order_id || order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{order.order_number || order.order_id || order.id || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.full_name || order.customer_name || order.first_name || order.username || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{order.email || order.user_email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.plan_name || order.service_name || order.vps_plan_name || 'Service'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {(() => {
                          const raw = order.total_price ?? order.amount ?? order.price ?? 0
                          const num = Number(String(raw).replace(/[^0-9.-]+/g, '')) || 0
                          const currency = order.currency || order.currency_code || 'UZS'
                          return `${num.toLocaleString()} ${currency}`
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'active' ? 'bg-green-100 text-green-800' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'suspended' ? 'bg-red-100 text-red-800' :
                        order.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.payment_status === 'refunded' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                      >
                        <Eye size={16} />
                        Просмотр
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowModal(false)}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Заказ #{selectedOrder.order_number || selectedOrder.order_id || selectedOrder.id}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Создан: {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Информация о клиенте</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Имя:</span>
                    <span className="font-medium">{selectedOrder.customer_name || selectedOrder.first_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{selectedOrder.user_email || selectedOrder.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Телефон:</span>
                    <span className="font-medium">{selectedOrder.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Детали услуги</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Услуга:</span>
                    <span className="font-medium">{selectedOrder.service_name || selectedOrder.vps_plan_name || 'Service'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Тип:</span>
                    <span className="font-medium">{selectedOrder.service_plan_id ? 'Сервис план' : 'VPS план'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Статус:</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.status === 'active' ? 'bg-green-100 text-green-800' :
                      selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedOrder.status === 'suspended' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Информация об оплате</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Сумма:</span>
                    <span className="font-medium text-lg">
                      {(() => {
                        const raw = selectedOrder.total_price ?? selectedOrder.amount ?? selectedOrder.price ?? 0
                        const num = Number(String(raw).replace(/[^0-9.-]+/g, '')) || 0
                        const currency = selectedOrder.currency || selectedOrder.currency_code || 'UZS'
                        return `${num.toLocaleString()} ${currency}`
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Метод оплаты:</span>
                    <span className="font-medium">{selectedOrder.payment_method || 'Payme'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Статус оплаты:</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedOrder.payment_status}
                    </span>
                  </div>
                  {selectedOrder.payme_transaction_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID транзакции:</span>
                      <span className="font-mono text-sm">{selectedOrder.payme_transaction_id}</span>
                    </div>
                  )}
                </div>
              </div>

                            {/* Status Update Actions */}
              {selectedOrder.payment_status === 'paid' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Изменить статус заказа</h3>
                  <div className="flex gap-3">
                    {selectedOrder.status !== 'active' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.order_id || selectedOrder.id, 'active')}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        Активировать
                      </button>
                    )}
                    {selectedOrder.status === 'active' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.order_id || selectedOrder.id, 'suspended')}
                        className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                      >
                        Приостановить
                      </button>
                    )}
                    {selectedOrder.status !== 'cancelled' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.order_id || selectedOrder.id, 'cancelled')}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}