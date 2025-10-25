import { Activity, DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    monthRevenue: 0
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [recentUsers, setRecentUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      const [usersRes, ordersRes] = await Promise.all([
        api.get('/auth/users').catch(() => ({ data: { success: false, data: [] } })),
        api.get('/orders').catch(() => ({ data: { success: false, data: [] } }))
      ])

      // API returns { success: true, data: [...] }
      let users = []
      if (usersRes.data.success && Array.isArray(usersRes.data.data)) {
        users = usersRes.data.data
      } else if (Array.isArray(usersRes.data)) {
        users = usersRes.data
      }

      let orders = []
      if (ordersRes.data.success && Array.isArray(ordersRes.data.data)) {
        orders = ordersRes.data.data
      } else if (Array.isArray(ordersRes.data)) {
        orders = ordersRes.data
      }

      const activeUsers = users.filter(u => u?.status === 'active').length
      const pendingOrders = orders.filter(o => o?.payment_status === 'pending').length
      const paidOrders = orders.filter(o => o?.payment_status === 'paid')
      const totalRevenue = paidOrders.reduce((sum, o) => sum + parseFloat(o?.total_price || o?.amount || 0), 0)

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthRevenue = paidOrders
        .filter(o => new Date(o?.created_at) >= monthStart)
        .reduce((sum, o) => sum + parseFloat(o?.total_price || o?.amount || 0), 0)

      setStats({
        totalUsers: users.length,
        activeUsers,
        totalOrders: orders.length,
        pendingOrders,
        totalRevenue,
        monthRevenue
      })

      const sortedOrders = [...orders].sort((a, b) => 
        new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
      ).slice(0, 5)
      setRecentOrders(sortedOrders)

      const sortedUsers = [...users].sort((a, b) => 
        new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
      ).slice(0, 5)
      setRecentUsers(sortedUsers)

    } catch (error) {
      console.error('Ошибка загрузки данных панели:', error)
      if (error.response?.status === 429) {
        alert('Слишком много запросов. Подождите немного и обновите страницу.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Загрузка панели управления...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Панель управления</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Всего пользователей</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-sm text-green-600 mt-1">{stats.activeUsers} активных</p>
            </div>
            <Users className="text-blue-500" size={40} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Всего заказов</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
              <p className="text-sm text-yellow-600 mt-1">{stats.pendingOrders} ожидают</p>
            </div>
            <ShoppingCart className="text-purple-500" size={40} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Общий доход</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalRevenue.toLocaleString()} UZS</p>
              <p className="text-sm text-green-600 mt-1">+{stats.monthRevenue.toLocaleString()} в этом месяце</p>
            </div>
            <DollarSign className="text-green-500" size={40} />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity size={24} />
              Последние заказы
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentOrders.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Заказов пока нет</div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.order_id || order.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">Заказ #{order.order_number || order.order_id || order.id}</p>
                      <p className="text-sm text-gray-600">{order.customer_name || order.user_email || order.email || 'Клиент'}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(order.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const raw = order.total_price ?? order.amount ?? order.price ?? 0
                        const num = Number(String(raw).replace(/[^0-9.-]+/g, '')) || 0
                        const currency = order.currency || order.currency_code || 'UZS'
                        return <p className="font-semibold text-gray-900">{num.toLocaleString()} {currency}</p>
                      })()}
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} />
              Последние пользователи
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Пользователей пока нет</div>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {(user.first_name || user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username || user.email}
                      </p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Присоединился {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' : 
                      user.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/users" className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-4 rounded-lg transition-all flex items-center gap-3">
            <Users size={24} />
            <div>
              <p className="font-semibold">Управление пользователями</p>
              <p className="text-sm opacity-90">Просмотр всех пользователей</p>
            </div>
          </a>
          <a href="/orders" className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-4 rounded-lg transition-all flex items-center gap-3">
            <ShoppingCart size={24} />
            <div>
              <p className="font-semibold">Просмотр заказов</p>
              <p className="text-sm opacity-90">Управление всеми заказами</p>
            </div>
          </a>
          <a href="/service-groups" className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-4 rounded-lg transition-all flex items-center gap-3">
            <TrendingUp size={24} />
            <div>
              <p className="font-semibold">Услуги</p>
              <p className="text-sm opacity-90">Управление услугами</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}