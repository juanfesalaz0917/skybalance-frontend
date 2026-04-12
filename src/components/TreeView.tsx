/**
 * @file TreeView.tsx
 * @description Interactive AVL tree visualisation for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Each sub-component (NodeCard, PropertiesBar,
 *        DetailPanel, ZoomControls, Legend) has one job.
 *  - (O) Open/Closed: Node appearance is driven by data flags (nodoCritico,
 *        alerta, promocion) — adding a new flag only requires a new CSS branch.
 *  - (D) Dependency Inversion: Tree data arrives via props from App (DIP);
 *        this component never touches Axios or TreeService directly.
 *
 * Layout algorithm — In-Order Sequential X:
 *   1. In-order traversal assigns a sequential integer x-index to every node.
 *   2. Internal nodes are placed at (x * H_STEP, depth * V_STEP).
 *   3. SVG cubic-bezier paths connect parent-bottom to child-top.
 *   This guarantees no node overlaps and produces the classic BST/AVL layout.
 *
 * Interaction:
 *   - Drag to pan.
 *   - Scroll wheel to zoom (centered on cursor).
 *   - Click a node to open its detail side-panel.
 *   - "Center" button resets pan and zoom.
 *
 * Node color coding (matches project requirement §6):
 *   ■ White border   → root node
 *   ■ Red border     → nodoCritico === true  (depth exceeds user threshold)
 *   ■ Amber border   → alerta === true
 *   ■ Zinc border    → normal node
 */

import {
  ChevronLeft,
  Loader2,
  Maximize2,
  RefreshCw,
  ServerCrash,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { TreeNode, TreeProperties } from "../models/FlightNode";

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 180; // node card width  (px)
const NODE_H = 100; // node card height (px)
const H_STEP = NODE_W + 50; // horizontal distance between consecutive in-order nodes
const V_STEP = NODE_H + 70; // vertical distance between tree levels
const PADDING = 80; // canvas edge padding

// ─── Layout types ─────────────────────────────────────────────────────────────

interface PixelPos {
  px: number;
  py: number;
}
type PositionMap = Map<string, PixelPos>;

interface FlatNode {
  node: TreeNode;
  px: number;
  py: number;
}
interface PixelEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isLeft: boolean;
}
interface LayoutData {
  flatNodes: FlatNode[];
  edges: PixelEdge[];
  canvasW: number;
  canvasH: number;
}

// ─── Layout engine ────────────────────────────────────────────────────────────

/**
 * Computes pixel positions for every node using an in-order sequential
 * x-index strategy — the canonical AVL/BST layout.
 *
 * @param root - Root of the AVL tree (null-safe).
 * @returns LayoutData with positions, edges, and canvas dimensions.
 *          Returns null when the tree is empty.
 */
function buildLayout(root: TreeNode | null): LayoutData | null {
  if (!root) return null;

  const positions: PositionMap = new Map();
  let xCounter = 0;

  // Step 1 — assign x indices via in-order traversal
  function assignPositions(node: TreeNode | null, depth: number): void {
    if (!node) return;
    assignPositions(node.izquierdo, depth + 1);
    positions.set(node.flight.codigo, {
      px: PADDING + xCounter * H_STEP,
      py: PADDING + depth * V_STEP,
    });
    xCounter++;
    assignPositions(node.derecho, depth + 1);
  }

  assignPositions(root, 0);

  // Step 2 — collect flat node list (pre-order for top-to-bottom rendering)
  const flatNodes: FlatNode[] = [];
  function collectNodes(node: TreeNode | null): void {
    if (!node) return;
    const pos = positions.get(node.flight.codigo);
    if (pos) flatNodes.push({ node, ...pos });
    collectNodes(node.izquierdo);
    collectNodes(node.derecho);
  }
  collectNodes(root);

  // Step 3 — collect edges with pixel coordinates
  const edges: PixelEdge[] = [];
  function collectEdges(node: TreeNode | null): void {
    if (!node) return;
    const pos = positions.get(node.flight.codigo);
    if (!pos) return;

    (
      [
        [node.izquierdo, true],
        [node.derecho, false],
      ] as [TreeNode | null, boolean][]
    ).forEach(([child, isLeft]) => {
      if (!child) return;
      const cPos = positions.get(child.flight.codigo);
      if (!cPos) return;
      edges.push({
        fromX: pos.px + NODE_W / 2,
        fromY: pos.py + NODE_H,
        toX: cPos.px + NODE_W / 2,
        toY: cPos.py,
        isLeft,
      });
      collectEdges(child);
    });
  }
  collectEdges(root);

  // Step 4 — canvas dimensions
  const maxPX = flatNodes.length ? Math.max(...flatNodes.map((n) => n.px)) : 0;
  const maxPY = flatNodes.length ? Math.max(...flatNodes.map((n) => n.py)) : 0;
  const canvasW = maxPX + NODE_W + PADDING;
  const canvasH = maxPY + NODE_H + PADDING;

  return { flatNodes, edges, canvasW, canvasH };
}

