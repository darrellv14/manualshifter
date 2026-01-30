import React, { useEffect, useRef } from 'react';
import { CarState } from '../types.ts';
import { MAP } from '../constants.ts';

interface MinimapProps {
  state: CarState;
}

const Minimap: React.FC<MinimapProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Settings
    const size = 200;
    const zoom = 2; // Pixels per meter
    const center = size / 2;
    
    // Clear
    ctx.clearRect(0, 0, size, size);

    // Background (Buildings)
    ctx.fillStyle = '#1e293b'; // Slate 800
    ctx.fillRect(0, 0, size, size);

    // Draw Roads (Grid)
    ctx.strokeStyle = '#475569'; // Slate 600
    ctx.lineWidth = MAP.ROAD_WIDTH * zoom;

    // Calculate Grid Offsets relative to player
    // Player is at (state.x, state.z)
    // We want to draw lines at world coordinates N * BLOCK_SIZE
    
    const startX = Math.floor((state.x - (center/zoom)) / MAP.BLOCK_SIZE) * MAP.BLOCK_SIZE;
    const endX = Math.floor((state.x + (center/zoom)) / MAP.BLOCK_SIZE) * MAP.BLOCK_SIZE;
    const startZ = Math.floor((state.z - (center/zoom)) / MAP.BLOCK_SIZE) * MAP.BLOCK_SIZE;
    const endZ = Math.floor((state.z + (center/zoom)) / MAP.BLOCK_SIZE) * MAP.BLOCK_SIZE;

    ctx.beginPath();
    
    // Vertical Roads (Constant X)
    for (let x = startX; x <= endX; x += MAP.BLOCK_SIZE) {
        // Convert World X to Canvas X
        const canvasX = center + (x - state.x) * zoom;
        ctx.moveTo(canvasX, 0);
        ctx.lineTo(canvasX, size);
    }
    
    // Horizontal Roads (Constant Z)
    for (let z = startZ; z <= endZ; z += MAP.BLOCK_SIZE) {
        // Convert World Z to Canvas Y (Z is down in canvas usually, but let's match map)
        const canvasY = center + (z - state.z) * zoom;
        ctx.moveTo(0, canvasY);
        ctx.lineTo(size, canvasY);
    }
    ctx.stroke();

    // Draw Traffic
    ctx.fillStyle = '#ef4444'; // Red dots
    state.traffic.forEach(car => {
        const cx = center + (car.x - state.x) * zoom;
        const cy = center + (car.z - state.z) * zoom;
        
        // Only draw if within bounds
        if (cx > 0 && cx < size && cy > 0 && cy < size) {
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Player (Triangle)
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-state.heading); // Rotate map opposite to heading? Or rotate player?
    // GTA Style: Map rotates so Up is forward? Or Map fixed North Up?
    // Let's do Fixed North Up (easier for grid), Player rotates.
    // Actually, GTA map rotates so Up is Forward.
    
    // Let's try Rotating Map Mode:
    // If we want Rotating Map:
    // We need to rotate the whole context around center by +heading before drawing roads.
    // BUT, let's stick to North Up for now (Player rotates), it's clearer for grid navigation.
    
    ctx.fillStyle = '#0ea5e9'; // Sky Blue
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    
    // Flash light cone
    ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 40, -Math.PI/2 - 0.5, -Math.PI/2 + 0.5);
    ctx.fill();

    ctx.restore();

    // Border ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.stroke();

  }, [state.x, state.z, state.heading, state.traffic]);

  return (
    <div className="absolute top-4 right-4 z-30 rounded-full overflow-hidden border-4 border-gray-800 shadow-2xl bg-black">
      <canvas ref={canvasRef} width={200} height={200} className="block" />
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold text-white drop-shadow-md">
        N
      </div>
    </div>
  );
};

export default Minimap;