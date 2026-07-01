import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { signTexture, silhouetteTexture } from './textures';

const TEX = import.meta.env.BASE_URL + 'textures/';
// la textura ya es ladrillo rojo real (Bricks023); tinte casi neutro cálido
const BRICK_TINT = '#e8d8d0';

// Clona y configura una textura PBR (repetición, espacio de color, anisotropía).
function cfgTex(t: THREE.Texture, rx: number, ry: number, srgb = false): THREE.Texture {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  c.anisotropy = 8;
  c.needsUpdate = true;
  return c;
}
import Discover from '../Discover';
import History from '../History';
import './experience.css';

type Phase = 'landing' | 'fork' | 'discover' | 'history';

// Posiciones de cámara por fase (a la altura de una persona, DENTRO del espacio).
const POSES: Record<Phase, { pos: [number, number, number]; look: [number, number, number] }> = {
  landing: { pos: [0, 4, 10.5], look: [0, -1.2, 3.5] },    // mirando ABAJO por la escalera
  fork: { pos: [0, -2.4, -17], look: [0, -1.4, -22] },      // en la bifurcación
  discover: { pos: [-2, -2.6, -24.5], look: [0, -2.2, -40] },
  history: { pos: [2, -2.6, -24.5], look: [0, -2.2, -40] },
};

function CameraRig({ phase }: { phase: Phase }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(...POSES.landing.look));
  const base = useRef(new THREE.Vector3(...POSES.landing.pos));
  const off = useRef(new THREE.Vector2(0, 0)); // parallax suavizado
  useFrame((state, dt) => {
    const p = POSES[phase];
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.05));
    base.current.lerp(new THREE.Vector3(...p.pos), k);
    look.current.lerp(new THREE.Vector3(...p.look), k);
    // cámara libre MUY sutil: pequeño parallax según el ratón
    const amt = phase === 'landing' ? 0.5 : 0.4;
    off.current.lerp(new THREE.Vector2(state.pointer.x * amt, state.pointer.y * amt * 0.5), 0.05);
    camera.position.set(base.current.x + off.current.x, base.current.y + off.current.y, base.current.z);
    camera.lookAt(look.current);
  });
  return null;
}

function BrickBox({ args, position, rotation, repeat = [2, 1] }: {
  args: [number, number, number]; position: [number, number, number];
  rotation?: [number, number, number]; repeat?: [number, number];
}) {
  const [col, nor, rgh] = useTexture([TEX + 'brick_color.jpg', TEX + 'brick_normal.jpg', TEX + 'brick_rough.jpg']);
  const m = useMemo(() => ({
    map: cfgTex(col, repeat[0], repeat[1], true),
    normalMap: cfgTex(nor, repeat[0], repeat[1]),
    roughnessMap: cfgTex(rgh, repeat[0], repeat[1]),
  }), [col, nor, rgh, repeat[0], repeat[1]]);
  return (
    <mesh position={position} rotation={rotation} receiveShadow castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial {...m} color={BRICK_TINT} roughness={1} metalness={0}
        normalScale={new THREE.Vector2(1.1, 1.1)} />
    </mesh>
  );
}

