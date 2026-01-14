import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, Center, Grid } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const MODELS = [
  { name: 'kong', url: '/models/kong.glb', label: 'Kong' },
  { name: 'guntank', url: '/models/がんたんく.glb', label: 'Guntank' },
  { name: 'dynosour', url: '/models/dynosour.glb', label: 'Dynosour' },
]

function Model({ url, onInfo }: { url: string; onInfo: (info: ModelInfo) => void }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    // モデル情報をログ出力
    let triangleCount = 0
    let vertexCount = 0
    let meshCount = 0
    let hasVertexColors = false

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++
        const geometry = child.geometry
        if (geometry.index) {
          triangleCount += geometry.index.count / 3
        } else if (geometry.attributes.position) {
          triangleCount += geometry.attributes.position.count / 3
        }
        if (geometry.attributes.position) {
          vertexCount += geometry.attributes.position.count
        }
        if (geometry.attributes.color) {
          hasVertexColors = true
        }
      }
    })

    const info = {
      meshes: meshCount,
      vertices: vertexCount,
      triangles: Math.round(triangleCount),
      hasVertexColors
    }

    console.log('=== Model Info ===')
    console.log(`URL: ${url}`)
    console.log(`Meshes: ${info.meshes}`)
    console.log(`Vertices: ${info.vertices}`)
    console.log(`Triangles: ${info.triangles}`)
    console.log(`Vertex Colors: ${info.hasVertexColors ? 'Yes' : 'No'}`)

    onInfo(info)
  }, [scene, url, onInfo])

  return (
    <Center>
      <primitive ref={groupRef} object={scene} scale={1} />
    </Center>
  )
}

interface ModelInfo {
  meshes: number
  vertices: number
  triangles: number
  hasVertexColors: boolean
}

export default function ModelViewer() {
  const [selectedModel, setSelectedModel] = useState(0)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)

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
        <h1 style={{ margin: 0, fontSize: 20 }}>GLB Model Viewer</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {MODELS.map((model, i) => (
            <button
              key={model.name}
              onClick={() => setSelectedModel(i)}
              style={{
                padding: '6px 12px',
                background: selectedModel === i ? '#00ffff' : '#333',
                color: selectedModel === i ? '#000' : '#888',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: selectedModel === i ? 'bold' : 'normal'
              }}
            >
              {model.label}
            </button>
          ))}
        </div>
        {modelInfo && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#888' }}>
            <div>Meshes: {modelInfo.meshes}</div>
            <div>Vertices: {modelInfo.vertices}</div>
            <div style={{ color: modelInfo.triangles <= 1000 ? '#00ff88' : '#ff4444' }}>
              Triangles: {modelInfo.triangles} {modelInfo.triangles <= 1000 ? '✓' : '(over budget)'}
            </div>
            <div>Vertex Colors: {modelInfo.hasVertexColors ? 'Yes' : 'No'}</div>
          </div>
        )}
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
          <Model
            key={MODELS[selectedModel].url}
            url={MODELS[selectedModel].url}
            onInfo={setModelInfo}
          />
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
