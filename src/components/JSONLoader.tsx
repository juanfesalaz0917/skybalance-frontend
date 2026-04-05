/**
 * @file JSONLoader.tsx
 * @description Modal for loading a user-selected JSON file to reconstruct the AVL tree.
 *
 * REQ §1.1 — Lectura y administración del árbol:
 *  - User picks a JSON file via the OS file picker (no hardcoded path).
 *  - User chooses the reconstruction mode:
 *      · Topology  → respects parent/child structure from the JSON.
 *      · Insertion → inserts one by one with AVL auto-balance.
 *        In this mode, a BST is built in parallel and shown for comparison.
 *
 * REQ §6 — The critical depth threshold is set BEFORE loading.
 *
 * SOLID — (S) Only handles file selection + mode choice UI.
 *         (D) onLoad callback owns the actual service call.
 */

import React, { useState, useRef } from 'react';
import { Upload, FileJson, X, AlertCircle, Loader2 } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface JSONLoaderProps {
  isOpen:        boolean;
  criticalDepth: number;
  isLoading:     boolean;
  error:         string | null;
  onLoad:  (file: File, mode: 'topology' | 'insertion', criticalDepth: number) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const JSONLoader: React.FC<JSONLoaderProps> = ({
  isOpen,
  criticalDepth: initialDepth,
  isLoading,
  error,
  onLoad,
  onClose,
}) => {
  const [file,         setFile]         = useState<File | null>(null);
  const [mode,         setMode]         = useState<'topology' | 'insertion'>('insertion');
  const [localDepth,   setLocalDepth]   = useState(initialDepth);
  const [isDragging,   setIsDragging]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleFilePick = (picked: File | undefined) => {
    if (!picked) return;
    if (!picked.name.endsWith('.json')) {
      alert('Solo se aceptan archivos .json');
      return;
    }
    setFile(picked);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilePick(e.dataTransfer.files[0]);
  };

  const handleSubmit = () => {
    if (!file) return;
    onLoad(file, mode, localDepth);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loader-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-black px-6 py-4 flex items-center justify-between">
          <h2 id="loader-title" className="text-white font-bold text-lg tracking-wide">
            Cargar árbol desde JSON
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar"
            className="text-gray-300 hover:text-white disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Step 1: Critical depth (REQ §6) ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
              Profundidad crítica (REQ §6)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={localDepth}
                disabled={isLoading}
                onChange={e => setLocalDepth(Number(e.target.value))}
                className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                           focus:ring-2 focus:ring-black/20 outline-none disabled:opacity-50"
              />
              <p className="text-xs text-gray-500">
                Nodos más profundos que este valor serán marcados como críticos
                y su precio se incrementará un 25%.
              </p>
            </div>
          </div>

          {/* ── Step 2: Mode selection (REQ §1.1) ── */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Modo de reconstrucción
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  value: 'insertion' as const,
                  title: 'Inserción',
                  desc:  'Inserta uno a uno con balanceo automático. Genera comparación AVL vs BST.',
                  badge: 'Genera comparación',
                },
                {
                  value: 'topology' as const,
                  title: 'Topología',
                  desc:  'Respeta la estructura padre-hijo exacta del JSON.',
                  badge: 'Sin rebalanceo',
                },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  disabled={isLoading}
                  className={`
                    text-left rounded-xl border-2 px-3 py-2.5
                    transition-all duration-150 disabled:opacity-50
                    ${mode === opt.value
                      ? 'border-black bg-black/5'
                      : 'border-gray-200 hover:border-gray-400'}
                  `}
                >
                  <p className="text-sm font-bold text-gray-900">{opt.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{opt.desc}</p>
                  <span className={`
                    text-[10px] font-semibold mt-1.5 inline-block px-1.5 py-0.5 rounded
                    ${mode === opt.value ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}
                  `}>
                    {opt.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 3: File picker ── */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Archivo JSON
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl py-6 flex flex-col items-center gap-2
                cursor-pointer transition-colors duration-150
                ${isDragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-500'}
                ${file ? 'bg-green-50 border-green-400' : ''}
              `}
            >
              {file ? (
                <>
                  <FileJson size={28} className="text-green-600" />
                  <p className="text-sm font-semibold text-green-700">{file.name}</p>
                  <p className="text-xs text-green-600">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-gray-400" />
                  <p className="text-sm text-gray-600 font-medium">
                    Arrastra aquí o <span className="underline">selecciona</span>
                  </p>
                  <p className="text-xs text-gray-400">Solo archivos .json</p>
                </>
              )}
            </div>
            {/* Hidden native input — no hardcoded path (REQ §1.1) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => handleFilePick(e.target.files?.[0])}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2 rounded-full text-sm font-semibold border border-gray-300
                         text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold
                         bg-black text-white hover:bg-gray-800 disabled:opacity-40
                         transition-colors"
            >
              {isLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Cargando…</>
              ) : (
                <><Upload size={14} /> Cargar árbol</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JSONLoader;