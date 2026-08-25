/**
 * Escenarios 3D, uno por emisora, todos con sabor PlayStation 1.
 *
 *   lofi     → la habitación de estudio, de noche y con lluvia en el cristal
 *   house    → la playa al atardecer, con el mar moviéndose al ritmo
 *   schranz  → el callejón pintado de arriba abajo
 *
 * Claudy, la mascota, flota en los tres.
 *
 * El look de PS1 sale de cuatro cosas, no de los modelos:
 *   1. render a 320×180 escalado con filtro nearest (píxel gordo),
 *   2. vértices "snapeados" a una rejilla en espacio de recorte (el temblor),
 *   3. iluminación plana y texturas sin filtrar,
 *   4. cuantización de color, grano y un punto de ojo de pez al final.
 */
import * as THREE from 'three'
import type { Genre } from './composer'

const RES_W = 320
const RES_H = 180

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const choice = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

/* ══ material PS1 ══════════════════════════════════════════════════════ */

/** Inyecta el temblor de vértices de PS1 en cualquier material estándar. */
function ps1(material: THREE.Material, jitter = 96) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uJitter = { value: jitter }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uJitter;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec2 grid = vec2(uJitter, uJitter * 0.5625);
         gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grid) / grid * gl_Position.w;`,
      )
  }
  material.needsUpdate = true
  return material
}

const flat = (color: number, o: THREE.MeshLambertMaterialParameters = {}) =>
  ps1(new THREE.MeshLambertMaterial({ color, ...o }))

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color))
  mesh.position.set(x, y, z)
  return mesh
}

function plane(w: number, h: number, color: number) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }))
}

/* ══ Claudy ════════════════════════════════════════════════════════════ */

const CLAUDY_ORANGE = 0xe8794a

/**
 * Claudy: cuerpo naranja, dos ojos oscuros y cuatro patitas. Flota, se gira y
 * rebota con el bombo. Es el mismo bicho en los tres escenarios.
 */
function makeClaudy(scale = 1) {
  const group = new THREE.Group()
  const skin = new THREE.MeshBasicMaterial({ color: CLAUDY_ORANGE })
  const dark = new THREE.MeshBasicMaterial({ color: 0x141210 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.24), skin)
  group.add(body)
  // las dos orejillas laterales del icono
  for (const x of [-0.2, 0.2]) group.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.12), skin).translateX(x))
  // ojos
  for (const x of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.055), dark)
    eye.position.set(x, 0.01, 0.121)
    group.add(eye)
  }
  // cuatro patas
  const legs: THREE.Mesh[] = []
  for (const x of [-0.12, -0.04, 0.04, 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.028), skin)
    leg.position.set(x, -0.16, 0)
    group.add(leg)
    legs.push(leg)
  }
  group.scale.setScalar(scale)

  const home = new THREE.Vector3()
  return {
    group,
    /** Colócalo y olvídate: el resto lo hace `tick`. */
    place(x: number, y: number, z: number) {
      group.position.set(x, y, z)
      home.set(x, y, z)
    },
    tick(t: number, energy: number) {
      group.position.y = home.y + Math.sin(t * 1.6) * 0.08 + energy * 0.16
      group.rotation.y = Math.sin(t * 0.55) * 0.45
      group.rotation.z = Math.sin(t * 1.15) * 0.07
      // patalea un poco cuando la música aprieta
      for (let i = 0; i < legs.length; i++) {
        legs[i].rotation.x = Math.sin(t * 6 + i * 1.4) * (0.1 + energy * 0.5)
      }
      group.scale.setScalar(scale * (1 + energy * 0.1))
    },
  }
}

/** Lluvia reutilizable: instancias de plano cayendo dentro de una caja. */
function makeRain(count: number, spread: [number, number, number], top: number, opacity = 0.45) {
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.016, 0.26),
    new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity }),
    count,
  )
  const drops = Array.from({ length: count }, () => ({
    x: rand(-spread[0], spread[0]),
    y: rand(0, top),
    z: rand(-spread[2], spread[1]),
    speed: rand(5, 12),
  }))
  const dummy = new THREE.Object3D()
  return {
    mesh,
    tick(amount: number) {
      const visible = Math.round((amount / 100) * count)
      for (let i = 0; i < count; i++) {
        const d = drops[i]
        if (i < visible) {
          d.y -= d.speed * 0.016
          if (d.y < 0) {
            d.y = top
            d.x = rand(-spread[0], spread[0])
            d.z = rand(-spread[2], spread[1])
          }
          dummy.position.set(d.x, d.y, d.z)
          dummy.scale.set(1, 0.7 + d.speed * 0.07, 1)
        } else {
          dummy.position.set(0, -999, 0)
          dummy.scale.set(1, 1, 1)
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}

interface Kit {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** cuánto ojo de pez le pega a este escenario */
  fisheye: number
  tick(t: number, energy: number, rain: number, playing: boolean): void
}

/* ══ 1 · la habitación (lofi) ══════════════════════════════════════════ */

function buildRoom(): Kit {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x121a33, 16, 46)
  const camera = new THREE.PerspectiveCamera(52, RES_W / RES_H, 0.1, 60)
  const CAM = new THREE.Vector3(2.1, 1.85, 2.7)
  const LOOK = new THREE.Vector3(-0.15, 1.5, -2.4)

  scene.add(new THREE.AmbientLight(0x4a5480, 2.4))
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x3a2a20, 1.6))
  const moon = new THREE.DirectionalLight(0xa8bcff, 1.9)
  moon.position.set(-2, 4, -8)
  scene.add(moon)
  const deskLamp = new THREE.PointLight(0xffb066, 26, 9, 1.6)
  deskLamp.position.set(-0.6, 1.8, -1.1)
  scene.add(deskLamp)
  const screenLight = new THREE.PointLight(0x7fd8ff, 9, 5, 1.6)
  screenLight.position.set(0.15, 1.55, -1.25)
  scene.add(screenLight)
  const fill = new THREE.PointLight(0xffd6b0, 7, 6, 1.8)
  fill.position.set(1.4, 2.2, 1.2)
  scene.add(fill)

  // habitación
  const room = new THREE.Group()
  scene.add(room)
  room.add(box(9, 0.2, 9, 0x3d3122, 0, -0.1, 0))
  room.add(box(9, 0.2, 9, 0x151020, 0, 4.2, 0))
  room.add(box(0.2, 4.4, 9, 0x503d55, -4.4, 2.1, 0))
  room.add(box(9, 4.4, 0.2, 0x503d55, 0, 2.1, 4.4))

  // pared del fondo con el hueco de la ventana
  const wallColor = 0x5b4460
  room.add(box(9, 1.0, 0.2, wallColor, 0, 0.5, -3.2))
  room.add(box(9, 1.3, 0.2, wallColor, 0, 3.55, -3.2))
  room.add(box(2.6, 2.1, 0.2, wallColor, -3.2, 1.95, -3.2))
  room.add(box(2.6, 2.1, 0.2, wallColor, 3.2, 1.95, -3.2))

  const frame = 0x1b1420
  room.add(box(3.9, 0.14, 0.26, frame, 0, 3.02, -3.19))
  room.add(box(3.9, 0.14, 0.26, frame, 0, 0.95, -3.19))
  room.add(box(0.14, 2.2, 0.26, frame, -1.9, 1.98, -3.19))
  room.add(box(0.14, 2.2, 0.26, frame, 1.9, 1.98, -3.19))
  room.add(box(0.1, 2.1, 0.2, frame, 0, 1.98, -3.19))
  room.add(box(3.8, 0.1, 0.2, frame, 0, 1.98, -3.19))
  room.add(box(4.3, 0.22, 0.5, 0x2b2130, 0, 0.92, -3.05))

  // la ciudad al otro lado
  const windowLights: THREE.Mesh[] = []
  for (let i = 0; i < 22; i++) {
    const w = rand(0.6, 1.7)
    const h = rand(2, 7)
    const b = box(w, h, 0.6, 0x1a2140, rand(-8, 8), h / 2 - 1.2, -9 - rand(0, 8))
    scene.add(b)
    for (let k = 0; k < 5; k++) {
      if (Math.random() > 0.55) continue
      const lit = plane(0.12, 0.16, Math.random() < 0.25 ? 0x9ad8ff : 0xffcf99)
      lit.position.set(b.position.x + rand(-w * 0.35, w * 0.35), rand(0.4, h - 0.4), b.position.z + 0.31)
      scene.add(lit)
      windowLights.push(lit)
    }
  }

  // velo del cristal
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 2.1),
    new THREE.MeshBasicMaterial({ color: 0x2a4a7a, transparent: true, opacity: 0.22 }),
  )
  glass.position.set(0, 1.98, -3.14)
  scene.add(glass)

  const rain = makeRain(220, [1.85, -3.1, -3.14], 3.05, 0.5)
  rain.mesh.position.set(0, 0, -3.12)
  scene.add(rain.mesh)

  // escritorio y portátil
  const desk = new THREE.Group()
  desk.position.set(-0.15, 0, -1.5)
  scene.add(desk)
  desk.add(box(3.2, 0.12, 1.4, 0x6b4a2f, 0, 1.1, 0))
  desk.add(box(0.12, 1.1, 1.3, 0x4e351f, -1.5, 0.55, 0))
  desk.add(box(0.12, 1.1, 1.3, 0x4e351f, 1.5, 0.55, 0))
  desk.add(box(0.9, 0.05, 0.62, 0x9aa3b2, 0.3, 1.18, 0.1))
  desk.add(box(0.16, 0.18, 0.16, 0xd9d2c4, -0.85, 1.25, 0.2))

  const lid = new THREE.Group()
  lid.position.set(0.3, 1.2, -0.2)
  lid.rotation.x = -0.32
  desk.add(lid)
  lid.add(box(0.9, 0.6, 0.04, 0x8d95a4, 0, 0.3, 0))
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x9fe4ff })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), screenMat)
  screen.position.set(0, 0.3, 0.025)
  lid.add(screen)
  const asterisk = new THREE.Group()
  const astMat = new THREE.MeshBasicMaterial({ color: CLAUDY_ORANGE })
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.05), astMat)
    bar.rotation.z = (i * Math.PI) / 3
    asterisk.add(bar)
  }
  asterisk.position.set(0, 0.3, 0.03)
  lid.add(asterisk)

  // la persona de espaldas
  const person = new THREE.Group()
  person.position.set(0.15, 0, -0.55)
  scene.add(person)
  person.add(box(0.6, 0.08, 0.55, 0x30242c, 0, 0.62, 0))
  person.add(box(0.6, 0.75, 0.08, 0x30242c, 0, 1.0, -0.28))
  person.add(box(0.5, 0.7, 0.34, 0xb8615c, 0, 1.05, 0.02))
  person.add(box(0.32, 0.34, 0.3, 0xe6b58f, 0, 1.55, 0.02))
  person.add(box(0.38, 0.26, 0.36, 0x6b4a3c, 0, 1.7, 0.02))
  person.add(box(0.12, 0.34, 0.12, 0xb8615c, -0.3, 1.12, 0.14))
  person.add(box(0.12, 0.34, 0.12, 0xb8615c, 0.3, 1.12, 0.14))
  person.add(box(0.44, 0.11, 0.36, 0x4a4450, 0, 1.62, 0.02))

  // el gato del alféizar
  const cat = new THREE.Group()
  cat.position.set(1.35, 1.05, -2.98)
  scene.add(cat)
  cat.add(box(0.42, 0.2, 0.22, 0x6b5f52, 0, 0.1, 0))
  cat.add(box(0.2, 0.2, 0.2, 0x6b5f52, -0.22, 0.24, 0))
  cat.add(box(0.05, 0.09, 0.04, 0x6b5f52, -0.16, 0.36, 0.05))
  cat.add(box(0.05, 0.09, 0.04, 0x6b5f52, -0.28, 0.36, 0.05))
  const tail = box(0.28, 0.05, 0.05, 0x6b5f52, 0.28, 0.14, 0)
  cat.add(tail)

  // guirnalda
  const fairy: Array<{ mesh: THREE.Mesh; base: THREE.Color }> = []
  for (let i = 0; i < 14; i++) {
    const t = i / 13
    const base = new THREE.Color([0xffcf99, 0xe8a1b0, 0x9ad8ff][i % 3])
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ color: base.clone() }))
    bulb.position.set(-3.6 + t * 7.2, 3.5 - Math.sin(t * Math.PI) * 0.35, -3.05)
    scene.add(bulb)
    fairy.push({ mesh: bulb, base })
  }

  const claudy = makeClaudy(1)
  claudy.place(1.5, 1.75, -1.0)
  scene.add(claudy.group)

  return {
    scene,
    camera,
    fisheye: 0.08,
    tick(t, energy, rainPct, playing) {
      camera.position.set(
        CAM.x + Math.sin(t * 0.21) * 0.12,
        CAM.y + Math.sin(t * 0.31) * 0.06,
        CAM.z,
      )
      camera.lookAt(LOOK.x, LOOK.y + Math.sin(t * 0.17) * 0.03, LOOK.z)

      rain.tick(rainPct)

      const pulse = playing ? 0.75 + energy * 0.5 : 0.45 + Math.sin(t * 0.9) * 0.05
      screenMat.color.setRGB(0.42 * pulse, 0.78 * pulse, 1.0 * pulse)
      screenLight.intensity = 7 + energy * 9
      asterisk.rotation.z = t * (playing ? 0.9 : 0.25)
      asterisk.scale.setScalar(0.9 + energy * 0.35)

      claudy.tick(t, energy)
      tail.rotation.z = Math.sin(t * 1.7) * 0.5

      for (let i = 0; i < fairy.length; i++) {
        const { mesh, base } = fairy[i]
        const flick = Math.min(1, 0.72 + Math.sin(t * 1.8 + i * 1.3) * 0.18 + energy * 0.2)
        ;(mesh.material as THREE.MeshBasicMaterial).color.copy(base).multiplyScalar(flick)
      }
      if (Math.random() < 0.004) {
        const lit = windowLights[Math.floor(Math.random() * windowLights.length)]
        lit.visible = !lit.visible
      }
    },
  }
}

/* ══ 2 · la playa (house) ══════════════════════════════════════════════ */

function buildBeach(): Kit {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x2a2350, 26, 90)
  const camera = new THREE.PerspectiveCamera(56, RES_W / RES_H, 0.1, 200)
  const CAM = new THREE.Vector3(0, 3.3, 13)
  const LOOK = new THREE.Vector3(0, 1.1, -20)

  // cielo de atardecer: una esfera por dentro con degradado
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 20, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: new THREE.Color(0x1a1442) },
        uMid: { value: new THREE.Color(0xa8407a) },
        uLow: { value: new THREE.Color(0xff9a4d) },
      },
      vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uMid, uLow; varying float vY;
        void main(){
          float y = clamp(vY * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(uLow, uMid, smoothstep(0.42, 0.56, y));
          c = mix(c, uTop, smoothstep(0.55, 0.85, y));
          gl_FragColor = vec4(floor(c * 32.0) / 32.0, 1.0);
        }`,
    }),
  )
  scene.add(sky)

  scene.add(new THREE.AmbientLight(0x7a6a9a, 2.6))
  scene.add(new THREE.HemisphereLight(0xffb27a, 0x2c2a4a, 2.2))
  const sunLight = new THREE.DirectionalLight(0xffb066, 2.4)
  sunLight.position.set(0, 3, -40)
  scene.add(sunLight)
  const partyLight = new THREE.PointLight(0xff5fa8, 22, 26, 1.5)
  partyLight.position.set(-6, 3.4, 4)
  scene.add(partyLight)
  const partyLight2 = new THREE.PointLight(0x56b6ff, 22, 26, 1.5)
  partyLight2.position.set(6, 3.4, 4)
  scene.add(partyLight2)

  // el sol tocando el agua
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4.2, 18), new THREE.MeshBasicMaterial({ color: 0xffd08a }))
  sun.position.set(0, 2.4, -70)
  scene.add(sun)

  // estrellas arriba del todo
  const stars: THREE.Mesh[] = []
  for (let i = 0; i < 60; i++) {
    const s = plane(0.22, 0.22, 0xffffff)
    const a = rand(-Math.PI, Math.PI)
    s.position.set(Math.sin(a) * rand(30, 80), rand(14, 44), -Math.cos(Math.abs(a) * 0.6) * rand(30, 90))
    scene.add(s)
    stars.push(s)
  }

  // arena
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), flat(0x8e7a5e))
  sand.rotation.x = -Math.PI / 2
  sand.position.set(0, 0, 16)
  scene.add(sand)

  // mar: rejilla que se mueve de verdad
  const SEA_W = 44
  const SEA_H = 30
  const seaGeo = new THREE.PlaneGeometry(180, 92, SEA_W, SEA_H)
  const sea = new THREE.Mesh(seaGeo, flat(0x2a5f8f))
  sea.rotation.x = -Math.PI / 2
  sea.position.set(0, 0.05, -45)
  scene.add(sea)
  const seaBase = Float32Array.from(seaGeo.attributes.position.array)

  // espuma en la orilla
  const foam: THREE.Mesh[] = []
  for (let i = 0; i < 12; i++) {
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(rand(6, 16), 0.7),
      new THREE.MeshBasicMaterial({ color: 0xdfeaf2, transparent: true, opacity: 0.55 }),
    )
    f.rotation.x = -Math.PI / 2
    f.position.set(rand(-40, 40), 0.08, rand(-6, -1))
    scene.add(f)
    foam.push(f)
  }

  // palmeras en silueta
  for (const x of [-16, -11, 11, 16, 22]) {
    const palm = new THREE.Group()
    palm.position.set(x, 0, rand(2, 8))
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, rand(4.5, 7), 6), flat(0x5a4436))
    trunk.position.y = trunk.geometry.parameters.height / 2
    trunk.rotation.z = rand(-0.12, 0.12)
    palm.add(trunk)
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), flat(0x3f6a44, { side: THREE.DoubleSide }))
      frond.position.y = trunk.geometry.parameters.height
      frond.rotation.y = (i / 7) * Math.PI * 2
      frond.rotation.z = rand(-0.5, -0.15)
      frond.translateX(1.5)
      palm.add(frond)
    }
    scene.add(palm)
  }

  // chiringuito: torres de altavoces y guirnalda
  const speakers: THREE.Mesh[] = []
  for (const x of [-6.5, 6.5]) {
    const stack = new THREE.Group()
    stack.position.set(x, 0, 3)
    for (let i = 0; i < 3; i++) {
      const cab = box(1.5, 1.1, 1.0, 0x1b1b1e, 0, 0.55 + i * 1.12, 0)
      stack.add(cab)
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.36, 10), new THREE.MeshBasicMaterial({ color: 0x39343a }))
      cone.position.set(0, 0.55 + i * 1.12, 0.51)
      stack.add(cone)
      speakers.push(cone)
    }
    scene.add(stack)
  }
  const bulbs: Array<{ mesh: THREE.Mesh; base: THREE.Color }> = []
  for (let i = 0; i < 18; i++) {
    const t = i / 17
    const base = new THREE.Color([0xffd08a, 0xff7ab6, 0x8ad0ff][i % 3])
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ color: base.clone() }))
    b.position.set(-6.5 + t * 13, 3.6 - Math.sin(t * Math.PI) * 0.9, 3)
    scene.add(b)
    bulbs.push({ mesh: b, base })
  }

  // hoguera
  const fireLight = new THREE.PointLight(0xff8a3a, 9, 8, 1.8)
  fireLight.position.set(0, 0.7, 7.5)
  scene.add(fireLight)
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 6), new THREE.MeshBasicMaterial({ color: 0xffa23a }))
  fire.position.set(0, 0.65, 7.5)
  scene.add(fire)
  for (let i = 0; i < 6; i++) {
    const log = box(0.9, 0.16, 0.16, 0x3a2a1e, rand(-0.5, 0.5), 0.08, 7.5 + rand(-0.4, 0.4))
    log.rotation.y = rand(0, 3)
    scene.add(log)
  }

  const claudy = makeClaudy(1.6)
  claudy.place(0, 3.1, 6.0)
  scene.add(claudy.group)

  const seaPos = seaGeo.attributes.position as THREE.BufferAttribute

  return {
    scene,
    camera,
    fisheye: 0.06,
    tick(t, energy, rainPct, playing) {
      camera.position.set(CAM.x + Math.sin(t * 0.19) * 0.5, CAM.y + Math.sin(t * 0.33) * 0.12, CAM.z)
      camera.lookAt(LOOK.x + Math.sin(t * 0.14) * 1.2, LOOK.y, LOOK.z)

      // el dial de ambiente sube la marejada; la música la empuja
      const swell = 0.25 + (rainPct / 100) * 0.9 + energy * 0.8
      for (let i = 0; i <= SEA_W; i++) {
        for (let j = 0; j <= SEA_H; j++) {
          const k = j * (SEA_W + 1) + i
          const x = seaBase[k * 3]
          const y = seaBase[k * 3 + 1]
          seaPos.setZ(
            k,
            Math.sin(x * 0.12 + t * 1.4) * swell * 0.6 +
              Math.sin(y * 0.09 - t * 0.9) * swell * 0.45 +
              Math.sin((x + y) * 0.05 + t * 2.1) * swell * 0.25,
          )
        }
      }
      seaPos.needsUpdate = true
      seaGeo.computeVertexNormals()

      // la espuma va y viene con la orilla
      for (let i = 0; i < foam.length; i++) {
        const f = foam[i]
        const phase = (t * 0.35 + i * 0.37) % 1
        f.position.z = -6 + phase * 6.5
        ;(f.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - phase)
      }

      // la fiesta responde al bombo
      partyLight.intensity = 12 + energy * 34
      partyLight2.intensity = 12 + energy * 34
      for (const cone of speakers) cone.scale.setScalar(1 + energy * 0.28)
      for (let i = 0; i < bulbs.length; i++) {
        const { mesh, base } = bulbs[i]
        const k = Math.min(1, 0.6 + Math.sin(t * 2.4 + i * 0.8) * 0.2 + energy * 0.4)
        ;(mesh.material as THREE.MeshBasicMaterial).color.copy(base).multiplyScalar(k)
      }
      fire.scale.set(1 + Math.sin(t * 9) * 0.12, 1 + Math.sin(t * 13) * 0.2 + energy * 0.4, 1)
      fireLight.intensity = 8 + Math.sin(t * 11) * 2.5 + energy * 8
      for (let i = 0; i < stars.length; i++) {
        stars[i].visible = playing ? true : Math.sin(t + i) > -0.9
      }

      claudy.tick(t, energy)
    },
  }
}

