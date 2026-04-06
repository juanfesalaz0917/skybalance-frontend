/**
 * @file Navbar.tsx
 * @description Top navigation bar with all dashboard controls.
 *
 * Controls housed here:
 *  - Hamburger (logout)
 *  - Logo
 *  - Search bar (active in list view only)
 *  - Load JSON button (REQ §1.1)
 *  - Side panel toggles: Métricas (REQ §4) | Versiones (REQ §2) | Cola (REQ §3)
 *  - View toggle: Lista ↔ Árbol
 *
 * SOLID — (S) Only navigation UI. All logic injected via props (DIP).
 */

import React, { useState } from 'react';
import {
  Menu, Search, X,
  LayoutList, Network,
  FileJson, BarChart2, GitBranch, List,
} from 'lucide-react';
import skybalanceLogo from '../assets/logo-skybalance.png';

// ─── Types ────────────────────────────────────────────────────────────────────

type SidePanel = 'analytics' | 'versions' | 'queue' | null;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface NavbarProps {
  onSearch:           (query: string) => void;
  onMenuToggle:       () => void;
  viewMode:           'list' | 'tree';
  onViewChange:       (mode: 'list' | 'tree') => void;
  /** Opens the JSON file loader modal (REQ §1.1). */
  onOpenLoader:       () => void;
  /** Active side panel — highlights the corresponding icon. */
  sidePanel:          SidePanel;
  /** Toggles a side panel (pass null to close). */
  onSidePanelChange:  (panel: SidePanel) => void;
}

// ─── Sub-component: IconToggle ────────────────────────────────────────────────

const IconToggle: React.FC<{
  label:    string;
  icon:     React.ReactNode;
  active:   boolean;
  onClick:  () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`
      p-2 rounded-lg transition-all duration-150
      ${active
        ? 'bg-white/20 text-white'
        : 'text-zinc-400 hover:text-white hover:bg-white/10'}
    `}
  >
    {icon}
  </button>
);

// ─── Component ────────────────────────────────────────────────────────────────

const Navbar: React.FC<NavbarProps> = ({
  onSearch,
  onMenuToggle,
  viewMode,
  onViewChange,
  onOpenLoader,
  sidePanel,
  onSidePanelChange,
}) => {
  const [query, setQuery] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch(e.target.value);
  };

  const handleClear = () => { setQuery(''); onSearch(''); };

  const togglePanel = (panel: SidePanel) =>
    onSidePanelChange(sidePanel === panel ? null : panel);

  return (
    <nav
      className="w-full bg-black px-3 py-2 flex items-center gap-2 sticky top-0 z-50 shadow-lg"
      aria-label="Barra de navegación principal"
    >
      {/* ── Left: hamburger + logo ── */}
      <button
        onClick={onMenuToggle}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="text-white hover:text-gray-300 transition-colors flex-shrink-0 p-1 rounded"
      >
        <Menu size={24} />
      </button>

      <img
        src={skybalanceLogo}
        alt="SkyBalance Airlines"
        className="flex-shrink-0"
        style={{
          width: '38px', height: '38px',
          objectFit: 'contain',
          filter: 'brightness(0) invert(1)',
        }}
      />

      {/* ── Search bar (disabled in tree view) ── */}
      <div
        className={`
          flex items-center gap-2 bg-white rounded-full px-3 py-1.5 flex-1 max-w-sm
          transition-opacity ${viewMode === 'tree' ? 'opacity-40 pointer-events-none' : ''}
        `}
        role="search"
      >
        <Search size={14} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Buscar vuelo..."
          aria-label="Buscar vuelo"
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400
                     outline-none border-0 min-w-0"
        />
        {query.length > 0 && (
          <button onClick={handleClear} aria-label="Limpiar" className="text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-1 ml-auto">

        {/* REQ §1.1 — Load JSON */}
        <button
          onClick={onOpenLoader}
          aria-label="Cargar árbol desde JSON"
          title="Cargar árbol desde JSON"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                     text-zinc-300 hover:text-white hover:bg-white/10 transition-all border
                     border-zinc-700 hover:border-zinc-500"
        >
          <FileJson size={14} />
          <span className="hidden md:inline">Cargar JSON</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700 mx-1" />

        {/* REQ §4 — Analytics panel toggle */}
        <IconToggle
          label="Métricas del árbol"
          icon={<BarChart2 size={17} />}
          active={sidePanel === 'analytics'}
          onClick={() => togglePanel('analytics')}
        />

        {/* REQ §2 — Versions panel toggle */}
        <IconToggle
          label="Versiones guardadas"
          icon={<GitBranch size={17} />}
          active={sidePanel === 'versions'}
          onClick={() => togglePanel('versions')}
        />

        {/* REQ §3 — Concurrency queue toggle */}
        <IconToggle
          label="Cola de inserción"
          icon={<List size={17} />}
          active={sidePanel === 'queue'}
          onClick={() => togglePanel('queue')}
        />

        {/* Divider */}
        <div className="w-px h-5 bg-zinc-700 mx-1" />

        {/* View toggle: Lista / Árbol */}
        <div
          className="flex items-center gap-0.5 bg-zinc-800 rounded-full p-0.5"
          role="group"
          aria-label="Cambiar vista"
        >
          {([
            { mode: 'list' as const, icon: <LayoutList size={14} />, label: 'Lista' },
            { mode: 'tree' as const, icon: <Network     size={14} />, label: 'Árbol' },
          ]).map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              aria-label={`Vista de ${label.toLowerCase()}`}
              aria-pressed={viewMode === mode}
              title={`Ver como ${label}`}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                transition-all duration-200
                ${viewMode === mode
                  ? 'bg-white text-black shadow'
                  : 'text-zinc-400 hover:text-white'}
              `}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;