import React, { useState, useEffect, useCallback } from 'react';
import { css, keyframes } from '@emotion/css';

// ─── Types ───────────────────────────────────────────────────────────

interface RolePreset {
  role: string;
  label: string;
  is_worker: boolean;
  persona?: string;
  expertise?: string[];
  builtin?: boolean;
}

interface ConfigField {
  type: 'number' | 'string' | 'boolean' | 'select';
  label: string;
  default: any;
  min?: number;
  max?: number;
  options?: string[];
}

interface Phase {
  id: string;
  label: string;
  repeats?: boolean;
  creates_isolation?: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  version?: number;
  role_presets: RolePreset[];
  config_schema: Record<string, ConfigField>;
  phases: Phase[];
  isolation_strategy?: string;
}

// ─── Animations ──────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 8px rgba(0, 255, 204, 0.15); }
  50%      { box-shadow: 0 0 20px rgba(0, 255, 204, 0.35); }
`;

const slideDown = keyframes`
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 1200px; }
`;

const trackPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
`;

const floatParticle = keyframes`
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  20%  { opacity: 0.6; }
  80%  { opacity: 0.3; }
  100% { transform: translateY(-120px) translateX(30px); opacity: 0; }
`;

// ─── Category Colors ─────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  engineering: { bg: 'rgba(0, 255, 204, 0.12)', text: '#00ffcc', glow: 'rgba(0, 255, 204, 0.4)' },
  research:    { bg: 'rgba(123, 97, 255, 0.12)', text: '#7B61FF', glow: 'rgba(123, 97, 255, 0.4)' },
  writing:     { bg: 'rgba(255, 170, 51, 0.12)', text: '#ffaa33', glow: 'rgba(255, 170, 51, 0.4)' },
  data:        { bg: 'rgba(51, 170, 255, 0.12)', text: '#33aaff', glow: 'rgba(51, 170, 255, 0.4)' },
  operations:  { bg: 'rgba(255, 107, 107, 0.12)', text: '#ff6b6b', glow: 'rgba(255, 107, 107, 0.4)' },
};

const getCategoryColor = (cat: string) =>
  CATEGORY_COLORS[cat] ?? { bg: 'rgba(0, 255, 204, 0.08)', text: '#00ffcc', glow: 'rgba(0, 255, 204, 0.3)' };

const ICON_MAP: Record<string, string> = {
  code: '\u2318',
  search: '\u2315',
  edit: '\u270E',
  data: '\u2637',
  ops: '\u2699',
};

// ─── Isolation badge labels ──────────────────────────────────────────

const ISOLATION_LABELS: Record<string, string> = {
  git_worktree: 'Git Worktree',
  subdirectory: 'Subdirectory',
  none: 'None',
};

