'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  email: string
  name: string
  type: 'trainer' | 'installer' | 'manager'
  location?: string | string[]
  languages?: string[]
  inConfig: boolean
  authorized: boolean
  authInfo?: {
    expiresAt: string
    calendarId: string
    createdAt: string
    updatedAt: string
  }
}

interface UsersData {
  trainers: User[]
  installers: User[]
  managers: User[]
  summary: {
    totalTrainers: number
    authorizedTrainers: number
    totalInstallers: number
    authorizedInstallers: number
    totalManagers: number
    authorizedManagers: number
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [usersData, setUsersData] = useState<UsersData | null>(null)
  const [activeTab, setActiveTab] = useState<'trainers' | 'installers' | 'managers'>('trainers')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({
    type: 'trainer' as 'trainer' | 'installer',
    email: '',
    name: '',
    location: 'Within Klang Valley',
    languages: ['English']
  })
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English'])

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        setIsAuthenticated(true)
        const data = await response.json()
        setUsersData(data)
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      if (response.ok) {
        setIsAuthenticated(true)
        await checkAuth()
      } else {
        const data = await response.json()
        setLoginError(data.error || 'Invalid credentials')
      }
    } catch (error) {
      setLoginError('Login failed. Please try again.')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    setIsAuthenticated(false)
    setUsersData(null)
  }

  const handleRevokeAuth = async (email: string) => {
    if (!confirm(`Are you sure you want to revoke authorization for ${email}?`)) {
      return
    }
    
    try {
      const response = await fetch('/api/admin/users/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      if (response.ok) {
        alert('Authorization revoked successfully')
        await checkAuth()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to revoke authorization')
      }
    } catch (error) {
      alert('Failed to revoke authorization')
    }
  }

