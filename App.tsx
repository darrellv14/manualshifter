import React, { useState, useEffect, useRef, useCallback } from 'react';
import Scene3D from './components/Scene3D.tsx';
import Dashboard from './components/Dashboard.tsx';
import Controls from './components/Controls.tsx';
import Minimap from './components/Minimap.tsx';
import SteeringWheel from './components/SteeringWheel.tsx';
import { CarState, INITIAL_CAR_STATE, Gear } from './types.ts';
import { PhysicsEngine } from './services/physicsEngine.ts';
import { AudioManager } from './services/AudioManager.ts';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<CarState>(INITIAL_CAR_STATE);
  
  const stateRef = useRef<CarState>(INITIAL_CAR_STATE);
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // Audio Manager Instance
  const audioManagerRef = useRef<AudioManager>(new AudioManager());

  const updateState = (newState: Partial<CarState>) => {
    stateRef.current = { ...stateRef.current, ...newState };
    setGameState(stateRef.current);
  };

  const handleIgnition = () => {
      const audio = audioManagerRef.current;
      if (stateRef.current.isEngineOn) {
          updateState({ isEngineOn: false });
          audio.stop();
      } else {
          updateState({ isEngineOn: true, isStalled: false, rpm: 800 });
          audio.start();
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;
      
      if (key === 'i') handleIgnition();

      // Sequential Gears
      if (e.key === 'ArrowUp') {
          const current = stateRef.current.gear;
          if (current < Gear.Fifth) updateState({ gear: current + 1 });
      }
      if (e.key === 'ArrowDown') {
          const current = stateRef.current.gear;
          if (current > Gear.Reverse) updateState({ gear: current - 1 });
      }

      // H-Pattern Gears
      if (key === '1') updateState({ gear: Gear.First });
      if (key === '2') updateState({ gear: Gear.Second });
      if (key === '3') updateState({ gear: Gear.Third });
      if (key === '4') updateState({ gear: Gear.Fourth });
      if (key === '5') updateState({ gear: Gear.Fifth });
      if (key === 'r') updateState({ gear: Gear.Reverse });
      if (key === '0' || key === 'n') updateState({ gear: Gear.Neutral });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // User interaction required for audio
    const unlockAudio = () => audioManagerRef.current.init();
    window.addEventListener('click', unlockAudio);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    let { gasPosition, brakePosition, clutchPosition, steeringInput } = stateRef.current;
    
    // GAS
    if (keysPressed.current['w']) {
        gasPosition = Math.min(1, gasPosition + 2 * dt);
    } else {
        if (!document.activeElement?.className.includes('range')) {
           gasPosition = Math.max(0, gasPosition - 2 * dt);
        }
    }

    // BRAKE
    if (keysPressed.current['s']) {
        brakePosition = Math.min(1, brakePosition + 3 * dt);
    } else {
         if (!document.activeElement?.className.includes('range')) {
            brakePosition = Math.max(0, brakePosition - 3 * dt);
         }
    }

    // CLUTCH - STICKY LOGIC
    if (keysPressed.current['shift']) {
        // Pressing down is always fast
        clutchPosition = Math.min(1, clutchPosition + 5 * dt);
    } else {
         if (!document.activeElement?.className.includes('range')) {
            // "Sticky Clutch" Logic for Keyboard Users
            // Slow down release significantly when passing through the bite point
            // to allow the physics engine to generate creep torque and prevent instant stalling.
            const BITE_POINT_START = 0.3;
            const BITE_POINT_END = 0.6;
            
            let releaseSpeed = 5.0; // Normal fast release
            
            // If inside the bite zone, slow down drastically
            if (clutchPosition > BITE_POINT_START && clutchPosition < BITE_POINT_END) {
                releaseSpeed = 0.5; // Sticky!
            }
            
            clutchPosition = Math.max(0, clutchPosition - releaseSpeed * dt);
         }
    }

    // STEERING (SMOOTHING LOGIC)
    const isLeft = keysPressed.current['a'] || keysPressed.current['arrowleft'];
    const isRight = keysPressed.current['d'] || keysPressed.current['arrowright'];

    // Time to turn wheel fully (seconds)
    const steerTime = 0.5; 
    const steerSpeed = (1.0 / steerTime) * dt;

    // Self centering speed increases with car speed
    const currentSpeed = Math.abs(stateRef.current.speed);
    const centeringFactor = Math.max(1, currentSpeed / 20);
    const returnSpeed = (1.0 / 0.5) * dt * centeringFactor;

    if (isLeft) {
        if (steeringInput < 1.0) steeringInput += steerSpeed;
    } else if (isRight) {
        if (steeringInput > -1.0) steeringInput -= steerSpeed;
    } else {
        // Return to center
        if (steeringInput > 0) {
            steeringInput -= returnSpeed;
            if (steeringInput < 0) steeringInput = 0;
        } else if (steeringInput < 0) {
            steeringInput += returnSpeed;
            if (steeringInput > 0) steeringInput = 0;
        }
    }
    
    // Clamp
    steeringInput = Math.max(-1, Math.min(1, steeringInput));

    stateRef.current = { ...stateRef.current, gasPosition, brakePosition, clutchPosition, steeringInput };

    // Update Physics
    const nextState = PhysicsEngine.update(stateRef.current, dt);
    stateRef.current = nextState;
    setGameState(nextState);

    // Update Audio
    audioManagerRef.current.update(nextState.rpm, nextState.gasPosition, nextState.tireSlip, nextState.speed);

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handlePedalChange = (pedal: 'clutch' | 'brake' | 'gas', value: number) => {
     if (pedal === 'clutch') stateRef.current.clutchPosition = value;
     if (pedal === 'brake') stateRef.current.brakePosition = value;
     if (pedal === 'gas') stateRef.current.gasPosition = value;
  };

  const handleGearChange = (gear: Gear) => {
      updateState({ gear });
  };

  return (
    <div className="w-full h-screen relative overflow-hidden font-sans bg-sky-200">
      <Scene3D gameState={gameState} />
      
      <Minimap state={gameState} />

      <Dashboard state={gameState} />
      
      <SteeringWheel steeringInput={gameState.steeringInput} />
      
      <Controls 
        state={gameState} 
        onPedalChange={handlePedalChange}
        onGearChange={handleGearChange}
        onIgnition={handleIgnition}
      />
    </div>
  );
};

export default App;