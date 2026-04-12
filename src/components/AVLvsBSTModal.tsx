import React, { useMemo } from "react";

import type { TreeNode } from "../models/FlightNode";
import type { ComparativeTreeStats } from "../services/TreeService";

interface D3LikeNode {
  name: string;
  attributes?: {
    FB?: number;
    Prof?: number;
  };
  children?: D3LikeNode[];
}

interface NodePos {
  x: number;
  y: number;
  node: TreeNode;
}

interface EdgePos {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface LayoutResult {
  nodes: NodePos[];
  edges: EdgePos[];
  width: number;
  height: number;
}

export interface AVLvsBSTModalProps {
  isOpen: boolean;
  avlTree: TreeNode | null;
  bstTree: TreeNode | null;
  avlStats?: ComparativeTreeStats;
  bstStats?: ComparativeTreeStats | null;
  onClose: () => void;
}

const NODE_W = 96;
const NODE_H = 48;
const H_STEP = NODE_W + 30;
const V_STEP = NODE_H + 40;
const PADDING = 30;

// Estructura equivalente al formato esperado por react-d3-tree.
function transformToD3(node: TreeNode | null): D3LikeNode | null {
  if (!node) return null;

  const children: D3LikeNode[] = [];
  const left = transformToD3(node.izquierdo);
  const right = transformToD3(node.derecho);
  if (left) children.push(left);
  if (right) children.push(right);

  return {
    name: node.flight.codigo,
    attributes: {
      FB: node.flight.factorEquilibrio,
      Prof: node.flight.profundidad,
    },
    children: children.length > 0 ? children : undefined,
  };
}

function countLeaves(node: TreeNode | null): number {
  if (!node) return 0;
  if (!node.izquierdo && !node.derecho) return 1;
  return countLeaves(node.izquierdo) + countLeaves(node.derecho);
}

function computeDepth(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + Math.max(computeDepth(node.izquierdo), computeDepth(node.derecho));
}

function countNodes(node: TreeNode | null): number {
  if (!node) return 0;
  return 1 + countNodes(node.izquierdo) + countNodes(node.derecho);
}

function buildLayout(root: TreeNode | null): LayoutResult | null {
  if (!root) return null;

  const posByCode = new Map<string, { x: number; y: number }>();
  let idx = 0;

  function assign(node: TreeNode | null, depth: number): void {
    if (!node) return;
    assign(node.izquierdo, depth + 1);
    posByCode.set(node.flight.codigo, {
      x: PADDING + idx * H_STEP,
      y: PADDING + depth * V_STEP,
    });
    idx += 1;
    assign(node.derecho, depth + 1);
  }

  const nodes: NodePos[] = [];
  const edges: EdgePos[] = [];

  function collect(node: TreeNode | null): void {
    if (!node) return;

    const p = posByCode.get(node.flight.codigo);
    if (p) {
      nodes.push({ x: p.x, y: p.y, node });

      if (node.izquierdo) {
        const lp = posByCode.get(node.izquierdo.flight.codigo);
        if (lp) {
          edges.push({
            x1: p.x + NODE_W / 2,
            y1: p.y + NODE_H,
            x2: lp.x + NODE_W / 2,
            y2: lp.y,
          });
        }
      }

      if (node.derecho) {
        const rp = posByCode.get(node.derecho.flight.codigo);
        if (rp) {
          edges.push({
            x1: p.x + NODE_W / 2,
            y1: p.y + NODE_H,
            x2: rp.x + NODE_W / 2,
            y2: rp.y,
          });
        }
      }
    }

    collect(node.izquierdo);
    collect(node.derecho);
  }

  assign(root, 0);
  collect(root);

  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x)) : 0;
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) : 0;

  return {
    nodes,
    edges,
    width: maxX + NODE_W + PADDING,
    height: maxY + NODE_H + PADDING,
  };
}

