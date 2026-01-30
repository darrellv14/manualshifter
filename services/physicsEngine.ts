import { CarState, Gear, TrafficCar } from '../types.ts';
import { PHYSICS, TRAFFIC_SETTINGS, COLORS, MAP } from '../constants.ts';

export class PhysicsEngine {
  
  // Helper: Get torque based on current RPM from the curve
  private static getEngineTorque(rpm: number): number {
    const curve = PHYSICS.TORQUE_CURVE;
    // Find point in curve
    for (let i = 0; i < curve.length - 1; i++) {
      if (rpm >= curve[i].rpm && rpm <= curve[i+1].rpm) {
        const t = (rpm - curve[i].rpm) / (curve[i+1].rpm - curve[i].rpm);
        // Linear interpolation
        return curve[i].torque + t * (curve[i+1].torque - curve[i].torque);
      }
    }
    return 0;
  }

  // Helper: Traffic generation
  private static generateTrafficCar(id: number, playerX: number, playerZ: number): TrafficCar {
    const angle = Math.random() * Math.PI * 2;
    const dist = TRAFFIC_SETTINGS.SPAWN_RADIUS * (0.5 + Math.random() * 0.5);
    
    let x = playerX + Math.cos(angle) * dist;
    let z = playerZ + Math.sin(angle) * dist;
    
    const blockSize = MAP.BLOCK_SIZE;
    const roadHalf = MAP.ROAD_WIDTH / 2;
    
    let heading = 0;
    
    if (Math.random() > 0.5) {
        const gridX = Math.round(x / blockSize) * blockSize;
        x = gridX + (Math.random() > 0.5 ? roadHalf/2 : -roadHalf/2);
        heading = Math.random() > 0.5 ? 0 : Math.PI; 
    } else {
        const gridZ = Math.round(z / blockSize) * blockSize;
        z = gridZ + (Math.random() > 0.5 ? roadHalf/2 : -roadHalf/2);
        heading = Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2; 
    }

    const speed = TRAFFIC_SETTINGS.SPEED_MIN + Math.random() * (TRAFFIC_SETTINGS.SPEED_MAX - TRAFFIC_SETTINGS.SPEED_MIN);
    const colorHex = COLORS.trafficColors[Math.floor(Math.random() * COLORS.trafficColors.length)];
    const colorString = '#' + colorHex.toString(16).padStart(6, '0');
    
    return { id, x, z, heading, speed, color: colorString };
  }