/**
 * Generates an SVG cubic-bezier path from parent-bottom to child-top.
 * The S-curve makes the tree edges visually clear.
 */
function edgePath(fx: number, fy: number, tx: number, ty: number): string {
  const midY = (fy + ty) / 2;
  return `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
}

// ─── Sub-component: NodeCard ──────────────────────────────────────────────────

interface NodeCardProps {
  node: TreeNode;
  isRoot: boolean;
  isSelected: boolean;
  onClick: (node: TreeNode) => void;
}

/**
 * NodeCard — Renders a single AVL tree node as a compact aviation-themed card.
 *
 * Color semantics (project requirement §6):
 *  - Red border/tint  : nodoCritico === true  (depth ≥ critical threshold)
 *  - Amber border     : alerta === true
 *  - White border     : root node
 *  - Zinc border      : normal node
 *
 * FE badge colour:
 *  - Green  : factorEquilibrio === 0  (perfectly balanced)
 *  - Yellow : |FE| === 1              (valid AVL state)
 *  - Red    : |FE| >= 2               (invalid — only visible in stress mode)
 */
const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isRoot,
  isSelected,
  onClick,
}) => {
  const { flight } = node;
  const absFE = Math.abs(flight.factorEquilibrio);

  // ── Styles ──
  const borderColor = flight.nodoCritico
    ? "border-red-500"
    : flight.alerta
      ? "border-amber-500"
      : isRoot
        ? "border-white"
        : isSelected
          ? "border-sky-400"
          : "border-zinc-600";

  const bgColor = flight.nodoCritico
    ? "bg-red-950/80"
    : flight.alerta
      ? "bg-amber-950/80"
      : isRoot
        ? "bg-zinc-900"
        : "bg-zinc-800";

  const feColor =
    absFE === 0
      ? "text-green-400"
      : absFE === 1
        ? "text-yellow-400"
        : "text-red-400";

  const ringClass = isSelected
    ? "ring-2 ring-sky-400 ring-offset-1 ring-offset-zinc-950"
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Nodo ${flight.codigo}: ${flight.origen} a ${flight.destino}`}
      onClick={() => onClick(node)}
      onKeyDown={(e) => e.key === "Enter" && onClick(node)}
      className={`
        ${bgColor} ${borderColor} ${ringClass}
        border-2 rounded-xl px-3 py-2
        cursor-pointer hover:brightness-125
        transition-all duration-150
        flex flex-col justify-between
      `}
      style={{ width: NODE_W, height: NODE_H }}
    >
      {/* ── Row 1: code + badges ── */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-white font-bold text-[11px] tracking-widest truncate">
          {flight.codigo}
        </span>
        <div className="flex flex-wrap justify-end gap-0.5 flex-shrink-0">
          {flight.nodoCritico && (
            <span className="text-[8px] bg-red-500 text-white px-1 rounded font-bold leading-tight">
              CRIT
            </span>
          )}
          {flight.alerta && (
            <span className="text-[8px] bg-amber-500 text-white px-1 rounded font-bold leading-tight">
              ALERTA
            </span>
          )}
          {flight.promocion && (
            <span className="text-[8px] bg-green-600 text-white px-1 rounded font-bold leading-tight">
              PROMO
            </span>
          )}
        </div>
      </div>

      {/* ── Row 2: route ── */}
      <p className="text-gray-300 text-[11px] truncate leading-tight">
        <span className="opacity-70">{flight.origen}</span>
        <span className="mx-1 text-gray-600">→</span>
        <span className="opacity-70">{flight.destino}</span>
      </p>

      {/* ── Row 3: metrics ── */}
      <div className="flex items-center gap-2.5 border-t border-zinc-700/60 pt-1.5 mt-0.5">
        <span className="text-gray-500 text-[10px]">
          H:{" "}
          <span className="text-blue-400 font-semibold">{flight.altura}</span>
        </span>
        <span className="text-gray-500 text-[10px]">
          FE:{" "}
          <span className={`font-semibold ${feColor}`}>
            {flight.factorEquilibrio >= 0 ? "+" : ""}
            {flight.factorEquilibrio}
          </span>
        </span>
        <span className="text-gray-500 text-[10px]">
          Prof:{" "}
          <span className="text-purple-400 font-semibold">
            {flight.profundidad}
          </span>
        </span>
      </div>
    </div>
  );
};

