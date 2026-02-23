<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import {
    detectPerformanceTier,
    createRenderer,
    disposeScene,
    disposeRenderer,
    createMouseTracker,
    createAnimationLoop,
  } from './threeUtils';

  let canvas: HTMLCanvasElement;
  let container: HTMLElement;

  onMount(() => {
    const perfConfig = detectPerformanceTier();
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 15;

    const renderer = createRenderer(canvas, perfConfig);
    const mouseTracker = createMouseTracker(container);

    // --- 3D Gavel (wireframe) ---
    const gavelGroup = new THREE.Group();

    // Gavel head (box)
    const headGeom = new THREE.BoxGeometry(3, 1.2, 1.2);
    const headEdges = new THREE.EdgesGeometry(headGeom);
    const headMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
    const headLine = new THREE.LineSegments(headEdges, headMat);
    headGeom.dispose();
    gavelGroup.add(headLine);

    // Gavel handle (cylinder)
    const handleGeom = new THREE.CylinderGeometry(0.2, 0.2, 4, 6);
    const handleEdges = new THREE.EdgesGeometry(handleGeom);
    const handleMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 });
    const handleLine = new THREE.LineSegments(handleEdges, handleMat);
    handleLine.position.y = -2.5;
    handleGeom.dispose();
    gavelGroup.add(handleLine);

    // Tilt the gavel
    gavelGroup.rotation.z = 0.3;
    scene.add(gavelGroup);

    // --- Orbiting shapes ---
    const orbitCount = perfConfig.tier === 'low' ? 4 : perfConfig.tier === 'medium' ? 6 : 8;
    interface OrbitShape {
      mesh: THREE.LineSegments;
      radius: number;
      speed: number;
      angle: number;
      yOffset: number;
    }

    const orbitShapes: OrbitShape[] = [];
    const orbitGeomFactories = [
      () => new THREE.IcosahedronGeometry(0.5),
      () => new THREE.OctahedronGeometry(0.5),
    ];

    for (let i = 0; i < orbitCount; i++) {
      const geomFactory = orbitGeomFactories[i % orbitGeomFactories.length];
      const geom = geomFactory();
      const edges = new THREE.EdgesGeometry(geom);
      const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 });
      const mesh = new THREE.LineSegments(edges, mat);
      geom.dispose();

      const radius = 3 + Math.random() * 4;
      const angle = (i / orbitCount) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 3,
        Math.sin(angle) * radius
      );
      scene.add(mesh);

      orbitShapes.push({
        mesh,
        radius,
        speed: 0.2 + Math.random() * 0.3,
        angle,
        yOffset: (Math.random() - 0.5) * 3,
      });
    }

    // Camera smoothing state
    let camTargetX = 0;
    let camTargetY = 0;

    // --- Animation ---
    const animLoop = createAnimationLoop((delta, elapsed) => {
      // Gavel rocking
      gavelGroup.rotation.z = 0.3 + Math.sin(elapsed * 0.5) * 0.26;
      gavelGroup.rotation.y += delta * 0.15;

      // Orbiting shapes
      for (const orbit of orbitShapes) {
        orbit.angle += orbit.speed * delta;
        orbit.mesh.position.x = Math.cos(orbit.angle) * orbit.radius;
        orbit.mesh.position.z = Math.sin(orbit.angle) * orbit.radius;
        orbit.mesh.position.y = orbit.yOffset + Math.sin(elapsed * 0.7 + orbit.angle) * 0.5;
        orbit.mesh.rotation.x += delta * 0.5;
        orbit.mesh.rotation.y += delta * 0.3;
      }

      // Mouse parallax on camera
      camTargetX = mouseTracker.coords.x * 0.5;
      camTargetY = mouseTracker.coords.y * 0.5;
      camera.position.x += (camTargetX - camera.position.x) * 0.05;
      camera.position.y += (camTargetY - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    });

    animLoop.start();

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      animLoop.stop();
      resizeObserver.disconnect();
      mouseTracker.cleanup();
      disposeScene(scene);
      disposeRenderer(renderer);
    };
  });
</script>

<div bind:this={container} class="three-hero">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .three-hero {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .three-hero canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
