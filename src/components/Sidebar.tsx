import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FlaskConical,
  Library,
  Bot,
  Map,
  Microscope,
  Menu,
  X,
  Layers,
  ListOrdered,
  Activity,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',           label: 'Главная',         icon: LayoutDashboard },
  { to: '/candidates', label: 'Кандидаты',       icon: FlaskConical    },
  { to: '/blueprints', label: 'Блюпринты',       icon: Layers          },
  { to: '/library',    label: 'Библиотека',      icon: Library         },
  { to: '/agents',     label: 'Субагенты',       icon: Bot             },
  { to: '/studies',    label: 'Глубокий анализ', icon: Microscope      },
  { to: '/queue',      label: 'Очередь',         icon: ListOrdered     },
  { to: '/telemetry',  label: 'Телеметрия',      icon: Activity        },
  { to: '/map',        label: 'Карта',           icon: Map             },
]

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-[60] p-2 rounded-lg bg-card border border-border lg:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-border z-50',
          'flex flex-col transition-transform duration-200',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo area */}
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Панель исследований
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ночной ресёрч-агент
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Adil's AI Research
          </p>
        </div>
      </aside>
    </>
  )
}