// Suelo de piedra PBR.
function Floor({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const [col, nor, rgh] = useTexture([TEX + 'floor_color.jpg', TEX + 'floor_normal.jpg', TEX + 'floor_rough.jpg']);
  const rx = size[0] / 3.5, ry = size[1] / 3.5;
  const m = useMemo(() => ({
    map: cfgTex(col, rx, ry, true), normalMap: cfgTex(nor, rx, ry), roughnessMap: cfgTex(rgh, rx, ry),
  }), [col, nor, rgh, rx, ry]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial {...m} color="#b8b8b8" roughness={1} metalness={0} />
    </mesh>
  );
}

// Hueco de escalera estilo fábrica: muros altos que encierran, peldaños,
// barandilla y pared del fondo con un vano que da al túnel.
function Stairwell() {
  const steps = 14;
  const yTop = 1.8, yBot = -3.8, zTop = 9, zBot = 2.6;
  const dz = (zTop - zBot) / steps;
  const metal = { color: '#26282c', metalness: 0.85, roughness: 0.4 };
  return (
    <group>
      {/* muros laterales altos */}
      <BrickBox args={[0.5, 9, 8]} position={[-2.9, -0.5, 5.6]} repeat={[4, 5]} />
      <BrickBox args={[0.5, 9, 8]} position={[2.9, -0.5, 5.6]} repeat={[4, 5]} />
      {/* peldaños (huella + contrahuella) */}
      {Array.from({ length: steps }).map((_, i) => {
        const f = i / (steps - 1);
        const y = yTop - f * (yTop - yBot);
        const z = zTop - f * (zTop - zBot);
        return (
          <group key={i}>
            <BrickBox args={[5, 0.16, dz + 0.2]} position={[0, y, z]} repeat={[3, 1]} />
            <BrickBox args={[5, 0.42, 0.14]} position={[0, y - 0.27, z - dz / 2]} repeat={[3, 1]} />
          </group>
        );
      })}
      {/* barandilla metálica: postes sobre los escalones y pasamanos ENCIMA */}
      {(() => {
        const dy = yTop - yBot, dz = zTop - zBot;
        const ang = Math.atan2(dz, dy);           // inclinación del pasamanos
        const L = Math.hypot(dy, dz) + 0.4;
        const postH = 1.0;
        return [-2.3, 2.3].map((x) => (
          <group key={x}>
            {/* pasamanos, a la altura del tope de los postes */}
            <mesh position={[x, (yTop + yBot) / 2 + postH, (zTop + zBot) / 2]} rotation={[ang, 0, 0]}>
              <cylinderGeometry args={[0.06, 0.06, L, 10]} />
              <meshStandardMaterial {...metal} />
            </mesh>
            {/* postes verticales, de cada escalón hacia arriba */}
            {Array.from({ length: 8 }).map((_, i) => {
              const f = i / 7, z = zTop - f * dz, sy = yTop - f * dy;
              return (
                <mesh key={i} position={[x, sy + postH / 2, z]}>
                  <cylinderGeometry args={[0.045, 0.045, postH, 8]} />
                  <meshStandardMaterial {...metal} />
                </mesh>
              );
            })}
          </group>
        ));
      })()}
      {/* pared del fondo (z=2) con vano hacia el túnel */}
      <BrickBox args={[2.0, 9, 0.5]} position={[-2.6, -0.5, 2]} repeat={[1, 5]} />
      <BrickBox args={[2.0, 9, 0.5]} position={[2.6, -0.5, 2]} repeat={[1, 5]} />
      <BrickBox args={[8, 3, 0.5]} position={[0, 2.5, 2]} repeat={[4, 1]} />
    </group>
  );
}

// Lámpara industrial cálida colgada (como la foto de referencia de la entrada).
function IndustrialLamp({ position }: { position: [number, number, number] }) {
  const bulb = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (bulb.current) bulb.current.intensity = 16 + Math.sin(clock.elapsedTime * 9) * 1.5;
  });
  return (
    <group position={position}>
      {/* brazo a la pared */}
      <mesh position={[0, 0.5, -0.4]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
        <meshStandardMaterial color="#1b1b1e" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* pantalla acampanada */}
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.42, 0.4, 20, 1, true]} />
        <meshStandardMaterial color="#33373b" metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* bombilla cálida (color >1 para resplandor/bloom) */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color={[3, 2, 1]} toneMapped={false} />
      </mesh>
      <pointLight ref={bulb} position={[0, -0.1, 0]} color="#ffb262" distance={13} intensity={34} castShadow />
    </group>
  );
}