  const handleRemoveUser = async (type: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the configuration? This will also revoke their authorization.`)) {
      return
    }
    
    try {
      const response = await fetch('/api/admin/users/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email })
      })
      
      if (response.ok) {
        alert('User removed successfully')
        await checkAuth()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove user')
      }
    } catch (error) {
      alert('Failed to remove user')
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/admin/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUser,
          languages: selectedLanguages
        })
      })

      if (response.ok) {
        alert('User added successfully')
        setShowAddModal(false)
        setNewUser({
          type: 'trainer',
          email: '',
          name: '',
          location: 'Within Klang Valley',
          languages: ['English']
        })
        setSelectedLanguages(['English'])
        await checkAuth()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add user')
      }
    } catch (error) {
      alert('Failed to add user')
    }
  }

  const toggleLanguage = (language: string) => {
    setSelectedLanguages(prev => {
      if (prev.includes(language)) {
        // Don't allow removing the last language
        if (prev.length === 1) return prev
        return prev.filter(l => l !== language)
      } else {
        return [...prev, language]
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {loginError && (
              <div className="text-red-600 text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    )
  }

  const currentUsers = activeTab === 'trainers' ? usersData?.trainers || []
    : activeTab === 'installers' ? usersData?.installers || []
    : usersData?.managers || []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Trainers</h3>
            <p className="text-3xl font-bold text-blue-600">
              {usersData?.summary.authorizedTrainers}/{usersData?.summary.totalTrainers}
            </p>
            <p className="text-sm text-gray-500 mt-1">Authorized / Total</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Installers</h3>
            <p className="text-3xl font-bold text-green-600">
              {usersData?.summary.authorizedInstallers}/{usersData?.summary.totalInstallers}
            </p>
            <p className="text-sm text-gray-500 mt-1">Authorized / Total</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Managers</h3>
            <p className="text-3xl font-bold text-purple-600">
              {usersData?.summary.authorizedManagers}
            </p>
            <p className="text-sm text-gray-500 mt-1">Authorized</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('trainers')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'trainers'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Trainers ({usersData?.trainers.length})
              </button>
              <button
                onClick={() => setActiveTab('installers')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'installers'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Installers ({usersData?.installers.length})
              </button>
              <button
                onClick={() => setActiveTab('managers')}
                className={`px-6 py-3 text-sm font-medium ${
                  activeTab === 'managers'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Managers ({usersData?.managers.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
              {activeTab !== 'managers' && (
                <button
                  onClick={() => {
                    setNewUser({
                      type: activeTab === 'trainers' ? 'trainer' : 'installer',
                      email: '',
                      name: '',
                      location: 'Within Klang Valley',
                      languages: ['English']
                    })
                    setSelectedLanguages(['English'])
                    setShowAddModal(true)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add {activeTab === 'trainers' ? 'Trainer' : 'Installer'}
                </button>
              )}
            </div>

            {/* Workflow Info */}
            {activeTab === 'trainers' && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  📋 Onboarding Workflow for New Trainers
                </h3>
                <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                  <li>
                    <strong>Add via Admin Dashboard:</strong> Click "Add Trainer" button above to add their name, email, and location to the config file.
                  </li>
                  <li>
                    <strong>Send Authorization Link:</strong> Share this link with the new trainer:
                    <div className="mt-1 p-2 bg-white rounded border border-blue-300 font-mono text-xs break-all">
                      https://onboarding-portal-5fhi.onrender.com/trainers/authorize
                    </div>
                  </li>
                  <li>
                    <strong>Trainer Authorizes:</strong> They click "Authorize with Lark" and log in with their Lark account.
                  </li>
                  <li>
                    <strong>Automatic Setup:</strong> System automatically stores their OAuth tokens and updates the config file with their Lark IDs. They're now ready to use!
                  </li>
                </ol>
              </div>
            )}

            {activeTab === 'installers' && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  📋 Onboarding Workflow for New Installers
                </h3>
                <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
                  <li>
                    <strong>Add via Admin Dashboard:</strong> Click "Add Installer" button above to add their name, email, and location to the config file.
                  </li>
                  <li>
                    <strong>Send Authorization Link:</strong> Share this link with the new installer:
                    <div className="mt-1 p-2 bg-white rounded border border-blue-300 font-mono text-xs break-all">
                      https://onboarding-portal-5fhi.onrender.com/installers/authorize
                    </div>
                  </li>
                  <li>
                    <strong>Installer Authorizes:</strong> They click "Authorize with Lark" and log in with their Lark account.
                  </li>
                  <li>
                    <strong>Automatic Setup:</strong> System automatically stores their OAuth tokens and updates the config file with their Lark IDs. They're now ready to use!
                  </li>
                </ol>
              </div>
            )}

            {activeTab === 'managers' && (
              <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-purple-900 mb-2">
                  📋 Onboarding Workflow for New Managers
                </h3>
                <ol className="text-sm text-purple-800 space-y-1 ml-4 list-decimal">
                  <li>
                    <strong>No Config File:</strong> Managers are not stored in config files, only in the database after authorization.
                  </li>
                  <li>
                    <strong>Send Authorization Link:</strong> Share this link with the new manager:
                    <div className="mt-1 p-2 bg-white rounded border border-purple-300 font-mono text-xs break-all">
                      https://onboarding-portal-5fhi.onrender.com/managers/authorize
                    </div>
                  </li>
                  <li>
                    <strong>Manager Authorizes:</strong> They click "Authorize with Lark" and log in with their Lark account.
                  </li>
                  <li>
                    <strong>Automatic Setup:</strong> System automatically stores their OAuth tokens in the database. They're now ready to use!
                  </li>
                </ol>
                <p className="text-xs text-purple-700 mt-3 italic">
                  Note: You can only revoke manager authorization via this dashboard. To completely remove a manager, delete their record from the database.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    {activeTab === 'trainers' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Languages
                        </th>
                      </>
                    )}
                    {activeTab === 'installers' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.map((user) => (
                    <tr key={user.email}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      {activeTab === 'trainers' && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(user as any).location?.join(', ') || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {((user as any).languages || []).map((lang: string) => (
                                <span key={lang} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </td>
                        </>
                      )}
                      {activeTab === 'installers' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.location || 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.authorized ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Authorized
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Not Authorized
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {user.authorized && (
                          <button
                            onClick={() => handleRevokeAuth(user.email)}
                            className="text-orange-600 hover:text-orange-900"
                          >
                            Revoke
                          </button>
                        )}
                        {user.inConfig && activeTab !== 'managers' && (
                          <button
                            onClick={() => handleRemoveUser(user.type, user.email)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              Add {newUser.type === 'trainer' ? 'Trainer' : 'Installer'}
            </h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <select
                  value={newUser.location}
                  onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="Within Klang Valley">Within Klang Valley</option>
                  <option value="Penang">Penang</option>
                  <option value="Johor Bahru">Johor Bahru</option>
                </select>
              </div>
              {newUser.type === 'trainer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Languages
                  </label>
                  <div className="space-y-2">
                    {['English', 'Bahasa Malaysia', 'Chinese'].map((language) => (
                      <label key={language} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLanguages.includes(language)}
                          onChange={() => toggleLanguage(language)}
                          className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{language}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {selectedLanguages.join(', ')}
                  </p>
                </div>
              )}
              <div className="flex space-x-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