// ─── Styles ──────────────────────────────────────────────────────────

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
    margin-bottom: 32px;
    animation: ${fadeIn} 0.6s ease-out;
  `,

  title: css`
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #e8f0fe;
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

  grid: css`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  `,

  card: css`
    background: rgba(15, 20, 30, 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 204, 0.08);
    border-radius: 12px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    animation: ${fadeIn} 0.5s ease-out both;
    position: relative;
    overflow: hidden;

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
    border-color: rgba(0, 255, 204, 0.35);
    box-shadow: 0 0 24px rgba(0, 255, 204, 0.12);
    animation: ${pulseGlow} 3s ease-in-out infinite;
  `,

  cardHeader: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  `,

  cardIcon: css`
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(0, 255, 204, 0.08);
    border: 1px solid rgba(0, 255, 204, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #00ffcc;
    flex-shrink: 0;
  `,

  cardTitleBlock: css`
    flex: 1;
    margin-left: 14px;
  `,

  cardName: css`
    font-size: 17px;
    font-weight: 600;
    color: #e8f0fe;
    margin: 0 0 2px 0;
    line-height: 1.3;
  `,

  cardVersion: css`
    font-size: 11px;
    color: rgba(200, 214, 229, 0.35);
  `,

  cardDesc: css`
    font-size: 13px;
    color: rgba(200, 214, 229, 0.6);
    line-height: 1.55;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  cardMeta: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  `,

  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 20px;
    white-space: nowrap;
    letter-spacing: 0.3px;
  `,

  metaCount: css`
    font-size: 11px;
    color: rgba(200, 214, 229, 0.4);
    display: inline-flex;
    align-items: center;
    gap: 3px;
  `,

  // ─── Detail Panel ──────────────────────────────────────────────

  detail: css`
    position: relative;
    z-index: 1;
    background: rgba(12, 16, 24, 0.9);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0, 255, 204, 0.1);
    border-radius: 14px;
    padding: 32px;
    margin-bottom: 24px;
    animation: ${slideDown} 0.4s ease-out;
    overflow: hidden;
  `,

  detailHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  `,

  detailTitle: css`
    font-size: 22px;
    font-weight: 700;
    color: #e8f0fe;
    margin: 0;
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
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #e8f0fe;
    }
  `,

  sectionTitle: css`
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: rgba(0, 255, 204, 0.6);
    margin: 0 0 14px 0;
  `,

  section: css`
    margin-bottom: 28px;
  `,

  // ─── Roles ────────────────────────────────────────────────────

  rolesRow: css`
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  `,

  roleBadge: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(15, 20, 30, 0.7);
    border: 1px solid rgba(0, 255, 204, 0.08);
    font-size: 13px;
    color: #c8d6e5;
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(0, 255, 204, 0.2);
      background: rgba(0, 255, 204, 0.04);
    }
  `,

  roleIcon: css`
    font-size: 10px;
    opacity: 0.5;
  `,

  workerDot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #00ffcc;
    box-shadow: 0 0 6px rgba(0, 255, 204, 0.5);
    flex-shrink: 0;
  `,

  coordinatorDot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #7B61FF;
    box-shadow: 0 0 6px rgba(123, 97, 255, 0.5);
    flex-shrink: 0;
  `,

  // ─── Config Schema ────────────────────────────────────────────

  schemaGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  `,

  schemaField: css`
    background: rgba(15, 20, 30, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 14px;
  `,

  schemaLabel: css`
    font-size: 12px;
    font-weight: 500;
    color: rgba(200, 214, 229, 0.5);
    margin-bottom: 6px;
  `,

  schemaValue: css`
    font-size: 14px;
    font-weight: 500;
    color: #e8f0fe;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  `,

  schemaType: css`
    font-size: 10px;
    color: rgba(0, 255, 204, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  `,

  // ─── Phase Timeline ───────────────────────────────────────────

  timeline: css`
    display: flex;
    align-items: center;
    gap: 0;
    overflow-x: auto;
    padding: 12px 0;

    &::-webkit-scrollbar { height: 4px; }
    &::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 2px; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.15); border-radius: 2px; }
  `,

  phaseNode: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
  `,

  phaseDot: css`
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(0, 255, 204, 0.06);
    border: 2px solid rgba(0, 255, 204, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: #00ffcc;
    position: relative;
    z-index: 1;
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(0, 255, 204, 0.5);
      box-shadow: 0 0 16px rgba(0, 255, 204, 0.2);
    }
  `,

  phaseLabel: css`
    font-size: 11px;
    color: rgba(200, 214, 229, 0.5);
    text-align: center;
    max-width: 80px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  phaseConnector: css`
    width: 40px;
    height: 2px;
    background: linear-gradient(90deg, rgba(0, 255, 204, 0.3), rgba(0, 255, 204, 0.08));
    flex-shrink: 0;
    margin-bottom: 24px;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -1px;
      background: linear-gradient(90deg, rgba(0, 255, 204, 0.6), transparent);
      background-size: 200% 100%;
      animation: ${shimmer} 3s linear infinite;
      border-radius: 1px;
    }
  `,

  repeatIndicator: css`
    position: absolute;
    top: -8px;
    right: -8px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(123, 97, 255, 0.15);
    border: 1px solid rgba(123, 97, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #7B61FF;
    z-index: 2;
    animation: ${trackPulse} 2s ease-in-out infinite;
  `,

  isolationIndicator: css`
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffaa33;
    box-shadow: 0 0 6px rgba(255, 170, 51, 0.4);
    z-index: 2;
  `,

  // ─── Actions ──────────────────────────────────────────────────

  actions: css`
    display: flex;
    gap: 12px;
    margin-top: 8px;
  `,

  applyBtn: css`
    background: linear-gradient(135deg, rgba(0, 255, 204, 0.12), rgba(0, 255, 204, 0.04));
    border: 1px solid rgba(0, 255, 204, 0.25);
    border-radius: 8px;
    color: #00ffcc;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 24px;
    cursor: pointer;
    transition: all 0.25s ease;
    letter-spacing: 0.3px;

    &:hover {
      background: linear-gradient(135deg, rgba(0, 255, 204, 0.2), rgba(0, 255, 204, 0.08));
      box-shadow: 0 0 20px rgba(0, 255, 204, 0.15);
      transform: translateY(-1px);
    }

    &:active { transform: translateY(0); }
  `,

  // ─── Toast ─────────────────────────────────────────────────────

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
    z-index: 9999;
    animation: ${fadeIn} 0.3s ease-out;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 255, 204, 0.1);
  `,

  // ─── Loading / Error ──────────────────────────────────────────

  loadingBar: css`
    height: 2px;
    background: linear-gradient(90deg, transparent, #00ffcc, transparent);
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s linear infinite;
    border-radius: 1px;
    margin: 40px 0;
  `,

  emptyState: css`
    text-align: center;
    padding: 60px 20px;
    color: rgba(200, 214, 229, 0.35);
    font-size: 14px;
  `,
};

// ─── Component ───────────────────────────────────────────────────────

export function TemplateBrowserPanel() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const resp = await fetch('http://localhost:4040/api/templates');
        if (!resp.ok) { throw new Error(`HTTP ${resp.status}`); }
        const data = await resp.json();
        setTemplates(data);
      } catch (e: any) {
        setError(e.message ?? 'Failed to fetch templates');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleCardClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  // Background particles (static positions, generated once)
  const [particles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      size: 1 + Math.random() * 2,
    }))
  );

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
        <h1 className={styles.title}>Template Library</h1>
        <p className={styles.subtitle}>
          Workflow blueprints for agent orchestration &mdash; {templates.length} template{templates.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Loading */}
      {loading && <div className={styles.loadingBar} />}

      {/* Error */}
      {error && (
        <div className={styles.emptyState}>
          Failed to load templates: {error}
        </div>
      )}

      {/* Card Grid */}
      {!loading && !error && templates.length === 0 && (
        <div className={styles.emptyState}>No templates found.</div>
      )}

      <div className={styles.grid}>
        {templates.map((t, idx) => {
          const catColor = getCategoryColor(t.category);
          const isSelected = selectedId === t.id;
          return (
            <div
              key={t.id}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
              style={{ animationDelay: `${idx * 0.07}s` }}
              onClick={() => handleCardClick(t.id)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  {ICON_MAP[t.icon ?? ''] ?? '\u2726'}
                </div>
                <div className={styles.cardTitleBlock}>
                  <h3 className={styles.cardName}>{t.name}</h3>
                  {t.version != null && (
                    <span className={styles.cardVersion}>v{t.version}</span>
                  )}
                </div>
              </div>

              <p className={styles.cardDesc}>{t.description}</p>

              <div className={styles.cardMeta}>
                {/* Category badge */}
                <span
                  className={styles.badge}
                  style={{
                    background: catColor.bg,
                    color: catColor.text,
                    border: `1px solid ${catColor.bg}`,
                  }}
                >
                  {t.category}
                </span>

                {/* Isolation badge */}
                {t.isolation_strategy && t.isolation_strategy !== 'none' && (
                  <span
                    className={styles.badge}
                    style={{
                      background: 'rgba(255, 170, 51, 0.1)',
                      color: '#ffaa33',
                      border: '1px solid rgba(255, 170, 51, 0.15)',
                    }}
                  >
                    {ISOLATION_LABELS[t.isolation_strategy] ?? t.isolation_strategy}
                  </span>
                )}

                {/* Role count */}
                <span className={styles.metaCount}>
                  <span style={{ color: '#00ffcc' }}>{'\u25CF'}</span>
                  {t.role_presets.length} role{t.role_presets.length !== 1 ? 's' : ''}
                </span>

                {/* Phase count */}
                <span className={styles.metaCount}>
                  <span style={{ color: '#7B61FF' }}>{'\u25CF'}</span>
                  {t.phases.length} phase{t.phases.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Detail Panel */}
      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>{selected.name}</h2>
            <button className={styles.closeBtn} onClick={() => setSelectedId(null)}>
              {'\u2715'}
            </button>
          </div>

          {/* Roles Section */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Roles</h4>
            <div className={styles.rolesRow}>
              {selected.role_presets.map((r) => (
                <div key={r.role} className={styles.roleBadge}>
                  <span className={r.is_worker ? styles.workerDot : styles.coordinatorDot} />
                  <span>{r.label}</span>
                  <span className={styles.roleIcon}>
                    {r.is_worker ? 'worker' : 'coordinator'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Config Schema */}
          {Object.keys(selected.config_schema).length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Configuration</h4>
              <div className={styles.schemaGrid}>
                {Object.entries(selected.config_schema).map(([key, field]) => (
                  <div key={key} className={styles.schemaField}>
                    <div className={styles.schemaLabel}>{field.label}</div>
                    <div className={styles.schemaValue}>
                      {field.type === 'boolean'
                        ? field.default
                          ? 'true'
                          : 'false'
                        : field.type === 'select'
                        ? String(field.default)
                        : String(field.default ?? '\u2014')}
                    </div>
                    <div className={styles.schemaType}>
                      {field.type}
                      {field.min != null && ` \u00B7 min ${field.min}`}
                      {field.max != null && ` \u00B7 max ${field.max}`}
                      {field.options && ` \u00B7 ${field.options.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase Timeline */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Phase Timeline</h4>
            <div className={styles.timeline}>
              {selected.phases.map((phase, idx) => (
                <React.Fragment key={phase.id}>
                  <div className={styles.phaseNode}>
                    <div className={styles.phaseDot}>
                      {idx + 1}
                      {phase.repeats && (
                        <span className={styles.repeatIndicator} title="Repeating phase">
                          {'\u21BB'}
                        </span>
                      )}
                      {phase.creates_isolation && (
                        <span className={styles.isolationIndicator} title="Creates isolation" />
                      )}
                    </div>
                    <span className={styles.phaseLabel} title={phase.label}>
                      {phase.label}
                    </span>
                  </div>
                  {idx < selected.phases.length - 1 && (
                    <div className={styles.phaseConnector} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.applyBtn}
              onClick={(e) => {
                e.stopPropagation();
                showToast(`Template "${selected.name}" ready to apply \u2014 select a project to continue.`);
              }}
            >
              Apply to Project
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
