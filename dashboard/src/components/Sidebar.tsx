import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Bot,
  DollarSign,
  FolderKanban,
  Crosshair,
  Server,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/costs', label: 'Costs', icon: DollarSign },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/targets', label: 'Targets', icon: Crosshair },
  { to: '/system', label: 'System', icon: Server },
];

export default function Sidebar() {
  const { sidebarOpen } = useDashboard();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      {sidebarOpen && (
        <motion.aside
          className="w-48 shrink-0 border-r border-muted/30 bg-bg-primary/60 backdrop-blur-sm flex flex-col py-3 z-20"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 192, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <nav className="flex flex-col gap-0.5 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                  style={{ color: isActive ? '#67e8f9' : '#94a3b8' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: 'rgba(103, 232, 249, 0.08)',
                        border: '1px solid rgba(103, 232, 249, 0.15)',
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon size={16} className="relative z-10 shrink-0" />
                  <span className="relative z-10 font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto px-4 py-3 border-t border-muted/20">
            <p className="text-[10px] text-dim font-mono">c9s metrics v0.1.0</p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