// Túnel abovedado y SELLADO (suelo, paredes, bóveda de medio cañón opaca).
function Tunnel() {
  const [vCol, vNor, vRgh] = useTexture([TEX + 'brick_color.jpg', TEX + 'brick_normal.jpg', TEX + 'brick_rough.jpg']);
  const vault = useMemo(() => ({
    map: cfgTex(vCol, 10, 4, true), normalMap: cfgTex(vNor, 10, 4), roughnessMap: cfgTex(vRgh, 10, 4),
  }), [vCol, vNor, vRgh]);
  return (
    <group>
      {/* suelo de piedra PBR — cubre corredor y sala */}
      <Floor position={[0, -4, -12]} size={[16, 64]} />
      {/* paredes del corredor (del pie de la escalera a la bifurcación) */}
      <BrickBox args={[0.4, 6, 24]} position={[-4, -1, -10]} repeat={[5, 2]} />
      <BrickBox args={[0.4, 6, 24]} position={[4, -1, -10]} repeat={[5, 2]} />
      {/* bóveda de medio cañón sobre el corredor (empieza pasado el pie de la escalera) */}
      <mesh position={[0, 2, -10]}>
        <cylinderGeometry args={[4, 4, 24, 28, 1, true, 0, Math.PI]} />
        <meshStandardMaterial {...vault} color={BRICK_TINT} roughness={1} metalness={0} side={THREE.BackSide} />
      </mesh>
      {/* arcos de ladrillo repetidos (estilo bodega industrial) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`arch-${i}`} position={[0, 2, -1 - i * 2.7]} castShadow>
          <torusGeometry args={[3.96, 0.45, 12, 28, Math.PI]} />
          <meshStandardMaterial color="#4e201c" roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* tapa plana por encima de la bóveda */}
      <mesh position={[0, 6, -10]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 24]} />
        <meshStandardMaterial color="#0a0c10" side={THREE.DoubleSide} />
      </mesh>
      {/* pared del fondo (bifurcación): pilar central + laterales → 2 huecos en x≈±2 */}
      <BrickBox args={[1.0, 6, 0.4]} position={[0, -1, -22]} repeat={[1, 2]} />
      <BrickBox args={[1.0, 6, 0.4]} position={[-3.5, -1, -22]} repeat={[1, 2]} />
      <BrickBox args={[1.0, 6, 0.4]} position={[3.5, -1, -22]} repeat={[1, 2]} />
      <BrickBox args={[8, 1.6, 0.4]} position={[0, 1.6, -22]} repeat={[4, 1]} />
      {/* pared del fondo de la sala (tras el escenario) */}
      <BrickBox args={[12, 8, 0.4]} position={[0, -1, -41]} repeat={[6, 3]} />
    </group>
  );
}

// Cartel de la entrada: placa metálica + foco que la enfoca.
function EntranceSign() {
  const tex = useMemo(() => signTexture('CHUPITBEATS'), []);
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  return (
    <group>
      {/* cartel sobre el vano de la entrada (dintel) */}
      <mesh position={[0, 2.6, 2.5]}>
        <planeGeometry args={[3.6, 0.95]} />
        <meshStandardMaterial map={tex} roughness={0.6} metalness={0.4}
          emissive="#8a929c" emissiveMap={tex} emissiveIntensity={0.25} />
      </mesh>
      {/* foco que lo enfoca desde arriba-delante */}
      <object3D ref={target} position={[0, 2.6, 2.5]} />
      <spotLight ref={light} position={[0, 4.5, 6]} angle={0.5} penumbra={0.5}
        distance={14} intensity={20} color="#ffdba0" />
    </group>
  );
}

