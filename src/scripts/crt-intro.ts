/**
 * First-visit intro: a wireframe CRT powers on, boots, then shows the live
 * constellation (rendered into `target` by the caller) and the camera dives
 * into the screen. When it finishes, the caller renders the world directly
 * from the same pose, so the dive lands seamlessly inside the scene.
 */
import * as THREE from 'three';
import { makeGlowTexture } from './three-utils';

const SCREEN_W = 3.6, SCREEN_H = 2.7;
const INTRO_FOV = 40;
/** The world camera's vertical FOV; the landing frame must match it. */
const WORLD_FOV = 50;
const T = { power: 450, boot: 2300, hold: 350, handoff: 550, dive: 1500 };
const T_BOOT = T.power;
const T_HOLD = T_BOOT + T.boot;
const T_HANDOFF = T_HOLD + T.hold;
const T_DIVE = T_HANDOFF + T.handoff;
export const INTRO_TOTAL_MS = T_DIVE + T.dive;

type Segment = [text: string, color: string];
const BOOT_LINES: Segment[][] = [
    [['SJL-BIOS v26.09', '#FF9E64'], ['   (c) 2026 sungjun lee\'s system', '#565F89']],
    [],
    [['CPU  ', '#9AA5CE'], ['CMCM @ University of British Columbia ', '#C0CAF5'], ['.... OK', '#9ECE6A']],
    [['YEAR ', '#9AA5CE'], ['4 of 4 ', '#C0CAF5'], ['............................... OK', '#9ECE6A']],
    [['DISK ', '#9AA5CE'], ['/home/sungjun ', '#C0CAF5'], ['........................ OK', '#9ECE6A']],
    [['MNT  ', '#9AA5CE'], ['~/journey ~/projects ~/courses ~/math ', '#7DCFFF'], ['OK', '#9ECE6A']],
    [['NET  ', '#9AA5CE'], ['seoul.kr → tokyo.jp → ubc.ca ', '#C0CAF5'], ['.......... OK', '#9ECE6A']],
    [],
    [['guest', '#7DCFFF'], ['@', '#B2D3D8'], ['ubc', '#9AA5CE'], [' ~ ', '#F7768E'], ['→ ', '#565F89'], ['ssh sungjun@ubc', '#BB9AF7']],
    [['Welcome. Launching the constellation...', '#C0CAF5']],
];

export interface CrtIntro {
    /** Render target the caller fills with the world, as seen from the dive's landing pose. */
    readonly target: THREE.WebGLRenderTarget;
    /** Vertical FOV (4:3 aspect) to render `target` with, so the landed screen matches the world view exactly. */
    readonly targetFov: number;
    readonly done: boolean;
    /** Draw one frame of the intro to the screen. */
    render(renderer: THREE.WebGLRenderer, now: number): void;
    resize(aspect: number): void;
    skip(): void;
}

