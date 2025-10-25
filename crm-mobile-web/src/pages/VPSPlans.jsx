import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export default function VPSPlans() {
  const { data, isLoading } = useQuery({
    queryKey: ['vps-plans'],
    queryFn: async () => {
      const res = await api.get('/vps')
      return res.data
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">VPS Plans</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.data?.map((plan) => (
            <div key={plan.id} className="bg-white rounded-lg shadow p-6 border">
              <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>CPU: {plan.cpu_cores} cores</p>
                <p>RAM: {plan.ram_gb} GB</p>
                <p>Storage: {plan.storage_gb} GB</p>
                <p>Region: {plan.region}</p>
                <p className="text-xl font-bold text-gray-900 mt-4">
                  {parseFloat(plan.price_monthly).toLocaleString()} UZS/month
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