// ─── Sub-component: PropertiesBar ─────────────────────────────────────────────

/**
 * PropertiesBar — Compact top strip showing AVL summary statistics.
 * Meets project requirement §4 (real-time metrics).
 */
const PropertiesBar: React.FC<{
  properties: TreeProperties;
  onRefresh: () => void;
  isLoading: boolean;
}> = ({ properties, onRefresh, isLoading }) => (
  <div className="bg-black border-b border-zinc-800 px-6 py-2.5 flex items-center gap-6 flex-wrap">
    <span className="text-zinc-400 text-xs">
      Raíz:{" "}
      <span className="text-white font-semibold">{properties.raiz ?? "—"}</span>
    </span>
    <span className="text-zinc-400 text-xs">
      Altura:{" "}
      <span className="text-blue-400 font-semibold">{properties.altura}</span>
    </span>
    <span className="text-zinc-400 text-xs">
      Nodos:{" "}
      <span className="text-green-400 font-semibold">{properties.nodos}</span>
    </span>

    {/* Rotation breakdown — requirement §4 */}
    <div className="flex items-center gap-2">
      <span className="text-zinc-600 text-[10px] uppercase tracking-wider">
        Rotaciones:
      </span>
      {(["II", "DD", "ID", "DI"] as const).map((type) => (
        <span key={type} className="text-zinc-400 text-[10px]">
          {type}:{" "}
          <span className="text-amber-400 font-semibold">
            {properties.rotaciones[type]}
          </span>
        </span>
      ))}
    </div>

    <button
      onClick={onRefresh}
      disabled={isLoading}
      aria-label="Refrescar árbol"
      className="ml-auto flex items-center gap-1.5 text-zinc-400 hover:text-white
                 text-xs transition-colors duration-150 disabled:opacity-40"
    >
      <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
      Refrescar
    </button>
  </div>
);

// ─── Sub-component: DetailPanel ───────────────────────────────────────────────

/**
 * DetailPanel — Right side-panel showing all fields of the selected node.
 * Slides in when a node card is clicked.
 */