export function createCrtIntro(start: number, onDone: () => void): CrtIntro {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1b26);
    const camera = new THREE.PerspectiveCamera(INTRO_FOV, 1, 0.05, 100);

    const target = new THREE.WebGLRenderTarget(1024, 768);

    // ── Boot text, drawn to a canvas as it "types" ──────
    const bootCanvas = document.createElement('canvas');
    bootCanvas.width = 1024;
    bootCanvas.height = 768;
    const ctx = bootCanvas.getContext('2d')!;
    const bootTexture = new THREE.CanvasTexture(bootCanvas);
    bootTexture.colorSpace = THREE.SRGBColorSpace;
    const totalChars = BOOT_LINES.reduce((n, line) => n + line.reduce((m, [t]) => m + t.length, 0) + 1, 0);
    let drawnChars = -1;

    function drawBoot(chars: number, cursorOn: boolean) {
        ctx.fillStyle = '#1a1b26';
        ctx.fillRect(0, 0, bootCanvas.width, bootCanvas.height);
        ctx.font = '26px "Consolas", "Monaco", "Andale Mono", monospace';
        ctx.textBaseline = 'top';
        let left = chars, x = 0, y = 70;
        for (const line of BOOT_LINES) {
            x = 70;
            for (const [text, color] of line) {
                if (left <= 0) break;
                const shown = text.slice(0, left);
                ctx.fillStyle = color;
                ctx.fillText(shown, x, y);
                x += ctx.measureText(shown).width;
                left -= shown.length;
            }
            if (left <= 0) break;
            left -= 1;   // newline
            y += 40;
        }
        if (cursorOn) {
            ctx.fillStyle = '#C0CAF5';
            ctx.fillRect(x + 4, y + 2, 14, 26);
        }
        bootTexture.needsUpdate = true;
    }

    // ── Screen: slightly bulged plane with a CRT shader ─
    const screenGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 32, 24);
    const p = screenGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / (SCREEN_W / 2), v = p.getY(i) / (SCREEN_H / 2);
        p.setZ(i, 0.16 * (1 - u * u) * (1 - v * v));
    }
    const uniforms = {
        uBoot: { value: bootTexture },
        uWorld: { value: target.texture },
        uMix: { value: 0 },
        uPower: { value: 0 },
        uClean: { value: 0 },
        uTime: { value: 0 },
    };
    const screen = new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform sampler2D uBoot;
            uniform sampler2D uWorld;
            uniform float uMix, uPower, uClean, uTime;
            varying vec2 vUv;
            void main() {
                // Barrel distortion and scanlines fade out as the dive lands, so the last frame is clean.
                vec2 c = vUv * 2.0 - 1.0;
                c *= 1.0 + 0.07 * (1.0 - uClean) * dot(c, c);
                vec2 uv = c * 0.5 + 0.5;
                vec3 col = vec3(0.0);
                if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
                    col = mix(texture2D(uBoot, uv).rgb, texture2D(uWorld, uv).rgb, uMix);
                    float scan = 0.82 + 0.18 * sin(uv.y * 900.0 + uTime * 6.0);
                    col *= mix(scan, 1.0, uClean);
                    float vig = smoothstep(0.95, 0.35, length(uv - 0.5));
                    col *= mix(0.5 + 0.5 * vig, 1.0, uClean);
                }
                // Power-on: a bright line that opens into the picture.
                float open = clamp(uPower, 0.0, 1.0);
                float band = step(abs(vUv.y - 0.5), max(open * open, 0.004) * 0.5) * step(abs(vUv.x - 0.5), min(1.0, open * 5.0) * 0.5);
                col = col * band + vec3(0.85, 0.9, 1.0) * band * (1.0 - smoothstep(0.0, 0.6, open));
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    }));
    scene.add(screen);

    // ── Wireframe body, in the constellation's style ────
    const line = new THREE.LineBasicMaterial({ color: 0xbb9af7, transparent: true, opacity: 0.75 });
    const edges = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line);
        e.position.set(x, y, z);
        scene.add(e);
    };
    edges(new THREE.BoxGeometry(SCREEN_W + 0.7, SCREEN_H + 0.7, 0.35), 0, 0, -0.05);   // bezel
    edges(new THREE.BoxGeometry(SCREEN_W - 0.2, SCREEN_H - 0.3, 2.2), 0, 0.05, -1.3);   // tube housing
    edges(new THREE.BoxGeometry(0.7, 0.45, 0.7), 0, -SCREEN_H / 2 - 0.55, -1.0);        // neck
    edges(new THREE.BoxGeometry(2.2, 0.16, 1.6), 0, -SCREEN_H / 2 - 0.85, -1.0);        // base
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: 0x7aa2f7, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
    }));
    glow.scale.set(11, 8, 1);
    glow.position.z = -0.4;
    scene.add(glow);

    const startPos = new THREE.Vector3(1.4, 0.8, 9.5);
    const endPos = new THREE.Vector3();   // set in resize(): where the screen exactly fills the view
    let targetFov = WORLD_FOV;
    const look = new THREE.Vector3();
    let skipAt = Infinity;
    let finished = false;

    const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
    const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    return {
        target,
        get targetFov() { return targetFov; },
        get done() { return finished; },

        render(renderer, now) {
            let t = now - start;
            // A skip jumps straight to a short dive.
            if (skipAt < Infinity) t = Math.max(t, T_DIVE + T.dive * 0.75 + (now - skipAt));
            if (t >= INTRO_TOTAL_MS) {
                if (!finished) { finished = true; onDone(); }
                return;
            }

            uniforms.uTime.value = now / 1000;
            uniforms.uPower.value = clamp01(t / T.power);
            const typed = Math.floor(clamp01((t - T_BOOT) / T.boot) * totalChars);
            const cursorOn = Math.floor(now / 400) % 2 === 0;
            const key = typed * 2 + (cursorOn ? 1 : 0);
            if (key !== drawnChars) { drawnChars = key; drawBoot(typed, cursorOn); }
            uniforms.uMix.value = easeInOut(clamp01((t - T_HANDOFF) / T.handoff));
            const dive = easeInOut(clamp01((t - T_DIVE) / T.dive));
            uniforms.uClean.value = clamp01((dive - 0.55) / 0.4);
            (glow.material as THREE.SpriteMaterial).opacity = 0.35 * uniforms.uPower.value * (1 - dive);
            screen.scale.z = 1 - dive;   // flatten the glass so the landing frame isn't bulged

            // Drift slightly while booting, then dive straight into the glass.
            const drift = clamp01(t / T_DIVE);
            camera.position.copy(startPos).lerp(new THREE.Vector3(0.6, 0.35, 7.5), drift).lerp(endPos, dive);
            look.set(0, -0.1 * (1 - dive), 0);
            camera.lookAt(look);

            renderer.render(scene, camera);
        },

        resize(aspect) {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            // Land where the screen just covers the viewport: fill the width on wide viewports, the height otherwise.
            const tanI = Math.tan(THREE.MathUtils.degToRad(INTRO_FOV / 2));
            const d = aspect >= SCREEN_W / SCREEN_H ? (SCREEN_W / 2) / (tanI * aspect) : (SCREEN_H / 2) / tanI;
            endPos.set(0, 0, d);
            // Only this fraction of the screen's height is visible at landing; widen the target's FOV
            // so that visible crop equals the world camera's frustum.
            const visible = Math.min(1, (2 * d * tanI) / SCREEN_H);
            targetFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(WORLD_FOV / 2)) / visible));
        },

        skip() {
            if (skipAt === Infinity) skipAt = performance.now();
        },
    };
}
