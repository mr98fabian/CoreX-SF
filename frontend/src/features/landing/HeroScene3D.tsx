/**
 * HeroScene3D — Ultra-subtle WebGL ambiance for the KoreX hero.
 *
 * Only tiny dot particles with additive blending.
 * No solid/wireframe geometry to avoid visual artifacts.
 * Fully transparent canvas, composited behind hero content.
 */
import { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Constants ────────────────────────────────────── */
const PARTICLE_COUNT = 120;
const MOBILE_PARTICLE_COUNT = 60;

/* ── Deterministic pseudo-random (no Math.random in render) ─── */
function seeded(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

/* ── Generate circular dot texture (avoid default squares) ──── */
function createDotTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// Eager-init to avoid creating each frame
let _dotTex: THREE.Texture | null = null;
function getDotTexture(): THREE.Texture {
    if (!_dotTex) _dotTex = createDotTexture();
    return _dotTex;
}

/* ── Mouse tracker (shared, no React state) ───────── */
const mouse = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });
}

/* ── Particle Field ───────────────────────────────── */
function Particles() {
    const ref = useRef<THREE.Points>(null);
    const { size } = useThree();
    const count = size.width < 768 ? MOBILE_PARTICLE_COUNT : PARTICLE_COUNT;
    const dotMap = useMemo(() => getDotTexture(), []);

    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 6;
            const r = 0.5 + (i / count) * 7;
            arr[i * 3] = Math.cos(angle) * r + (seeded(i * 7) - 0.5) * 3;
            arr[i * 3 + 1] = (seeded(i * 3) - 0.5) * 6;
            arr[i * 3 + 2] = Math.sin(angle) * r + (seeded(i * 11) - 0.5) * 3 - 4;
        }
        return arr;
    }, [count]);

    useFrame((_, dt) => {
        if (!ref.current) return;
        ref.current.rotation.y += dt * 0.015;
        ref.current.position.x += (mouse.x * 0.4 - ref.current.position.x) * 0.006;
        ref.current.position.y += (mouse.y * 0.2 - ref.current.position.y) * 0.006;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
            </bufferGeometry>
            <pointsMaterial
                map={dotMap}
                color="#fbbf24"
                size={1.2}
                sizeAttenuation
                transparent
                opacity={0.15}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

/* ── Second layer — accent dots ───────────────────── */
function AccentParticles() {
    const ref = useRef<THREE.Points>(null);
    const { size } = useThree();
    const count = size.width < 768 ? 30 : 60;
    const dotMap = useMemo(() => getDotTexture(), []);

    const positions = useMemo(() => {
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (seeded(i * 17 + 100) - 0.5) * 14;
            arr[i * 3 + 1] = (seeded(i * 23 + 200) - 0.5) * 8;
            arr[i * 3 + 2] = (seeded(i * 31 + 300) - 0.5) * 6 - 5;
        }
        return arr;
    }, [count]);

    useFrame((_, dt) => {
        if (!ref.current) return;
        ref.current.rotation.y -= dt * 0.008;
        ref.current.rotation.x += dt * 0.003;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
            </bufferGeometry>
            <pointsMaterial
                map={dotMap}
                color="#8b5cf6"
                size={0.8}
                sizeAttenuation
                transparent
                opacity={0.10}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

/* ── Exported Canvas ──────────────────────────────── */
export default function HeroScene3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Pause WebGL rendering when hero is scrolled offscreen
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // R3F respects the frameloop prop; we toggle visibility
                // to let the browser skip compositing entirely
                const container = canvas.parentElement;
                if (container) {
                    container.style.visibility = entry.isIntersecting ? 'visible' : 'hidden';
                }
            },
            { threshold: 0 }
        );

        observer.observe(canvas);
        return () => observer.disconnect();
    }, []);

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            willChange: 'transform',
        }}>
            <Suspense fallback={null}>
                <Canvas
                    ref={canvasRef}
                    camera={{ position: [0, 0, 8], fov: 60 }}
                    gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
                    dpr={[1, 1.5]}
                    frameloop="always"
                    style={{ background: 'transparent' }}
                >
                    <Particles />
                    <AccentParticles />
                </Canvas>
            </Suspense>
        </div>
    );
}
