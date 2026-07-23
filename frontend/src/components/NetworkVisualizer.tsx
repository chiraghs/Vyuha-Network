import React, { useEffect, useRef, useState } from 'react';
import { CriminalNode, CriminalEdge } from '../types';

interface NetworkVisualizerProps {
  nodes: CriminalNode[];
  edges: CriminalEdge[];
  onSelectNode?: (node: CriminalNode) => void;
}

export const NetworkVisualizer: React.FC<NetworkVisualizerProps> = ({ nodes, edges, onSelectNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Local mutable state for force-directed simulation nodes
  const simNodesRef = useRef<{
    [id: string]: {
      id: string;
      label: string;
      name: string;
      risk_score: number;
      is_hub: boolean;
      status: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      fx?: number;
      fy?: number;
      radius: number;
    }
  }>({});

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Initialize node positions scattered randomly
  useEffect(() => {
    const simNodes = simNodesRef.current;
    
    // Maintain positions on updates, add new ones, remove old ones
    const newSimNodes: typeof simNodes = {};
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 500;

    nodes.forEach((node) => {
      if (simNodes[node.id]) {
        // Keep existing positions
        newSimNodes[node.id] = {
          ...simNodes[node.id],
          label: node.label,
          risk_score: node.risk_score,
          is_hub: node.is_hub,
          status: node.status
        };
      } else {
        // Scatter around center
        const radius = node.is_hub ? 14 : 9;
        newSimNodes[node.id] = {
          id: node.id,
          label: node.label,
          name: node.name,
          risk_score: node.risk_score,
          is_hub: node.is_hub,
          status: node.status,
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: 0,
          radius
        };
      }
    });

    simNodesRef.current = newSimNodes;
  }, [nodes]);

  // Main canvas animation and physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    // Physics parameters
    const kRepulsion = 1500; // Force pushing nodes apart
    const kAttraction = 0.04; // Spring constant along edges
    const centerGravity = 0.02; // Keeps graph centered
    const damping = 0.85; // Air resistance

    const runPhysicsStep = () => {
      const simNodes = simNodesRef.current;
      const keys = Object.keys(simNodes);
      const width = canvas.width;
      const height = canvas.height;

      // 1. Repulsion between all node pairs
      for (let i = 0; i < keys.length; i++) {
        const nodeA = simNodes[keys[i]];
        for (let j = i + 1; j < keys.length; j++) {
          const nodeB = simNodes[keys[j]];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          // Avoid division by zero
          const distSqr = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSqr);

          if (dist < 150) {
            const force = kRepulsion / distSqr;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            // Push nodeA back, nodeB forward
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }

      // 2. Attraction along edges
      edges.forEach((edge) => {
        const nodeA = simNodes[edge.source];
        const nodeB = simNodes[edge.target];
        if (!nodeA || !nodeB) return;

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Rest length is ~80px
        const restLength = 100;
        const force = (dist - restLength) * kAttraction * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        nodeA.vx += fx;
        nodeA.vy += fy;
        nodeB.vx -= fx;
        nodeB.vy -= fy;
      });

      // 3. Central Gravity and Update positions
      for (const id in simNodes) {
        const node = simNodes[id];
        
        // Skip updating dragged nodes
        if (node.fx !== undefined && node.fy !== undefined) {
          node.x = node.fx;
          node.y = node.fy;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        // Pull toward canvas center
        const dcx = width / 2 - node.x;
        const dcy = height / 2 - node.y;
        node.vx += dcx * centerGravity;
        node.vy += dcy * centerGravity;

        // Apply velocities and air resistance damping
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= damping;
        node.vy *= damping;

        // Keep inside boundaries
        node.x = Math.max(20, Math.min(width - 20, node.x));
        node.y = Math.max(20, Math.min(height - 20, node.y));
      }
    };

    const drawGraph = () => {
      const simNodes = simNodesRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Color mapping for risk scores
      const getNodeColor = (score: number) => {
        if (score >= 80) return '#ef4444'; // Red
        if (score >= 50) return '#fbbf24'; // Yellow/Gold
        return '#3b82f6'; // Blue
      };

      // 1. Draw Edges
      edges.forEach((edge) => {
        const nodeA = simNodes[edge.source];
        const nodeB = simNodes[edge.target];
        if (!nodeA || !nodeB) return;

        ctx.beginPath();
        ctx.moveTo(nodeA.x, nodeA.y);
        ctx.lineTo(nodeB.x, nodeB.y);
        
        // Highlight links connecting to selected or hovered nodes
        const isLinked = selectedNodeId === edge.source || selectedNodeId === edge.target ||
                         hoveredNodeId === edge.source || hoveredNodeId === edge.target;
        
        ctx.strokeStyle = isLinked ? 'rgba(251, 191, 36, 0.6)' : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = isLinked ? 2.5 : 1 + edge.strength * 2;
        ctx.stroke();

        // Draw relationship text mid-link if linked
        if (isLinked) {
          const midX = (nodeA.x + nodeB.x) / 2;
          const midY = (nodeA.y + nodeB.y) / 2;
          ctx.font = '9px Inter';
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'center';
          ctx.fillText(edge.relation, midX, midY - 4);
        }
      });

      // 2. Draw Nodes
      for (const id in simNodes) {
        const node = simNodes[id];
        const color = getNodeColor(node.risk_score);
        const isHovered = hoveredNodeId === node.id;
        const isSelected = selectedNodeId === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isHovered || isSelected ? 3 : 0), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Highlight selected/hovered nodes with halo rings
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw node labels (names)
        ctx.font = node.is_hub ? 'bold 11px Inter' : '10px Inter';
        ctx.fillStyle = isSelected ? '#fbbf24' : isHovered ? '#ffffff' : '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y - (node.radius + 8));
      }
    };

    const updateFrame = () => {
      runPhysicsStep();
      drawGraph();
      animationId = requestAnimationFrame(updateFrame);
    };

    // Begin render frame loop
    animationId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [edges, selectedNodeId, hoveredNodeId]);

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const simNodes = simNodesRef.current;
    let clickedNodeId: string | null = null;

    // Find node clicked on
    for (const id in simNodes) {
      const node = simNodes[id];
      const dx = node.x - x;
      const dy = node.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= node.radius + 5) {
        clickedNodeId = id;
        break;
      }
    }

    if (clickedNodeId) {
      const clickedNode = simNodes[clickedNodeId];
      clickedNode.fx = x;
      clickedNode.fy = y;
      setSelectedNodeId(clickedNodeId);
      
      const originalNode = nodes.find(n => n.id === clickedNodeId);
      if (originalNode && onSelectNode) {
        onSelectNode(originalNode);
      }
    } else {
      setSelectedNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const simNodes = simNodesRef.current;
    
    // Check if dragging node
    if (selectedNodeId && simNodes[selectedNodeId]) {
      simNodes[selectedNodeId].fx = x;
      simNodes[selectedNodeId].fy = y;
      return;
    }

    // Otherwise, check hover state
    let hoverId: string | null = null;
    for (const id in simNodes) {
      const node = simNodes[id];
      const dx = node.x - x;
      const dy = node.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 5) {
        hoverId = id;
        break;
      }
    }
    setHoveredNodeId(hoverId);
    canvas.style.cursor = hoverId ? 'pointer' : 'default';
  };

  const handleMouseUp = () => {
    const simNodes = simNodesRef.current;
    if (selectedNodeId && simNodes[selectedNodeId]) {
      simNodes[selectedNodeId].fx = undefined;
      simNodes[selectedNodeId].fy = undefined;
    }
  };

  return (
    <div className="network-viewport" style={{ borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(3, 7, 18, 0.85)',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '11px',
        border: '1px solid var(--border-glass)',
        pointerEvents: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
          <span>High Risk Recidivism (&ge;80)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
          <span>Medium Risk (50-79)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
          <span>Low Risk (&lt;50)</span>
        </div>
      </div>
      
      {/* Node dragging user hint */}
      <div style={{
        position: 'absolute',
        bottom: '15px',
        right: '15px',
        color: 'var(--text-muted)',
        fontSize: '10px',
        pointerEvents: 'none'
      }}>
        💡 Drag nodes to rearrange the network.
      </div>
    </div>
  );
};
