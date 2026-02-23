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

    const frustumSize = 40;
    let aspect = 1;
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    camera.position.z = 50;

    const renderer = createRenderer(canvas, perfConfig);
    const mouseTracker = createMouseTracker(container);

    // --- Wireframe cluster shapes ---
    const clusterCount = perfConfig.tier === 'low' ? 4 : 6;
    interface ClusterShape {
      mesh: THREE.LineSegments;
      basePos: THREE.Vector3;
      rotSpeed: THREE.Vector3;
    }
    const clusterShapes: ClusterShape[] = [];

    const geomFactories = [
      () => new THREE.BoxGeometry(3, 3, 3),
      () => new THREE.OctahedronGeometry(2),
    ];

    // Position shapes around the edges (frame-like arrangement)
    const edgePositions = [
      new THREE.Vector3(-12, 10, 0),
      new THREE.Vector3(12, 10, 0),
      new THREE.Vector3(-12, -10, 0),
      new THREE.Vector3(12, -10, 0),
      new THREE.Vector3(-14, 0, 0),
      new THREE.Vector3(14, 0, 0),
    ];

    for (let i = 0; i < clusterCount; i++) {
      const geomFactory = geomFactories[i % geomFactories.length];
      const geom = geomFactory();
      const edges = new THREE.EdgesGeometry(geom);
      const opacity = 0.08 + Math.random() * 0.04;
      const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity });
      const mesh = new THREE.LineSegments(edges, mat);
      geom.dispose();

      const pos = edgePositions[i % edgePositions.length];
      mesh.position.copy(pos);
      // Rotate boxes 45 degrees
      if (i % 2 === 0) {
        mesh.rotation.z = Math.PI / 4;
      }

      scene.add(mesh);
      clusterShapes.push({
        mesh,
        basePos: pos.clone(),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.2
        ),
      });
    }

    // --- Drifting line fragments ---
    const lineCount = perfConfig.tier === 'low' ? 10 : perfConfig.tier === 'medium' ? 20 : 30;
    interface DriftLine {
      mesh: THREE.Line;
      velocity: THREE.Vector2;
    }
    const driftLines: DriftLine[] = [];

    for (let i = 0; i < lineCount; i++) {
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 0),
      ];
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.05 });
      const line = new THREE.Line(geom, mat);

      line.position.set(
        (Math.random() - 0.5) * frustumSize * 1.5,
        (Math.random() - 0.5) * frustumSize,
        0
      );

      scene.add(line);
      driftLines.push({
        mesh: line,
        velocity: new THREE.Vector2(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.4
        ),
      });
    }

    // --- Animation ---
    const animLoop = createAnimationLoop((delta, elapsed) => {
      const halfW = frustumSize * aspect / 2;
      const halfH = frustumSize / 2;

      // Update cluster shapes - tilt toward cursor
      for (const shape of clusterShapes) {
        shape.mesh.rotation.x += shape.rotSpeed.x * delta;
        shape.mesh.rotation.y += shape.rotSpeed.y * delta;

        // Mouse reactivity: shapes tilt toward cursor
        const targetTiltX = mouseTracker.coords.y * 0.3;
        const targetTiltY = mouseTracker.coords.x * 0.3;
        shape.mesh.rotation.x += (targetTiltX - shape.mesh.rotation.x % (Math.PI * 2)) * 0.02;
        shape.mesh.rotation.y += (targetTiltY - shape.mesh.rotation.y % (Math.PI * 2)) * 0.02;
      }

      // Update drifting lines
      for (const dl of driftLines) {
        dl.mesh.position.x += dl.velocity.x * delta;
        dl.mesh.position.y += dl.velocity.y * delta;

        // Wrap
        if (dl.mesh.position.x > halfW + 5) dl.mesh.position.x = -halfW - 5;
        if (dl.mesh.position.x < -halfW - 5) dl.mesh.position.x = halfW + 5;
        if (dl.mesh.position.y > halfH + 5) dl.mesh.position.y = -halfH - 5;
        if (dl.mesh.position.y < -halfH - 5) dl.mesh.position.y = halfH + 5;
      }

      renderer.render(scene, camera);
    });

    animLoop.start();

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          aspect = width / height;
          camera.left = -frustumSize * aspect / 2;
          camera.right = frustumSize * aspect / 2;
          camera.top = frustumSize / 2;
          camera.bottom = -frustumSize / 2;
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

<div bind:this={container} class="three-auth-bg">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .three-auth-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .three-auth-bg canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
