/**
 * @file VersioningPanel.tsx
 * @description Named version management panel.
 *
 * REQ §2 — Sistema de Versionado Persistente:
 *  - User saves a named snapshot ("Simulación Alta Demanda").
 *  - User can restore any saved version.
 *  - User can delete individual versions.
 *
 * SOLID — (S) Only version list UI. State managed by useAppState (DIP).
 */

import React, { useState } from 'react';
import { Save, RotateCcw, Trash2, GitBranch, Clock } from 'lucide-react';
import type { TreeVersion } from '../hooks/useAppState';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VersioningPanelProps {
  versions:         TreeVersion[];
  onSave:           (name: string) => void;
  onRestore:        (version: TreeVersion) => void;
  onDelete:         (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const VersioningPanel: React.FC<VersioningPanelProps> = ({
  versions,
  onSave,
  onRestore,
  onDelete,
}) => {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    onSave(trimmed || `Versión ${new Date().toLocaleTimeString('es-CO')}`);
    setName('');
  };

  return (
    <div className="bg-zinc-900 border-l border-zinc-800 w-64 flex-shrink-0 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-black">
        <GitBranch size={15} className="text-zinc-400" />
        <h3 className="text-white font-bold text-sm">Versiones</h3>
        <span className="ml-auto text-zinc-600 text-[10px]">{versions.length}</span>
      </div>

      {/* Save new version */}
      <div className="px-3 py-3 border-b border-zinc-800">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder='Ej: "Alta demanda"'
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
                     text-xs text-white placeholder-zinc-500 outline-none
                     focus:border-zinc-500 mb-2"
        />
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5
                     bg-white text-black text-xs font-bold rounded-lg
                     hover:bg-gray-100 transition-colors"
        >
          <Save size={12} /> Guardar versión actual
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-8 px-4">
            No hay versiones guardadas. Guarda el estado actual del árbol para poder restaurarlo.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {versions.map(v => (
              <li key={v.id} className="px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{v.name}</p>
                    <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <Clock size={9} />
                      {v.savedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onRestore(v)}
                      aria-label={`Restaurar ${v.name}`}
                      title="Restaurar esta versión"
                      className="p-1 text-zinc-400 hover:text-green-400 transition-colors"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(v.id)}
                      aria-label={`Eliminar ${v.name}`}
                      title="Eliminar versión"
                      className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VersioningPanel;