function CurtainDoor({ x, label, accent, onClick }: {
  x: number; label: string; accent: string; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const sign = useMemo(() => signTexture(label, accent === '#00ffcc' ? '#9ff5e6' : '#ffb8c8'), [label, accent]);
  return (
    <group position={[x, -1, -21.7]}>
      <mesh
        onClick={onClick}
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      >
        <planeGeometry args={[2, 5, 16, 24]} />
        <meshStandardMaterial color={hover ? '#b8253c' : '#7d1222'} roughness={0.75} metalness={0.05}
          emissive="#5a0010" emissiveIntensity={hover ? 0.6 : 0.32} side={THREE.DoubleSide} />
      </mesh>
      {/* foco blanco-cálido que ilumina la cortina + halo del color de la sección */}
      <pointLight position={[0, 0.8, 1.8]} color="#ffe6ea" distance={7} intensity={hover ? 16 : 11} />
      <pointLight position={[0, 1.6, 1.2]} color={accent} distance={5} intensity={hover ? 10 : 5} />
      <mesh position={[0, 2.75, 0.15]}>
        <planeGeometry args={[2.2, 0.62]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function RaveLights({ on }: { on: boolean }) {
  const colors = ['#ff2d6b', '#00ffcc', '#4b9bff', '#b46bff', '#ff8a3d'];
  const targets = useRef<THREE.Object3D[]>([]);
  const lights = useRef<THREE.SpotLight[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    targets.current.forEach((tg, i) => {
      if (tg) tg.position.set(Math.sin(t * (0.8 + i * 0.3) + i) * 4, -4, -33 + Math.cos(t * (0.6 + i * 0.2)) * 4);
    });
    lights.current.forEach((l, i) => { if (l) l.intensity = on ? 45 + Math.sin(t * 6 + i) * 30 : 0; });
  });
  return (
    <group>
      {colors.map((c, i) => (
        <group key={i}>
          <object3D ref={(o) => { if (o) targets.current[i] = o; }} position={[0, -4, -33]} />
          <spotLight
            ref={(l) => { if (l) { lights.current[i] = l; l.target = targets.current[i] ?? l.target; } }}
            position={[-3 + i * 1.6, 1.6, -34 + (i % 2) * 4]}
            color={c} angle={0.5} penumbra={0.7} distance={28} intensity={0}
          />
        </group>
      ))}
    </group>
  );
}

function Crowd() {
  const sprites = useMemo(() => Array.from({ length: 26 }).map((_, i) => ({
    tex: silhouetteTexture(i), x: -3.4 + Math.random() * 6.8, z: -26 - Math.random() * 9,
    s: 1.5 + Math.random() * 0.7, ph: Math.random() * Math.PI * 2, sp: 4 + Math.random() * 4,
  })), []);
  const refs = useRef<THREE.Sprite[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((s, i) => {
      if (s) s.position.y = -3.4 + Math.abs(Math.sin(t * sprites[i].sp + sprites[i].ph)) * 0.5;
    });
  });
  return (
    <group>
      {sprites.map((p, i) => (
        <sprite key={i} ref={(s) => { if (s) refs.current[i] = s; }}
          position={[p.x, -3.4, p.z]} scale={[p.s * 0.6, p.s, 1]}>
          <spriteMaterial map={p.tex} transparent opacity={0.92} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

// Sala rave CERRADA: paredes laterales, techo industrial, fondo, escenario y DJ.
function RaveRoom() {
  return (
    <group>
      {/* paredes laterales de la sala (más ancha que el corredor) */}
      <BrickBox args={[0.4, 8, 20]} position={[-6, 0, -32]} repeat={[4, 2]} />
      <BrickBox args={[0.4, 8, 20]} position={[6, 0, -32]} repeat={[4, 2]} />
      {/* conectores de la pared de la bifurcación a la sala (ensanche) */}
      <BrickBox args={[4, 8, 0.4]} position={[-5, 0, -23]} repeat={[2, 2]} />
      <BrickBox args={[4, 8, 0.4]} position={[5, 0, -23]} repeat={[2, 2]} />
      {/* techo industrial (cierra la sala) */}
      <mesh position={[0, 4, -32]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 20]} />
        <meshStandardMaterial color="#0c0f13" roughness={0.9} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* vigas del techo */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 3.8, -24 - i * 4]}>
          <boxGeometry args={[12, 0.3, 0.3]} />
          <meshStandardMaterial color="#16191e" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* líneas de neón rojo en el techo (estilo Cover.jpg) — color >1 para que haga bloom */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={`n${i}`} position={[0, 3.7, -25 - i * 4.5]}>
          <boxGeometry args={[10, 0.1, 0.1]} />
          <meshBasicMaterial color={[3.2, 0.18, 0.4]} toneMapped={false} />
        </mesh>
      ))}
      {/* escenario al fondo */}
      <mesh position={[0, -3.4, -40]} castShadow receiveShadow>
        <boxGeometry args={[8, 1.2, 2.4]} />
        <meshStandardMaterial color="#0c0e12" roughness={0.8} metalness={0.3} />
      </mesh>
      {/* cabina/mesa de DJ */}
      <mesh position={[0, -2.4, -38.8]} castShadow>
        <boxGeometry args={[3, 1, 0.9]} />
        <meshStandardMaterial color="#0a0c10" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* DJ (silueta) */}
      <mesh position={[0, -1.4, -39.6]}>
        <capsuleGeometry args={[0.32, 0.9, 4, 8]} />
        <meshStandardMaterial color="#04050a" />
      </mesh>
      {/* pantalla retroiluminada tras el DJ */}
      <mesh position={[0, -0.6, -41.6]}>
        <planeGeometry args={[7, 4]} />
        <meshBasicMaterial color="#10243a" toneMapped={false} />
      </mesh>
      {/* altavoces a los lados (Cover.jpg) */}
      {[-3.4, 3.4].map((x) => (
        <mesh key={x} position={[x, -2.6, -39.6]} castShadow>
          <boxGeometry args={[1.2, 2.6, 1.2]} />
          <meshStandardMaterial color="#0a0b0e" roughness={0.7} />
        </mesh>
      ))}
      {/* luces de relleno para que la sala se entienda (mood rave) */}
      <pointLight position={[0, 2, -30]} color="#ff2d6b" distance={20} intensity={18} />
      <pointLight position={[-4, 0, -34]} color="#4b9bff" distance={16} intensity={12} />
      <pointLight position={[4, 0, -28]} color="#b46bff" distance={16} intensity={12} />
      {/* contraluz del DJ */}
      <pointLight position={[0, 0.4, -41]} color="#ff3355" distance={13} intensity={26} />
      <pointLight position={[0, -1.5, -38]} color="#ffd0d0" distance={8} intensity={10} />
    </group>
  );
}

