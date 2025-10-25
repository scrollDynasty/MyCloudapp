import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export default function ServiceGroups() {
  const { data, isLoading } = useQuery({
    queryKey: ['service-groups'],
    queryFn: async () => {
      const res = await api.get('/service-groups')
      return res.data
    },
  })

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Service Groups</h1>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.data?.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow p-6 border">
              <h3 className="text-lg font-bold mb-2">{group.name_ru}</h3>
              <p className="text-sm text-gray-600 mb-4">{group.description_ru}</p>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  group.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {group.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm text-gray-500">Order: {group.display_order}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
