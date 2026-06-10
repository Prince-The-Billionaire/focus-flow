// components/ui/ThreeAvatar.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface ThreeAvatarProps {
  isAnalyzing?: boolean;
  layoutMode?: 'center' | 'side';
}

export default function ThreeAvatar({ isAnalyzing = false, layoutMode = 'center' }: ThreeAvatarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    // 2. High-End Light-Mode Studio Rigging
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const mainDirectional = new THREE.DirectionalLight(0xffffff, 2.2);
    mainDirectional.position.set(6, 10, 6);
    scene.add(mainDirectional);

    const softFill = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    softFill.position.set(-6, 3, 4);
    scene.add(softFill);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
    rimLight.position.set(0, -3, -6);
    scene.add(rimLight);

    let loadedModel: THREE.Group | null = null;
    const loader = new GLTFLoader();
    
    loader.load(
      '/avatar.glb',
      (gltf) => {
        loadedModel = gltf.scene;
        loadedModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.roughness = Math.min(mat.roughness, 0.12); 
              mat.metalness = Math.max(mat.metalness, 0.15);
            }
          }
        });

        // Center pivot perfectly within local coordinates
        loadedModel.position.set(0, -0.6, 0);
        loadedModel.scale.set(1.1, 1.1, 1.1); 
        scene.add(loadedModel);
        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('GLTF loading exception:', error);
        setIsLoading(false);
      }
    );

    // 3. Normalized Mouse Delta Vector Tracking
    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      mouse.current.x = THREE.MathUtils.clamp(x * 0.3, -0.3, 0.3);
      mouse.current.y = THREE.MathUtils.clamp(y * 0.2, -0.2, 0.2);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 4. Real-time Fluid Render & Adaptive Size Tracking Loop
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Dynamic Canvas Resizer Check to support smooth GSAP layout width morphing
      const currentWidth = container.clientWidth;
      const currentHeight = container.clientHeight;
      if (renderer.domElement.width !== currentWidth || renderer.domElement.height !== currentHeight) {
        camera.aspect = currentWidth / currentHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentWidth, currentHeight, false);
      }

      if (loadedModel) {
        // Idle ambient floating rhythm
        loadedModel.position.y = -0.55 + Math.sin(time * 1.3) * 0.06;
        
        if (isAnalyzing) {
          loadedModel.position.x = Math.sin(time * 26) * 0.012;
        } else {
          loadedModel.position.x = THREE.MathUtils.lerp(loadedModel.position.x, 0, 0.1);
        }

        // Target Matrix calculations based on current Layout State
        let targetRotationY = mouse.current.x;
        let targetRotationX = -mouse.current.y;

        if (layoutMode === 'side') {
          // Adjust look vectors to turn towards the right panel and tilt upward
          targetRotationY += 0.55; 
          targetRotationX -= 0.15; 
        }

        // Apply smooth interpolation (Lerp) to the final angles
        loadedModel.rotation.y += (targetRotationY - loadedModel.rotation.y) * 0.08;
        loadedModel.rotation.x += (targetRotationX - loadedModel.rotation.x) * 0.08;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (loadedModel) scene.remove(loadedModel);
      renderer.dispose();
    };
  }, [isAnalyzing, layoutMode]);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none z-10 transition-opacity duration-300">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-white/40 backdrop-blur-md z-20">
          <div className="h-7 w-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase font-bold">Synchronizing Mesh Asset...</span>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}