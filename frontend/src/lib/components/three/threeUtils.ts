import * as THREE from 'three';

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceConfig {
  tier: PerformanceTier;
  particleMultiplier: number;
  maxPixelRatio: number;
  maxShapes: number;
}

export function detectPerformanceTier(): PerformanceConfig {
  let tier: PerformanceTier = 'high';

  // Check mobile UA
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check hardware concurrency
  const cores = navigator.hardwareConcurrency || 2;

  // Try to detect GPU via WebGL
  let isLowGPU = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const lowGPUPatterns = /SwiftShader|llvmpipe|Mesa|Intel.*HD.*[2-4]000|Mali-4/i;
        isLowGPU = lowGPUPatterns.test(renderer);
      }
    }
  } catch {
    // WebGL detection failed, assume medium
  }

  if (isMobile || cores <= 2 || isLowGPU) {
    tier = 'low';
  } else if (cores <= 4) {
    tier = 'medium';
  }

  const configs: Record<PerformanceTier, PerformanceConfig> = {
    high: { tier: 'high', particleMultiplier: 1, maxPixelRatio: 2, maxShapes: 15 },
    medium: { tier: 'medium', particleMultiplier: 0.5, maxPixelRatio: 1.5, maxShapes: 8 },
    low: { tier: 'low', particleMultiplier: 0.2, maxPixelRatio: 1, maxShapes: 4 },
  };

  return configs[tier];
}

export function createRenderer(canvas: HTMLCanvasElement, perfConfig: PerformanceConfig): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: perfConfig.tier === 'high',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, perfConfig.maxPixelRatio));
  return renderer;
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points || object instanceof THREE.Line) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  });
}

export function disposeRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.dispose();
  renderer.forceContextLoss();
}

export interface MouseTracker {
  coords: { x: number; y: number };
  cleanup: () => void;
}

export function createMouseTracker(container: HTMLElement): MouseTracker {
  const coords = { x: 0, y: 0 };

  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    coords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    coords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseLeave() {
    coords.x = 0;
    coords.y = 0;
  }

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseleave', onMouseLeave);

  return {
    coords,
    cleanup: () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    },
  };
}

export interface AnimationLoop {
  start: () => void;
  stop: () => void;
}

export function createAnimationLoop(callback: (delta: number, elapsed: number) => void): AnimationLoop {
  let rafId: number | null = null;
  let lastTime = 0;
  let elapsed = 0;
  let running = false;

  function onVisibilityChange() {
    if (document.hidden) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (running) {
      lastTime = performance.now();
      loop();
    }
  }

  function loop() {
    rafId = requestAnimationFrame((time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1); // Cap at 100ms
      lastTime = time;
      elapsed += delta;
      callback(delta, elapsed);
      if (running) loop();
    });
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      loop();
    },
    stop() {
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
