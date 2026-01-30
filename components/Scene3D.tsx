import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CarState } from '../types.ts';
import { COLORS, MAP, TRAFFIC_SETTINGS } from '../constants.ts';

interface SceneProps {
  gameState: CarState;
}

// Internal Texture Generator for Smoke
const createSmokeTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

const Scene3D: React.FC<SceneProps> = ({ gameState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  const carGroupRef = useRef<THREE.Group | null>(null);
  const brakeLightsMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const trafficPoolRef = useRef<THREE.Group[]>([]);
  const wheelsRef = useRef<THREE.Group[]>([]);
  
  // Effects
  const smokeParticlesRef = useRef<THREE.Group | null>(null);
  const skidMarksRef = useRef<THREE.InstancedMesh | null>(null);
  const skidMarkIndexRef = useRef(0);
  
  // Instanced Meshes for City
  const buildingsRef = useRef<THREE.InstancedMesh | null>(null);
  const sidewalksRef = useRef<THREE.InstancedMesh | null>(null); 
  const groundRef = useRef<THREE.Mesh | null>(null);

  const lastGridRef = useRef<{x: number, z: number} | null>(null);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(COLORS.sky);
    scene.background = skyColor; 
    scene.fog = new THREE.Fog(COLORS.sky, 80, 250);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- LIGHTING ---
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.5);
    dirLight.position.set(100, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    const d = 80;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // --- GROUND ---
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x334155, 
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundRef.current = ground;

    // --- SKID MARKS SYSTEM ---
    // Using InstancedMesh for performance. A skid mark is a small flat plane.
    const skidGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const skidMat = new THREE.MeshBasicMaterial({ 
        color: 0x111111, 
        transparent: true, 
        opacity: 0.6,
        depthWrite: false, // Prevent z-fighting somewhat
        polygonOffset: true,
        polygonOffsetFactor: -1 // Draw on top of ground
    });
    const maxSkids = 1000;
    const skidMarks = new THREE.InstancedMesh(skidGeo, skidMat, maxSkids);
    skidMarks.rotation.x = -Math.PI/2;
    skidMarks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(skidMarks);
    skidMarksRef.current = skidMarks;
    
    // Initialize skidmarks off-screen
    const dummyMat = new THREE.Matrix4();
    dummyMat.setPosition(0, -100, 0);
    for (let i = 0; i < maxSkids; i++) {
        skidMarks.setMatrixAt(i, dummyMat);
    }
    skidMarks.instanceMatrix.needsUpdate = true;


    // --- SMOKE SYSTEM ---
    const smokeGroup = new THREE.Group();
    scene.add(smokeGroup);
    smokeParticlesRef.current = smokeGroup;

    // --- CITY GEOMETRY ---
    const diameter = (MAP.RENDER_DISTANCE * 2 + 1);
    const maxBuildings = diameter * diameter;

    // Sidewalks
    const sidewalkWidth = MAP.BLOCK_SIZE - MAP.ROAD_WIDTH;
    const sidewalkGeo = new THREE.BoxGeometry(1, 0.4, 1);
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const sidewalks = new THREE.InstancedMesh(sidewalkGeo, sidewalkMat, maxBuildings);
    sidewalks.receiveShadow = true;
    scene.add(sidewalks);
    sidewalksRef.current = sidewalks;

    // Buildings
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.5 
    }); 
    const buildings = new THREE.InstancedMesh(boxGeo, boxMat, maxBuildings);
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    scene.add(buildings);
    buildingsRef.current = buildings;


    // --- PLAYER CAR ---
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    // Car Body
    const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.6, 4.2),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.6 })
    );
    chassis.position.y = 0.6;
    chassis.castShadow = true;
    carGroup.add(chassis);
    
    // Windshield/Cabin
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.6, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.9 })
    );
    cabin.position.set(0, 1.15, -0.3);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // TAIL LIGHTS
    const tailLightGeo = new THREE.BoxGeometry(0.6, 0.2, 0.1);
    const tailLightMat = new THREE.MeshStandardMaterial({ 
        color: 0x550000, 
        emissive: 0x000000,
        emissiveIntensity: 0
    });
    brakeLightsMatRef.current = tailLightMat;

    const leftLight = new THREE.Mesh(tailLightGeo, tailLightMat);
    leftLight.position.set(-0.6, 0.7, 2.1);
    carGroup.add(leftLight);

    const rightLight = new THREE.Mesh(tailLightGeo, tailLightMat);
    rightLight.position.set(0.6, 0.7, 2.1);
    carGroup.add(rightLight);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.35, 24);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const positions = [
        { x: -1, z: 1.3 }, { x: 1, z: 1.3 }, 
        { x: -1, z: -1.3 }, { x: 1, z: -1.3 } // Fixed: Changed last coordinate x from -1 to 1
    ];
    positions.forEach(pos => {
        const wGroup = new THREE.Group();
        const tire = new THREE.Mesh(wheelGeo, wheelMat);
        tire.rotation.z = Math.PI/2;
        tire.castShadow = true;
        wGroup.add(tire);
        wGroup.position.set(pos.x, 0.35, pos.z);
        carGroup.add(wGroup);
        wheelsRef.current.push(wGroup);
    });

    // --- TRAFFIC POOL ---
    const trafficGroup = new THREE.Group();
    scene.add(trafficGroup);
    
    const maxTraffic = TRAFFIC_SETTINGS.COUNT + 5;
    for(let i=0; i<maxTraffic; i++) {
        const grp = new THREE.Group();
        
        const bodyColor = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4), bodyColor);
        body.position.y = 0.6;
        body.castShadow = true;
        body.receiveShadow = true;
        
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        top.position.set(0, 1.15, 0);
        
        grp.add(body);
        grp.add(top);
        
        grp.visible = false;
        trafficGroup.add(grp);
        trafficPoolRef.current.push(grp);
    }

    const handleResize = () => {
        if (!containerRef.current || !camera || !renderer) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (containerRef.current) containerRef.current.innerHTML = '';
        renderer.dispose();
    };
  }, []);

  // --- ANIMATION LOOP ---
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  useEffect(() => {
      if (!rendererRef.current || !sceneRef.current) return;
      
      const dummy = new THREE.Object3D();
      const colorHelper = new THREE.Color();
      const smokeTexture = createSmokeTexture();
      const smokeMaterial = new THREE.SpriteMaterial({ 
          map: smokeTexture, 
          transparent: true, 
          opacity: 0.4, 
          color: 0xeeeeee 
      });

      const animate = () => {
          const state = stateRef.current;
          const { x, z, heading, speed, steeringInput, traffic, brakePosition, gasPosition, rpm, tireSlip, isStalled } = state;

          // 1. Update Player Car
          if (carGroupRef.current) {
              carGroupRef.current.position.set(x, 0, z);
              carGroupRef.current.rotation.y = heading + Math.PI;
              
              const roll = steeringInput * (Math.abs(speed)/250);
              
              // Add stall shake if recently stalled or random flicker
              let stallShake = 0;
              if (isStalled && Math.random() > 0.5) {
                  stallShake = (Math.random() - 0.5) * 0.05;
              }

              const pitch = (gasPosition * 0.02) - (brakePosition * 0.03) + stallShake;

              carGroupRef.current.rotation.z = -roll;
              carGroupRef.current.rotation.x = -pitch;
          }

          // 2. VISUAL EFFECTS: SMOKE & SKIDMARKS
          if (tireSlip > 0.2 && Math.abs(speed) > 1) {
              // A. Spawn Smoke
              // Only spawn occasionally to save FPS
              if (Math.random() > 0.6 && smokeParticlesRef.current) {
                  // Rear wheels position relative to car
                  const wheelOffsetZ = -1.3;
                  // Left and Right wheels
                  const xOffsets = [-1, 1];
                  
                  xOffsets.forEach(xOffset => {
                      const sprite = new THREE.Sprite(smokeMaterial);
                      
                      // Calculate world pos of rear tires
                      const wx = x + Math.sin(heading + Math.PI/2) * xOffset + Math.sin(heading) * wheelOffsetZ;
                      const wz = z + Math.cos(heading + Math.PI/2) * xOffset + Math.cos(heading) * wheelOffsetZ;
                      
                      sprite.position.set(wx, 0.2, wz);
                      // Randomize slightly
                      sprite.position.x += (Math.random() - 0.5) * 0.5;
                      sprite.position.z += (Math.random() - 0.5) * 0.5;
                      
                      sprite.scale.set(0.5, 0.5, 0.5);
                      
                      // Add custom data for animation
                      (sprite as any).userData = { life: 1.0, vy: 0.02 + Math.random()*0.02 };
                      smokeParticlesRef.current?.add(sprite);
                  });
              }

              // B. Spawn Skid Marks
              if (skidMarksRef.current) {
                   const wheelOffsetZ = -1.3;
                   const xOffsets = [-1, 1];
                   
                   xOffsets.forEach(xOffset => {
                       const i = skidMarkIndexRef.current;
                       const wx = x + Math.sin(heading + Math.PI/2) * xOffset + Math.sin(heading) * wheelOffsetZ;
                       const wz = z + Math.cos(heading + Math.PI/2) * xOffset + Math.cos(heading) * wheelOffsetZ;
                       
                       dummy.position.set(wx, 0.02, wz);
                       dummy.rotation.set(-Math.PI/2, 0, heading);
                       dummy.scale.set(1, 1, 1); // 0.4x0.4 plane
                       dummy.updateMatrix();
                       
                       skidMarksRef.current!.setMatrixAt(i, dummy.matrix);
                       
                       skidMarkIndexRef.current = (skidMarkIndexRef.current + 1) % 1000;
                   });
                   skidMarksRef.current.instanceMatrix.needsUpdate = true;
              }
          }

          // Animate Smoke
          if (smokeParticlesRef.current) {
              for (let i = smokeParticlesRef.current.children.length - 1; i >= 0; i--) {
                  const p = smokeParticlesRef.current.children[i] as THREE.Sprite;
                  p.userData.life -= 0.02; // Fade speed
                  p.position.y += p.userData.vy;
                  const scale = 0.5 + (1.0 - p.userData.life) * 2; // Expand
                  p.scale.set(scale, scale, scale);
                  (p.material as THREE.SpriteMaterial).opacity = p.userData.life * 0.4;
                  
                  if (p.userData.life <= 0) {
                      smokeParticlesRef.current.remove(p);
                  }
              }
          }


          // 3. Brake Lights
          if (brakeLightsMatRef.current) {
              if (brakePosition > 0.1) {
                  brakeLightsMatRef.current.color.setHex(0xff0000);
                  brakeLightsMatRef.current.emissive.setHex(0xff0000);
                  brakeLightsMatRef.current.emissiveIntensity = 2;
              } else {
                  brakeLightsMatRef.current.color.setHex(0x550000);
                  brakeLightsMatRef.current.emissive.setHex(0x000000);
                  brakeLightsMatRef.current.emissiveIntensity = 0;
              }
          }

          // 4. Wheels
          wheelsRef.current.forEach((w, i) => {
              w.children[0].rotation.x += speed * 0.01;
              if (i < 2) w.rotation.y = steeringInput * 0.6;
          });

          // 5. Camera Follow & Effects
          if (cameraRef.current) {
              const baseDist = 8;
              const speedEffect = Math.abs(speed) / 200; // 0 to ~1
              
              // Camera Pullback
              const dist = baseDist + (speedEffect * 3);
              
              // Dynamic FOV
              const targetFOV = 60 + (speedEffect * 30); // 60 to 90
              cameraRef.current.fov += (targetFOV - cameraRef.current.fov) * 0.1;
              cameraRef.current.updateProjectionMatrix();

              // Shake
              const rpmShake = (rpm > 6000) ? (Math.random() - 0.5) * 0.05 : 0;
              const speedShake = (speed > 150) ? (Math.random() - 0.5) * 0.02 : 0;

              const cx = x + Math.sin(heading) * dist;
              const cz = z + Math.cos(heading) * dist;
              
              cameraRef.current.position.x += (cx - cameraRef.current.position.x) * 0.1 + rpmShake;
              cameraRef.current.position.z += (cz - cameraRef.current.position.z) * 0.1 + rpmShake;
              cameraRef.current.position.y = 4.5 + speedShake;
              cameraRef.current.lookAt(x, 1.5, z);
          }

          // 6. Ground Follow
          if (groundRef.current) {
              groundRef.current.position.set(x, -0.1, z);
          }

          // 7. City Generation
          if (buildingsRef.current && sidewalksRef.current) {
            const currentGridX = Math.round(x / MAP.BLOCK_SIZE);
            const currentGridZ = Math.round(z / MAP.BLOCK_SIZE);
            
            if (!lastGridRef.current || lastGridRef.current.x !== currentGridX || lastGridRef.current.z !== currentGridZ) {
                lastGridRef.current = { x: currentGridX, z: currentGridZ };
                
                let idx = 0;
                const viewRadius = MAP.RENDER_DISTANCE;
                
                for(let i = -viewRadius; i <= viewRadius; i++) {
                    for(let j = -viewRadius; j <= viewRadius; j++) {
                        const bx = (currentGridX + i) * MAP.BLOCK_SIZE + MAP.BLOCK_SIZE * 0.5;
                        const bz = (currentGridZ + j) * MAP.BLOCK_SIZE + MAP.BLOCK_SIZE * 0.5;
                        const hash = Math.abs(Math.sin(bx * 12.9898 + bz * 78.233) * 43758.5453);
                        
                        // SIDEWALK
                        const swWidth = MAP.BLOCK_SIZE - MAP.ROAD_WIDTH;
                        dummy.position.set(bx, 0.2, bz);
                        dummy.scale.set(swWidth, 1, swWidth);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        sidewalksRef.current.setMatrixAt(idx, dummy.matrix);

                        // BUILDING
                        const height = MAP.BUILDING_HEIGHT_MIN + (hash % 1) * (MAP.BUILDING_HEIGHT_MAX - MAP.BUILDING_HEIGHT_MIN);
                        const bWidth = swWidth - 4; 
                        
                        dummy.position.set(bx, height/2 + 0.4, bz);
                        dummy.scale.set(bWidth, height, bWidth);
                        dummy.updateMatrix();
                        buildingsRef.current.setMatrixAt(idx, dummy.matrix);

                        const hue = (hash * 10) % 1; 
                        colorHelper.setHSL(0.6 + hue * 0.1, 0.5, 0.3 + (hash % 0.5));
                        buildingsRef.current.setColorAt(idx, colorHelper);

                        idx++;
                    }
                }
                buildingsRef.current.count = idx;
                buildingsRef.current.instanceMatrix.needsUpdate = true;
                buildingsRef.current.instanceColor!.needsUpdate = true;
                sidewalksRef.current.count = idx;
                sidewalksRef.current.instanceMatrix.needsUpdate = true;
            }
          }

          // 8. Traffic Pooling
          trafficPoolRef.current.forEach(t => t.visible = false);
          traffic.forEach((tCar, i) => {
              if (i < trafficPoolRef.current.length) {
                  const mesh = trafficPoolRef.current[i];
                  mesh.visible = true;
                  mesh.position.set(tCar.x, 0, tCar.z);
                  mesh.rotation.y = tCar.heading + Math.PI;
                  
                  const bodyMesh = mesh.children[0] as THREE.Mesh;
                  const mat = bodyMesh.material as THREE.MeshStandardMaterial;
                  if (mat.color.getHexString() !== tCar.color.replace('#', '')) {
                       mat.color.set(tCar.color);
                  }
              }
          });

          rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
          requestAnimationFrame(animate);
      };
      
      const frameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frameId);
  }, []); 

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};

export default Scene3D;