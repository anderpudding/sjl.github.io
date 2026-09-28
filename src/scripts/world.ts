/**
 * The persistent 3D backdrop: every route is a node in a directory
 * "constellation" and the camera flies between nodes on navigation.
 * The canvas is persisted by the view-transition router, so this runs once.
 */
import * as THREE from 'three';
import { navigate } from 'astro:transitions/client';
import { routes, routeFor, type Route } from '../data/routes';

const C = {
    bg: 0x1a1b26,
    text: 0xc0caf5,
    orange: 0xff9e64,
    purple: 0xbb9af7,
    cyan: 0x7dcfff,
    dim: 0x565f89,
    host: 0x9aa5ce,
};
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const FLIGHT_MS = 1800;
const INTRO_MS = 2600;

interface WorldNode {
    route: Route;
    pos: THREE.Vector3;
    group: THREE.Group;
    core: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
    glow: THREE.Sprite;
    label: THREE.Sprite;
    hover: number;       // 0..1, eased
    active: number;      // 0..1, eased
}

interface Pose { pos: THREE.Vector3; target: THREE.Vector3; }

let started = false;

export function startWorld(el: HTMLCanvasElement | null): void {
    if (!el || started) return;
    started = true;
    const canvas = el;

    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
        return;   // no WebGL: the canvas keeps its CSS gradient
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    const FOG_DENSITY = 0.02;
    const fog = new THREE.FogExp2(C.bg, FOG_DENSITY);
    scene.fog = fog;
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

    // ── Nodes ────────────────────────────────────────────
    const glowTexture = makeGlowTexture();
    const children = routes.filter(r => r.href !== '/');
    const nodes: WorldNode[] = routes.map(route => {
        const isRoot = route.href === '/';
        const i = children.indexOf(route);
        const angle = i / children.length * TAU + 0.35;
        const pos = isRoot
            ? new THREE.Vector3(0, 0, 0)
            : new THREE.Vector3(Math.sin(angle) * 16, Math.sin(i * 2.1) * 3.5, Math.cos(angle) * 16);

        const group = new THREE.Group();
        group.position.copy(pos);

        const core = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(isRoot ? 1.2 : 0.75, isRoot ? 1 : 0)),
            new THREE.LineBasicMaterial({ color: isRoot ? C.orange : C.purple, transparent: true }),
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture, color: isRoot ? C.orange : C.purple,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
        }));
        glow.scale.setScalar(isRoot ? 6 : 4);

        const label = makeLabel(route.path, route.blurb);
        label.position.set(0, isRoot ? 2.4 : 1.7, 0);

        group.add(core, glow, label);
        scene.add(group);
        return { route, pos, group, core, glow, label, hover: 0, active: 0 };
    });
    const root = nodes[0];

    // ── Edges from ~ to each directory, with packets running along them ──
    const curves = nodes.slice(1).map(n => {
        const mid = n.pos.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 4, 0));
        return new THREE.QuadraticBezierCurve3(root.pos, mid, n.pos);
    });
    for (const curve of curves) {
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
            new THREE.LineDashedMaterial({ color: C.dim, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.8 }),
        );
        line.computeLineDistances();
        scene.add(line);
    }
    const PACKETS_PER_EDGE = 2;
    const packetGeo = new THREE.BufferGeometry();
    const packetPos = new Float32Array(curves.length * PACKETS_PER_EDGE * 3);
    packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPos, 3));
    const packets = new THREE.Points(packetGeo, new THREE.PointsMaterial({
        color: C.cyan, size: 0.35, map: glowTexture, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(packets);

    // ── Backdrop: stars + polar grid floor ───────────────
    const STAR_COUNT = 1800;
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starCol = new Float32Array(STAR_COUNT * 3);
    const palette = [C.text, C.dim, C.host, C.purple, C.cyan].map(c => new THREE.Color(c));
    for (let i = 0; i < STAR_COUNT; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(70 + Math.random() * 90);
        starPos.set([v.x, v.y, v.z], i * 3);
        const col = palette[Math.floor(Math.random() * palette.length)];
        starCol.set([col.r, col.g, col.b], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        size: 0.45, vertexColors: true, transparent: true, opacity: 0.75, fog: false,
    }));
    scene.add(stars);

    const grid = new THREE.PolarGridHelper(46, 16, 10, 96, C.dim, C.dim);
    grid.position.y = -9;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    scene.add(grid);

    // ── Camera poses ─────────────────────────────────────
    function poseFor(route: Route): Pose {
        const node = nodes.find(n => n.route === route) ?? root;
        // Home: aim above ~ so the constellation sits below the hero title.
        if (node === root) return { pos: new THREE.Vector3(0, 12, 34), target: new THREE.Vector3(0, 4.5, 0) };
        // Stand outside the ring, swung to the side so ~ isn't hidden right behind the node,
        // and aim a little below it so the node sits in the hero band above the window.
        const out = new THREE.Vector3(node.pos.x, 0, node.pos.z).normalize().applyAxisAngle(UP, 0.65);
        return {
            pos: node.pos.clone().addScaledVector(out, 11).add(new THREE.Vector3(0, 2.2, 0)),
            target: node.pos.clone().add(new THREE.Vector3(0, -1.4, 0)),
        };
    }
    const homeDive: Pose = { pos: new THREE.Vector3(0, 3.2, 10), target: new THREE.Vector3(0, -2.2, 0) };

    let activeRoute = routeFor(location.pathname);
    let from: Pose = activeRoute === routes[0]
        ? { pos: new THREE.Vector3(0, 34, 95), target: new THREE.Vector3(0, 0, 0) }   // intro fly-in
        : poseFor(activeRoute);
    let to: Pose = poseFor(activeRoute);
    let flightStart = performance.now();
    let flightMs = reduceMotion ? 0 : INTRO_MS;

    function flyTo(route: Route) {
        from = { pos: base.pos.clone(), target: base.target.clone() };
        to = poseFor(route);
        flightStart = performance.now();
        flightMs = reduceMotion ? 0 : FLIGHT_MS;
    }

    const base: Pose = { pos: from.pos.clone(), target: from.target.clone() };
    const arcControl = new THREE.Vector3();

    function updateFlight(now: number) {
        const t = flightMs ? Math.min(1, (now - flightStart) / flightMs) : 1;
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        // Arc over the scene rather than cutting straight through it.
        arcControl.copy(from.pos).lerp(to.pos, 0.5);
        arcControl.y += from.pos.distanceTo(to.pos) * 0.3;
        const u = 1 - e;
        base.pos.set(0, 0, 0)
            .addScaledVector(from.pos, u * u)
            .addScaledVector(arcControl, 2 * u * e)
            .addScaledVector(to.pos, e * e);
        base.target.copy(from.target).lerp(to.target, e);
    }

    // ── Pointer: parallax, hover, click-to-cd ────────────
    const pointer = new THREE.Vector2(0, 0);
    const parallax = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    let hovered: WorldNode | null = null;
    let pointerOnCanvas = false;

    function trackPointer(e: PointerEvent | MouseEvent) {
        pointer.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
        pointerOnCanvas = e.target === canvas;
    }
    window.addEventListener('pointermove', trackPointer);
    canvas.addEventListener('pointerleave', () => { pointerOnCanvas = false; });
    canvas.addEventListener('click', e => {
        trackPointer(e);   // taps arrive without a preceding pointermove
        updateHover();
        if (hovered && hovered.route !== activeRoute) navigate(hovered.route.href);
    });

    function updateHover() {
        hovered = null;
        if (pointerOnCanvas) {
            raycaster.setFromCamera(pointer, camera);
            let best = Infinity;
            // Screen-space pick against each node (and its label) — forgiving on small targets.
            for (const n of nodes) {
                const d = raycaster.ray.distanceToPoint(n.pos);
                const dLabel = raycaster.ray.distanceToPoint(n.label.getWorldPosition(tmp));
                const dist = camera.position.distanceTo(n.pos);
                const score = Math.min(d, dLabel) / dist;
                if (score < 0.06 && score < best) { best = score; hovered = n; }
            }
        }
        canvas.style.cursor = hovered && hovered.route !== activeRoute ? 'pointer' : '';
    }
    const tmp = new THREE.Vector3();

    // ── Navigation hook ──────────────────────────────────
    document.addEventListener('astro:page-load', () => {
        const next = routeFor(location.pathname);
        if (next === activeRoute) return;
        activeRoute = next;
        flyTo(next);
    });

    // ── Loop ─────────────────────────────────────────────
    function resize() {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', () => { resize(); if (document.hidden) renderer.render(scene, camera); });
    resize();

    let last = performance.now();
    let rafId = 0;

    function frame(now: number) {
        rafId = 0;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const k = 1 - Math.exp(-dt * 6);   // frame-rate independent easing factor

        updateFlight(now);

        // Scroll: on home, dive toward ~ over the first screen; elsewhere, drift up slightly.
        const camPos = base.pos.clone();
        const camTarget = base.target.clone();
        if (activeRoute === routes[0]) {
            const s = Math.min(1, window.scrollY / window.innerHeight);
            const e = s * s * (3 - 2 * s);
            camPos.lerp(homeDive.pos, e);
            camTarget.lerp(homeDive.target, e);
        } else {
            camPos.y += Math.min(window.scrollY, 1500) * 0.0025;
        }
        // Portrait screens are narrow: back the camera off so the scene still fits across.
        const fit = Math.max(1, 0.8 / camera.aspect);
        camPos.sub(camTarget).multiplyScalar(fit).add(camTarget);
        fog.density = FOG_DENSITY / fit;
        if (!reduceMotion) {
            parallax.lerp(pointer, k * 0.5);
            camPos.x += parallax.x * 0.9;
            camPos.y += parallax.y * 0.5;
        }
        camera.position.copy(camPos);
        camera.lookAt(camTarget);

        updateHover();

        const time = now / 1000;
        for (const n of nodes) {
            n.hover += ((n === hovered ? 1 : 0) - n.hover) * k * 1.5;
            n.active += ((n.route === activeRoute ? 1 : 0) - n.active) * k;
            const color = n.core.material.color;
            color.set(n === root ? C.orange : C.purple).lerp(tmpColor.set(C.orange), n.active).lerp(tmpColor.set(C.cyan), n.hover);
            (n.glow.material as THREE.SpriteMaterial).color.copy(color);
            (n.glow.material as THREE.SpriteMaterial).opacity = 0.25 + 0.35 * n.active + 0.3 * n.hover
                + (reduceMotion ? 0 : 0.08 * Math.sin(time * 2 + n.pos.x));
            n.core.rotation.y += dt * (0.25 + 1.2 * n.active + 1.5 * n.hover) * (reduceMotion ? 0 : 1);
            n.core.rotation.x += dt * 0.1 * (reduceMotion ? 0 : 1);
            n.group.scale.setScalar(1 + 0.25 * n.hover + 0.15 * n.active);
            (n.label.material as THREE.SpriteMaterial).opacity = 0.55 + 0.45 * Math.max(n.active, n.hover);
        }

        if (!reduceMotion) {
            curves.forEach((curve, ci) => {
                for (let p = 0; p < PACKETS_PER_EDGE; p++) {
                    const t = (time * 0.18 + p / PACKETS_PER_EDGE + ci * 0.137) % 1;
                    curve.getPoint(t, tmp);
                    packetPos.set([tmp.x, tmp.y, tmp.z], (ci * PACKETS_PER_EDGE + p) * 3);
                }
            });
            packetGeo.attributes.position.needsUpdate = true;
            stars.rotation.y += dt * 0.004;
        }

        renderer.render(scene, camera);
        schedule();
    }
    const tmpColor = new THREE.Color();

    function schedule() {
        if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => {
        last = performance.now();
        schedule();
    });
    frame(performance.now());   // draw once even if the tab starts hidden
}

function makeGlowTexture(): THREE.Texture {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeLabel(path: string, blurb: string): THREE.Sprite {
    const font = '"Consolas", "Monaco", "Andale Mono", monospace';
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const big = 44, small = 26, pad = 12;
    ctx.font = `bold ${big}px ${font}`;
    const w1 = ctx.measureText(path).width;
    ctx.font = `${small}px ${font}`;
    const w2 = ctx.measureText(blurb).width;
    c.width = Math.ceil(Math.max(w1, w2) + pad * 2);
    c.height = big + small + pad * 3;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${big}px ${font}`;
    ctx.fillStyle = '#C0CAF5';
    ctx.fillText(path, c.width / 2, pad);
    ctx.font = `${small}px ${font}`;
    ctx.fillStyle = '#565F89';
    ctx.fillText(blurb, c.width / 2, pad * 2 + big);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const h = 1.1;
    sprite.scale.set(h * c.width / c.height, h, 1);
    return sprite;
}
