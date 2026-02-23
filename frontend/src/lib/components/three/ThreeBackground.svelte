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
    type PerformanceConfig,
    type AnimationLoop,
    type MouseTracker,
  } from './threeUtils';

  let canvas: HTMLCanvasElement;
  let container: HTMLElement;

  onMount(() => {
    const perfConfig = detectPerformanceTier();
    const scene = new THREE.Scene();

    // Orthographic camera for consistent 2D-feeling sizing
    const frustumSize = 50;
    let aspect = window.innerWidth / window.innerHeight;
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
    renderer.setSize(window.innerWidth, window.innerHeight);

    const mouseTracker = createMouseTracker(container);

    // --- Wireframe shapes ---
    const shapeCount = Math.min(perfConfig.maxShapes, 15);
    const geometryFactories = [
      () => new THREE.BoxGeometry(2, 2, 2),
      () => new THREE.OctahedronGeometry(1.5),
      () => new THREE.TetrahedronGeometry(1.5),
    ];

    interface FloatingShape {
      mesh: THREE.LineSegments;
      velocity: THREE.Vector3;
      rotSpeed: THREE.Vector3;
    }

    const shapes: FloatingShape[] = [];
    for (let i = 0; i < shapeCount; i++) {
      const geomFactory = geometryFactories[i % geometryFactories.length];
      const geom = geomFactory();
      const edges = new THREE.EdgesGeometry(geom);
      const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 });
      const line = new THREE.LineSegments(edges, mat);
      geom.dispose();

      const halfW = frustumSize * aspect / 2;
      const halfH = frustumSize / 2;
      line.position.set(
        (Math.random() - 0.5) * halfW * 2,
        (Math.random() - 0.5) * halfH * 2,
        0
      );
      const scale = 0.8 + Math.random() * 1.5;
      line.scale.set(scale, scale, scale);

      scene.add(line);
      shapes.push({
        mesh: line,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          0
        ),
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.1
        ),
      });
    }

    // --- Particle field ---
    const baseParticleCount = 200;
    const particleCount = Math.round(baseParticleCount * perfConfig.particleMultiplier);
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    const halfW = frustumSize * aspect / 2;
    const halfH = frustumSize / 2;

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * halfW * 2;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * halfH * 2;
      particlePositions[i * 3 + 2] = 0;
      particleVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          0
        )
      );
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.08,
      size: 1.5,
      sizeAttenuation: false,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // --- Connecting lines (constellation effect) ---
    const lineThreshold = perfConfig.tier === 'high' ? 8 : 6;
    const maxLines = perfConfig.tier === 'high' ? 100 : 40;
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array(maxLines * 6);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeom.setDrawRange(0, 0);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.03,
    });
    const constellationLines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(constellationLines);

    // --- Animation ---
    const animLoop = createAnimationLoop((delta, elapsed) => {
      const currentHalfW = frustumSize * aspect / 2;
      const currentHalfH = frustumSize / 2;

      // Update shapes
      for (const shape of shapes) {
        shape.mesh.rotation.x += shape.rotSpeed.x * delta;
        shape.mesh.rotation.y += shape.rotSpeed.y * delta;
        shape.mesh.rotation.z += shape.rotSpeed.z * delta;

        shape.mesh.position.x += shape.velocity.x * delta;
        shape.mesh.position.y += shape.velocity.y * delta;

        // Viewport wrapping
        if (shape.mesh.position.x > currentHalfW + 3) shape.mesh.position.x = -currentHalfW - 3;
        if (shape.mesh.position.x < -currentHalfW - 3) shape.mesh.position.x = currentHalfW + 3;
        if (shape.mesh.position.y > currentHalfH + 3) shape.mesh.position.y = -currentHalfH - 3;
        if (shape.mesh.position.y < -currentHalfH - 3) shape.mesh.position.y = currentHalfH + 3;
      }

      // Update particles with Brownian motion and mouse repulsion
      const pos = particleGeom.attributes.position as THREE.BufferAttribute;
      const mouseWorldX = mouseTracker.coords.x * currentHalfW;
      const mouseWorldY = mouseTracker.coords.y * currentHalfH;

      for (let i = 0; i < particleCount; i++) {
        // Brownian motion
        particleVelocities[i].x += (Math.random() - 0.5) * 0.02;
        particleVelocities[i].y += (Math.random() - 0.5) * 0.02;
        // Damping
        particleVelocities[i].multiplyScalar(0.99);

        let px = pos.getX(i) + particleVelocities[i].x * delta * 60;
        let py = pos.getY(i) + particleVelocities[i].y * delta * 60;

        // Mouse repulsion
        const dx = px - mouseWorldX;
        const dy = py - mouseWorldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5 && dist > 0) {
          const force = (5 - dist) / 5 * 0.3;
          px += (dx / dist) * force;
          py += (dy / dist) * force;
        }

        // Wrap
        if (px > currentHalfW) px = -currentHalfW;
        if (px < -currentHalfW) px = currentHalfW;
        if (py > currentHalfH) py = -currentHalfH;
        if (py < -currentHalfH) py = currentHalfH;

        pos.setXY(i, px, py);
      }
      pos.needsUpdate = true;

      // Update constellation lines
      let lineIdx = 0;
      const linePos = constellationLines.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount && lineIdx < maxLines; i++) {
        for (let j = i + 1; j < particleCount && lineIdx < maxLines; j++) {
          const ax = pos.getX(i), ay = pos.getY(i);
          const bx = pos.getX(j), by = pos.getY(j);
          const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
          if (d < lineThreshold) {
            linePos.setXYZ(lineIdx * 2, ax, ay, 0);
            linePos.setXYZ(lineIdx * 2 + 1, bx, by, 0);
            lineIdx++;
          }
        }
      }
      linePos.needsUpdate = true;
      constellationLines.geometry.setDrawRange(0, lineIdx * 2);

      renderer.render(scene, camera);
    });

    animLoop.start();

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      aspect = width / height;

      camera.left = -frustumSize * aspect / 2;
      camera.right = frustumSize * aspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = -frustumSize / 2;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    });
    resizeObserver.observe(document.documentElement);

    return () => {
      animLoop.stop();
      resizeObserver.disconnect();
      mouseTracker.cleanup();
      disposeScene(scene);
      disposeRenderer(renderer);
    };
  });
</script>

<div bind:this={container} class="three-background">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .three-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }

  .three-background canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
