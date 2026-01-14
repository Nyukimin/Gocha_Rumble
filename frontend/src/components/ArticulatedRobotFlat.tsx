import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function ArticulatedRobotFlat() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<boolean>(false);
  const [animMode, setAnimMode] = useState('idle');
  const animModeRef = useRef('idle');

  useEffect(() => {
    animModeRef.current = animMode;
  }, [animMode]);

  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;
    sceneRef.current = true;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);

    const camera = new THREE.PerspectiveCamera(60, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 6);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x00ffff, 1);
    mainLight.position.set(5, 10, 5);
    scene.add(mainLight);

    const backLight = new THREE.DirectionalLight(0xff00ff, 0.5);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, metalness: 0.8, roughness: 0.2, flatShading: true
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff, metalness: 0.9, roughness: 0.1,
      emissive: 0x00ffff, emissiveIntensity: 0.3, flatShading: true
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f0f1a, metalness: 0.7, roughness: 0.3, flatShading: true
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff0044, emissive: 0xff0044, emissiveIntensity: 1, flatShading: true
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8, flatShading: true
    });

    // ============ HIERARCHICAL ROBOT STRUCTURE (ALL FLAT SURFACES) ============
    const robot = new THREE.Group();

    // ----- TORSO (Root) -----
    const torso = new THREE.Group();
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.7), bodyMat);
    torso.add(torsoMesh);

    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.1), darkMat);
    chestMesh.position.set(0, 0.1, 0.35);
    torso.add(chestMesh);

    // Core: 2つのBoxを45度回転させてダイヤモンド風に
    const coreGroup = new THREE.Group();
    const coreBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), coreMat);
    const coreBox2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), coreMat);
    coreBox2.rotation.set(Math.PI / 4, Math.PI / 4, 0);
    coreGroup.add(coreBox1);
    coreGroup.add(coreBox2);
    coreGroup.position.set(0, 0.1, 0.42);
    torso.add(coreGroup);

    torso.position.y = 1.7;
    robot.add(torso);

    // ----- HEAD (attached to torso) -----
    const headPivot = new THREE.Group();
    headPivot.position.y = 0.7;

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), bodyMat);
    headMesh.position.y = 0.4;
    headPivot.add(headMesh);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.1), accentMat);
    visor.position.set(0, 0.45, 0.35);
    headPivot.add(visor);

    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.05), eyeMat);
    leftEye.position.set(-0.2, 0.45, 0.4);
    headPivot.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.05), eyeMat);
    rightEye.position.set(0.2, 0.45, 0.4);
    headPivot.add(rightEye);

    // Antenna: 細いBoxに変更
    const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), accentMat);
    antenna.position.set(0.25, 0.8, 0);
    headPivot.add(antenna);

    // Antenna tip: 小さいBoxに変更
    const antennaTip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), eyeMat);
    antennaTip.position.set(0.25, 0.98, 0);
    antennaTip.rotation.set(Math.PI / 4, Math.PI / 4, 0);
    headPivot.add(antennaTip);

    torso.add(headPivot);

    // ----- JOINT GEOMETRY -----
    const createJoint = (material: THREE.Material) => {
      const joint = new THREE.Group();
      const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), material);
      const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), material);
      box2.rotation.y = Math.PI / 4;
      joint.add(box1);
      joint.add(box2);
      return joint;
    };

    // ----- LEFT ARM -----
    const leftShoulderPivot = new THREE.Group();
    leftShoulderPivot.position.set(-0.7, 0.45, 0);

    const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), accentMat);
    leftShoulder.position.x = -0.1;
    leftShoulderPivot.add(leftShoulder);

    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25), bodyMat);
    leftUpperArm.position.set(-0.1, -0.4, 0);
    leftShoulderPivot.add(leftUpperArm);

    const leftElbowPivot = new THREE.Group();
    leftElbowPivot.position.set(-0.1, -0.7, 0);

    const leftElbow = createJoint(accentMat);
    leftElbowPivot.add(leftElbow);

    const leftLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), bodyMat);
    leftLowerArm.position.y = -0.35;
    leftElbowPivot.add(leftLowerArm);

    const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.15), darkMat);
    leftHand.position.y = -0.7;
    leftElbowPivot.add(leftHand);

    leftShoulderPivot.add(leftElbowPivot);
    torso.add(leftShoulderPivot);

    // ----- RIGHT ARM -----
    const rightShoulderPivot = new THREE.Group();
    rightShoulderPivot.position.set(0.7, 0.45, 0);

    const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.35), accentMat);
    rightShoulder.position.x = 0.1;
    rightShoulderPivot.add(rightShoulder);

    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25), bodyMat);
    rightUpperArm.position.set(0.1, -0.4, 0);
    rightShoulderPivot.add(rightUpperArm);

    const rightElbowPivot = new THREE.Group();
    rightElbowPivot.position.set(0.1, -0.7, 0);

    const rightElbow = createJoint(accentMat);
    rightElbowPivot.add(rightElbow);

    const rightLowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), bodyMat);
    rightLowerArm.position.y = -0.35;
    rightElbowPivot.add(rightLowerArm);

    const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.15), darkMat);
    rightHand.position.y = -0.7;
    rightElbowPivot.add(rightHand);

    rightShoulderPivot.add(rightElbowPivot);
    torso.add(rightShoulderPivot);

    // ----- WAIST -----
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5), darkMat);
    waist.position.y = -0.75;
    torso.add(waist);

    // ----- LEFT LEG -----
    const leftHipPivot = new THREE.Group();
    leftHipPivot.position.set(-0.25, -0.95, 0);

    const leftUpperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), bodyMat);
    leftUpperLeg.position.y = -0.25;
    leftHipPivot.add(leftUpperLeg);

    const leftKneePivot = new THREE.Group();
    leftKneePivot.position.y = -0.55;

    const leftKnee = createJoint(accentMat);
    leftKneePivot.add(leftKnee);

    const leftLowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), bodyMat);
    leftLowerLeg.position.y = -0.35;
    leftKneePivot.add(leftLowerLeg);

    const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.4), darkMat);
    leftFoot.position.set(0, -0.65, 0.05);
    leftKneePivot.add(leftFoot);

    leftHipPivot.add(leftKneePivot);
    torso.add(leftHipPivot);

    // ----- RIGHT LEG -----
    const rightHipPivot = new THREE.Group();
    rightHipPivot.position.set(0.25, -0.95, 0);

    const rightUpperLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), bodyMat);
    rightUpperLeg.position.y = -0.25;
    rightHipPivot.add(rightUpperLeg);

    const rightKneePivot = new THREE.Group();
    rightKneePivot.position.y = -0.55;

    const rightKnee = createJoint(accentMat);
    rightKneePivot.add(rightKnee);

    const rightLowerLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.25), bodyMat);
    rightLowerLeg.position.y = -0.35;
    rightKneePivot.add(rightLowerLeg);

    const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.4), darkMat);
    rightFoot.position.set(0, -0.65, 0.05);
    rightKneePivot.add(rightFoot);

    rightHipPivot.add(rightKneePivot);
    torso.add(rightHipPivot);

    scene.add(robot);

    // Ground & Grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0f, metalness: 0.5, roughness: 0.8 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.46;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(20, 40, 0x00ffff, 0x0a2a2a);
    gridHelper.position.y = -0.45;
    scene.add(gridHelper);

    // ============ ANIMATION ============
    let time = 0;

    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.02;
      const mode = animModeRef.current;

      // Core always rotates
      coreGroup.rotation.y += 0.05;
      coreGroup.rotation.x = Math.sin(time * 2) * 0.2;

      // Eye pulse
      const pulse = (Math.sin(time * 3) + 1) / 2;
      eyeMat.emissiveIntensity = 0.5 + pulse * 0.5;
      coreMat.emissiveIntensity = 0.5 + pulse * 0.5;
      (antennaTip.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(time * 5) > 0 ? 1 : 0.2;

      if (mode === 'idle') {
        robot.position.y = Math.sin(time) * 0.05;
        robot.rotation.y = Math.sin(time * 0.3) * 0.1;
        headPivot.rotation.y = Math.sin(time * 0.8) * 0.3;
        headPivot.rotation.x = Math.sin(time * 0.5) * 0.1;
        leftShoulderPivot.rotation.x = Math.sin(time * 0.7) * 0.1;
        rightShoulderPivot.rotation.x = Math.sin(time * 0.7 + Math.PI) * 0.1;
        leftElbowPivot.rotation.x = -0.2;
        rightElbowPivot.rotation.x = -0.2;
        leftHipPivot.rotation.x = 0;
        rightHipPivot.rotation.x = 0;
        leftKneePivot.rotation.x = 0;
        rightKneePivot.rotation.x = 0;
      }

      else if (mode === 'walk') {
        robot.position.y = Math.abs(Math.sin(time * 4)) * 0.1;
        robot.rotation.y = 0;
        headPivot.rotation.y = 0;
        headPivot.rotation.x = Math.sin(time * 4) * 0.05;
        leftShoulderPivot.rotation.x = Math.sin(time * 4) * 0.6;
        rightShoulderPivot.rotation.x = Math.sin(time * 4 + Math.PI) * 0.6;
        leftElbowPivot.rotation.x = -0.4 - Math.abs(Math.sin(time * 4)) * 0.3;
        rightElbowPivot.rotation.x = -0.4 - Math.abs(Math.sin(time * 4 + Math.PI)) * 0.3;
        leftHipPivot.rotation.x = Math.sin(time * 4 + Math.PI) * 0.5;
        rightHipPivot.rotation.x = Math.sin(time * 4) * 0.5;
        leftKneePivot.rotation.x = Math.max(0, Math.sin(time * 4 + Math.PI)) * 0.6;
        rightKneePivot.rotation.x = Math.max(0, Math.sin(time * 4)) * 0.6;
      }

      else if (mode === 'wave') {
        robot.position.y = Math.sin(time) * 0.05;
        robot.rotation.y = -0.3;
        headPivot.rotation.y = 0.2;
        headPivot.rotation.x = 0;
        rightShoulderPivot.rotation.x = -0.2;
        rightShoulderPivot.rotation.z = -2.5;
        rightElbowPivot.rotation.x = Math.sin(time * 6) * 0.5 - 0.5;
        leftShoulderPivot.rotation.x = 0.1;
        leftShoulderPivot.rotation.z = 0;
        leftElbowPivot.rotation.x = -0.3;
        leftHipPivot.rotation.x = 0;
        rightHipPivot.rotation.x = 0;
        leftKneePivot.rotation.x = 0;
        rightKneePivot.rotation.x = 0;
      }

      else if (mode === 'dance') {
        robot.position.y = Math.abs(Math.sin(time * 6)) * 0.15;
        robot.rotation.y = Math.sin(time * 3) * 0.4;
        headPivot.rotation.y = Math.sin(time * 6) * 0.3;
        headPivot.rotation.z = Math.sin(time * 3) * 0.2;
        leftShoulderPivot.rotation.x = Math.sin(time * 6) * 0.8;
        leftShoulderPivot.rotation.z = 0.3;
        rightShoulderPivot.rotation.x = Math.sin(time * 6 + Math.PI) * 0.8;
        rightShoulderPivot.rotation.z = -0.3;
        leftElbowPivot.rotation.x = -1.2 + Math.sin(time * 6) * 0.3;
        rightElbowPivot.rotation.x = -1.2 + Math.sin(time * 6 + Math.PI) * 0.3;
        leftHipPivot.rotation.x = Math.sin(time * 6) * 0.2;
        rightHipPivot.rotation.x = Math.sin(time * 6 + Math.PI) * 0.2;
        leftKneePivot.rotation.x = Math.abs(Math.sin(time * 6)) * 0.4;
        rightKneePivot.rotation.x = Math.abs(Math.sin(time * 6 + Math.PI)) * 0.4;
      }

      else if (mode === 'punch') {
        robot.position.y = 0;
        robot.rotation.y = Math.sin(time * 8) * 0.1;
        headPivot.rotation.y = 0;
        headPivot.rotation.x = 0.1;
        const punchPhase = (time * 4) % (Math.PI * 2);
        if (punchPhase < Math.PI) {
          leftShoulderPivot.rotation.x = -1.5 + Math.sin(punchPhase) * 0.3;
          leftElbowPivot.rotation.x = -0.2;
          rightShoulderPivot.rotation.x = 0.2;
          rightElbowPivot.rotation.x = -1.2;
        } else {
          rightShoulderPivot.rotation.x = -1.5 + Math.sin(punchPhase) * 0.3;
          rightElbowPivot.rotation.x = -0.2;
          leftShoulderPivot.rotation.x = 0.2;
          leftElbowPivot.rotation.x = -1.2;
        }
        leftHipPivot.rotation.x = 0.1;
        rightHipPivot.rotation.x = -0.1;
        leftKneePivot.rotation.x = 0.1;
        rightKneePivot.rotation.x = 0.1;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const buttons = [
    { mode: 'idle', label: 'Idle', color: 'bg-gray-600' },
    { mode: 'walk', label: 'Walk', color: 'bg-blue-600' },
    { mode: 'wave', label: 'Wave', color: 'bg-green-600' },
    { mode: 'dance', label: 'Dance', color: 'bg-purple-600' },
    { mode: 'punch', label: 'Punch', color: 'bg-red-600' },
  ];

  return (
    <div style={{ width: '100%', height: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', background: '#0f0f1a', borderBottom: '1px solid rgba(0,255,255,0.3)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ffff', margin: 0 }}>
          Articulated Low-Poly Robot (FLAT ONLY)
        </h1>
        <p style={{ fontSize: '14px', color: '#888', margin: '4px 0 0 0' }}>
          All BoxGeometry | No curved surfaces | Fully Rigged
        </p>
      </div>

      <div ref={containerRef} style={{ flex: 1 }} />

      <div style={{ padding: '16px', background: '#0f0f1a', borderTop: '1px solid rgba(0,255,255,0.3)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {buttons.map(({ mode, label, color }) => (
            <button
              key={mode}
              onClick={() => setAnimMode(mode)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 500,
                border: animMode === mode ? '2px solid #00ffff' : '2px solid transparent',
                background: animMode === mode ? '#333' : '#222',
                color: animMode === mode ? '#00ffff' : '#888',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