const TreeCanvas: React.FC<{
  tree: TreeNode | null;
  accent: "sky" | "amber";
  showFB: boolean;
}> = ({ tree, accent, showFB }) => {
  const layout = useMemo(() => buildLayout(tree), [tree]);
  const d3Root = useMemo(() => transformToD3(tree), [tree]);

  if (!layout || !d3Root) {
    return (
      <div className="h-[400px] rounded-xl border border-zinc-800 bg-zinc-900/70 flex items-center justify-center text-xs text-zinc-500">
        Árbol vacío
      </div>
    );
  }

  return (
    <div className="h-[400px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-2">
      <div
        style={{ width: layout.width, height: layout.height }}
        className="relative"
      >
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          {layout.edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={accent === "sky" ? "#38bdf8" : "#f59e0b"}
              strokeOpacity={0.68}
              strokeWidth={1.7}
            />
          ))}
        </svg>

        {layout.nodes.map(({ node, x, y }) => (
          <div
            key={node.flight.codigo}
            style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            className={
              "absolute rounded-lg border px-1.5 py-1 text-center " +
              (accent === "sky"
                ? "bg-sky-950/70 border-sky-600 text-sky-100"
                : "bg-amber-950/60 border-amber-600 text-amber-100")
            }
          >
            <p className="text-[11px] font-bold leading-tight truncate">
              {node.flight.codigo}
            </p>
            {showFB && (
              <p className="text-[10px] opacity-90 leading-tight">
                FB: {node.flight.factorEquilibrio}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatsBlock: React.FC<{
  tree: TreeNode | null;
  stats?: ComparativeTreeStats | null;
  showRotations: boolean;
}> = ({ tree, stats, showRotations }) => {
  const rootCode = stats?.raiz ?? tree?.flight.codigo ?? "—";
  const depth = stats?.profundidad ?? computeDepth(tree);
  const leaves = stats?.cantidadHojas ?? countLeaves(tree);
  const totalNodes = stats?.totalNodos ?? countNodes(tree);

  return (
    <div className="mt-2 text-xs text-zinc-300 space-y-1">
      <p>
        Raíz: <span className="text-white font-semibold">{rootCode}</span>
      </p>
      <p>
        Profundidad: <span className="text-white font-semibold">{depth}</span>
      </p>
      <p>
        Cantidad de hojas:{" "}
        <span className="text-white font-semibold">{leaves}</span>
      </p>
      <p>
        Total nodos:{" "}
        <span className="text-white font-semibold">{totalNodes}</span>
      </p>
      {showRotations && (
        <p>
          Rotaciones:{" "}
          <span className="text-white font-semibold">
            {`{ LL: ${stats?.rotaciones?.LL ?? 0}, RR: ${stats?.rotaciones?.RR ?? 0}, LR: ${stats?.rotaciones?.LR ?? 0}, RL: ${stats?.rotaciones?.RL ?? 0} }`}
          </span>
        </p>
      )}
    </div>
  );
};

const AVLvsBSTModal: React.FC<AVLvsBSTModalProps> = ({
  isOpen,
  avlTree,
  bstTree,
  avlStats,
  bstStats,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed z-[80] right-4 bottom-4 w-[min(96vw,1360px)] h-[min(88vh,860px)]">
      <div className="w-full h-full rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-black">
          <h2 className="text-white font-bold text-base">
            Ventana adicional: Comparativo AVL vs BST
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-300 hover:text-white text-sm"
          >
            Cerrar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100%-53px)]">
          <section className="p-4 border-b lg:border-b-0 lg:border-r border-zinc-800">
            <h3 className="text-sky-300 font-semibold text-sm mb-1">
              AVL (Balanceado)
            </h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">
              Gráfico del árbol AVL
            </p>
            <TreeCanvas tree={avlTree} accent="sky" showFB />
            <StatsBlock tree={avlTree} stats={avlStats} showRotations />
          </section>

          <section className="p-4">
            <h3 className="text-amber-300 font-semibold text-sm mb-1">
              BST (Sin Balanceo)
            </h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-2">
              Gráfico del árbol BST
            </p>
            <TreeCanvas tree={bstTree} accent="amber" showFB={false} />
            <StatsBlock tree={bstTree} stats={bstStats} showRotations={false} />
          </section>
        </div>
      </div>
    </div>
  );
};

export default AVLvsBSTModal;
