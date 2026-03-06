import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { css, keyframes } from '@emotion/css';
import type { WidgetCatalogEntry, Project } from '../types';

// ── Constants ───────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:4040';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  chart:    { bg: 'rgba(0, 255, 204, 0.12)',   text: '#00ffcc', glow: 'rgba(0, 255, 204, 0.4)' },
  status:   { bg: 'rgba(123, 97, 255, 0.12)',  text: '#7B61FF', glow: 'rgba(123, 97, 255, 0.4)' },
  monitor:  { bg: 'rgba(51, 170, 255, 0.12)',  text: '#33aaff', glow: 'rgba(51, 170, 255, 0.4)' },
  activity: { bg: 'rgba(255, 170, 51, 0.12)',  text: '#ffaa33', glow: 'rgba(255, 170, 51, 0.4)' },
  table:    { bg: 'rgba(255, 107, 107, 0.12)', text: '#ff6b6b', glow: 'rgba(255, 107, 107, 0.4)' },
};

const getCategoryStyle = (cat: string) =>
  CATEGORY_COLORS[cat] ?? { bg: 'rgba(0, 255, 204, 0.08)', text: '#00ffcc', glow: 'rgba(0, 255, 204, 0.3)' };

// ── Animations ──────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeInFast = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 204, 0.15); }
  50%      { box-shadow: 0 0 24px rgba(0, 255, 204, 0.35); }
