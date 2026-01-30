import React from 'react';

interface SteeringWheelProps {
  steeringInput: number; // Range -1.0 (Right) to 1.0 (Left)
}

const SteeringWheel: React.FC<SteeringWheelProps> = ({ steeringInput }) => {
  // Real cars usually have 900 degrees lock-to-lock (2.5 turns)
  // Input -1 to 1 multiplied by 450 degrees
  const rotation = steeringInput * 450; 

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      {/* Steering Container */}
      <div 
        className="w-64 h-64 relative transition-transform duration-75 ease-out will-change-transform"
        style={{ 
          transform: `rotate(${-rotation}deg)`, // Negative because typically + input is Left in this game logic
          filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))'
        }}
      >
        {/* SVG Steering Wheel Design */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Outer Rim (Leather) */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a1a" strokeWidth="8" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="1,2" opacity="0.5" />
          
          {/* Top Marker (Red Center Line) */}
          <path d="M 50 5 L 50 12" stroke="#ef4444" strokeWidth="8" strokeLinecap="butt" />

          {/* Center Hub */}
          <circle cx="50" cy="50" r="12" fill="#222" stroke="#444" strokeWidth="1" />
          
          {/* Center Logo */}
          <circle cx="50" cy="50" r="6" fill="#fbbf24" />
          
          {/* Spokes */}
          {/* Left */}
          <path d="M 40 50 L 10 50 L 10 60 L 42 58 Z" fill="#262626" stroke="#111" strokeWidth="0.5" />
          {/* Right */}
          <path d="M 60 50 L 90 50 L 90 60 L 58 58 Z" fill="#262626" stroke="#111" strokeWidth="0.5" />
          {/* Bottom */}
          <path d="M 50 62 L 50 90 L 40 85 L 45 60 Z" fill="#262626" stroke="#111" strokeWidth="0.5" />
          <path d="M 50 62 L 50 90 L 60 85 L 55 60 Z" fill="#262626" stroke="#111" strokeWidth="0.5" />

          {/* Grip Texture Detail (Simple Dots) */}
          <circle cx="20" cy="50" r="1" fill="#444" />
          <circle cx="80" cy="50" r="1" fill="#444" />
        </svg>
      </div>
    </div>
  );
};

export default SteeringWheel;