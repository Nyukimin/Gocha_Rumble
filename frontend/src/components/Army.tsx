import { useGLTF } from '@react-three/drei'
import { useMemo, useLayoutEffect, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'

// -----------------------------------------------------------------------------
// 定数・パラメータ定義
// -----------------------------------------------------------------------------

const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()

// パーツごとのスケール定義
type BoneScales = { [key: string]: [number, number, number] }

// ユニット定義
const UNIT_TYPES = {
  MELEE: {
    id: 0,
    ratio: 0.6,
    scale: 0.6,
    speed: 1.5,
    color: '#ff3333', // 赤
    // SDガンダム風: 頭デカ、手足デカ、胴体短
    boneScales: {
      'Head': [2.5, 2.5, 2.5],
      'Torso': [0.7, 0.6, 0.7],
      'UpperArm': [1.3, 1.3, 1.3],
      'LowerArm': [1.5, 1.5, 1.5],
      'Hand': [2.0, 2.0, 2.0],
      'UpperLeg': [0.7, 0.7, 0.7],
      'LowerLeg': [0.7, 0.7, 0.7],
      'Foot': [2.0, 1.5, 2.0],
    } as BoneScales,
    boids: { seperation: 2.0, alignment: 1.0, cohesion: 1.0, maxSpeed: 0.8, maxForce: 0.05, perceptionRadius: 10 }
  },
  TANK: {
    id: 1,
    ratio: 0.2,
    scale: 0.9,
    speed: 0.5,
    color: '#0044ff', // 青
    // マッチョ風: 肩幅広、胴体太、足太
    boneScales: {
      'Head': [0.6, 0.6, 0.6],
      'Torso': [1.8, 1.4, 1.8],
      'Shoulder': [2.5, 2.5, 2.5],
      'UpperArm': [1.8, 1.8, 1.8],
      'UpperLeg': [1.8, 1.5, 1.8],
      'LowerLeg': [1.8, 1.5, 1.8],
    } as BoneScales,
    boids: { seperation: 3.0, alignment: 1.0, cohesion: 2.0, maxSpeed: 0.3, maxForce: 0.1, perceptionRadius: 15 }
  },
  SUPPORT: {
    id: 2,
    ratio: 0.2,
    scale: 0.4,
    speed: 1.0,
    color: '#ffdd00', // 黄
    // ちびキャラ風: 頭大きく、手足小さく
    boneScales: {
      'Head': [2.2, 2.2, 2.2],          // 頭を大きく
      'Torso': [0.9, 0.6, 0.9],         // 胴体を小さく
      'Shoulder': [0.6, 0.6, 0.6],      // 肩を小さく
      'UpperArm': [0.5, 0.5, 0.5],      // 腕を細く
      'LowerArm': [0.5, 0.5, 0.5],
      'UpperLeg': [0.4, 0.4, 0.4],      // 脚を細く
      'LowerLeg': [0.4, 0.4, 0.4],
    } as BoneScales,
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
// ヘルパー: CPUスキニング計算
// -----------------------------------------------------------------------------
const bakeSkinnedMesh = (skinnedMesh: THREE.SkinnedMesh, boneScales: BoneScales): THREE.BufferGeometry => {
  const skeleton = skinnedMesh.skeleton
  
  // ボーンスケールの一時適用
  const originalScales = new Map<THREE.Bone, THREE.Vector3>()
  skeleton.bones.forEach(bone => {
    originalScales.set(bone, bone.scale.clone())
    // scale適用
    Object.keys(boneScales).forEach(key => {
      if (bone.name.includes(key)) {
        const s = boneScales[key]
        bone.scale.set(s[0], s[1], s[2])
      }
    })
  })
  
  // 行列更新
  skeleton.update()
  // ボーンのmatrixWorldを更新（これが重要！）
  skeleton.bones.forEach(bone => {
    bone.updateMatrixWorld(true)
  })

  const geometry = skinnedMesh.geometry.clone()
  const positionAttribute = geometry.attributes.position
  const skinIndexAttribute = geometry.attributes.skinIndex
  const skinWeightAttribute = geometry.attributes.skinWeight

  if (!positionAttribute || !skinIndexAttribute || !skinWeightAttribute) {
    // 戻す
    skeleton.bones.forEach(bone => {
      const s = originalScales.get(bone)
      if (s) bone.scale.copy(s)
    })
    skeleton.update()
    return geometry
  }

  const vertex = new THREE.Vector3()
  const skinnedVertex = new THREE.Vector3()
  const boneMatrix = new THREE.Matrix4()
  const bindMatrix = skinnedMesh.bindMatrix
  const bindMatrixInverse = skinnedMesh.bindMatrixInverse

  // 頂点計算
  for (let i = 0; i < positionAttribute.count; i++) {
    vertex.fromBufferAttribute(positionAttribute, i)
    skinnedVertex.set(0, 0, 0)

    const skinIndices = [
      skinIndexAttribute.getX(i),
      skinIndexAttribute.getY(i),
      skinIndexAttribute.getZ(i),
      skinIndexAttribute.getW(i)
    ]
    const skinWeights = [
      skinWeightAttribute.getX(i),
      skinWeightAttribute.getY(i),
      skinWeightAttribute.getZ(i),
      skinWeightAttribute.getW(i)
    ]

    // ボーン変形計算
    // v_skinned = sum( weight * BoneMatrix * BoneInverse ) * BindMatrix * v_local
    for (let j = 0; j < 4; j++) {
      const weight = skinWeights[j]
      if (weight === 0) continue

      const boneIndex = skinIndices[j]
      const bone = skeleton.bones[boneIndex]
      if (!bone) continue

      const boneInverse = skeleton.boneInverses[boneIndex]

      // boneMatrix = BoneWorld * BoneInverse
      boneMatrix.multiplyMatrices(bone.matrixWorld, boneInverse)
      
      const v = vertex.clone().applyMatrix4(bindMatrix).applyMatrix4(boneMatrix)
      skinnedVertex.add(v.multiplyScalar(weight))
    }
    
    // BindMatrixInverse でMeshローカル座標系に戻す
    skinnedVertex.applyMatrix4(bindMatrixInverse)
    
    // 最後にMesh自体のWorld行列（親のスケールや位置）を適用して「焼き込む」
    // これにより、InstancedMeshの原点に対して、本来あるべき位置・サイズになる
    skinnedVertex.applyMatrix4(skinnedMesh.matrixWorld)

    positionAttribute.setXYZ(i, skinnedVertex.x, skinnedVertex.y, skinnedVertex.z)
  }

  // スケールを元に戻す
  skeleton.bones.forEach(bone => {
    const s = originalScales.get(bone)
    if (s) bone.scale.copy(s)
  })
  skeleton.update()

  // 法線再計算
  geometry.computeVertexNormals()
  
  // 不要属性削除
  geometry.deleteAttribute('skinIndex')
  geometry.deleteAttribute('skinWeight')
  if (geometry.morphAttributes) geometry.morphAttributes = {}
  if (geometry.attributes.color) geometry.deleteAttribute('color')

  return geometry
}

// -----------------------------------------------------------------------------
// メインコンポーネント
// -----------------------------------------------------------------------------
export const Army = ({ count = 1000 }: { count: number }) => {
  const { scene } = useGLTF('/models/RobotExpressive.glb') as any
  const { camera } = useThree()

  // カメラ初期位置設定
  useEffect(() => {
    // 違いがわかるように少し近く
    camera.position.set(0, 30, 40)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // 1. タイプごとの統合ジオメトリを生成（パーツを1つにマージ）
  // ---------------------------------------------------------------------------
  const mergedGeometryMap = useMemo(() => {
    // シーンの行列を更新しておく
    scene.updateMatrixWorld(true)
    
    // デバッグ: ボーン名を出力
    let boneNamesLogged = false
    scene.traverse((obj: any) => {
      if (!boneNamesLogged && obj.isSkinnedMesh && obj.skeleton) {
        const boneNames = obj.skeleton.bones.map((b: any) => b.name)
        console.log('[DEBUG] All bone names:', boneNames.join(', '))
        boneNamesLogged = true
      }
    })
    
    const geometryMap: { [key: string]: THREE.BufferGeometry } = {}

    // 各ユニットタイプごとに生成
    Object.keys(UNIT_TYPES).forEach(typeKey => {
      const typeConfig = UNIT_TYPES[typeKey as keyof typeof UNIT_TYPES]
      const boneScales = typeConfig.boneScales
      const geometries: THREE.BufferGeometry[] = []

      scene.traverse((obj: any) => {
        if (obj.isSkinnedMesh) {
          const geometry = bakeSkinnedMesh(obj, boneScales)
          // マージ用に属性を正規化
          if (geometry.attributes.uv) geometry.deleteAttribute('uv')
          if (geometry.attributes.uv1) geometry.deleteAttribute('uv1')
          if (geometry.attributes.uv2) geometry.deleteAttribute('uv2')
          // morphTargetsRelativeを統一
          geometry.morphTargetsRelative = false
          if (geometry.morphAttributes) geometry.morphAttributes = {}
          geometries.push(geometry)

        } else if (obj.isMesh) {
          const geometry = obj.geometry.clone()
          geometry.applyMatrix4(obj.matrixWorld)
          geometry.computeVertexNormals()
          if (geometry.attributes.color) geometry.deleteAttribute('color')
          if (geometry.attributes.uv) geometry.deleteAttribute('uv')
          if (geometry.attributes.uv1) geometry.deleteAttribute('uv1')
          if (geometry.attributes.uv2) geometry.deleteAttribute('uv2')
          // morphTargetsRelativeを統一
          geometry.morphTargetsRelative = false
          if (geometry.morphAttributes) geometry.morphAttributes = {}
          geometries.push(geometry)
        }
      })
      
      // ジオメトリを統合
      if (geometries.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geometries, false)
        if (merged) {
          geometryMap[typeKey] = merged
          const triangleCount = merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3
          console.log(`[Merged ${typeKey}] ${geometries.length} parts merged, ${triangleCount} triangles per unit`)
        }
      }
    })
    
    return geometryMap
  }, [scene])

  // 2. タイプ別のマテリアルを作成
  // ---------------------------------------------------------------------------
  const typeMaterials = useMemo(() => {
    const materials: { [key: string]: THREE.MeshBasicMaterial } = {}
    Object.keys(UNIT_TYPES).forEach(typeKey => {
      const typeColor = UNIT_TYPES[typeKey as keyof typeof UNIT_TYPES].color
      materials[typeKey] = new THREE.MeshBasicMaterial({ color: typeColor })
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
  const meshRefs = useRef<{ [key: string]: THREE.InstancedMesh[] }>({
    MELEE: [], TANK: [], SUPPORT: []
  })

  // 5. ループ処理（Boids計算 & 描画更新）
  // ---------------------------------------------------------------------------
  const grid = useMemo(() => new SpatialGrid(20), [])

  useFrame((state) => {
    const { data: allParticles } = particles
    if (allParticles.length === 0) return

    // シェーダーアニメーションは一時的に無効化（色の問題を優先）

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
      tempObject.scale.set(p.scale, p.scale, p.scale)
      tempObject.updateMatrix()

      const typeKey = p.type
      const index = p.meshIndices.index
      
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

    Object.values(meshRefs.current).forEach(meshList => {
      if (meshList && Array.isArray(meshList)) {
        meshList.forEach(mesh => {
          if (mesh) mesh.instanceMatrix.needsUpdate = true
        })
      }
    })
  })

  // 6. 描画コンポーネント（統合ジオメトリで3色描画）
  // ---------------------------------------------------------------------------
  return (
    <>
      {Object.keys(UNIT_TYPES).map((key) => {
        const typeKey = key as keyof typeof UNIT_TYPES
        const typeCount = particles.counts[typeKey]
        const material = typeMaterials[typeKey]
        const geometry = mergedGeometryMap[typeKey]
        
        if (typeCount === 0 || !geometry) return null

        console.log(`[RENDER] ${typeKey}: count=${typeCount}, material.color=${material.color.getHexString()}`)
        
        return (
          <instancedMesh
            key={typeKey}
            ref={(el) => {
              if (el) {
                meshRefs.current[typeKey][0] = el
                
                // 初期化
                const pList = particles.data.filter(p => p.type === typeKey)
                pList.forEach(p => {
                  tempObject.position.copy(p.position)
                  tempObject.rotation.set(0, p.rotationY, 0)
                  tempObject.scale.set(p.scale, p.scale, p.scale)
                  tempObject.updateMatrix()
                  el.setMatrixAt(p.meshIndices.index, tempObject.matrix)
                })
                el.instanceMatrix.needsUpdate = true
              }
            }}
            args={[geometry, material, typeCount]}
            frustumCulled={false}
          />
        )
      })}
    </>
  )
}
