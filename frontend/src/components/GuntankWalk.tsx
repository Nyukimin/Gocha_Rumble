import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, Grid } from '@react-three/drei'
import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'

function WalkingGuntank({ isWalking }: { isWalking: boolean }) {
  const gltf = useGLTF('/models/がんたんく.glb')
  const { scene } = gltf
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  // モデル構造をログ出力（初回のみ）
  useRef(() => {
    console.log('=== GLTF Structure ===')
    console.log('Animations:', gltf.animations?.length || 0)

    scene.traverse((child) => {
      if (child instanceof THREE.Bone) {
        console.log('Bone found:', child.name)
      }
      if (child instanceof THREE.SkinnedMesh) {
        console.log('SkinnedMesh found:', child.name)
        console.log('Skeleton bones:', child.skeleton?.bones?.length || 0)
      }
    })

    console.log('Scene children:', scene.children.map(c => `${c.type}: ${c.name}`))
  }).current?.()

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (isWalking) {
      timeRef.current += delta * 4 // 歩行速度

      const t = timeRef.current

      // 上下バウンス（歩行時の上下動）
      groupRef.current.position.y = Math.abs(Math.sin(t * 2)) * 0.08

      // 左右の傾き（体重移動）
      groupRef.current.rotation.z = Math.sin(t) * 0.05

      // 前後の傾き（歩行リズム）
      groupRef.current.rotation.x = Math.sin(t * 2) * 0.03

      // 左右の揺れ（腰の動き）
      groupRef.current.position.x = Math.sin(t) * 0.02

    } else {
      // アイドル時: ゆっくり呼吸のような動き
      timeRef.current += delta

      groupRef.current.position.y = Math.sin(timeRef.current * 0.5) * 0.02
      groupRef.current.rotation.z = Math.sin(timeRef.current * 0.3) * 0.01
      groupRef.current.rotation.x = 0
      groupRef.current.position.x = 0
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1} />
    </group>
  )
}

export default function GuntankWalk() {
  const [isWalking, setIsWalking] = useState(false)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e' }}>
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        color: '#00ffff',
        fontFamily: 'monospace'
      }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Guntank Walk Animation</h1>
        <p style={{ margin: '4px 0', fontSize: 14, color: '#888' }}>
          Transform-based walking motion
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIsWalking(false)}
            style={{
              padding: '8px 16px',
              background: !isWalking ? '#00ffff' : '#333',
              color: !isWalking ? '#000' : '#888',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: !isWalking ? 'bold' : 'normal'
            }}
          >
            Idle
          </button>
          <button
            onClick={() => setIsWalking(true)}
            style={{
              padding: '8px 16px',
              background: isWalking ? '#00ff88' : '#333',
              color: isWalking ? '#000' : '#888',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: isWalking ? 'bold' : 'normal'
            }}
          >
            Walk
          </button>
        </div>
      </div>

      <Canvas
        shadows
        camera={{ position: [3, 2, 5], fov: 50 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0a0f']} />

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          color="#00ffff"
        />
        <directionalLight
          position={[-5, 5, -5]}
          intensity={0.5}
          color="#ff00ff"
        />

        <Suspense fallback={null}>
          <WalkingGuntank isWalking={isWalking} />
          <Environment preset="city" />
        </Suspense>

        <Grid
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#0a2a2a"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#00ffff"
          fadeDistance={30}
          fadeStrength={1}
        />

        <OrbitControls
          makeDefault
          minDistance={1}
          maxDistance={20}
        />
      </Canvas>
    </div>
  )
}