  public static update(state: CarState, dt: number): CarState {
    let { 
      rpm, speed, gear, clutchPosition, 
      gasPosition, brakePosition, isEngineOn, 
      isStalled, heading, x, z, steeringInput, traffic, distanceTraveled, tireSlip
    } = state;

    let velocity = speed / 3.6; 

    // --- 1. TRAFFIC MANAGEMENT ---
    if (traffic.length < TRAFFIC_SETTINGS.COUNT) {
        traffic.push(this.generateTrafficCar(Date.now() + Math.random(), x, z));
    }
    const nextTraffic = traffic.map(car => {
        const dist = (car.speed / 3.6) * dt;
        car.x -= Math.sin(car.heading) * dist; 
        car.z -= Math.cos(car.heading) * dist;
        const dx = car.x - x;
        const dz = car.z - z;
        if (Math.sqrt(dx*dx + dz*dz) > TRAFFIC_SETTINGS.SPAWN_RADIUS * 1.5) {
            return this.generateTrafficCar(car.id, x, z);
        }
        return car;
    });


    // --- 2. TRANSMISSION SETUP ---
    // User Input: 0 (Released/Up) to 1 (Pressed/Down)
    // We need "Pedal Pressed Amount"
    const pedalPressed = clutchPosition; 

    const gearRatio = PHYSICS.GEAR_RATIOS[gear];
    const totalRatio = gearRatio * PHYSICS.FINAL_DRIVE;
    const isNeutral = gear === Gear.Neutral;

    const wheelCircumference = 2 * Math.PI * PHYSICS.WHEEL_RADIUS;
    const wheelRPM = (velocity * 60) / wheelCircumference;
    const targetEngineRPM = Math.abs(wheelRPM * totalRatio); // Theoretical RPM based on wheel speed

    // --- 3. ENGINE LOGIC ---
    let engineTorque = 0;
    let driveForce = 0;
    
    if (isEngineOn && !isStalled) {
        
        // =========================================================
        // FIX: REV LIMITER / FUEL CUT
        // =========================================================
        const isRevLimited = targetEngineRPM > PHYSICS.MAX_RPM + 200; // Small tolerance

        if (isRevLimited && !isNeutral && pedalPressed < 0.5) {
            // REV LIMITER HIT!
            engineTorque = -50; // Slight engine drag
        } else {
            // NORMAL OPERATION
            const availableTorque = this.getEngineTorque(rpm);
            
            // FIX: ENGINE BRAKING LOGIC
            if (gasPosition < 0.01) {
                // When gas is released, apply negative torque (engine braking)
                // Proportional to RPM
                engineTorque = -(rpm * 0.05); 
            } else {
                engineTorque = availableTorque * gasPosition;
            }
        }

        // --- SCENARIO 1: HARD STALL CHECK (Shift without Clutch) ---
        if (!isNeutral && Math.abs(speed) < 5 && pedalPressed < 0.1) {
             isStalled = true;
             isEngineOn = false;
             rpm = 0;
             velocity += 0.8; // Hard lurch
        }

        // --- SCENARIO 2: BITE POINT LOGIC ---
        let clutchLoadFactor = 0; // Resistance to engine (0 = None, 1 = Full)

        if (isNeutral) {
            clutchLoadFactor = 0;
        } else {
            if (pedalPressed > 0.6) {
                // Disengaged (Pressed Down)
                clutchLoadFactor = 0;
            } 
            else if (pedalPressed <= 0.6 && pedalPressed >= 0.3) {
                // *** BITE ZONE ***
                const biteProgress = (0.6 - pedalPressed) / 0.3; 
                clutchLoadFactor = biteProgress * 0.8; // Load ramps up
            } 
            else {
                // Fully Engaged (Released)
                clutchLoadFactor = 1.0;
            }
        }

        // --- RPM CALCULATION ---

        if (clutchLoadFactor < 0.1) {
            // A. Free Revving (Clutch Down / Neutral)
            const revUp = 6000 * gasPosition;
            const revDown = 3000;
            
            if (gasPosition > 0.1 && !isRevLimited) { // Don't rev if limited
                rpm += revUp * dt;
            } else {
                if (rpm > PHYSICS.IDLE_RPM + 100) { 
                    rpm -= revDown * dt;
                }
            }
        } else {
            // B. Under Load (Clutch Biting / Engaged)
            
            // 1. Drag RPM towards Wheel Speed
            const stiffness = 20.0 * clutchLoadFactor; 
            const rpmDiff = targetEngineRPM - rpm;
            rpm += rpmDiff * stiffness * dt;

            // 2. Engine Power fighting the Load
            if (gasPosition > 0 && !isRevLimited) {
                // Engine fights back based on gas
                // MODIFIED: Reduced from 3000 to 1500 for heavier flywheel/inertia
                // MODIFIED: Increased load factor resistance from 0.5 to 0.8
                rpm += 1500 * gasPosition * dt * (1.0 - clutchLoadFactor * 0.8);
            }

            // 3. Stall Effect in Bite Zone
            // If biting but no gas, load drags RPM down
            if (gasPosition < 0.1 && Math.abs(speed) < 10) {
                // UPDATED: Decreased drag from 500 to 300 to simulate HEAVY FLYWHEEL (harder to stall)
                rpm -= 300 * clutchLoadFactor * dt; 
            }
        }

        // --- IDLE GOVERNOR (THE SAVIOR) ---
        // Only works if load is light
        if (rpm < PHYSICS.IDLE_RPM && !isStalled) {
             if (clutchLoadFactor < 0.7) {
                 // UPDATED: Increased multiplier from 20.0 to 50.0 to fight load better
                 rpm += (PHYSICS.IDLE_RPM - rpm) * 50.0 * dt; 
             }
        }

        // Limit RPM (Visual Clamp)
        rpm = Math.max(0, Math.min(PHYSICS.MAX_RPM, rpm));

        // STALL CONDITION
        if (rpm < PHYSICS.STALL_RPM && !isNeutral) {
            isStalled = true;
            isEngineOn = false;
            if (clutchLoadFactor > 0.5) velocity += 0.2; // Small jerk
        }

        // --- 4. FORCE CALCULATION ---
        
        if (!isNeutral) {
            const transmissionEfficiency = 0.9;
            const wheelTorque = engineTorque * totalRatio * transmissionEfficiency;
            
            // CREEP LOGIC (Auto-move at bite point)
            // If in bite zone, having RPM, but low gas -> Flywheel inertia moves car
            let creepTorque = 0;
            // FIX: Removed 'clutchLoadFactor' multiplication here!
            // It is applied later in 'driveForce'. This prevents "Double Filtering" (0.1 * 0.1 = 0.01).
            if (gasPosition < 0.3 && rpm > 300 && rpm < 1500 && clutchLoadFactor > 0.1) {
                creepTorque = 450 * gearRatio; 
            }

            // Total drive force
            driveForce = ((wheelTorque + creepTorque) / PHYSICS.WHEEL_RADIUS) * clutchLoadFactor;

            if (gear === Gear.Reverse) driveForce = -driveForce;
        }

        // Physics Forces
        const dragForce = 0.5 * PHYSICS.AIR_DENSITY * PHYSICS.FRONTAL_AREA * PHYSICS.DRAG_COEFF * (velocity * velocity);
        // FIX: Rolling resistance now applies to reverse motion (abs(velocity))
        const rollingResistance = Math.abs(velocity) > 0.1 ? (PHYSICS.MASS * 9.8 * 0.015) : 0;
        const brakeForce = brakePosition * PHYSICS.BRAKE_TORQUE;

        const direction = velocity >= 0 ? 1 : -1;
        const totalResistance = (dragForce + rollingResistance + brakeForce) * direction;
        const netForce = driveForce - totalResistance;

        const acceleration = netForce / PHYSICS.MASS;
        velocity += acceleration * dt;

        // Stop creep
        if (Math.abs(velocity) < 0.1 && gasPosition === 0 && Math.abs(driveForce) < 10) {
            velocity = 0;
        }

    } else {
        // Engine off
        rpm -= 2000 * dt; 
        rpm = Math.max(0, rpm);
        
        // Momentum only physics
        const dragForce = 0.5 * PHYSICS.AIR_DENSITY * PHYSICS.FRONTAL_AREA * PHYSICS.DRAG_COEFF * (velocity * velocity);
        // FIX: Rolling resistance for engine off as well
        const rollingResistance = Math.abs(velocity) > 0.1 ? (PHYSICS.MASS * 9.8 * 0.015) : 0;
        const brakeForce = brakePosition * PHYSICS.BRAKE_TORQUE;
        const direction = velocity >= 0 ? 1 : -1;
        const acceleration = -(dragForce + rollingResistance + brakeForce) * direction / PHYSICS.MASS;
        velocity += acceleration * dt;
        if (Math.abs(velocity) < 0.1) velocity = 0;
    }


    // --- 5. TIRE SLIP & DRIFT ---
    let newTireSlip = 0;
    const maxGrip = PHYSICS.MASS * 9.8 * 0.9;
    if (Math.abs(driveForce) > maxGrip && Math.abs(speed) < 50) newTireSlip += (Math.abs(driveForce) - maxGrip) / maxGrip;
    if (Math.abs(velocity) > 5) {
        const lf = Math.abs(steeringInput) * (velocity * velocity) * 0.02;
        if (lf > 1.0) newTireSlip += (lf - 1.0);
    }
    newTireSlip = Math.min(1.0, Math.max(0, newTireSlip));


    // --- 6. POSITION UPDATE & STEERING ---
    speed = velocity * 3.6;

    if (Math.abs(velocity) > 0.1) {
        const speedRatio = Math.min(1.0, Math.abs(speed) / PHYSICS.STEER_SENSITIVITY_CURVE);
        const sensitivity = 1.0 - (speedRatio * 0.8);
        
        const currentSteerAngle = steeringInput * PHYSICS.MAX_STEER_ANGLE * sensitivity;
        const angularVelocity = (velocity * Math.sin(currentSteerAngle)) / PHYSICS.WHEEL_BASE;
        
        heading += angularVelocity * dt;
    }

    let newX = x - Math.sin(heading) * velocity * dt;
    let newZ = z - Math.cos(heading) * velocity * dt;

    // --- 7. COLLISION & CRASH ---
    const blockSize = MAP.BLOCK_SIZE;
    const roadHalf = MAP.ROAD_WIDTH / 2;
    const distToXLine = Math.abs(newX - Math.round(newX / blockSize) * blockSize);
    const distToZLine = Math.abs(newZ - Math.round(newZ / blockSize) * blockSize);

    if (distToXLine > roadHalf && distToZLine > roadHalf) {
        if (Math.abs(speed) > 10) {
             // Hard crash
             speed = 0;
             velocity = 0;
             isStalled = true;
             isEngineOn = false;
             rpm = 0;
             newX = x; 
             newZ = z;
        } else {
             // Soft bump
             velocity = 0;
             speed = 0;
             newX = x;
             newZ = z;
        }
    }

    return {
      isEngineOn,
      rpm,
      speed,
      gear,
      clutchPosition,
      gasPosition,
      brakePosition,
      distanceTraveled: distanceTraveled + Math.abs(velocity * dt),
      isStalled,
      steeringInput,
      tireSlip: newTireSlip,
      x: newX,
      z: newZ,
      heading,
      traffic: nextTraffic
    };
  }
}