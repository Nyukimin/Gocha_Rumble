import { useGLTF } from '@react-three/drei'
import { useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// -----------------------------------------------------------------------------
// 定数・パラメータ定義
// -----------------------------------------------------------------------------

const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()

// ユニット定義
const UNIT_TYPES = {
  MELEE: {
    id: 0,
    ratio: 0.6,
    scale: 0.6,
    speed: 1.5,
    color: '#ff3333', // 赤
    boids: { seperation: 2.0, alignment: 1.0, cohesion: 1.0, maxSpeed: 0.8, maxForce: 0.05, perceptionRadius: 10 }
  },
  TANK: {
    id: 1,
    ratio: 0.2,
    scale: 0.9,
    speed: 0.5,
    color: '#0044ff', // 青
    boids: { seperation: 3.0, alignment: 1.0, cohesion: 2.0, maxSpeed: 0.3, maxForce: 0.1, perceptionRadius: 15 }
  },
  SUPPORT: {
    id: 2,
    ratio: 0.2,
    scale: 0.4,
    speed: 1.0,
    color: '#ffdd00', // 黄
    boids: { seperation: 4.0, alignment: 0.5, cohesion: 0.5, maxSpeed: 0.6, maxForce: 0.08, perceptionRadius: 20 }
  }
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
  const { scene } = useGLTF('/models/RobotExpressive.glb') as any
  const { camera } = useThree()

  // カメラ初期位置設定
  useEffect(() => {
    camera.position.set(0, 40, 50)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // 1. モデルデータの抽出と正規化（ワールド座標系への焼き込み）
  // ---------------------------------------------------------------------------
  const meshes = useMemo(() => {
    const meshData: { geometry: THREE.BufferGeometry; material: THREE.Material; key: string }[] = []
    
    // シーンをクローンして操作（元のキャッシュを汚さないため）
    const clonedScene = scene.clone(true)
    
    // ワールド行列を更新（これが重要：パーツの相対位置を確定させる）
    clonedScene.updateMatrixWorld(true)
    
    clonedScene.traverse((obj: any) => {
      if (obj.isMesh) {
        // ジオメトリを複製
        const geometry = obj.geometry.clone()
        
        // ワールド変換行列をジオメトリに適用（焼き込み）
        // これにより、InstancedMeshの原点(0,0,0)に対して、
        // モデル本来のパーツ位置（頭は上、足は下など）が正しく配置される
        geometry.applyMatrix4(obj.matrixWorld)
        
        // 法線の再計算（変形で歪む可能性があるため）
        geometry.computeVertexNormals()
        
        // 不要な属性の削除（InstancedMeshでの描画負荷軽減）
        geometry.deleteAttribute('skinIndex')
        geometry.deleteAttribute('skinWeight')
        if (geometry.morphAttributes) geometry.morphAttributes = {}
        if (geometry.attributes.color) geometry.deleteAttribute('color') // 頂点カラーは削除し、InstanceColorを使う

        // マテリアルの調整
        const material = obj.material.clone()
        material.skinning = false // スキンニングアニメーションはOFF
        material.morphTargets = false // モーフターゲットもOFF
        
        meshData.push({ geometry, material, key: obj.uuid })
      }
    })
    return meshData
  }, [scene])

  // 2. シェーダーアニメーションの準備
  // ---------------------------------------------------------------------------
  const customMaterials = useMemo(() => {
    const map = new Map<string, THREE.Material>()
    
    meshes.forEach(({ material, key }) => {
      const mat = material.clone()
      
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 }
        mat.userData.shader = shader
        
        // 簡易的な歩行アニメーション（頂点シェーダー）
        shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
            #include <begin_vertex>
            
            // 足の判定（Y座標が低い部分）
            float isLeg = 1.0 - smoothstep(0.5, 2.0, transformed.y); // 高さ調整が必要かも
            float legSide = sign(transformed.x);
            
            // インスタンスごとのランダム値
            #ifdef USE_INSTANCING
              float rnd = instanceMatrix[3][0] * 0.1 + instanceMatrix[3][2] * 0.1;
            #else
              float rnd = 0.0;
            #endif

            float speed = 10.0;
            float walkSignal = sin(uTime * speed + rnd + legSide * 3.14);
            
            // 前後(Z)と上下(Y)の動き
            transformed.z += walkSignal * 0.5 * isLeg;
            transformed.y += abs(sin(uTime * speed + rnd)) * 0.2 * isLeg;
          `
        )
      }
      map.set(key, mat)
    })
    return map
  }, [meshes])

  // 3. パーティクル（Boidsユニット）の初期化
  // ---------------------------------------------------------------------------
  // タイプごとに配列を分けず、フラットに管理してインデックスで参照する方式
  type Particle = {
    position: THREE.Vector3
    velocity: THREE.Vector3
    acceleration: THREE.Vector3
    rotationY: number
    scale: number
    color: string
    type: keyof typeof UNIT_TYPES
    meshIndices: { type: keyof typeof UNIT_TYPES, index: number } // 描画用インデックス
  }

  const particles = useMemo(() => {
    const data: Particle[] = []
    // タイプごとのカウンタ（InstancedMeshの何番目か）
    const typeCounts = { MELEE: 0, TANK: 0, SUPPORT: 0 }

    for (let i = 0; i < count; i++) {
      const r = Math.random()
      let typeKey: keyof typeof UNIT_TYPES = 'MELEE'
      if (r > 0.8) typeKey = 'SUPPORT'
      else if (r > 0.6) typeKey = 'TANK'
      
      const type = UNIT_TYPES[typeKey]
      
      // 配置（少し広めに）
      const x = (Math.random() - 0.5) * 200
      const z = (Math.random() - 0.5) * 200

      data.push({
        position: new THREE.Vector3(x, 0, z),
        velocity: new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize().multiplyScalar(type.boids.maxSpeed),
        acceleration: new THREE.Vector3(),
        rotationY: Math.random() * Math.PI * 2,
        scale: type.scale,
        color: type.baseColor,
        type: typeKey,
        meshIndices: { type: typeKey, index: typeCounts[typeKey]++ }
      })
    }
    return { data, counts: typeCounts }
  }, [count])

  // 4. InstancedMeshの参照管理
  // ---------------------------------------------------------------------------
  // meshRefs.current[typeKey][meshIndex] = InstancedMesh
  const meshRefs = useRef<{ [key: string]: THREE.InstancedMesh[] }>({
    MELEE: [], TANK: [], SUPPORT: []
  })

  // 5. ループ処理（Boids計算 & 描画更新）
  // ---------------------------------------------------------------------------
  const grid = useMemo(() => new SpatialGrid(20), [])

  useFrame((state) => {
    const { data: allParticles } = particles
    if (allParticles.length === 0) return

    // シェーダーの時間更新
    customMaterials.forEach(mat => {
      if (mat.userData.shader) {
        mat.userData.shader.uniforms.uTime.value = state.clock.elapsedTime
      }
    })

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
      p.acceleration.add(p.position.clone().multiplyScalar(-0.005)) // 中央への引力

      p.velocity.add(p.acceleration).clampLength(0, typeParams.maxSpeed)
      p.position.add(p.velocity)

      if (p.velocity.length() > 0.01) {
        p.rotationY = Math.atan2(p.velocity.x, p.velocity.z)
      }
    })

    // 行列更新
    // 全パーティクルを走査して、対応するInstancedMeshの行列を更新する
    allParticles.forEach(p => {
      tempObject.position.copy(p.position)
      tempObject.rotation.set(0, p.rotationY, 0)
      tempObject.scale.set(p.scale, p.scale, p.scale)
      tempObject.updateMatrix()

      const typeKey = p.type
      const index = p.meshIndices.index
      
      // そのタイプの全メッシュパーツに対して行列をセット
      const targetMeshes = meshRefs.current[typeKey]
      if (targetMeshes) {
        for (let i = 0; i < targetMeshes.length; i++) {
          const mesh = targetMeshes[i]
          if (mesh) {
            mesh.setMatrixAt(index, tempObject.matrix)
          }
        }
      }
    })

    // needsUpdateフラグを立てる
    Object.values(meshRefs.current).forEach(meshList => {
      meshList.forEach(mesh => {
        if (mesh) mesh.instanceMatrix.needsUpdate = true
      })
    })
  })

  // 6. 描画コンポーネント
  // ---------------------------------------------------------------------------
  return (
    <>
      {Object.keys(UNIT_TYPES).map((key) => {
        const typeKey = key as keyof typeof UNIT_TYPES
        const typeCount = particles.counts[typeKey]
        
        if (typeCount === 0) return null

        return (
          <group key={typeKey}>
            {meshes.map(({ geometry, key: meshKey }, meshIndex) => {
              // マテリアル取得
              const material = customMaterials.get(meshKey)
              
              return (
                <instancedMesh
                  key={`${typeKey}-${meshKey}`}
                  ref={(el) => {
                    if (el) {
                      meshRefs.current[typeKey][meshIndex] = el
                      
                      // 初期化時の描画保証（これをしないと一瞬消える）
                      // typeKeyに属するパーティクルを探して初期値をセット
                      // ※パフォーマンス的には重いが初期化時のみなので許容
                      const pList = particles.data.filter(p => p.type === typeKey)
                      pList.forEach(p => {
                        tempObject.position.copy(p.position)
                        tempObject.rotation.set(0, p.rotationY, 0)
                        tempObject.scale.set(p.scale, p.scale, p.scale)
                        tempObject.updateMatrix()
                        el.setMatrixAt(p.meshIndices.index, tempObject.matrix)
                        
                        tempColor.set(p.color)
                        el.setColorAt(p.meshIndices.index, tempColor)
                      })
                      el.instanceMatrix.needsUpdate = true
                      if (el.instanceColor) el.instanceColor.needsUpdate = true
                    }
                  }}
                  args={[geometry, material, typeCount]}
                  frustumCulled={false}
                />
              )
            })}
          </group>
        )
      })}
    </>
  )
}