const DetailPanel: React.FC<{
  node: TreeNode;
  onClose: () => void;
}> = ({ node, onClose }) => {
  const { flight } = node;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Código", value: flight.codigo },
    { label: "Origen", value: flight.origen },
    { label: "Destino", value: flight.destino },
    { label: "Hora salida", value: flight.horaSalida },
    { label: "Precio base", value: `$${flight.precioBase.toLocaleString()}` },
    { label: "Precio final", value: `$${flight.precioFinal.toLocaleString()}` },
    { label: "Pasajeros", value: flight.pasajeros },
    { label: "Prioridad", value: flight.prioridad },
    { label: "Rentabilidad", value: flight.rentabilidad.toFixed(2) },
    { label: "Altura (árbol)", value: flight.altura },
    {
      label: "Factor equilibrio",
      value: `${flight.factorEquilibrio >= 0 ? "+" : ""}${flight.factorEquilibrio}`,
    },
    { label: "Profundidad", value: flight.profundidad },
    { label: "Nodo crítico", value: flight.nodoCritico ? "⚠ Sí" : "No" },
    { label: "Promoción", value: flight.promocion ? "✓ Activa" : "No" },
    { label: "Alerta", value: flight.alerta ? "⚠ Activa" : "No" },
  ];

  return (
    <aside
      className="
        w-72 flex-shrink-0 bg-zinc-900 border-l border-zinc-800
        flex flex-col overflow-y-auto
      "
      aria-label="Detalles del nodo seleccionado"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black">
        <h3 className="text-white font-bold text-sm tracking-wide">
          {flight.codigo}
        </h3>
        <button
          onClick={onClose}
          aria-label="Cerrar panel"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Route hero */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-zinc-300 text-sm font-medium">
          {flight.origen}
          <span className="mx-2 text-zinc-600">→</span>
          {flight.destino}
        </p>
      </div>

      {/* Data rows */}
      <div className="flex-1 px-4 py-3 space-y-2.5">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">{label}</span>
            <span
              className={`
              text-xs font-medium
              ${label === "Nodo crítico" && flight.nodoCritico ? "text-red-400" : ""}
              ${
                label === "Factor equilibrio"
                  ? Math.abs(flight.factorEquilibrio) === 0
                    ? "text-green-400"
                    : Math.abs(flight.factorEquilibrio) === 1
                      ? "text-yellow-400"
                      : "text-red-400"
                  : "text-white"
              }
            `}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Child pointers */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">
          Hijos
        </p>
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg bg-zinc-800 px-2 py-1.5 text-center">
            <p className="text-zinc-500 text-[9px]">IZQ</p>
            <p className="text-xs text-zinc-300 font-medium truncate">
              {node.izquierdo?.flight.codigo ?? "—"}
            </p>
          </div>
          <div className="flex-1 rounded-lg bg-zinc-800 px-2 py-1.5 text-center">
            <p className="text-zinc-500 text-[9px]">DER</p>
            <p className="text-xs text-zinc-300 font-medium truncate">
              {node.derecho?.flight.codigo ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ─── Sub-component: ZoomControls ─────────────────────────────────────────────

const ZoomControls: React.FC<{
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
}> = ({ scale, onZoomIn, onZoomOut, onCenter }) => (
  <div
    className="
    absolute bottom-5 right-5 z-10
    flex flex-col gap-1
    bg-zinc-900/90 border border-zinc-700 rounded-xl
    p-1.5 shadow-xl
  "
  >
    <button
      onClick={onZoomIn}
      aria-label="Acercar"
      className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
    >
      <ZoomIn size={16} />
    </button>
    <span className="text-center text-[10px] text-zinc-500 py-0.5 tabular-nums">
      {Math.round(scale * 100)}%
    </span>
    <button
      onClick={onZoomOut}
      aria-label="Alejar"
      className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
    >
      <ZoomOut size={16} />
    </button>
    <div className="border-t border-zinc-700 mt-0.5 pt-1">
      <button
        onClick={onCenter}
        aria-label="Centrar árbol"
        className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  </div>
);

// ─── Sub-component: Legend ────────────────────────────────────────────────────

const Legend: React.FC = () => (
  <div
    className="
    absolute bottom-5 left-5 z-10
    bg-zinc-900/90 border border-zinc-700 rounded-xl
    px-3 py-2.5 shadow-xl
  "
  >
    <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-2">
      Leyenda
    </p>
    <div className="space-y-1.5">
      {[
        { color: "border-white bg-zinc-900", label: "Raíz" },
        { color: "border-red-500 bg-red-950/80", label: "Nodo crítico" },
        { color: "border-amber-500 bg-amber-950/80", label: "Alerta" },
        { color: "border-zinc-600 bg-zinc-800", label: "Normal" },
        { color: "border-sky-400", label: "Seleccionado" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded border-2 flex-shrink-0 ${color}`} />
          <span className="text-zinc-400 text-[10px]">{label}</span>
        </div>
      ))}
    </div>
    <div className="border-t border-zinc-700 mt-2 pt-2 space-y-1">
      <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">
        FE (Factor equilibrio)
      </p>
      {[
        { color: "text-green-400", label: "= 0  (balanceado)" },
        { color: "text-yellow-400", label: "±1  (válido AVL)" },
        { color: "text-red-400", label: "≥2  (inválido)" },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className={`text-[10px] font-bold w-5 text-center ${color}`}>
            ●
          </span>
          <span className="text-zinc-400 text-[10px]">{label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface TreeViewProps {
  treeRoot: TreeNode | null;
  properties: TreeProperties | null;
  isLoading: boolean;
  error: string | null;
  onRefreshTree: () => Promise<void>;
  onRefreshAll?: () => Promise<void>;
}

/**
 * TreeView — Full-screen interactive AVL tree visualisation.
 *
 * Fulfils project requirements:
 *  §4  Métricas analíticas: PropertiesBar shows height, nodes, rotations in real time.
 *  §6  Nodo crítico: red colour coding for nodoCritico === true.
 *  §1.2 Balanceo visual: tree re-renders after any mutation (parent calls refresh).
 */
const TreeView: React.FC<TreeViewProps> = ({
  treeRoot,
  properties,
  isLoading,
  error,
  onRefreshTree,
  onRefreshAll,
}) => {
  // ── Layout ──────────────────────────────────────────────────────────────────
  const layout = useMemo(() => buildLayout(treeRoot), [treeRoot]);

  // ── Pan / Zoom state ────────────────────────────────────────────────────────
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 60, y: 40 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Selected node ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleNodeClick = useCallback((node: TreeNode) => {
    setSelected(node);
    setPanelOpen(true);
  }, []);

  // ── Interaction handlers ────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[role="button"]')) return; // don't pan when clicking a node
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setAttribute("data-panning", "true");
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  };

  const stopPan = (e: React.MouseEvent) => {
    isPanning.current = false;
    e.currentTarget.removeAttribute("data-panning");
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setScale((s) => {
      const next = Math.min(Math.max(s * delta, 0.2), 3);
      // Zoom toward mouse cursor
      setOffset((o) => ({
        x: mouseX - (mouseX - o.x) * (next / s),
        y: mouseY - (mouseY - o.y) * (next / s),
      }));
      return next;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Zoom controls ───────────────────────────────────────────────────────────

  const zoomIn = () => setScale((s) => Math.min(s * 1.2, 3));
  const zoomOut = () => setScale((s) => Math.max(s * 0.8, 0.2));
  const center = () => {
    setScale(0.9);
    setOffset({ x: 60, y: 40 });
  };

  // ── Root code (for isRoot check) ────────────────────────────────────────────
  const rootCode = treeRoot?.flight.codigo ?? null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 overflow-hidden">
      {/* ── Properties bar ── */}
      {properties && (
        <PropertiesBar
          properties={properties}
          onRefresh={() => {
            if (onRefreshAll) {
              void onRefreshAll();
              return;
            }
            void onRefreshTree();
          }}
          isLoading={isLoading}
        />
      )}

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Canvas ── */}
        <div
          ref={containerRef}
          className="
            flex-1 relative overflow-hidden select-none
            cursor-grab data-[panning]:cursor-grabbing
          "
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          {/* Loading */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500 z-20">
              <Loader2 size={40} className="animate-spin" />
              <p className="text-sm">Cargando árbol AVL…</p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-20"
            >
              <ServerCrash size={40} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Empty tree */}
          {!isLoading && !error && !layout && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500 z-20">
              <p className="text-base font-medium">El árbol está vacío.</p>
              <p className="text-sm">
                Crea un vuelo desde la vista de lista para comenzar.
              </p>
            </div>
          )}

          {/* Tree canvas */}
          {layout && (
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "0 0",
                position: "relative",
                width: layout.canvasW,
                height: layout.canvasH,
                willChange: "transform",
              }}
            >
              {/* SVG layer — lines */}
              <svg
                width={layout.canvasW}
                height={layout.canvasH}
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
              >
                {layout.edges.map((edge, i) => (
                  <path
                    key={i}
                    d={edgePath(edge.fromX, edge.fromY, edge.toX, edge.toY)}
                    fill="none"
                    stroke={edge.isLeft ? "#6366f1" : "#a855f7"} // indigo = left, purple = right
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                ))}
              </svg>

              {/* Node layer */}
              {layout.flatNodes.map(({ node, px, py }) => (
                <div
                  key={node.flight.codigo}
                  style={{ position: "absolute", left: px, top: py }}
                >
                  <NodeCard
                    node={node}
                    isRoot={node.flight.codigo === rootCode}
                    isSelected={selected?.flight.codigo === node.flight.codigo}
                    onClick={handleNodeClick}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Overlay controls */}
          <ZoomControls
            scale={scale}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onCenter={center}
          />
          <Legend />

          {/* Edge legend — left/right */}
          <div className="absolute top-4 right-5 flex items-center gap-4 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <svg width="20" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke="#6366f1"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-zinc-500 text-[10px]">Hijo izq.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="20" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke="#a855f7"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-zinc-500 text-[10px]">Hijo der.</span>
            </div>
          </div>
        </div>

        {/* ── Detail side-panel ── */}
        {panelOpen && selected && (
          <DetailPanel
            node={selected}
            onClose={() => {
              setPanelOpen(false);
              setSelected(null);
            }}
          />
        )}

        {/* Collapsed panel toggle */}
        {!panelOpen && selected && (
          <button
            onClick={() => setPanelOpen(true)}
            aria-label="Abrir panel de detalles"
            className="
              self-center mr-1 z-10
              p-1.5 rounded-l-xl
              bg-zinc-800 border border-zinc-700
              text-zinc-400 hover:text-white
              transition-colors
            "
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TreeView;