/* ══ 3 · el callejón (schranz) ═════════════════════════════════════════ */

const SPRAY = ['#e02b1d', '#b9f227', '#ff2d95', '#2e6bff', '#f5f0e2', '#ff7a1a', '#00d9c0']

function drawTag(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rand(-0.25, 0.25))
  ctx.strokeStyle = color
  ctx.lineWidth = rand(2, 5) * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  let px = 0
  let py = 0
  ctx.moveTo(px, py)
  for (let i = 0, n = Math.floor(rand(4, 9)); i < n; i++) {
    const nx = px + rand(10, 34) * scale
    const ny = rand(-18, 18) * scale
    ctx.quadraticCurveTo(px + rand(0, 20) * scale, py + rand(-30, 30) * scale, nx, ny)
    px = nx
    py = ny
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(px + rand(20, 60) * scale, py - rand(20, 50) * scale)
  ctx.stroke()
  ctx.restore()
}

function drawThrowUp(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const fill = choice(SPRAY)
  const outline = Math.random() < 0.5 ? '#0c0b0a' : '#f5f0e2'
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rand(-0.12, 0.12))
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.ellipse(i * 62 * scale, 0, 34 * scale, rand(30, 46) * scale, rand(-0.2, 0.2), 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 6 * scale
    ctx.strokeStyle = outline
    ctx.stroke()
  }
  ctx.fillStyle = fill
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(rand(-20, 190) * scale, 20 * scale, rand(2, 5) * scale, rand(12, 60) * scale)
  }
  ctx.restore()
}

