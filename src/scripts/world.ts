/**
 * The persistent 3D backdrop: every route is a node in a directory
 * "constellation" and the camera flies between nodes on navigation.
 * The canvas is persisted by the view-transition router, so this runs once.
 */
import * as THREE from 'three';
import { navigate } from 'astro:transitions/client';
import { routes, routeFor, readSiteTree, type Route } from '../data/routes';
import { makeGlowTexture, makeLabel } from './three-utils';
import { createGlobe, GLOBE_RADIUS } from './globe';

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
const ORBIT_RADIUS = 3.4;
const ORBIT_TILT = 0.35;
const INTRO_MS = 2600;

interface WorldNode {
    route: Route;
    pos: THREE.Vector3;
    group: THREE.Group;
    core: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
    glow: THREE.Sprite;
    label: THREE.Sprite;
    baseColor: number;
    hover: number;       // 0..1, eased
    active: number;      // 0..1, eased
    /** Satellites (projects) orbit their parent node. */
    orbit?: { center: THREE.Vector3; phase: number };
}

interface Pose { pos: THREE.Vector3; target: THREE.Vector3; }

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

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
    const globe = createGlobe();
    const tree = readSiteTree();

    function makeNode(route: Route, pos: THREE.Vector3, look: { size: number; color: number; box?: boolean; detail?: number; labelY: number; labelH?: number }): WorldNode {
        const group = new THREE.Group();
        group.position.copy(pos);
        const shape = look.box
            ? new THREE.BoxGeometry(look.size, look.size, look.size)
            : new THREE.IcosahedronGeometry(look.size, look.detail ?? 0);
        const core = new THREE.LineSegments(
            new THREE.EdgesGeometry(shape),
            new THREE.LineBasicMaterial({ color: look.color, transparent: true }),
        );
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture, color: look.color,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
        }));
        glow.scale.setScalar(look.size * 5.3);
        const label = look.labelH ? makeLabel(route.title, '', look.labelH) : makeLabel(route.path, route.blurb);
        label.position.set(0, look.labelY, 0);
        group.add(core, glow, label);
        scene.add(group);
        return { route, pos, group, core, glow, label, baseColor: look.color, hover: 0, active: 0 };
    }

    // Top-level directories on a ring around ~.
    const topRoutes = routes.filter(r => r.href !== '/');
    const topNodes: WorldNode[] = routes.map(route => {
        if (route.href === '/') {
            return makeNode(route, new THREE.Vector3(0, 0, 0), { size: 1.2, detail: 1, color: C.orange, labelY: 2.4 });
        }
        const i = topRoutes.indexOf(route);
        const angle = i / topRoutes.length * TAU + 0.35;
        const pos = new THREE.Vector3(Math.sin(angle) * 16, Math.sin(i * 2.1) * 3.5, Math.cos(angle) * 16);
        const node = makeNode(route, pos, { size: 0.75, color: C.purple, labelY: 1.7 });
        if (route.name === 'journey') {
            node.core.visible = false;
            node.group.add(globe.group);
        }
        return node;
    });

    // Projects orbit ~/projects as small cubes, on a tilted ring.
    const projectsNode = topNodes.find(n => n.route.href === '/projects')!;
    const satRoutes = tree.filter(r => r.parent === '/projects');
    const satellites: WorldNode[] = satRoutes.map((route, i) => {
        const node = makeNode(route, projectsNode.pos.clone(), { size: 0.5, box: true, color: C.cyan, labelY: 0.7, labelH: 0.4 });
        node.orbit = { center: projectsNode.pos, phase: i / satRoutes.length * TAU };
        return node;
    });
    const orbitRing = new THREE.Mesh(
        new THREE.TorusGeometry(ORBIT_RADIUS, 0.012, 6, 128),
        new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.25 }),
    );
    orbitRing.position.copy(projectsNode.pos);
    orbitRing.rotation.x = Math.PI / 2 + ORBIT_TILT;
    scene.add(orbitRing);
    let orbitAngle = 0;

    const nodes = [...topNodes, ...satellites];
    const root = nodes[0];
    const journeyNode = nodes.find(n => n.route.name === 'journey')!;

    // ── Edges from ~ to each directory, with packets running along them ──
    const curves = topNodes.slice(1).map(n => {
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
    const homePose: Pose = { pos: new THREE.Vector3(0, 12, 34), target: new THREE.Vector3(0, 4.5, 0) };
    const homeDive: Pose = { pos: new THREE.Vector3(0, 3.2, 10), target: new THREE.Vector3(0, -2.2, 0) };

    // Journey page: continuous hop index from how far each [data-hop] section has scrolled past mid-screen.
    let hopEls: HTMLElement[] = [];
    let hopProgress = 0;
    function readHopProgress(): number {
        if (!hopEls.length) return 0;
        const mid = window.innerHeight / 2;
        const centers = hopEls.map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
        if (mid <= centers[0]) return 0;
        for (let i = 0; i < centers.length - 1; i++) {
            if (mid <= centers[i + 1]) return i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
        }
        return centers.length - 1;
    }

    /** Where the camera wants to be for a route right now — poses may depend on scroll. */
    function livePose(route: Route, out: Pose): Pose {
        const node = nodes.find(n => n.route === route) ?? root;
        if (node === root) {
            // Aim above ~ so the constellation sits below the hero title; dive toward it on scroll.
            const e = smooth(Math.min(1, window.scrollY / window.innerHeight));
            out.pos.copy(homePose.pos).lerp(homeDive.pos, e);
            out.target.copy(homePose.target).lerp(homeDive.target, e);
        } else if (node === journeyNode) {
            globe.pose(hopProgress, out.pos, out.target);
        } else if (node.orbit) {
            // Close-up on a satellite, from outside its orbit and slightly to the side.
            const outward = tmp.copy(node.pos).sub(node.orbit.center).setY(0).normalize().applyAxisAngle(UP, 0.5);
            out.pos.copy(node.pos).addScaledVector(outward, 5.5);
            out.pos.y += 1.3 + Math.min(window.scrollY, 1500) * 0.0015;
            out.target.copy(node.pos);
            out.target.y -= 0.9;
        } else {
            // Stand outside the ring, swung to the side so ~ isn't hidden right behind the node,
            // and aim a little below it so the node sits in the hero band above the window.
            const outward = tmp.set(node.pos.x, 0, node.pos.z).normalize().applyAxisAngle(UP, 0.65);
            // ~/projects looks down on its orbit ring so the satellites spread out as an ellipse.
            const high = node === projectsNode;
            out.pos.copy(node.pos).addScaledVector(outward, high ? 12 : 11);
            out.pos.y += (high ? 6.5 : 2.2) + Math.min(window.scrollY, 1500) * 0.0025;
            out.target.copy(node.pos);
            out.target.y -= high ? 3.2 : 1.4;
        }
        return out;
    }

    // The flight blends from a frozen start pose into the destination's live pose.
    let activeRoute = routeFor(location.pathname, tree);
    const from: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    const to: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    const base: Pose = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    let flightStart = performance.now();
    let flightMs = 0;
    if (activeRoute === routes[0] && !reduceMotion) {
        from.pos.set(0, 34, 95);   // intro fly-in from deep space
        flightMs = INTRO_MS;
    }

    function flyTo() {
        from.pos.copy(base.pos);
        from.target.copy(base.target);
        flightStart = performance.now();
        flightMs = reduceMotion ? 0 : FLIGHT_MS;
    }

    const arcControl = new THREE.Vector3();

    function updateCamera(now: number) {
        livePose(activeRoute, to);
        const t = flightMs ? Math.min(1, (now - flightStart) / flightMs) : 1;
        if (t >= 1) {
            base.pos.copy(to.pos);
            base.target.copy(to.target);
            return;
        }
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
    function collectHops() {
        hopEls = [...document.querySelectorAll<HTMLElement>('[data-hop]')];
    }
    collectHops();
    document.addEventListener('astro:page-load', () => {
        collectHops();
        const next = routeFor(location.pathname, tree);
        if (next === activeRoute) return;
        activeRoute = next;
        flyTo();
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
    let viewX = 0, viewY = 0;
    let rafId = 0;

    function frame(now: number) {
        rafId = 0;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const k = 1 - Math.exp(-dt * 6);   // frame-rate independent easing factor

        hopProgress = readHopProgress();
        updateCamera(now);

        const camPos = base.pos.clone();
        const camTarget = base.target.clone();
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

        // Shift the rendered view to make room for text: journey's globe goes right on wide screens;
        // on portrait screens everything but home shifts up, since the camera backs off there.
        const w = window.innerWidth, h = window.innerHeight;
        const wide = camera.aspect > 1.1;
        const onJourney = activeRoute === journeyNode.route;
        const wantX = onJourney && wide ? -w * 0.2 : 0;
        const wantY = wide ? 0 : onJourney ? h * 0.2 : activeRoute !== root.route ? h * 0.14 : 0;
        viewX += (wantX - viewX) * k;
        viewY += (wantY - viewY) * k;
        if (Math.abs(viewX) + Math.abs(viewY) > 0.5) {
            camera.setViewOffset(w, h, viewX, viewY, w, h);
        } else if (camera.view?.enabled) {
            camera.clearViewOffset();
        }

        updateHover();

        const time = now / 1000;
        // Satellites orbit slowly, and hold still while one of them is being read.
        const satFocus = Math.max(...satellites.map(n => n.active), 0);
        const projectsFocus = Math.max(projectsNode.active, satFocus);
        if (!reduceMotion) orbitAngle += dt * 0.12 * (1 - satFocus);
        const tiltQ = tmpQ.setFromAxisAngle(tmpAxis.set(1, 0, 0), ORBIT_TILT);
        for (const n of satellites) {
            const a = orbitAngle + n.orbit!.phase;
            n.pos.set(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS).applyQuaternion(tiltQ).add(n.orbit!.center);
            n.group.position.copy(n.pos);
        }

        for (const n of nodes) {
            n.hover += ((n === hovered ? 1 : 0) - n.hover) * k * 1.5;
            n.active += ((n.route === activeRoute ? 1 : 0) - n.active) * k;
            const color = n.core.material.color;
            color.set(n.baseColor).lerp(tmpColor.set(C.orange), n.active).lerp(tmpColor.set(n.orbit ? C.text : C.cyan), n.hover);
            (n.glow.material as THREE.SpriteMaterial).color.copy(color);
            (n.glow.material as THREE.SpriteMaterial).opacity = 0.25 + 0.35 * n.active + 0.3 * n.hover
                + (reduceMotion ? 0 : 0.08 * Math.sin(time * 2 + n.pos.x));
            n.core.rotation.y += dt * (0.25 + 1.2 * n.active + 1.5 * n.hover) * (reduceMotion ? 0 : 1);
            n.core.rotation.x += dt * 0.1 * (reduceMotion ? 0 : 1);
            n.group.scale.setScalar(1 + 0.25 * n.hover + 0.15 * n.active);
            // Project names show only near ~/projects; while one is open, the others step back.
            const satBase = 0.45 * (1 - 0.7 * satFocus);
            (n.label.material as THREE.SpriteMaterial).opacity = n.orbit
                ? Math.max(n.hover, projectsFocus * (satBase + (1 - satBase) * n.active))
                : 0.55 + 0.45 * Math.max(n.active, n.hover);
        }
        // Up close, the satellites carry the scene; fade the parent's own big label.
        (projectsNode.label.material as THREE.SpriteMaterial).opacity *= Math.max(0, 1 - 0.85 * projectsNode.active - satFocus);

        // The journey node is the globe: it grows into the page's set piece when active.
        globe.update(dt, time, hopProgress, journeyNode.active, reduceMotion, camera.position);
        journeyNode.label.position.y = 0.8 + GLOBE_RADIUS * (0.3 + 0.7 * journeyNode.active);
        (journeyNode.label.material as THREE.SpriteMaterial).opacity *= 1 - journeyNode.active;
        (journeyNode.glow.material as THREE.SpriteMaterial).opacity *= 1 - journeyNode.active;

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
    const tmpQ = new THREE.Quaternion();
    const tmpAxis = new THREE.Vector3();

    function schedule() {
        if (!rafId && !document.hidden) rafId = requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => {
        last = performance.now();
        schedule();
    });
    frame(performance.now());   // draw once even if the tab starts hidden
}
