import React from 'react';
import { CarState, Gear } from '../types.ts';

interface ControlsProps {
  state: CarState;
  onPedalChange: (pedal: 'clutch' | 'brake' | 'gas', value: number) => void;
  onGearChange: (gear: Gear) => void;
  onIgnition: () => void;
}

// Visual Constants for Clutch Bite Point (Matches Physics Logic)
const BITE_POINT_START = 0.3; // 30% from bottom (released)
const BITE_POINT_END = 0.6;   // 60% from bottom

const Controls: React.FC<ControlsProps> = ({ state, onPedalChange, onGearChange, onIgnition }) => {
  
  const handleGearClick = (g: Gear) => {
    onGearChange(g);
  };

  const Pedal = ({ label, value, type, color }: { label: string, value: number, type: 'clutch' | 'brake' | 'gas', color: string }) => (
    <div className="flex flex-col items-center h-48 w-16 relative group pointer-events-auto">
       {/* Visual Slider Container */}
       <div className="h-40 w-full bg-gray-900/80 rounded-lg relative overflow-hidden border border-gray-600 shadow-xl backdrop-blur-sm">
          
          {/* CLUTCH BITE POINT VISUALIZER */}
          {type === 'clutch' && (
             <div 
               className="absolute left-0 right-0 bg-yellow-500/20 border-y border-yellow-500/40 z-0"
               style={{
                  bottom: `${BITE_POINT_START * 100}%`,
                  height: `${(BITE_POINT_END - BITE_POINT_START) * 100}%`
               }}
             >
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-yellow-200 font-mono opacity-60 writing-vertical-rl">
                    BITE ZONE
                </div>
             </div>
          )}

          {/* Fill */}
          <div 
            className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ease-linear ${color} opacity-80 z-10`}
            style={{ height: `${value * 100}%` }}
          />
          {/* Pedal Plate Visual */}
          <div className="absolute bottom-2 left-2 right-2 h-8 bg-gray-300 rounded border-b-4 border-gray-500 shadow-sm z-20"
               style={{ marginBottom: `${value * 80}%`, transition: 'margin 0.07s linear' }}></div>
       </div>

       {/* Interactive Input Overlay */}
       <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01"
          value={value}
          onChange={(e) => onPedalChange(type, parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          style={{ transform: 'rotate(-90deg)', width: '12rem', height: '4rem', top: '3rem', left: '-4rem' }} 
       />
       
       <span className="mt-1 text-white font-bold text-[10px] uppercase tracking-wider bg-black/50 px-2 rounded">{label}</span>
    </div>
  );

  // Helper for H-Shifter Knob Position
  const getKnobPosition = (g: Gear) => {
      // Return percentage {top, left}
      switch(g) {
          case Gear.First: return { top: '10%', left: '15%' };
          case Gear.Second: return { top: '80%', left: '15%' };
          case Gear.Third: return { top: '10%', left: '50%' };
          case Gear.Fourth: return { top: '80%', left: '50%' };
          case Gear.Fifth: return { top: '10%', left: '85%' };
          case Gear.Reverse: return { top: '80%', left: '85%' };
          default: return { top: '45%', left: '50%' }; // Neutral
      }
  };

  const knobPos = getKnobPosition(state.gear);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
      
      {/* TOP INSTRUCTIONS (Minimal) */}
      <div className="w-full text-center pt-20 pointer-events-auto">
         <div className="inline-block bg-black/30 backdrop-blur text-white text-[10px] px-4 py-1 rounded-full border border-white/10">
            [I] IGNITION &nbsp;•&nbsp; [ARROWS] DRIVE &nbsp;•&nbsp; [W/S/SHIFT] PEDALS &nbsp;•&nbsp; [1-5/R] GEARS
         </div>
      </div>

      {/* BOTTOM CONTROLS CONTAINER */}
      <div className="flex justify-between items-end p-6 w-full">
        
        {/* LEFT: PEDALS */}
        <div className="flex gap-3 items-end mb-2">
            <Pedal label="Clutch" value={state.clutchPosition} type="clutch" color="bg-blue-600" />
            <Pedal label="Brake" value={state.brakePosition} type="brake" color="bg-red-600" />
            <Pedal label="Gas" value={state.gasPosition} type="gas" color="bg-green-500" />
        </div>

        {/* RIGHT: H-SHIFTER & IGNITION */}
        <div className="flex flex-col items-end gap-4 pointer-events-auto">
            
            {/* IGNITION BUTTON */}
            <button
                onClick={onIgnition}
                className={`w-16 h-16 rounded-full border-4 shadow-lg flex items-center justify-center transition-all ${state.isEngineOn ? 'border-red-500 bg-red-900/50 text-red-500' : 'border-green-500 bg-green-900/50 text-green-500 hover:bg-green-800/80'}`}
                title="Ignition (Press I)"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                </svg>
            </button>

            {/* H-SHIFTER VISUAL */}
            <div className="w-40 h-40 bg-gray-900/90 rounded-full border-4 border-gray-600 shadow-2xl relative">
                {/* Gate Paths */}
                <div className="absolute inset-0 flex items-center justify-center opacity-50">
                    <div className="w-24 h-24 relative">
                        {/* Horizontal Neutral Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-2 bg-black -mt-1 rounded"></div>
                        {/* Vertical Lines */}
                        <div className="absolute top-0 bottom-0 left-[15%] w-2 bg-black rounded"></div>
                        <div className="absolute top-0 bottom-0 left-[50%] w-2 bg-black -ml-1 rounded"></div>
                        <div className="absolute top-0 bottom-0 right-[15%] w-2 bg-black rounded"></div>
                    </div>
                </div>

                {/* Clickable Zones (Invisible but overlaying) */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 p-2">
                    <div onClick={() => handleGearClick(Gear.First)} className="cursor-pointer hover:bg-white/5 rounded"></div>
                    <div onClick={() => handleGearClick(Gear.Third)} className="cursor-pointer hover:bg-white/5 rounded"></div>
                    <div onClick={() => handleGearClick(Gear.Fifth)} className="cursor-pointer hover:bg-white/5 rounded"></div>
                    
                    {/* Neutral Row - Click middle for Neutral */}
                    <div onClick={() => handleGearClick(Gear.Neutral)} className="col-span-3 cursor-pointer hover:bg-white/5 rounded h-8 my-auto"></div>

                    <div onClick={() => handleGearClick(Gear.Second)} className="cursor-pointer hover:bg-white/5 rounded -mt-8 pt-8"></div>
                    <div onClick={() => handleGearClick(Gear.Fourth)} className="cursor-pointer hover:bg-white/5 rounded -mt-8 pt-8"></div>
                    <div onClick={() => handleGearClick(Gear.Reverse)} className="cursor-pointer hover:bg-white/5 rounded -mt-8 pt-8"></div>
                </div>

                {/* Gear Labels */}
                <span className="absolute top-3 left-6 text-white text-xs font-bold pointer-events-none">1</span>
                <span className="absolute top-3 left-1/2 -ml-1 text-white text-xs font-bold pointer-events-none">3</span>
                <span className="absolute top-3 right-6 text-white text-xs font-bold pointer-events-none">5</span>
                
                <span className="absolute bottom-3 left-6 text-white text-xs font-bold pointer-events-none">2</span>
                <span className="absolute bottom-3 left-1/2 -ml-1 text-white text-xs font-bold pointer-events-none">4</span>
                <span className="absolute bottom-3 right-6 text-red-500 text-xs font-bold pointer-events-none">R</span>

                {/* The Stick / Knob */}
                <div 
                    className="absolute w-8 h-8 bg-white rounded-full shadow-lg border-2 border-gray-400 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ease-out z-10"
                    style={{ 
                        top: knobPos.top, 
                        left: knobPos.left,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-100 to-gray-400"></div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;