function FlickerBulb({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.elapsedTime;
      ref.current.intensity = 7 + Math.sin(t * 28) * (Math.random() > 0.5 ? 1.5 : 3) * (Math.random() > 0.03 ? 1 : 0.3);
    }
  });
  return <pointLight ref={ref} position={position} color="#aebfcc" distance={18} intensity={14} castShadow />;
}

function Scene({ phase, go }: { phase: Phase; go: (p: Phase) => void }) {
  const inRoom = phase === 'discover' || phase === 'history';
  return (
    <>
      <CameraRig phase={phase} />
      <fogExp2 attach="fog" args={['#0c1218', 0.016]} />
      {/* iluminación base tenue (con PBR+ACES poca luz cunde mucho) */}
      <ambientLight color="#6a7d8e" intensity={0.28} />
      <hemisphereLight color="#7689a0" groundColor="#1c1416" intensity={0.3} />
      {/* luz fría de la "calle" entrando por arriba de las escaleras */}
      <directionalLight position={[3, 12, 18]} intensity={0.55} color="#aac0d4" />
      {/* bombillas del corredor */}
      <FlickerBulb position={[0, 1.4, -4]} />
      <pointLight position={[0, 1.2, -12]} color="#bcd0dd" distance={16} intensity={9} />
      <pointLight position={[0, 0.5, -19]} color="#d4be92" distance={13} intensity={7} />

      <Stairwell />
      <IndustrialLamp position={[0, 1.3, 2.7]} />
      <Tunnel />
      <EntranceSign />
      <CurtainDoor x={-2} label="DISCOVERY" accent="#00ffcc" onClick={() => go('discover')} />
      <CurtainDoor x={2} label="HISTORIAL" accent="#ff2d6b" onClick={() => go('history')} />
      <RaveRoom />
      <Crowd />
      <RaveLights on={inRoom} />
    </>
  );
}

export default function Experience() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [fade, setFade] = useState(false);

  const go = (p: Phase) => {
    setFade(true);
    window.setTimeout(() => setPhase(p), 350);
    window.setTimeout(() => setFade(false), 800);
  };

  useEffect(() => {
    if (phase !== 'landing') return;
    // bajar SOLO con scroll (acumula un poco para que sea un gesto deliberado)
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      acc += e.deltaY;
      if (acc > 120) { window.removeEventListener('wheel', onWheel); go('fork'); }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [phase]);

  const inRoom = phase === 'discover' || phase === 'history';

  return (
    <div className="xp-root">
      <Canvas camera={{ position: POSES.landing.pos, fov: 62, near: 0.5, far: 150 }} dpr={[1, 1.5]}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, antialias: true }}>
        <color attach="background" args={['#070b0f']} />
        <Suspense fallback={null}>
          <Scene phase={phase} go={go} />
        </Suspense>
        {/* post-procesado: glow de neón/luces (técnica Unreal Bloom de three.js) */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.7} radius={0.7} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.85} />
        </EffectComposer>
      </Canvas>

      <div className={`xp-fade ${fade ? 'on' : ''}`} />

      {phase === 'landing' && <div className="xp-hint">baja al subterráneo · haz scroll ↓</div>}
      {phase === 'fork' && <div className="xp-hint">elige una puerta</div>}

      {inRoom && (
        <div className="room-overlay">
          <button className="xp-back" onClick={() => go('fork')}>← volver a la bifurcación</button>
          <div className="room-panel">
            {phase === 'discover' ? <Discover /> : <History />}
          </div>
        </div>
      )}
    </div>
  );
}
