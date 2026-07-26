import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { riskLevel } from '../../lib/risk';
import type { NetworkEdge, NetworkNode } from '../../types';

interface ForceGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  selectedId: string | null;
  onSelect: (node: NetworkNode | null) => void;
}

interface SimNode {
  node: NetworkNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

const REPULSION = 9500;
const SPRING_LENGTH = 155;
const SPRING_STRENGTH = 0.018;
const CENTER_PULL = 0.009;
const DAMPING = 0.86;
/** Only the N most-connected nodes are labelled by default (plus hover focus). */
const MAX_DEFAULT_LABELS = 10;

function resolveVars(names: string[]): Record<string, string> {
  const styles = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, styles.getPropertyValue(n).trim()]));
}

/**
 * Custom canvas force-directed graph: pan (drag background), zoom (wheel),
 * drag nodes, hover highlighting of neighborhoods, click to inspect.
 */
export function ForceGraph({ nodes, edges, selectedId, onSelect }: ForceGraphProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Map<string, SimNode>>(new Map());
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const hoverRef = useRef<string | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; node: NetworkNode } | null>(null);
  const [dragging, setDragging] = useState(false);

  const colors = useMemo(
    () =>
      resolveVars([
        '--bg-page',
        '--text-1',
        '--text-3',
        '--grid-line',
        '--axis-line',
        '--accent',
        '--bg-surface',
        '--status-good',
        '--status-warning',
        '--status-serious',
        '--status-critical',
      ]),
    // re-resolve when theme flips
    [theme],
  );

  const riskFill = (score: number) => {
    switch (riskLevel(score)) {
      case 'critical':
        return colors['--status-critical'];
      case 'elevated':
        return colors['--status-serious'];
      case 'moderate':
        return colors['--status-warning'];
      default:
        return colors['--status-good'];
    }
  };

  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      (map.get(edge.source) ?? map.set(edge.source, new Set()).get(edge.source)!).add(edge.target);
      (map.get(edge.target) ?? map.set(edge.target, new Set()).get(edge.target)!).add(edge.source);
    }
    return map;
  }, [edges]);

  // Minimum connection count for a node to be labelled by default — keeps only
  // the top ~10 hubs labelled so the canvas doesn't turn into a wall of text.
  const labelThreshold = useMemo(() => {
    const counts = nodes.map((n) => n.connections).sort((a, b) => b - a);
    return counts.length > MAX_DEFAULT_LABELS ? counts[MAX_DEFAULT_LABELS - 1] : 0;
  }, [nodes]);

  // (Re)seed simulation nodes when the dataset changes, keeping known positions.
  useEffect(() => {
    const sim = simRef.current;
    const next = new Map<string, SimNode>();
    const count = Math.max(1, nodes.length);
    nodes.forEach((node, i) => {
      const existing = sim.get(node.id);
      const angle = (i / count) * Math.PI * 2;
      const spread = 120 + (i % 5) * 60;
      next.set(node.id, {
        node,
        x: existing?.x ?? Math.cos(angle) * spread,
        y: existing?.y ?? Math.sin(angle) * spread,
        vx: 0,
        vy: 0,
        radius: Math.min(22, 7 + node.connections * 1.6),
      });
    });
    simRef.current = next;
  }, [nodes]);

  // Simulation + render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const step = () => {
      const sim = [...simRef.current.values()];

      // Zoom-coupled spreading: as the user zooms in, the layout expands so the
      // dense centre de-clutters instead of just magnifying. Rest length and
      // repulsion grow with zoom; the centre pull relaxes so nodes can drift out.
      const zk = transformRef.current.k;
      const spread = 0.75 + 0.55 * Math.min(3.5, Math.max(0.35, zk));
      const restLen = SPRING_LENGTH * spread;
      const repulsion = REPULSION * spread * spread;
      const centerPull = CENTER_PULL / spread;

      // Physics
      for (let i = 0; i < sim.length; i++) {
        const a = sim[i];
        for (let j = i + 1; j < sim.length; j++) {
          const b = sim[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = Math.max(80, dx * dx + dy * dy);
          const force = repulsion / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;

          // Hard collision separation — never let two discs overlap (padding
          // grows a little with zoom so labels have room when zoomed in).
          const minGap = a.radius + b.radius + 6 + spread * 4;
          if (dist < minGap) {
            const push = (minGap - dist) / 2;
            const ox = (dx / dist) * push;
            const oy = (dy / dist) * push;
            a.x += ox;
            a.y += oy;
            b.x -= ox;
            b.y -= oy;
          }
        }
        a.vx -= a.x * centerPull;
        a.vy -= a.y * centerPull;
      }
      for (const edge of edges) {
        const a = simRef.current.get(edge.source);
        const b = simRef.current.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const stretch = (dist - restLen) * SPRING_STRENGTH * Math.min(1.5, edge.strength || 1);
        const fx = (dx / dist) * stretch;
        const fy = (dy / dist) * stretch;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const n of sim) {
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Render
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const { x: tx, y: ty, k } = transformRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + tx, height / 2 + ty);
      ctx.scale(k, k);

      const hovered = hoverRef.current;
      const focusId = hovered ?? selectedId;
      const focusNeighbors = focusId ? neighborMap.get(focusId) : undefined;

      // Edges
      for (const edge of edges) {
        const a = simRef.current.get(edge.source);
        const b = simRef.current.get(edge.target);
        if (!a || !b) continue;
        const isFocused =
          focusId !== null && (edge.source === focusId || edge.target === focusId);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isFocused ? colors['--accent'] : colors['--grid-line'];
        ctx.globalAlpha = focusId && !isFocused ? 0.25 : 1;
        ctx.lineWidth = (isFocused ? 2 : 1) + Math.min(1.5, (edge.strength || 1) * 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Nodes
      for (const n of sim) {
        const isFocus = n.node.id === focusId;
        const isNeighbor = focusNeighbors?.has(n.node.id) ?? false;
        const dimmed = focusId !== null && !isFocus && !isNeighbor;
        ctx.globalAlpha = dimmed ? 0.3 : 1;

        // 2px surface ring separates overlapping marks
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = colors['--bg-page'];
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = riskFill(n.node.risk_score);
        ctx.fill();

        if (n.node.is_hub) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = colors['--accent'];
          ctx.lineWidth = 1.75;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (n.node.id === selectedId) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 7, 0, Math.PI * 2);
          ctx.strokeStyle = colors['--text-1'];
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Labels: only the top hubs by default, plus the focused node and its
        // neighbours on hover — keeps the canvas legible. Each label gets a
        // rounded surface pill behind it so text never sits on a circle.
        const showLabel =
          isFocus || isNeighbor || (focusId === null && n.node.connections >= labelThreshold);
        if (showLabel) {
          const fontPx = (isFocus ? 12 : 11) / Math.max(0.7, Math.min(k, 1.4));
          ctx.font = `${isFocus ? 600 : 500} ${fontPx}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const text = n.node.name;
          const ty = n.y + n.radius + fontPx * 0.9 + 5;
          const w = ctx.measureText(text).width;
          const padX = 4;
          const padY = 2.5;
          ctx.globalAlpha = dimmed ? 0.35 : 0.92;
          ctx.fillStyle = colors['--bg-surface'];
          const rx = 4;
          const bx = n.x - w / 2 - padX;
          const by = ty - fontPx / 2 - padY;
          const bw = w + padX * 2;
          const bh = fontPx + padY * 2;
          ctx.beginPath();
          ctx.moveTo(bx + rx, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, rx);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, rx);
          ctx.arcTo(bx, by + bh, bx, by, rx);
          ctx.arcTo(bx, by, bx + bw, by, rx);
          ctx.fill();
          ctx.globalAlpha = dimmed ? 0.5 : 1;
          ctx.fillStyle = dimmed ? colors['--text-3'] : colors['--text-1'];
          ctx.fillText(text, n.x, ty);
          ctx.textBaseline = 'alphabetic';
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      if (running) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [edges, neighborMap, colors, selectedId, nodes, labelThreshold]);

  // Pointer interaction: hover, node drag, pan, zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let draggedNode: SimNode | null = null;
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    let moved = false;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const { x: tx, y: ty, k } = transformRef.current;
      return {
        x: (clientX - rect.left - rect.width / 2 - tx) / k,
        y: (clientY - rect.top - rect.height / 2 - ty) / k,
      };
    };

    const hitTest = (clientX: number, clientY: number): SimNode | null => {
      const { x, y } = toWorld(clientX, clientY);
      let best: SimNode | null = null;
      for (const n of simRef.current.values()) {
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist <= Math.max(12, n.radius + 4) && (!best || dist < Math.hypot(best.x - x, best.y - y))) {
          best = n;
        }
      }
      return best;
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      moved = false;
      lastX = e.clientX;
      lastY = e.clientY;
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        draggedNode = hit;
      } else {
        panning = true;
        setDragging(true);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) > 3) moved = true;

      if (draggedNode) {
        const { x, y } = toWorld(e.clientX, e.clientY);
        draggedNode.x = x;
        draggedNode.y = y;
        draggedNode.vx = 0;
        draggedNode.vy = 0;
        return;
      }
      if (panning) {
        transformRef.current.x += e.clientX - lastX;
        transformRef.current.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      const hit = hitTest(e.clientX, e.clientY);
      hoverRef.current = hit?.node.id ?? null;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      if (hit) {
        const rect = canvas.getBoundingClientRect();
        setHoverTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: hit.node });
      } else {
        setHoverTip(null);
      }
    };

    const onPointerUp = () => {
      if (draggedNode && !moved) {
        onSelect(draggedNode.node);
      } else if (panning && !moved) {
        onSelect(null);
      }
      draggedNode = null;
      panning = false;
      setDragging(false);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextK = Math.min(3.5, Math.max(0.35, t.k * factor));
      // Zoom toward the cursor.
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      t.x = cx - ((cx - t.x) / t.k) * nextK;
      t.y = cy - ((cy - t.y) / t.k) * nextK;
      t.k = nextK;
    };

    const onLeave = () => {
      hoverRef.current = null;
      setHoverTip(null);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [onSelect]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} className={`network-canvas ${dragging ? 'dragging' : ''}`} />
      {hoverTip && (
        <div
          className="viz-tooltip"
          style={{ left: hoverTip.x + 14, top: hoverTip.y + 14 }}
        >
          <strong>{hoverTip.node.name}</strong>
          {hoverTip.node.alias && <> · “{hoverTip.node.alias}”</>}
          <br />
          Risk {Math.round(hoverTip.node.risk_score)} · {hoverTip.node.connections} links
          {hoverTip.node.is_hub && ' · Hub'}
        </div>
      )}
    </div>
  );
}
