export enum Gear {
  Reverse = -1,
  Neutral = 0,
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  Fifth = 5
}

export interface TrafficCar {
  id: number;
  x: number;
  z: number;
  heading: number; // radians
  speed: number; // km/h
  color: string;
}

export interface CarState {
  isEngineOn: boolean;
  rpm: number;
  speed: number; // km/h
  gear: Gear;
  clutchPosition: number; // 0.0 to 1.0
  gasPosition: number; // 0.0 to 1.0
  brakePosition: number; // 0.0 to 1.0
  isStalled: boolean;
  
  // World Position & Physics
  x: number; // World X
  z: number; // World Z
  heading: number; // Rotation around Y axis (radians)
  steeringInput: number; // -1 to 1

  // Physics Feedback
  tireSlip: number; // 0.0 to 1.0 (0 = Grip, 1 = Full Slide)

  distanceTraveled: number;

  // Environment
  traffic: TrafficCar[];
}

export const INITIAL_CAR_STATE: CarState = {
  isEngineOn: false,
  rpm: 0,
  speed: 0,
  gear: Gear.Neutral,
  clutchPosition: 0,
  gasPosition: 0,
  brakePosition: 0,
  isStalled: false,
  steeringInput: 0,
  x: 0,
  z: 0,
  heading: 0,
  tireSlip: 0,
  distanceTraveled: 0,
  traffic: []
};