`;

const floatParticle = keyframes`
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  20%  { opacity: 0.6; }
  80%  { opacity: 0.3; }
  100% { transform: translateY(-120px) translateX(30px); opacity: 0; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

// ── Styles ──────────────────────────────────────────────────────────────

const styles = {
  root: css`
    background: #0a0e14;
    min-height: 100%;
    padding: 32px;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    color: #c8d6e5;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,

  particles: css`
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  `,

  particle: css`
    position: absolute;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: rgba(0, 255, 204, 0.5);
    animation: ${floatParticle} 8s ease-in-out infinite;
  `,

  header: css`
    position: relative;
    z-index: 1;
    margin-bottom: 28px;
    animation: ${fadeIn} 0.6s ease-out;
  `,

  title: css`
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin: 0 0 6px 0;
    background: linear-gradient(135deg, #e8f0fe 0%, #00ffcc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  `,

  subtitle: css`
    font-size: 14px;
    color: rgba(200, 214, 229, 0.5);
    margin: 0;
  `,

  // ── Generate Bar ───────────────────────────────────────────────

  generateBar: css`
    position: relative;
    z-index: 1;
    display: flex;
    gap: 12px;
    margin-bottom: 28px;
    animation: ${fadeIn} 0.6s ease-out 0.1s both;
  `,

  generateInput: css`
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #ddd;
    padding: 12px 18px;
    font-size: 14px;
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:focus {
      border-color: rgba(0, 255, 204, 0.4);
      box-shadow: 0 0 0 3px rgba(0, 255, 204, 0.08);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.2);
    }
  `,

  generateBtn: css`
    background: linear-gradient(135deg, #00ffcc, #00ccaa);
    color: #0a0e14;
    border: none;
    border-radius: 10px;
    padding: 12px 28px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 24px rgba(0, 255, 204, 0.4);
    }

    &:active { transform: translateY(0); }

    &:disabled {
      opacity: 0.5;
      cursor: default;
      transform: none;
      box-shadow: none;
    }
  `,

  generateSpinner: css`
    width: 16px;
    height: 16px;
    border: 2px solid rgba(10, 14, 20, 0.3);
    border-top-color: #0a0e14;
    border-radius: 50%;
    animation: ${spin} 0.6s linear infinite;
  `,

  shimmerBar: css`
    position: relative;
    z-index: 1;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, #00ffcc, transparent);
    background-size: 200% 100%;
    animation: ${shimmer} 1.2s linear infinite;
    margin-bottom: 24px;
  `,

  // ── Card Grid ──────────────────────────────────────────────────

  grid: css`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  `,

  card: css`
    background: rgba(15, 20, 30, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 204, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: ${fadeIn} 0.5s ease-out both;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      padding: 1px;
      background: linear-gradient(135deg, rgba(0, 255, 204, 0.15), transparent 60%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      transform: translateY(-4px);
      border-color: rgba(0, 255, 204, 0.25);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4),
        0 0 24px rgba(0, 255, 204, 0.08);

      &::before { opacity: 1; }
    }
  `,

  cardSelected: css`
    border-color: rgba(0, 255, 204, 0.35) !important;
    box-shadow: 0 0 24px rgba(0, 255, 204, 0.12) !important;
    animation: ${pulseGlow} 3s ease-in-out infinite;
  `,

  cardPreview: css`
    width: 100%;
    height: 180px;
    border: none;
    border-radius: 12px 12px 0 0;
    display: block;
    pointer-events: none;
    background: #0a0e14;
  `,

  cardBody: css`
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  `,

  cardName: css`
    font-size: 15px;
    font-weight: 600;
    color: #e8f0fe;
    margin: 0;
    line-height: 1.3;
  `,

  cardMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    white-space: nowrap;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  `,

  cardDesc: css`
    font-size: 12px;
    color: rgba(200, 214, 229, 0.5);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  `,

  // ── Detail Panel ───────────────────────────────────────────────

  detailOverlay: css`
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: ${fadeInFast} 0.2s ease;
  `,

  detailPanel: css`
    width: 100%;
    max-width: 1100px;
    max-height: 80vh;
    background: rgba(12, 16, 24, 0.97);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 255, 204, 0.1);
    border-radius: 16px 16px 0 0;
    padding: 32px;
    overflow-y: auto;
    animation: ${slideUp} 0.35s cubic-bezier(0.4, 0, 0.2, 1);

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,

  detailHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
  `,

  detailTitleBlock: css`
    flex: 1;
  `,

  detailTitle: css`
    font-size: 22px;
    font-weight: 700;
    color: #e8f0fe;
    margin: 0 0 6px 0;
  `,

  detailDesc: css`
    font-size: 14px;
    color: rgba(200, 214, 229, 0.6);
    line-height: 1.6;
    margin: 0 0 4px 0;
  `,

  detailMetaRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  `,

  detailTimestamp: css`
    font-size: 11px;
    color: rgba(200, 214, 229, 0.3);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  `,

  closeBtn: css`
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(200, 214, 229, 0.6);
    font-size: 18px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-left: 16px;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #e8f0fe;
    }
  `,

  detailBody: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;

    @media (max-width: 720px) {
      grid-template-columns: 1fr;
    }
  `,

  detailPreview: css`
    width: 100%;
    height: 300px;
    border: none;
    border-radius: 10px;
    display: block;
    background: #0a0e14;
    border: 1px solid rgba(255, 255, 255, 0.04);
  `,

  detailRight: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
  `,

  sectionTitle: css`
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: rgba(0, 255, 204, 0.6);
    margin: 0 0 10px 0;
  `,

  schemaGrid: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,

  schemaField: css`
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(15, 20, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 10px 14px;
  `,

  schemaFieldName: css`
    font-size: 13px;
    font-weight: 500;
    color: #e8f0fe;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    min-width: 0;
  `,

  schemaFieldType: css`
    font-size: 10px;
    color: rgba(0, 255, 204, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 255, 204, 0.06);
    white-space: nowrap;
    flex-shrink: 0;
  `,

  schemaFieldDesc: css`
    font-size: 12px;
    color: rgba(200, 214, 229, 0.45);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  // ── Actions ────────────────────────────────────────────────────

  actions: css`
    display: flex;
    gap: 12px;
    align-items: center;
    margin-top: auto;
    padding-top: 8px;
  `,

  addBtn: css`
    background: linear-gradient(135deg, rgba(0, 255, 204, 0.12), rgba(0, 255, 204, 0.04));
    border: 1px solid rgba(0, 255, 204, 0.25);
    border-radius: 8px;
    color: #00ffcc;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.25s ease;
    letter-spacing: 0.3px;
    position: relative;

    &:hover {
      background: linear-gradient(135deg, rgba(0, 255, 204, 0.2), rgba(0, 255, 204, 0.08));
      box-shadow: 0 0 20px rgba(0, 255, 204, 0.15);
      transform: translateY(-1px);
    }

    &:active { transform: translateY(0); }
  `,

  deleteBtn: css`
    background: rgba(255, 68, 102, 0.1);
    border: 1px solid rgba(255, 68, 102, 0.25);
    border-radius: 8px;
    color: #ff4466;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 20px;
    cursor: pointer;
    transition: all 0.25s ease;

    &:hover {
      background: rgba(255, 68, 102, 0.2);
      box-shadow: 0 0 16px rgba(255, 68, 102, 0.12);
    }
  `,

  // ── Project Dropdown ───────────────────────────────────────────

  dropdownWrapper: css`
    position: relative;
    display: inline-block;
  `,

  dropdown: css`
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 220px;
    background: rgba(15, 20, 30, 0.97);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 204, 0.15);
    border-radius: 10px;
    padding: 6px;
    z-index: 100;
    animation: ${fadeIn} 0.2s ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    max-height: 240px;
    overflow-y: auto;

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,

  dropdownItem: css`
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #c8d6e5;
    font-size: 13px;
    padding: 8px 12px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(0, 255, 204, 0.06);
      color: #00ffcc;
    }
  `,

  // ── Toast ──────────────────────────────────────────────────────

  toast: css`
    position: fixed;
    bottom: 32px;
    right: 32px;
    background: rgba(15, 20, 30, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 204, 0.2);
    border-radius: 10px;
    padding: 14px 22px;
    color: #00ffcc;
    font-size: 13px;
    font-weight: 500;
    z-index: 99999;
    animation: ${fadeIn} 0.3s ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 255, 204, 0.1);
  `,

  toastError: css`
    border-color: rgba(255, 68, 102, 0.3);
    color: #ff4466;
  `,

  // ── Empty / Loading ────────────────────────────────────────────

  emptyState: css`
    text-align: center;
    padding: 60px 20px;
    color: rgba(200, 214, 229, 0.35);
    font-size: 14px;
    position: relative;
    z-index: 1;
  `,

  loadingBar: css`
    height: 2px;
    background: linear-gradient(90deg, transparent, #00ffcc, transparent);
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s linear infinite;
    border-radius: 1px;
    margin: 40px 0;
    position: relative;
    z-index: 1;
  `,

  // ── Confirm Dialog ─────────────────────────────────────────────

  confirmOverlay: css`
    position: fixed;
    inset: 0;
    z-index: 20000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: ${fadeInFast} 0.15s ease;
  `,

  confirmBox: css`
    background: rgba(15, 20, 30, 0.97);
    border: 1px solid rgba(255, 68, 102, 0.2);
    border-radius: 12px;
    padding: 28px;
    max-width: 380px;
    width: 90%;
    animation: ${fadeIn} 0.2s ease-out;
  `,

  confirmTitle: css`
    font-size: 16px;
    font-weight: 600;
    color: #e8f0fe;
    margin: 0 0 10px 0;
  `,

  confirmText: css`
    font-size: 13px;
    color: rgba(200, 214, 229, 0.6);
    margin: 0 0 20px 0;
    line-height: 1.5;
  `,

  confirmActions: css`
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `,

  cancelBtn: css`
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(200, 214, 229, 0.6);
    font-size: 13px;
    padding: 8px 18px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #e8f0fe;
    }
  `,
};

