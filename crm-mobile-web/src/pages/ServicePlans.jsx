import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export default function ServicePlans() {
  const { data, isLoading } = useQuery({
    queryKey: ['service-plans'],
    queryFn: async () => {
      const res = await api.get('/service-plans')
      return res.data?.data ?? res.data ?? []
    },
  })

  const plansList = (data || []).map((plan) => {
    const priceRaw = plan.price ?? 0
    const priceNum = Number(String(priceRaw).replace(/[^0-9.-]+/g, '')) || 0
    const discountRaw = plan.discount_price ?? 0
    const discountNum = Number(String(discountRaw).replace(/[^0-9.-]+/g, '')) || 0
    return (
      <div key={plan.id} className="bg-white rounded-lg shadow p-6 border">
        <h3 className="text-lg font-bold mb-2">{plan.name_ru}</h3>
        <p className="text-sm text-gray-600 mb-4">{plan.description_ru}</p>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-indigo-600">{priceNum.toLocaleString()} UZS</p>
          {discountNum > 0 && (
            <p className="text-sm text-gray-500 line-through">{discountNum.toLocaleString()} UZS</p>
          )}
          <p className="text-xs text-gray-500">per {plan.billing_period}</p>
        </div>
        <div className="mt-4">
          <span className={`px-2 py-1 text-xs rounded-full ${
            plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {plan.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    )
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Service Plans</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plansList}
        </div>
      )}
    </div>
  )
}
