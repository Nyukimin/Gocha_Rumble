import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'

// -----------------------------------------------------------------------------
// 定数・パラメータ定義
// -----------------------------------------------------------------------------

const tempObject = new THREE.Object3D()

// ユニット定義（形状パラメータを追加）
const UNIT_TYPES = {
  MELEE: {
    id: 0,
    ratio: 0.6,
    scale: 1.0,
    speed: 1.5,
    color: '#ff3333', // 赤
    // SDガンダム風: 頭デカ、手足デカ、胴体短
    shape: {
      headSize: 0.6,
      torsoWidth: 0.5,
      torsoHeight: 0.4,
      armWidth: 0.15,
      armLength: 0.5,
      legWidth: 0.18,
      legLength: 0.5,
      shoulderWidth: 0.25,
    },
    boids: { seperation: 2.0, alignment: 1.0, cohesion: 1.0, maxSpeed: 0.8, maxForce: 0.05, perceptionRadius: 10 }
  },
  TANK: {
    id: 1,
    ratio: 0.2,
    scale: 1.2,
    speed: 0.5,
    color: '#0044ff', // 青
    // マッチョ風: 肩幅広、胴体太、足太
    shape: {
      headSize: 0.4,
      torsoWidth: 0.8,
      torsoHeight: 0.5,
      armWidth: 0.25,
      armLength: 0.4,
      legWidth: 0.3,
      legLength: 0.4,
      shoulderWidth: 0.4,
    },
    boids: { seperation: 3.0, alignment: 1.0, cohesion: 2.0, maxSpeed: 0.3, maxForce: 0.1, perceptionRadius: 15 }
  },
  SUPPORT: {
    id: 2,
    ratio: 0.2,
    scale: 0.8,
    speed: 1.0,
    color: '#ffdd00', // 黄
    // ちびキャラ風: 頭大きく、手足小さく
    shape: {
      headSize: 0.7,
      torsoWidth: 0.35,
      torsoHeight: 0.3,
      armWidth: 0.1,
      armLength: 0.35,
      legWidth: 0.12,
      legLength: 0.35,
      shoulderWidth: 0.15,
    },
    boids: { seperation: 4.0, alignment: 0.5, cohesion: 0.5, maxSpeed: 0.6, maxForce: 0.08, perceptionRadius: 20 }
  }
}