function drawSticker(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rand(-0.4, 0.4))
  ctx.fillStyle = choice(SPRAY)
  ctx.fillRect(-size / 2, -size / 2, size, size * rand(0.6, 1))
  ctx.fillStyle = '#0c0b0a'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-size / 2 + 4, -size / 3 + i * size * 0.22, size * rand(0.35, 0.8), size * 0.09)
  }
  ctx.restore()
}

/** Muro de hormigón con capas: manchas, throw-ups, tags y pegatinas. */
function graffitiTexture(w = 512, h = 512, density = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#7d7666'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${rand(60, 150) | 0},${rand(58, 142) | 0},${rand(50, 126) | 0},${rand(0.05, 0.3)})`
    ctx.fillRect(rand(0, w), rand(0, h), rand(2, 26), rand(2, 22))
  }
  for (let i = 0; i < 3 * density; i++) drawThrowUp(ctx, rand(0, w * 0.8), rand(h * 0.25, h * 0.85), rand(0.7, 1.5))
  for (let i = 0; i < 16 * density; i++) drawTag(ctx, rand(0, w), rand(0, h), rand(0.5, 1.6), choice(SPRAY))
  for (let i = 0; i < 9 * density; i++) drawSticker(ctx, rand(0, w), rand(0, h), rand(18, 48))
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = `rgba(18,16,13,${rand(0.04, 0.22)})`
    ctx.fillRect(rand(0, w), rand(0, h), rand(3, 40), rand(3, 30))
  }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function asphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#33312c'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${rand(30, 90) | 0},${rand(30, 90) | 0},${rand(35, 100) | 0},${rand(0.04, 0.3)})`
    ctx.fillRect(rand(0, 256), rand(0, 256), rand(1, 9), rand(1, 7))
  }
  for (let i = 0; i < 7; i++) {
    ctx.beginPath()
    ctx.ellipse(rand(0, 256), rand(0, 256), rand(12, 40), rand(8, 22), rand(0, 3), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(70,95,150,${rand(0.15, 0.4)})`
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 6)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Un muro plano mirando hacia dentro, con la textura repetida a escala real. */
function wall(
  w: number,
  h: number,
  tex: THREE.Texture,
  repeatX: number,
  repeatY: number,
  pos: [number, number, number],
  rotY: number,
) {
  const t = tex.clone()
  t.needsUpdate = true
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    ps1(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })),
  )
  mesh.position.set(...pos)
  mesh.rotation.y = rotY
  return mesh
}

function painted(w: number, h: number, d: number, tex: THREE.Texture, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ps1(new THREE.MeshLambertMaterial({ map: tex })))
  mesh.position.set(x, y, z)
  return mesh
}

function buildAlley(): Kit {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x161c2e, 11, 34)
  const camera = new THREE.PerspectiveCamera(58, RES_W / RES_H, 0.1, 60)
  const CAM = new THREE.Vector3(0.55, 1.15, 4.6)
  const LOOK = new THREE.Vector3(-0.15, 2.0, -4)

  scene.add(new THREE.AmbientLight(0x5a6288, 3.6))
  scene.add(new THREE.HemisphereLight(0x9db0ee, 0x4a3a28, 2.3))
  const sky = new THREE.DirectionalLight(0xb6c4ff, 2.0)
  sky.position.set(-1, 8, -4)
  scene.add(sky)
  const lamp = new THREE.PointLight(0xffa445, 55, 20, 1.3)
  lamp.position.set(-1.5, 4.3, -2.2)
  scene.add(lamp)
  const neon = new THREE.PointLight(0xff5a1f, 18, 11, 1.7)
  neon.position.set(1.6, 3.0, -6.5)
  scene.add(neon)
  const mouth = new THREE.PointLight(0x8aa0ff, 26, 18, 1.4)
  mouth.position.set(0, 2.6, 5.5)
  scene.add(mouth)
  const deep = new THREE.PointLight(0xcfe0d0, 30, 22, 1.3)
  deep.position.set(0.4, 4.6, -9.5)
  scene.add(deep)

  const alley = new THREE.Group()
  scene.add(alley)

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 22), ps1(new THREE.MeshLambertMaterial({ map: asphaltTexture() })))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -4)
  alley.add(floor)

  alley.add(wall(22, 5, graffitiTexture(512, 512, 1.2), 5, 1.2, [-3.3, 2.5, -4], Math.PI / 2))
  alley.add(wall(22, 5, graffitiTexture(512, 512, 1), 5, 1.2, [3.3, 2.5, -4], -Math.PI / 2))
  alley.add(wall(6.6, 6, graffitiTexture(512, 512, 1.6), 1.5, 1.4, [0, 3, -14.4], 0))
  alley.add(box(0.5, 7, 22, 0x322a22, -3.42, 8.5, -4))
  alley.add(box(0.5, 7, 22, 0x322a22, 3.42, 8.5, -4))
  alley.add(box(7, 7, 0.5, 0x2b241d, 0, 9.5, -14.7))

  // contenedores
  for (const [x, z, rot] of [
    [-2.2, -1.6, 0.06],
    [-2.35, -4.2, -0.09],
    [2.35, -7.4, 0.13],
  ] as Array<[number, number, number]>) {
    const bin = new THREE.Group()
    bin.position.set(x, 0, z)
    bin.rotation.y = rot
    bin.add(painted(1.7, 1.15, 1.15, graffitiTexture(256, 256, 0.8), 0, 0.58, 0))
    const lid = painted(1.75, 0.14, 1.2, graffitiTexture(128, 128, 0.6), 0, 1.2, -0.1)
    lid.rotation.x = -0.5
    bin.add(lid)
    bin.add(box(0.14, 0.28, 0.14, 0x14120f, -0.7, 0.14, 0.5))
    bin.add(box(0.14, 0.28, 0.14, 0x14120f, 0.7, 0.14, 0.5))
    alley.add(bin)
  }

  for (let i = 0; i < 9; i++) {
    const bag = box(rand(0.3, 0.6), rand(0.3, 0.5), rand(0.3, 0.6), 0x0f0e0d, rand(-2.6, 2.6), 0.2, rand(-11, 0))
    bag.rotation.y = rand(0, 3)
    alley.add(bag)
  }
  for (let i = 0; i < 5; i++) {
    const crate = box(rand(0.4, 0.7), rand(0.3, 0.5), rand(0.4, 0.6), choice([0x8a6a42, 0x9c8258, 0x2f5f9c]), rand(-2.4, 2.4), 0.22, rand(-10, -1))
    crate.rotation.y = rand(0, 3)
    alley.add(crate)
  }

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 5), flat(0xff5a1f))
  cone.position.set(1.55, 0.38, 0.4)
  alley.add(cone)
  alley.add(box(0.62, 0.06, 0.62, 0x1a1512, 1.55, 0.03, 0.4))

  // aire acondicionado con su ventilador
  alley.add(painted(0.55, 0.95, 1.25, graffitiTexture(256, 256, 1.4), -2.95, 2.35, -3.4))
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.34, 10), new THREE.MeshBasicMaterial({ color: 0x2a2724 }))
  fan.position.set(-2.66, 2.35, -3.4)
  fan.rotation.y = Math.PI / 2
  alley.add(fan)
  const blades = new THREE.Group()
  blades.position.copy(fan.position)
  blades.rotation.y = Math.PI / 2
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x6d675e, side: THREE.DoubleSide }),
    )
    blade.rotation.z = (i * Math.PI) / 4
    blade.position.z = 0.02
    blades.add(blade)
  }
  alley.add(blades)

  // escalera de incendios
  for (let f = 0; f < 3; f++) {
    const y = 3.2 + f * 2.1
    alley.add(box(2.0, 0.1, 1.0, 0x14120f, 2.6, y, -6 - f * 0.2))
    for (let b = 0; b < 6; b++) {
      alley.add(box(0.05, 0.9, 0.05, 0x14120f, 1.75 + b * 0.3, y + 0.5, -5.55 - f * 0.2))
    }
  }

  // valla al fondo
  const fence = new THREE.Group()
  fence.position.set(0, 1.5, -12.4)
  alley.add(fence)
  for (let i = -14; i <= 14; i++) fence.add(box(0.04, 3, 0.04, 0x50565c, i * 0.22, 0, 0))
  for (let j = -6; j <= 6; j++) fence.add(box(6.4, 0.04, 0.04, 0x50565c, 0, j * 0.24, 0))

  // rótulo y carteles de luz
  const signMat = new THREE.MeshBasicMaterial({ color: 0xff5a1f })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.62), signMat)
  sign.position.set(3.05, 3.1, -6.5)
  sign.rotation.y = -Math.PI / 2
  alley.add(sign)
  alley.add(box(0.12, 0.86, 1.75, 0x100e0c, 3.22, 3.1, -6.5))

  const lightboxes: THREE.Mesh[] = []
  for (const [y, z, color] of [
    [4.4, -5.6, 0xffd23f],
    [5.3, -7.2, 0x2ee6d6],
    [3.7, -8.6, 0xff5a1f],
  ] as Array<[number, number, number]>) {
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ color }))
    lb.position.set(-3.05, y, z)
    lb.rotation.y = Math.PI / 2
    alley.add(lb)
    lightboxes.push(lb)
  }

  const windows: THREE.Mesh[] = []
  for (let i = 0; i < 26; i++) {
    const side = Math.random() < 0.5 ? -1 : 1
    const w = plane(0.3, 0.42, choice([0xffcf99, 0x9ad8ff, 0xf5f0e2]))
    w.position.set(side * 3.05, rand(5.5, 10), rand(-13, -1))
    w.rotation.y = (side * Math.PI) / 2
    alley.add(w)
    windows.push(w)
  }

  // el gato del callejón
  const cat = new THREE.Group()
  cat.position.set(-1.35, 1.18, -1.55)
  cat.rotation.y = 0.5
  alley.add(cat)
  cat.add(box(0.42, 0.2, 0.22, 0x6b5f52, 0, 0.1, 0))
  cat.add(box(0.2, 0.2, 0.2, 0x6b5f52, -0.22, 0.24, 0))
  cat.add(box(0.05, 0.09, 0.04, 0x6b5f52, -0.16, 0.36, 0.05))
  cat.add(box(0.05, 0.09, 0.04, 0x6b5f52, -0.28, 0.36, 0.05))
  const tail = box(0.28, 0.05, 0.05, 0x6b5f52, 0.28, 0.14, 0)
  cat.add(tail)

  // Claudy con su bote de espray
  const claudy = makeClaudy(1.5)
  claudy.place(1.35, 2.0, 0.6)
  scene.add(claudy.group)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), new THREE.MeshBasicMaterial({ color: 0xe02b1d }))
  can.position.set(0.26, -0.06, 0.1)
  claudy.group.add(can)
  const puff = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xb9f227, transparent: true, opacity: 0.5 }),
  )
  puff.position.set(0.26, 0.13, 0.1)
  claudy.group.add(puff)

  const rain = makeRain(340, [3.2, 4, 13], 9.5, 0.42)
  scene.add(rain.mesh)

  return {
    scene,
    camera,
    fisheye: 0.13,
    tick(t, energy, rainPct, playing) {
      // en la nave la cámara tiembla con el bombo
      const kick = energy * 0.16 * (playing ? 1 : 0.2)
      camera.position.set(
        CAM.x + Math.sin(t * 0.31) * 0.1 + Math.sin(t * 37) * kick,
        CAM.y + Math.sin(t * 0.44) * 0.06 + Math.cos(t * 41) * kick,
        CAM.z - energy * 0.35,
      )
      camera.lookAt(LOOK.x + Math.sin(t * 0.23) * 0.12, LOOK.y + Math.sin(t * 0.19) * 0.06, LOOK.z)
      camera.rotation.z = Math.sin(t * 0.27) * 0.02 + Math.sin(t * 23) * kick * 0.6

      rain.tick(rainPct)

      lamp.intensity = 50 + Math.sin(t * 2.3) * 4 + (Math.random() < 0.01 ? -30 : 0)
      neon.intensity = 12 + energy * 26
      signMat.color.setRGB(1, 0.35 + energy * 0.3, 0.12)
      for (let i = 0; i < lightboxes.length; i++) {
        lightboxes[i].visible = Math.sin(t * (1.7 + i * 0.6) + i) > -0.9
      }
      if (Math.random() < 0.006) {
        const w = windows[Math.floor(Math.random() * windows.length)]
        w.visible = !w.visible
      }
      blades.rotation.z += 0.05 + energy * 0.5

      claudy.tick(t, energy)
      const pm = puff.material as THREE.MeshBasicMaterial
      puff.scale.setScalar(0.6 + energy * 2.4)
      pm.opacity = 0.12 + energy * 0.5

      tail.rotation.z = Math.sin(t * 1.9) * 0.55
    },
  }
}

/* ══ montaje ═══════════════════════════════════════════════════════════ */

export interface SceneHandle {
  update(energy: number, rain: number, playing: boolean, genre: Genre): void
  dispose(): void
}

const BUILDERS: Record<Genre, () => Kit> = {
  lofi: buildRoom,
  house: buildBeach,
  schranz: buildAlley,
}

export function mountScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(1)
  renderer.setSize(RES_W, RES_H, false)
  renderer.setClearColor(0x05060a)
  const canvas = renderer.domElement
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const target = new THREE.WebGLRenderTarget(RES_W, RES_H, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  })
  const screenScene = new THREE.Scene()
  const screenCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      uTime: { value: 0 },
      uFisheye: { value: 0.1 },
      uAberration: { value: 0.0018 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime, uFisheye, uAberration;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      vec2 fisheye(vec2 uv, float k){
        vec2 c = uv - 0.5;
        return 0.5 + c * (1.0 + k * dot(c, c));
      }
      void main(){
        vec2 uv = fisheye(vUv, uFisheye);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
        vec2 dir = uv - 0.5;
        vec3 c;
        c.r = texture2D(tDiffuse, uv + dir * uAberration).r;
        c.g = texture2D(tDiffuse, uv).g;
        c.b = texture2D(tDiffuse, uv - dir * uAberration).b;
        c = floor(c * 32.0) / 32.0;                       // color de 15 bits
        float g = (hash(uv * 640.0 + fract(uTime)) - 0.5) * 0.05;
        float scan = 0.95 + 0.05 * sin(uv.y * 360.0);
        float v = smoothstep(1.6, 0.45, length(dir));
        gl_FragColor = vec4((c + g) * scan * v, 1.0);
      }`,
  })
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMat))

  // los escenarios se construyen la primera vez que se piden
  const kits: Partial<Record<Genre, Kit>> = {}
  const kitFor = (g: Genre): Kit => (kits[g] ??= BUILDERS[g]())

  let raf = 0
  let smoothEnergy = 0
  const clock = new THREE.Clock()
  let rainAmount = 30
  let energyIn = 0
  let isPlaying = false
  let genre: Genre = 'lofi'

  const resize = () => {
    if (container.clientWidth === 0) return
    for (const kit of Object.values(kits)) {
      kit.camera.aspect = RES_W / RES_H
      kit.camera.updateProjectionMatrix()
    }
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)

  const render = () => {
    raf = requestAnimationFrame(render)
    const t = clock.getElapsedTime()
    smoothEnergy += (energyIn - smoothEnergy) * (genre === 'schranz' ? 0.3 : 0.12)

    const kit = kitFor(genre)
    kit.tick(t, smoothEnergy, rainAmount, isPlaying)

    screenMat.uniforms.uTime.value = t
    screenMat.uniforms.uFisheye.value = kit.fisheye + smoothEnergy * (genre === 'schranz' ? 0.16 : 0.05)
    screenMat.uniforms.uAberration.value = 0.0016 + smoothEnergy * 0.005

    renderer.setRenderTarget(target)
    renderer.render(kit.scene, kit.camera)
    renderer.setRenderTarget(null)
    renderer.render(screenScene, screenCam)
  }
  render()

  return {
    update(energy, rainPct, playing, g) {
      energyIn = energy
      rainAmount = rainPct
      isPlaying = playing
      genre = g
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      target.dispose()
      canvas.remove()
    },
  }
}
