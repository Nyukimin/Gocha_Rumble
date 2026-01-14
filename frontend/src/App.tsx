import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Perf } from 'r3f-perf'
import { Suspense } from 'react'
import { Army } from './components/Army'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#222' }}>
      <Canvas
        shadows
        // 少し引いて全体が見やすく、かつ個体も識別できる距離に調整 (y:30, z:40)
        camera={{ position: [0, 30, 40], fov: 50 }}
        dpr={[1, 2]}
      >
        <Perf position="top-left" />
        
        <ambientLight intensity={1.0} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={2} 
          castShadow 
          shadow-mapSize={[1024, 1024]} 
        />
        
        <Suspense fallback={<Html center><h1 style={{color: 'white'}}>Loading 3D Assets...</h1></Html>}>
          <Army count={1000} />
        </Suspense>

        <OrbitControls />
        <gridHelper args={[100, 100]} />
      </Canvas>
    </div>
  )
}

export default App