// -----------------------------------------------------------------------------
// ローポリロボット生成関数（約400ポリゴン）
// -----------------------------------------------------------------------------
function createLowPolyRobot(shape: typeof UNIT_TYPES.MELEE.shape): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = []
  
  const { headSize, torsoWidth, torsoHeight, armWidth, armLength, legWidth, legLength, shoulderWidth } = shape
  
  // 頭（八角形球）: ~96三角形
  const headGeom = new THREE.SphereGeometry(headSize, 8, 6)
  headGeom.translate(0, torsoHeight + headSize * 0.8, 0)
  geometries.push(headGeom)
  
  // 胴体（箱）: 12三角形
  const torsoGeom = new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoWidth * 0.6)
  torsoGeom.translate(0, torsoHeight * 0.5, 0)
  geometries.push(torsoGeom)
  
  // 肩（箱×2）: 24三角形
  const shoulderGeomL = new THREE.BoxGeometry(shoulderWidth, shoulderWidth * 0.8, shoulderWidth * 0.8)
  shoulderGeomL.translate(-(torsoWidth * 0.5 + shoulderWidth * 0.5), torsoHeight * 0.8, 0)
  geometries.push(shoulderGeomL)
  
  const shoulderGeomR = new THREE.BoxGeometry(shoulderWidth, shoulderWidth * 0.8, shoulderWidth * 0.8)
  shoulderGeomR.translate(torsoWidth * 0.5 + shoulderWidth * 0.5, torsoHeight * 0.8, 0)
  geometries.push(shoulderGeomR)
  
  // 腕（円柱×2）: ~64三角形
  const armGeomL = new THREE.CylinderGeometry(armWidth, armWidth * 0.8, armLength, 8)
  armGeomL.translate(-(torsoWidth * 0.5 + shoulderWidth * 0.5), torsoHeight * 0.5 - armLength * 0.3, 0)
  geometries.push(armGeomL)
  
  const armGeomR = new THREE.CylinderGeometry(armWidth, armWidth * 0.8, armLength, 8)
  armGeomR.translate(torsoWidth * 0.5 + shoulderWidth * 0.5, torsoHeight * 0.5 - armLength * 0.3, 0)
  geometries.push(armGeomR)
  
  // 手（箱×2）: 24三角形
  const handGeomL = new THREE.BoxGeometry(armWidth * 1.5, armWidth * 1.5, armWidth * 1.5)
  handGeomL.translate(-(torsoWidth * 0.5 + shoulderWidth * 0.5), torsoHeight * 0.3 - armLength * 0.7, 0)
  geometries.push(handGeomL)
  
  const handGeomR = new THREE.BoxGeometry(armWidth * 1.5, armWidth * 1.5, armWidth * 1.5)
  handGeomR.translate(torsoWidth * 0.5 + shoulderWidth * 0.5, torsoHeight * 0.3 - armLength * 0.7, 0)
  geometries.push(handGeomR)
  
  // 腰（箱）: 12三角形
  const hipGeom = new THREE.BoxGeometry(torsoWidth * 0.8, torsoHeight * 0.3, torsoWidth * 0.5)
  hipGeom.translate(0, -torsoHeight * 0.1, 0)
  geometries.push(hipGeom)
  
  // 脚（円柱×2）: ~64三角形
  const legGeomL = new THREE.CylinderGeometry(legWidth, legWidth * 0.9, legLength, 8)
  legGeomL.translate(-torsoWidth * 0.25, -legLength * 0.6, 0)
  geometries.push(legGeomL)
  
  const legGeomR = new THREE.CylinderGeometry(legWidth, legWidth * 0.9, legLength, 8)
  legGeomR.translate(torsoWidth * 0.25, -legLength * 0.6, 0)
  geometries.push(legGeomR)
  
  // 足（箱×2）: 24三角形
  const footGeomL = new THREE.BoxGeometry(legWidth * 1.5, legWidth, legWidth * 2)
  footGeomL.translate(-torsoWidth * 0.25, -legLength - legWidth * 0.3, legWidth * 0.3)
  geometries.push(footGeomL)
  
  const footGeomR = new THREE.BoxGeometry(legWidth * 1.5, legWidth, legWidth * 2)
  footGeomR.translate(torsoWidth * 0.25, -legLength - legWidth * 0.3, legWidth * 0.3)
  geometries.push(footGeomR)
  
  // バックパック（箱）: 12三角形
  const backpackGeom = new THREE.BoxGeometry(torsoWidth * 0.6, torsoHeight * 0.5, torsoWidth * 0.3)
  backpackGeom.translate(0, torsoHeight * 0.6, -torsoWidth * 0.4)
  geometries.push(backpackGeom)
  
  // 全パーツを統合
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false)
  
  // ポリゴン数をログ出力
  const triangleCount = merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3
  console.log(`[LowPolyRobot] Created with ${triangleCount} triangles`)
  
  return merged
}

// -----------------------------------------------------------------------------
// ユーティリティクラス: 空間分割グリッド
// -----------------------------------------------------------------------------
class SpatialGrid {
  cellSize: number
  cells: Map<string, number[]>

  constructor(cellSize: number) {
    this.cellSize = cellSize
    this.cells = new Map()
  }

  clear() {
    this.cells.clear()
  }

  private getKey(pos: THREE.Vector3) {
    const x = Math.floor(pos.x / this.cellSize)
    const z = Math.floor(pos.z / this.cellSize)
    return `${x}:${z}`
  }

  add(index: number, pos: THREE.Vector3) {
    const key = this.getKey(pos)
    if (!this.cells.has(key)) this.cells.set(key, [])
    this.cells.get(key)!.push(index)
  }

