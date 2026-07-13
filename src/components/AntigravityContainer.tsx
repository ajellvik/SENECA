import React, { useState, useEffect, useRef } from 'react';
import { Space, Compass, ShieldAlert, Award, RefreshCw, Zap } from 'lucide-react';

interface PhysicsItem {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  angle: number;
  angularVelocity: number;
  isDragging: boolean;
  element: React.ReactNode;
}

interface AntigravityContainerProps {
  isActive: boolean;
  onClose?: () => void;
  cards: {
    id: string;
    title: string;
    node: React.ReactNode;
    initialWidth?: number;
    initialHeight?: number;
  }[];
}

export default function AntigravityContainer({ isActive, onClose, cards }: AntigravityContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PhysicsItem[]>([]);
  const [gravityMode, setGravityMode] = useState<'zero' | 'lunar' | 'attract'>('zero');
  const [chaosFactor, setChaosFactor] = useState(1);
  const animationFrameId = useRef<number | null>(null);
  
  // Track mouse states for drag gesture
  const dragInfoRef = useRef<{
    itemId: string | null;
    startX: number;
    startY: number;
    lastMouseX: number;
    lastMouseY: number;
    currentMouseX: number;
    currentMouseY: number;
    vx: number;
    vy: number;
  }>({
    itemId: null,
    startX: 0,
    startY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    currentMouseX: 0,
    currentMouseY: 0,
    vx: 0,
    vy: 0
  });

  const mouseRef = useRef({ x: 0, y: 0 });

  // Initialize the spatial placement of items when active
  useEffect(() => {
    if (!isActive) {
      setItems([]);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cWidth = rect.width || window.innerWidth;
    const cHeight = rect.height || window.innerHeight;

    // Arrange nodes on a stylized orbital path to split them apart on launch
    const initializedItems: PhysicsItem[] = cards.map((card, idx) => {
      // Calculate layout coordinates mapping
      const columns = Math.min(3, cards.length);
      const rowIdx = Math.floor(idx / columns);
      const colIdx = idx % columns;

      const paddingX = 80;
      const paddingY = 80;
      const stepX = (cWidth - paddingX * 2) / Math.max(1, columns - 1 || 1);
      const stepY = (cHeight - paddingY * 2) / Math.max(1, Math.ceil(cards.length / columns) - 1 || 1);

      const x = paddingX + colIdx * stepX * 0.9 + (Math.random() - 0.5) * 40;
      const y = paddingY + rowIdx * stepY * 0.9 + (Math.random() - 0.5) * 40;

      // Provide responsive gentle drifting velocity
      const vx = (Math.random() - 0.5) * 3 * chaosFactor;
      const vy = (Math.random() - 0.5) * 3 * chaosFactor;

      return {
        id: card.id,
        name: card.title,
        x,
        y: Math.max(80, y),
        vx,
        vy,
        width: card.initialWidth || 360,
        height: card.initialHeight || 280,
        angle: (idx * 15) % 45 - 20,
        angularVelocity: (Math.random() - 0.5) * 0.6,
        isDragging: false,
        element: card.node
      };
    });

    setItems(initializedItems);

    // Track mouse move for central grav attractor calculations
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const cRect = containerRef.current.getBoundingClientRect();
        mouseRef.current = {
          x: e.clientX - cRect.left,
          y: e.clientY - cRect.top
        };
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isActive, cards, chaosFactor]);

  // Main high-precision physics integrator tick-loop
  useEffect(() => {
    if (!isActive) return;

    const tick = () => {
      setItems((prevItems) => {
        const container = containerRef.current;
        if (!container) return prevItems;

        const bounds = container.getBoundingClientRect();
        const displayW = bounds.width || window.innerWidth;
        const displayH = bounds.height || window.innerHeight;

        const dragInfo = dragInfoRef.current;

        return prevItems.map((item) => {
          // If being dragged by mouse, let coordinate lock onto tracking parameters
          if (dragInfo.itemId === item.id) {
            // Keep speed calculations updated for fings
            const dx = dragInfo.currentMouseX - dragInfo.lastMouseX;
            const dy = dragInfo.currentMouseY - dragInfo.lastMouseY;
            
            dragInfo.vx = dx * 0.8;
            dragInfo.vy = dy * 0.8;

            dragInfo.lastMouseX = dragInfo.currentMouseX;
            dragInfo.lastMouseY = dragInfo.currentMouseY;

            return {
              ...item,
              x: dragInfo.currentMouseX - item.width / 2,
              y: dragInfo.currentMouseY - item.height / 2,
              vx: dragInfo.vx,
              vy: dragInfo.vy,
              angle: item.angle + dragInfo.vx * 0.05,
              angularVelocity: dragInfo.vx * 0.08,
              isDragging: true
            };
          }

          // Compute gravity vector parameters
          let gx = 0;
          let gy = 0;

          if (gravityMode === 'lunar') {
            gy = 0.08; // Weak lunar pull
          } else if (gravityMode === 'attract') {
            // Strong attraction toward center of gravity (Attractor Core or Cursor position!)
            const targetX = displayW / 2;
            const targetY = displayH / 2 + 50;

            const dx = targetX - (item.x + item.width / 2);
            const dy = targetY - (item.y + item.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist > 80) {
              gx = (dx / dist) * 0.15;
              gy = (dy / dist) * 0.15;
            }
          }

          // Advance vectors with frictional damping (space vacuum vacuuming!)
          let newVx = (item.vx + gx) * 0.99;
          let newVy = (item.vy + gy) * 0.99;

          let newX = item.x + newVx;
          let newY = item.y + newVy;
          let newAngle = item.angle + item.angularVelocity;
          let newAngV = item.angularVelocity * 0.98;

          // Boundary bounce and deflection dynamics
          const padding = 5;

          if (newX < padding) {
            newX = padding;
            newVx = Math.abs(newVx) * 0.7; // Bounce off left wall
            newAngV = (Math.random() - 0.5) * 2;
          } else if (newX + item.width > displayW - padding) {
            newX = displayW - item.width - padding;
            newVx = -Math.abs(newVx) * 0.7; // Bounce off right wall
            newAngV = (Math.random() - 0.5) * 2;
          }

          if (newY < 40 + padding) {
            newY = 40 + padding;
            newVy = Math.abs(newVy) * 0.7; // Bounce off ceiling
          } else if (newY + item.height > displayH - padding) {
            newY = displayH - item.height - padding;
            newVy = -Math.abs(newVy) * 0.7; // Bounce off floor with energy loss
            newAngV = (Math.random() - 0.5) * 1.5;
          }

          return {
            ...item,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy,
            angle: newAngle,
            angularVelocity: newAngV,
            isDragging: false
          };
        });
      });

      animationFrameId.current = requestAnimationFrame(tick);
    };

    animationFrameId.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isActive, gravityMode]);

  // Handle pointer coordinate inputs
  const handleItemMouseDown = (e: React.MouseEvent, item: PhysicsItem) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    dragInfoRef.current = {
      itemId: item.id,
      startX: mouseX,
      startY: mouseY,
      lastMouseX: mouseX,
      lastMouseY: mouseY,
      currentMouseX: mouseX,
      currentMouseY: mouseY,
      vx: item.vx,
      vy: item.vy
    };
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo.itemId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    dragInfo.currentMouseX = mouseX;
    dragInfo.currentMouseY = mouseY;
  };

  const handleContainerMouseUp = () => {
    const dragInfo = dragInfoRef.current;
    if (!dragInfo.itemId) return;

    // Apply impulse fling forces on release!
    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id === dragInfo.itemId) {
          return {
            ...item,
            vx: dragInfo.vx,
            vy: dragInfo.vy,
            isDragging: false
          };
        }
        return item;
      });
    });

    dragInfo.itemId = null;
  };

  const applySpaceImpulse = () => {
    setItems((prevItems) => {
      return prevItems.map((item) => {
        return {
          ...item,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          angularVelocity: (Math.random() - 0.5) * 6
        };
      });
    });
  };

  if (!isActive) return null;

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      onMouseLeave={handleContainerMouseUp}
      className="fixed inset-0 z-40 bg-[#01040d]/95 backdrop-blur-md overflow-hidden cosmic-grid h-screen w-screen px-4 pb-4 select-none"
    >
      {/* Background Star Radial Glares */}
      <div className="absolute top-[20%] left-[30%] h-96 w-96 rounded-full bg-cyan-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[30%] right-[10%] h-96 w-96 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      {/* Floating System Controller Header */}
      <div className="relative h-14 border-b border-slate-800/60 flex items-center justify-between px-6 z-50 bg-[#010410]/85 backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_8px_#22d3ee]" />
          <span className="text-[10px] font-extrabold font-mono tracking-widest text-cyan-300 uppercase">
            Antigravity Sandbox Workspace
          </span>
        </div>

        {/* Orbit Attractions Parameters Panel */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-2">Gravity parameters:</span>
          
          <button
            onClick={() => setGravityMode('zero')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider transition ${
              gravityMode === 'zero' 
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                : 'bg-slate-900 border border-slate-805 text-slate-400 hover:text-white'
            }`}
          >
            Zero-G
          </button>

          <button
            onClick={() => setGravityMode('lunar')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider transition ${
              gravityMode === 'lunar' 
                ? 'bg-purple-500/25 text-purple-300 border border-purple-400/40 shadow-[0_0_10px_rgba(192,132,252,0.2)]' 
                : 'bg-slate-900 border border-slate-805 text-slate-400 hover:text-white'
            }`}
          >
            Lunar-G
          </button>

          <button
            onClick={() => setGravityMode('attract')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wider transition ${
              gravityMode === 'attract' 
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                : 'bg-slate-900 border border-slate-805 text-slate-400 hover:text-white'
            }`}
          >
            Core Attractor
          </button>

          <button
            onClick={applySpaceImpulse}
            className="ml-3 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[10px] font-extrabold uppercase font-mono tracking-wider flex items-center gap-1 active:scale-95 transition"
            title="Applies an instantaneous kinetic blast pushing cards outwards!"
          >
            <Zap className="h-3.5 w-3.5" />
            Impulse Blast
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="ml-5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[10px] font-extrabold uppercase font-mono tracking-wider transition duration-150 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.3)]"
            >
              Restore Gravity
            </button>
          )}
        </div>
      </div>

      {/* Physics Attraction Hub Graphics Indicator when in attract mode */}
      {gravityMode === 'attract' && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[15%] pointer-events-none flex flex-col items-center">
          <div className="h-32 w-32 rounded-full border border-dashed border-amber-400/20 flex items-center justify-center animate-spin-slow">
            <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-amber-400/5 to-yellow-500/5 border border-amber-400/30 flex items-center justify-center">
              <Compass className="h-6 w-6 text-amber-400/60 animate-pulse" />
            </div>
          </div>
          <span className="text-[9px] font-bold text-amber-400/40 tracking-widest uppercase font-mono mt-3">attraction threshold</span>
        </div>
      )}

      {/* RENDER SPACE FOR FLOATING DOM CARDS */}
      <div className="relative w-full h-[calc(100vh-3.5rem)]">
        {items.map((item) => {
          return (
            <div
              key={item.id}
              onMouseDown={(e) => handleItemMouseDown(e, item)}
              className="physics-floating absolute"
              style={{
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${item.width}px`,
                height: `${item.height}px`,
                transform: `rotate(${item.angle}deg)`,
                opacity: item.isDragging ? 0.92 : 1,
                transition: item.isDragging ? 'none' : 'transform 0.05s linear'
              }}
            >
              {/* Outer border wrap with neon indicator highlights when grabbed */}
              <div className={`p-4 rounded-3xl bg-[#090f1d] border h-full w-full overflow-hidden flex flex-col justify-between shadow-2xl transition duration-150 ${
                item.isDragging 
                  ? 'border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.3)]' 
                  : 'border-slate-800 hover:border-slate-750'
              }`}>
                {/* Header label */}
                <div className="border-b border-slate-850 pb-2.5 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-black font-display tracking-tight text-slate-350 uppercase">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-600 uppercase">
                    DRAG AREA
                  </span>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 w-full overflow-auto mt-3 py-1">
                  {item.element}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
