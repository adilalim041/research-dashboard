import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ToastProvider } from './Toast'

export function Layout() {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:ml-64 min-h-screen">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </ToastProvider>
  )
}
