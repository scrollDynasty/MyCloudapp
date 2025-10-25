import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Orders from './pages/Orders'
import ServiceGroups from './pages/ServiceGroups'
import ServicePlans from './pages/ServicePlans'
import ServicesManagement from './pages/ServicesManagement'
import Users from './pages/Users'
import VPSPlans from './pages/VPSPlans'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    const user = localStorage.getItem('crm_user')
    
    if (token && user) {
      try {
        const userData = JSON.parse(user)
        if (userData.role === 'admin') {
          setIsAuthenticated(true)
        } else {
          localStorage.removeItem('crm_token')
          localStorage.removeItem('crm_user')
        }
      } catch (error) {
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
      }
    }
    
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout setIsAuthenticated={setIsAuthenticated}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/vps-plans" element={<VPSPlans />} />
        <Route path="/service-groups" element={<ServiceGroups />} />
        <Route path="/service-plans" element={<ServicePlans />} />
        <Route path="/services" element={<ServicesManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