  getNeighbors(pos: THREE.Vector3, radius: number) {
    const indices: number[] = []
    const range = Math.ceil(radius / this.cellSize)
    const centerKey = this.getKey(pos)
    const [cx, cz] = centerKey.split(':').map(Number)

    for (let x = cx - range; x <= cx + range; x++) {
      for (let z = cz - range; z <= cz + range; z++) {
        const key = `${x}:${z}`
        const cell = this.cells.get(key)
        if (cell) indices.push(...cell)
      }
    }
    return indices
  }
}

// -----------------------------------------------------------------------------
// メインコンポーネント
// -----------------------------------------------------------------------------
export const Army = ({ count = 1000 }: { count: number }) => {
  const { camera } = useThree()

  // カメラ初期位置設定
  useEffect(() => {
    camera.position.set(0, 30, 40)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // 1. タイプごとのローポリジオメトリを生成
  // ---------------------------------------------------------------------------
  const geometryMap = useMemo(() => {
    const map: { [key: string]: THREE.BufferGeometry } = {}
    
    Object.keys(UNIT_TYPES).forEach(typeKey => {
      const typeConfig = UNIT_TYPES[typeKey as keyof typeof UNIT_TYPES]
      const geometry = createLowPolyRobot(typeConfig.shape)
      map[typeKey] = geometry
      console.log(`[Geometry ${typeKey}] Created`)
    })
    
    return map
  }, [])

  // 2. タイプ別のマテリアルを作成
  // ---------------------------------------------------------------------------
  const typeMaterials = useMemo(() => {
    const materials: { [key: string]: THREE.MeshStandardMaterial } = {}
    Object.keys(UNIT_TYPES).forEach(typeKey => {
      const typeColor = UNIT_TYPES[typeKey as keyof typeof UNIT_TYPES].color
      materials[typeKey] = new THREE.MeshStandardMaterial({ 
        color: typeColor,
        roughness: 0.7,
        metalness: 0.3,
      })
      console.log(`[Material] Created ${typeKey} material with color: ${typeColor}`)
    })
    return materials
  }, [])

  // 3. パーティクル（Boidsユニット）の初期化
  // ---------------------------------------------------------------------------
  type Particle = {
    position: THREE.Vector3
    velocity: THREE.Vector3
    acceleration: THREE.Vector3
    rotationY: number
    scale: number
    color: string
    type: keyof typeof UNIT_TYPES
    meshIndices: { type: keyof typeof UNIT_TYPES, index: number }
  }

  const particles = useMemo(() => {
    const data: Particle[] = []
    const typeCounts = { MELEE: 0, TANK: 0, SUPPORT: 0 }

    for (let i = 0; i < count; i++) {
      const r = Math.random()
      let typeKey: keyof typeof UNIT_TYPES = 'MELEE'
      if (r > 0.8) typeKey = 'SUPPORT'
      else if (r > 0.6) typeKey = 'TANK'
      
      const type = UNIT_TYPES[typeKey]
      
      const x = (Math.random() - 0.5) * 200
      const z = (Math.random() - 0.5) * 200

      data.push({
        position: new THREE.Vector3(x, 0, z),
        velocity: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize().multiplyScalar(type.boids.maxSpeed),
        acceleration: new THREE.Vector3(),
        rotationY: Math.random() * Math.PI * 2,
        scale: type.scale,
        color: type.color,
        type: typeKey,
        meshIndices: { type: typeKey, index: typeCounts[typeKey]++ }
      })
    }
    console.log('[DEBUG] Particle counts:', typeCounts)
    return { data, counts: typeCounts }
  }, [count])

  // 4. InstancedMeshの参照管理
  // ---------------------------------------------------------------------------
  const meshRefs = useRef<{ [key: string]: THREE.InstancedMesh | null }>({
    MELEE: null, TANK: null, SUPPORT: null
  })

  // 5. ループ処理（Boids計算 & 描画更新）
  // ---------------------------------------------------------------------------
  const grid = useMemo(() => new SpatialGrid(20), [])

  useFrame(() => {
    const { data: allParticles } = particles
    if (allParticles.length === 0) return

    // グリッド登録
    grid.clear()
    allParticles.forEach((p, i) => grid.add(i, p.position))

    // Boids計算
    allParticles.forEach((p) => {
      const typeParams = UNIT_TYPES[p.type].boids
      p.acceleration.set(0, 0, 0)

      const neighbors = grid.getNeighbors(p.position, typeParams.perceptionRadius)
      
      const sep = new THREE.Vector3()
      const ali = new THREE.Vector3()
      const coh = new THREE.Vector3()
      let total = 0

      neighbors.forEach(idx => {
        const other = allParticles[idx]
        if (other === p) return

        const d = p.position.distanceTo(other.position)
        if (d > 0 && d < typeParams.perceptionRadius) {
          sep.add(new THREE.Vector3().subVectors(p.position, other.position).normalize().divideScalar(d))
          ali.add(other.velocity)
          coh.add(other.position)
          total++
        }
      })

      if (total > 0) {
        sep.divideScalar(total).normalize().multiplyScalar(typeParams.maxSpeed).sub(p.velocity).clampLength(0, typeParams.maxForce)
        ali.divideScalar(total).normalize().multiplyScalar(typeParams.maxSpeed).sub(p.velocity).clampLength(0, typeParams.maxForce)
        coh.divideScalar(total).sub(p.position).normalize().multiplyScalar(typeParams.maxSpeed).sub(p.velocity).clampLength(0, typeParams.maxForce)
      }

      p.acceleration.add(sep.multiplyScalar(typeParams.seperation))
      p.acceleration.add(ali.multiplyScalar(typeParams.alignment))
      p.acceleration.add(coh.multiplyScalar(typeParams.cohesion))
      p.acceleration.add(p.position.clone().multiplyScalar(-0.005))

      p.velocity.add(p.acceleration).clampLength(0, typeParams.maxSpeed)
      p.position.add(p.velocity)

      if (p.velocity.length() > 0.01) {
        p.rotationY = Math.atan2(p.velocity.x, p.velocity.z)
      }
    })

    // 行列更新
    allParticles.forEach(p => {
      tempObject.position.copy(p.position)
      tempObject.rotation.set(0, p.rotationY, 0)
      tempObject.scale.setScalar(p.scale)
      tempObject.updateMatrix()

      const mesh = meshRefs.current[p.type]
      if (mesh) {
        mesh.setMatrixAt(p.meshIndices.index, tempObject.matrix)
      }
    })

    // instanceMatrix更新フラグ
    Object.values(meshRefs.current).forEach(mesh => {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    })
  })

  // 6. 描画コンポーネント
  // ---------------------------------------------------------------------------
  return (
    <>
      {Object.keys(UNIT_TYPES).map((key) => {
        const typeKey = key as keyof typeof UNIT_TYPES
        const typeCount = particles.counts[typeKey]
        const material = typeMaterials[typeKey]
        const geometry = geometryMap[typeKey]
        
        if (typeCount === 0 || !geometry) return null

        return (
          <instancedMesh
            key={typeKey}
            ref={(el) => {
              if (el) {
                meshRefs.current[typeKey] = el
                
                // 初期化
                const pList = particles.data.filter(p => p.type === typeKey)
                pList.forEach(p => {
                  tempObject.position.copy(p.position)
                  tempObject.rotation.set(0, p.rotationY, 0)
                  tempObject.scale.setScalar(p.scale)
                  tempObject.updateMatrix()
                  el.setMatrixAt(p.meshIndices.index, tempObject.matrix)
                })
                el.instanceMatrix.needsUpdate = true
              }
            }}
            args={[geometry, material, typeCount]}
            frustumCulled={false}
            castShadow
            receiveShadow
          />
        )
      })}
    </>
  )
}
