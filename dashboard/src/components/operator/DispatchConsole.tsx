import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ChevronUp, Rocket, Loader2 } from 'lucide-react';
import { dispatchTask } from '../../lib/operatorApi';
import type { ManagedProject } from '../../lib/operatorApi';

interface Props {
  projects: ManagedProject[];
}

export default function DispatchConsole({ projects }: Props) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [model, setModel] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleDispatch = async () => {
    if (!project || !task.trim()) return;
    setDispatching(true);
    setLastResult(null);
    try {
      await dispatchTask(project, task, model || undefined);
      setLastResult(`Dispatched to ${project}`);
      setTask('');
    } catch (err) {
      setLastResult(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    setDispatching(false);
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Terminal size={13} style={{ color: '#fbbf24' }} />
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
          DISPATCH CONSOLE
        </span>
        {lastResult && (
          <span className="text-[10px] ml-2" style={{ color: lastResult.startsWith('Error') ? '#fb7185' : '#34d399' }}>
            {lastResult}
          </span>
        )}
        <ChevronUp
          size={12}
          className="ml-auto transition-transform"
          style={{
            color: 'rgba(255,255,255,0.2)',
            transform: open ? 'rotate(0)' : 'rotate(180deg)',
          }}
        />
      </button>

      {/* Dispatch form */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-2 px-3 pb-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              {/* Project select */}
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-md bg-black/30 outline-none mt-2"
                style={{
                  color: project ? '#c084fc' : 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 140,
                }}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>

              {/* Task input */}
              <input
                type="text"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDispatch()}
                placeholder="Describe the task..."
                className="flex-1 text-xs py-1.5 px-2 rounded-md bg-black/30 outline-none mt-2"
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />

              {/* Model select */}
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="text-xs py-1.5 px-2 rounded-md bg-black/30 outline-none mt-2"
                style={{
                  color: model ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  minWidth: 120,
                }}
              >
                <option value="">Default model</option>
                <option value="claude-opus-4-6">Opus 4.6</option>
                <option value="claude-sonnet-4-6">Sonnet 4.6</option>
                <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
              </select>

              {/* Dispatch button */}
              <button
                onClick={handleDispatch}
                disabled={dispatching || !project || !task.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold mt-2 transition-all"
                style={{
                  background: dispatching || !project || !task.trim()
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(251, 191, 36, 0.15)',
                  border: `1px solid ${dispatching || !project || !task.trim() ? 'rgba(255,255,255,0.06)' : 'rgba(251, 191, 36, 0.3)'}`,
                  color: dispatching || !project || !task.trim() ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                  cursor: dispatching || !project || !task.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {dispatching ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
                DISPATCH
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