// ── Widget Preview Component ────────────────────────────────────────────

function WidgetPreview({
  html,
  css: widgetCss,
  js,
  data,
  height = 180,
  className,
}: {
  html: string;
  css: string;
  js: string;
  data: Record<string, any>;
  height?: number;
  className?: string;
}) {
  const srcdoc = useMemo(
    () => `<!DOCTYPE html>
<html><head><style>
  body { margin: 0; background: #0a0e14; overflow: hidden; font-family: 'Inter', -apple-system, system-ui, sans-serif; color: #c8d6e5; }
  ${widgetCss}
</style></head><body>
  ${html}
  <script>
    try {
      const data = ${JSON.stringify(data ?? {})};
      ${js}
    } catch(e) { console.error(e); }
  </script>
</body></html>`,
    [html, widgetCss, js, data],
  );

  return (
    <iframe
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height, border: 'none', borderRadius: 8, display: 'block', background: '#0a0e14' }}
      className={className}
      title="Widget Preview"
    />
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export function WidgetStudioPanel() {
  const [entries, setEntries] = useState<WidgetCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Generate bar state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Project dropdown for "Add to Canvas"
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Confirm delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch catalog ────────────────────────────────────────────

  const fetchCatalog = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/widget-catalog`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: WidgetCatalogEntry[] = await resp.json();
      setEntries(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch widget catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // ── Fetch projects (for "Add to Canvas" dropdown) ────────────

  const fetchProjects = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/projects`);
      if (!resp.ok) return;
      const data: Project[] = await resp.json();
      setProjects(data);
    } catch {
      // Silently fail — projects just won't be available
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ── Close dropdown on outside click ──────────────────────────

  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProjectDropdown]);

  // ── Toast helper ─────────────────────────────────────────────

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Generate widget ──────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setGenerating(true);
    try {
      const resp = await fetch(`${API_BASE}/api/widget-catalog/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const newEntry: WidgetCatalogEntry = await resp.json();
      setEntries((prev) => [newEntry, ...prev]);
      setPrompt('');
      showToast(`Widget "${newEntry.name}" created successfully`);
    } catch (e: any) {
      showToast(e.message ?? 'Generation failed', true);
    } finally {
      setGenerating(false);
    }
  }, [prompt, showToast]);

  // ── Delete widget ────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/widget-catalog/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (selectedId === id) setSelectedId(null);
      setConfirmDeleteId(null);
      showToast('Widget deleted');
    } catch (e: any) {
      showToast(e.message ?? 'Delete failed', true);
    }
  }, [selectedId, showToast]);

  // ── Add to canvas ────────────────────────────────────────────

  const handleAddToCanvas = useCallback(async (projectName: string) => {
    const entry = entries.find((e) => e.id === selectedId);
    if (!entry) return;

    setShowProjectDropdown(false);
    try {
      const resp = await fetch(
        `${API_BASE}/api/canvas/${encodeURIComponent(projectName)}/widgets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: entry.name,
            html: entry.html,
            css: entry.css,
            js: entry.js,
            tab: 'main',
            col_span: entry.col_span ?? 4,
            row_span: entry.row_span ?? 4,
          }),
        },
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      showToast(`Added "${entry.name}" to ${projectName}`);
    } catch (e: any) {
      showToast(e.message ?? 'Failed to add widget', true);
    }
  }, [entries, selectedId, showToast]);

  // ── Derived state ────────────────────────────────────────────

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  // Background particles
  const [particles] = useState(() =>
    Array.from({ length: 16 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      size: 1 + Math.random() * 2,
    })),
  );

  // Parse data_schema fields for display
  const schemaFields = useMemo(() => {
    if (!selected?.data_schema) return [];
    const props = selected.data_schema.properties ?? selected.data_schema;
    return Object.entries(props).map(([name, def]: [string, any]) => ({
      name,
      type: def?.type ?? 'any',
      description: def?.description ?? '',
    }));
  }, [selected]);

  return (
    <div className={styles.root}>
      {/* Background particles */}
      <div className={styles.particles}>
        {particles.map((p, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Widget Studio</h1>
        <p className={styles.subtitle}>
          Browse, preview, and create reusable widget types &mdash; {entries.length} widget
          {entries.length !== 1 ? 's' : ''} in catalog
        </p>
      </div>

      {/* Generate Bar */}
      <div className={styles.generateBar}>
        <input
          className={styles.generateInput}
          type="text"
          placeholder="Describe a widget to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !generating) handleGenerate();
          }}
          disabled={generating}
        />
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating && <span className={styles.generateSpinner} />}
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Shimmer bar while generating */}
      {generating && <div className={styles.shimmerBar} />}

      {/* Loading state */}
      {loading && <div className={styles.loadingBar} />}

      {/* Error state */}
      {error && (
        <div className={styles.emptyState}>Failed to load widget catalog: {error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className={styles.emptyState}>
          No widgets in catalog yet. Describe one above to get started.
        </div>
      )}

      {/* Card Grid */}
      <div className={styles.grid}>
        {entries.map((entry, idx) => {
          const catStyle = getCategoryStyle(entry.category);
          const isSelected = selectedId === entry.id;
          return (
            <div
              key={entry.id}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
              style={{ animationDelay: `${idx * 0.06}s` }}
              onClick={() => setSelectedId(isSelected ? null : entry.id)}
            >
              <WidgetPreview
                html={entry.html}
                css={entry.css}
                js={entry.js}
                data={entry.preview_data}
                height={180}
                className={styles.cardPreview}
              />
              <div className={styles.cardBody}>
                <h3 className={styles.cardName}>{entry.name}</h3>
                <div className={styles.cardMeta}>
                  <span
                    className={styles.badge}
                    style={{
                      background: catStyle.bg,
                      color: catStyle.text,
                      border: `1px solid ${catStyle.bg}`,
                    }}
                  >
                    {entry.category}
                  </span>
                </div>
                <p className={styles.cardDesc}>{entry.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Panel (slides up from bottom as overlay) */}
      {selected && (
        <div className={styles.detailOverlay} onClick={() => setSelectedId(null)}>
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.detailHeader}>
              <div className={styles.detailTitleBlock}>
                <h2 className={styles.detailTitle}>{selected.name}</h2>
                <p className={styles.detailDesc}>{selected.description}</p>
                <div className={styles.detailMetaRow}>
                  <span
                    className={styles.badge}
                    style={{
                      background: getCategoryStyle(selected.category).bg,
                      color: getCategoryStyle(selected.category).text,
                      border: `1px solid ${getCategoryStyle(selected.category).bg}`,
                      fontSize: 11,
                      padding: '3px 10px',
                    }}
                  >
                    {selected.category}
                  </span>
                  {selected.created_at && (
                    <span className={styles.detailTimestamp}>
                      {new Date(selected.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedId(null)}>
                {'\u2715'}
              </button>
            </div>

            {/* Body: preview + info side-by-side */}
            <div className={styles.detailBody}>
              {/* Left: large preview */}
              <WidgetPreview
                html={selected.html}
                css={selected.css}
                js={selected.js}
                data={selected.preview_data}
                height={300}
                className={styles.detailPreview}
              />

              {/* Right: schema + actions */}
              <div className={styles.detailRight}>
                {/* Data Schema */}
                {schemaFields.length > 0 && (
                  <div>
                    <h4 className={styles.sectionTitle}>Data Schema</h4>
                    <div className={styles.schemaGrid}>
                      {schemaFields.map((f) => (
                        <div key={f.name} className={styles.schemaField}>
                          <span className={styles.schemaFieldName}>{f.name}</span>
                          <span className={styles.schemaFieldType}>{f.type}</span>
                          {f.description && (
                            <span className={styles.schemaFieldDesc}>{f.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {schemaFields.length === 0 && (
                  <div>
                    <h4 className={styles.sectionTitle}>Data Schema</h4>
                    <p style={{ fontSize: 13, color: 'rgba(200,214,229,0.35)', margin: 0 }}>
                      No schema defined for this widget.
                    </p>
                  </div>
                )}

                {/* Grid size info */}
                {(selected.col_span || selected.row_span) && (
                  <div>
                    <h4 className={styles.sectionTitle}>Default Size</h4>
                    <p
                      style={{
                        fontSize: 13,
                        color: '#c8d6e5',
                        margin: 0,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      }}
                    >
                      {selected.col_span ?? '?'} col &times; {selected.row_span ?? '?'} row
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className={styles.actions}>
                  <div className={styles.dropdownWrapper} ref={dropdownRef}>
                    <button
                      className={styles.addBtn}
                      onClick={() => setShowProjectDropdown((v) => !v)}
                    >
                      Add to Canvas {showProjectDropdown ? '\u25B4' : '\u25BE'}
                    </button>
                    {showProjectDropdown && (
                      <div className={styles.dropdown}>
                        {projects.length === 0 && (
                          <div
                            style={{
                              padding: '12px',
                              fontSize: 12,
                              color: 'rgba(200,214,229,0.4)',
                              textAlign: 'center',
                            }}
                          >
                            No projects found
                          </div>
                        )}
                        {projects.map((p) => (
                          <button
                            key={p.name}
                            className={styles.dropdownItem}
                            onClick={() => handleAddToCanvas(p.name)}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDeleteId(selected.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDeleteId(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Delete Widget</h3>
            <p className={styles.confirmText}>
              Are you sure you want to delete &ldquo;
              {entries.find((e) => e.id === confirmDeleteId)?.name ?? confirmDeleteId}
              &rdquo; from the catalog? This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
              <button className={styles.deleteBtn} onClick={() => handleDelete(confirmDeleteId)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.isError ? styles.toastError : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
