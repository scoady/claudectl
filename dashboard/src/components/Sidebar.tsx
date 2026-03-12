import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Bot,
  DollarSign,
  FolderKanban,
  Crosshair,
  Server,
  Network,
  ShieldCheck,
  Music,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/costs', label: 'Costs', icon: DollarSign },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/targets', label: 'Targets', icon: Crosshair },
  { to: '/system', label: 'System', icon: Server },
  { to: '/architecture', label: 'Architecture', icon: Network },
  { to: '/operator', label: 'Operator', icon: ShieldCheck },
  { to: '/studio', label: 'Studio', icon: Music },
];

export default function Sidebar() {
  const { sidebarOpen } = useDashboard();
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      {sidebarOpen && (
        <motion.aside
          className="glass-sidebar shrink-0 flex flex-col py-4 z-20"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 56, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-300"
                  title={item.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: 'rgba(103, 232, 249, 0.06)',
                        border: '1px solid rgba(103, 232, 249, 0.12)',
                        boxShadow: '0 0 20px rgba(103, 232, 249, 0.06)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <item.icon
                    size={18}
                    className="relative z-10 transition-all duration-300"
                    style={{
                      color: isActive ? '#67e8f9' : 'rgba(255,255,255,0.25)',
                      filter: isActive ? 'drop-shadow(0 0 6px rgba(103, 232, 249, 0.3))' : 'none',
                    }}
                  />
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto flex justify-center py-3">
            <span className="text-[8px] font-light tracking-wider" style={{ color: 'rgba(255,255,255,0.12)', writingMode: 'vertical-rl' }}>
              v0.1
            </span>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
