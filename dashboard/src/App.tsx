import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardProvider } from './context/DashboardContext';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import Overview from './pages/Overview';
import Agents from './pages/Agents';
import Costs from './pages/Costs';
import Projects from './pages/Projects';
import Targets from './pages/Targets';
import System from './pages/System';
import Architecture from './pages/Architecture';
import Operator from './pages/Operator';
import Studio from './pages/Studio';
import ConstellationBg from './components/ConstellationBg';

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex-1 overflow-y-auto p-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();

  return (
    <div className="h-full flex flex-col relative">
      {/* Remotion constellation — MORE visible now */}
      <ConstellationBg />

      {/* Ambient light orbs */}
      <div className="ambient-light ambient-light-1" />
      <div className="ambient-light ambient-light-2" />

      {/* CSS background layers */}
      <div className="starfield" />
      <div className="grid-overlay" />

      {/* App shell */}
      <TopBar />
      <div className="flex flex-1 min-h-0 relative z-10">
        <Sidebar />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageWrapper><Overview /></PageWrapper>} />
            <Route path="/agents" element={<PageWrapper><Agents /></PageWrapper>} />
            <Route path="/costs" element={<PageWrapper><Costs /></PageWrapper>} />
            <Route path="/projects" element={<PageWrapper><Projects /></PageWrapper>} />
            <Route path="/targets" element={<PageWrapper><Targets /></PageWrapper>} />
            <Route path="/system" element={<PageWrapper><System /></PageWrapper>} />
            <Route path="/architecture" element={<PageWrapper><Architecture /></PageWrapper>} />
            <Route path="/operator" element={<PageWrapper><Operator /></PageWrapper>} />
            <Route path="/studio" element={<PageWrapper><Studio /></PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <AppContent />
    </DashboardProvider>
  );
}
