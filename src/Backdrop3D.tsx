import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// Posición del ratón (normalizada) — el canvas es pointer-events:none, así que
// escuchamos en window. Sirve para un parallax MUY suave (nada de mareo).
const mouse = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth - 0.5;
    mouse.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
}

// Campo de partículas: giro MUY lento, casi ambiental.
function Particles() {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const n = 2200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 24;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.008;  // muy lento
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.035} color="#c6ff2e" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// Icosaedro wireframe: rotación lenta y constante (sin acelerones por scroll).
function Shape() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.04;
    ref.current.rotation.x += dt * 0.02;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.7, 1]} />
      <meshBasicMaterial color="#e8392f" wireframe transparent opacity={0.28} />
    </mesh>
  );
}

// Parallax suavísimo de cámara con el ratón (da profundidad sin marear).
function Rig() {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.x += (mouse.x * 0.9 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.y * 0.6 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function Backdrop3D() {
  return (
    <div className="backdrop3d">
      <Canvas camera={{ position: [0, 0, 8], fov: 55 }} dpr={[1, 1.6]}>
        <Rig />
        <Particles />
        <Shape />
        <EffectComposer>
          <Bloom luminanceThreshold={0.05} intensity={0.7} radius={0.6} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
