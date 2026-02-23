<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import {
    detectPerformanceTier,
    createRenderer,
    disposeScene,
    disposeRenderer,
    createAnimationLoop,
    type PerformanceConfig,
  } from './threeUtils';

  interface Props {
    bidCount?: number;
    isActive?: boolean;
    currentBid?: number;
    startingPrice?: number;
  }

  let { bidCount = 0, isActive = true, currentBid = 0, startingPrice = 0 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let container: HTMLElement;
  let perfConfig: PerformanceConfig | null = $state(null);
  let isLowTier = $state(false);

  // Track bid count changes for particle effects
  let lastBidCount = $state(bidCount);

  // Particle pool
  interface BidParticle {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    active: boolean;
  }

  let particlePool: BidParticle[] = [];
  let particlePointsRef: THREE.Points | null = null;
  let particleGeomRef: THREE.BufferGeometry | null = null;

  function spawnBidParticles(count: number) {
    let spawned = 0;
    for (const p of particlePool) {
      if (!p.active && spawned < count) {
        p.active = true;
        p.life = 0;
        p.maxLife = 1.5 + Math.random() * 0.5;
        p.position.set(
          (Math.random() - 0.5) * 4,
          -1,
          (Math.random() - 0.5) * 4
        );
        p.velocity.set(
          (Math.random() - 0.5) * 2,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 2
        );
        spawned++;
      }
    }
  }

  // Watch for bid count changes
  $effect(() => {
    if (bidCount > lastBidCount && particlePool.length > 0) {
      const particlesToSpawn = Math.min(20, Math.max(10, (bidCount - lastBidCount) * 10));
      spawnBidParticles(particlesToSpawn);
    }
    lastBidCount = bidCount;
  });

  onMount(() => {
    perfConfig = detectPerformanceTier();
    isLowTier = perfConfig.tier === 'low';

    if (isLowTier) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2, 10);
    camera.lookAt(0, 0, 0);

    const renderer = createRenderer(canvas, perfConfig);

    // --- Rotating wireframe frame (display pedestal) ---
    const frameGroup = new THREE.Group();

    const frameGeom = new THREE.BoxGeometry(5, 4, 0.3);
    const frameEdges = new THREE.EdgesGeometry(frameGeom);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });
    const frameLine = new THREE.LineSegments(frameEdges, frameMat);
    frameGeom.dispose();
    frameGroup.add(frameLine);

    // Corner decorations (4 small octahedrons)
    const cornerPositions = [
      new THREE.Vector3(-2.5, 2, 0),
      new THREE.Vector3(2.5, 2, 0),
      new THREE.Vector3(-2.5, -2, 0),
      new THREE.Vector3(2.5, -2, 0),
    ];

    interface CornerDeco {
      mesh: THREE.LineSegments;
      rotSpeed: THREE.Vector3;
    }
    const corners: CornerDeco[] = [];

    for (const pos of cornerPositions) {
      const geom = new THREE.OctahedronGeometry(0.3);
      const edges = new THREE.EdgesGeometry(geom);
      const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });
      const mesh = new THREE.LineSegments(edges, mat);
      geom.dispose();
      mesh.position.copy(pos);
      frameGroup.add(mesh);
      corners.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1
        ),
      });
    }

    scene.add(frameGroup);

    // --- Bid particles pool ---
    const maxParticles = 50;
    for (let i = 0; i < maxParticles; i++) {
      particlePool.push({
        position: new THREE.Vector3(0, -10, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        life: 0,
        maxLife: 2,
        active: false,
      });
    }

    const particlePositions = new Float32Array(maxParticles * 3);
    particleGeomRef = new THREE.BufferGeometry();
    particleGeomRef.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
      size: 2,
      sizeAttenuation: false,
    });
    particlePointsRef = new THREE.Points(particleGeomRef, particleMat);
    scene.add(particlePointsRef);

    // --- Animation ---
    const animLoop = createAnimationLoop((delta, elapsed) => {
      // Rotate frame
      frameGroup.rotation.y += delta * 0.3;

      // Active auction opacity pulse
      if (isActive) {
        const pulse = 0.08 + Math.sin(elapsed * 2) * 0.04;
        (frameLine.material as THREE.LineBasicMaterial).opacity = pulse;
      }

      // Corner rotations
      for (const corner of corners) {
        corner.mesh.rotation.x += corner.rotSpeed.x * delta;
        corner.mesh.rotation.y += corner.rotSpeed.y * delta;
      }

      // Update bid particles
      const pos = particleGeomRef!.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particlePool.length; i++) {
        const p = particlePool[i];
        if (p.active) {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            p.position.set(0, -10, 0);
          } else {
            p.position.x += p.velocity.x * delta;
            p.position.y += p.velocity.y * delta;
            p.position.z += p.velocity.z * delta;
            // Slow down
            p.velocity.multiplyScalar(0.98);
          }
        }
        pos.setXYZ(i, p.position.x, p.position.y, p.position.z);
      }
      pos.needsUpdate = true;

      // Fade particles based on active count
      const activeCount = particlePool.filter((p) => p.active).length;
      (particlePointsRef!.material as THREE.PointsMaterial).opacity = activeCount > 0 ? 0.15 : 0;

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
      particlePool = [];
      particleGeomRef = null;
      particlePointsRef = null;
      disposeScene(scene);
      disposeRenderer(renderer);
    };
  });
</script>

{#if !isLowTier}
  <div bind:this={container} class="three-showcase">
    <canvas bind:this={canvas}></canvas>
  </div>
{:else}
  <div></div>
{/if}

<style>
  .three-showcase {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .three-showcase canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
