/**
 * Wireframe set pieces for the directory nodes: each one shows what its page is about,
 * the way ~/math is a torus and ~/journey a globe. The node owns `mat` and tints it for
 * hover/active; a shape draws its main strokes with it, and its other materials follow
 * that tint through `tracker`.
 */
import * as THREE from 'three';
import { bucketlist, itemDone } from '../data/bucketlist';

export interface NodeShape {
    object: THREE.Object3D;
    /** How fast the world spins it (default 1); 0 leaves its rotation to the shape. */
    spin?: number;
    /** Whether it also tumbles about x, like the plain icosahedron nodes. */
    tumble?: boolean;
    /** Replaces the node's base color once known (~/lol takes its rank's color). */
    color?: number;
    /** `energy` is 0 idle in the constellation … 1 while its page is open or it is hovered. */
    update(dt: number, time: number, energy: number, reduceMotion: boolean, cameraPos: THREE.Vector3): void;
}

type Build = (mat: THREE.LineBasicMaterial, glow: THREE.Texture) => NodeShape;
type Tintable = THREE.Material & { color: THREE.Color };

const TAU = Math.PI * 2;

export function createNodeShape(name: string, mat: THREE.LineBasicMaterial, glow: THREE.Texture): NodeShape | null {
    return builders[name]?.(mat, glow) ?? null;
}

// ── Helpers ──────────────────────────────────────────

/** Secondary materials take the node's tint, at a fraction of its opacity. */
function tracker(main: THREE.LineBasicMaterial) {
    const list: [Tintable, number][] = [];
    return {
        add<M extends Tintable>(m: M, alpha = 1): M {
            m.transparent = true;
            list.push([m, alpha]);
            return m;
        },
        sync() {
            for (const [m, alpha] of list) {
                m.color.copy(main.color);
                m.opacity = main.opacity * alpha;
            }
        },
    };
}

function glowMaterial(glow: THREE.Texture, size: number, vertexColors = false): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
        size, map: glow, vertexColors, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
}

function lines(points: number[] | Float32Array, material: THREE.Material): THREE.LineSegments {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(points), 3));
    return new THREE.LineSegments(geo, material);
}

function dots(points: number[], material: THREE.Material): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(points), 3));
    return new THREE.Points(geo, material);
}

/** A circle in the xy plane, as segment pairs appended to `out`. */
function circle(out: number[], cx: number, cy: number, r: number, n: number): number[] {
    for (let i = 0; i < n; i++) {
        const a = i / n * TAU, b = (i + 1) / n * TAU;
        out.push(cx + r * Math.cos(a), cy + r * Math.sin(a), 0, cx + r * Math.cos(b), cy + r * Math.sin(b), 0);
    }
    return out;
}

const tmp = new THREE.Vector3();

/** Turn a flat piece toward the camera (about y), swaying a little. */
function faceCamera(obj: THREE.Object3D, cameraPos: THREE.Vector3, time: number, still: boolean) {
    obj.parent?.getWorldPosition(tmp);
    obj.rotation.y = Math.atan2(cameraPos.x - tmp.x, cameraPos.z - tmp.z) + (still ? 0 : Math.sin(time * 0.5) * 0.35);
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Small seeded PRNG so layouts are the same on every visit. */
function mulberry32(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── ~/learning ───────────────────────────────────────

/** "Optimization": gradient descent zigzagging down an elongated bowl, run after run. */
function gradientDescent(mat: THREE.LineBasicMaterial, glow: THREE.Texture): NodeShape {
    const tint = tracker(mat);
    const group = new THREE.Group();
    // f(u, v) = 0.4u² + 2v²: the steep v direction makes plain gradient descent overshoot and zigzag.
    const W = 0.9, H = 1.6, LR = 0.42, SQ5 = Math.sqrt(5);
    const f = (u: number, v: number) => 0.4 * u * u + 2 * v * v;
    const lift = (u: number, v: number, out: THREE.Vector3) => out.set(u * W, f(u, v) * H - 0.3, v * W);

    // The bowl: level sets (evenly spaced in height) and meridians, over the ellipse f ≤ 0.4.
    const surf: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const edge = (u0: number, v0: number, u1: number, v1: number) => {
        lift(u0, v0, a);
        lift(u1, v1, b);
        surf.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };
    for (let k = 1; k <= 6; k++) {
        const r = Math.sqrt(k / 6);
        for (let i = 0; i < 48; i++) {
            const t0 = i / 48 * TAU, t1 = (i + 1) / 48 * TAU;
            edge(r * Math.cos(t0), r * Math.sin(t0) / SQ5, r * Math.cos(t1), r * Math.sin(t1) / SQ5);
        }
    }
    for (let j = 0; j < 12; j++) {
        const c = Math.cos(j / 12 * TAU), s = Math.sin(j / 12 * TAU) / SQ5;
        for (let i = 0; i < 10; i++) edge(c * i / 10, s * i / 10, c * (i + 1) / 10, s * (i + 1) / 10);
    }
    group.add(lines(surf, tint.add(new THREE.LineBasicMaterial(), 0.3)));

    // One run of gradient descent from a point on the rim.
    const MAX = 40;
    const path: THREE.Vector3[] = [];
    let side = 1;
    function newRun() {
        side = -side;
        const th = side * (0.35 + Math.random() * 0.7) + (Math.random() < 0.5 ? 0 : Math.PI);
        let u = 0.97 * Math.cos(th), v = 0.97 * Math.sin(th) / SQ5;
        path.length = 0;
        path.push(lift(u, v, new THREE.Vector3()));
        while (path.length < MAX && (Math.abs(u) > 0.01 || Math.abs(v) > 0.004)) {
            u -= LR * 0.8 * u;
            v -= LR * 4 * v;
            path.push(lift(u, v, new THREE.Vector3()));
        }
    }
    newRun();

    const trailPos = new Float32Array((MAX + 1) * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    group.add(new THREE.Line(trailGeo, mat));
    const ball = dots([0, 0, 0], tint.add(glowMaterial(glow, 0.32)));
    group.add(ball);

    let p = 0, hold = 0;
    return {
        object: group,
        spin: 0.3,
        update(dt, _time, energy, reduceMotion) {
            tint.sync();
            const last = path.length - 1;
            if (reduceMotion) p = last;   // the whole run, at rest in the minimum
            else if (p < last) p = Math.min(last, p + dt * (1.4 + 3.6 * energy));
            else if ((hold += dt) > 1.2) { hold = 0; p = 0; newRun(); }

            const i = Math.floor(p), frac = p - i;
            for (let k = 0; k <= i; k++) path[k].toArray(trailPos, k * 3);
            // Each step is a hop across the valley.
            a.copy(path[i]).lerp(path[Math.min(i + 1, last)], frac);
            a.y += 0.08 * Math.sin(Math.PI * frac);
            a.toArray(trailPos, (i + 1) * 3);
            trailGeo.setDrawRange(0, i + 2);
            trailGeo.attributes.position.needsUpdate = true;
            ball.position.copy(a);
        },
    };
}

// ── ~/thoughts ───────────────────────────────────────

/** Thoughts wander but stay bounded: a Lorenz attractor, traced as it is integrated. */
function lorenz(mat: THREE.LineBasicMaterial, glow: THREE.Texture): NodeShape {
    const tint = tracker(mat);
    const group = new THREE.Group();
    const N = 1400, H = 0.006, S = 0.034;
    let x = 0.1, y = 0, z = 0;
    const k = new Float64Array(12);
    const deriv = (px: number, py: number, pz: number, o: number) => {
        k[o] = 10 * (py - px);
        k[o + 1] = px * (28 - pz) - py;
        k[o + 2] = px * py - (8 / 3) * pz;
    };
    function step() {   // RK4
        deriv(x, y, z, 0);
        deriv(x + H / 2 * k[0], y + H / 2 * k[1], z + H / 2 * k[2], 3);
        deriv(x + H / 2 * k[3], y + H / 2 * k[4], z + H / 2 * k[5], 6);
        deriv(x + H * k[6], y + H * k[7], z + H * k[8], 9);
        x += H / 6 * (k[0] + 2 * k[3] + 2 * k[6] + k[9]);
        y += H / 6 * (k[1] + 2 * k[4] + 2 * k[7] + k[10]);
        z += H / 6 * (k[2] + 2 * k[5] + 2 * k[8] + k[11]);
    }

    const pos = new Float32Array(N * 3);
    const write = (i: number) => { pos[i * 3] = x * S; pos[i * 3 + 1] = (z - 25) * S; pos[i * 3 + 2] = y * S; };
    for (let i = 0; i < 2000; i++) step();   // settle onto the attractor
    for (let i = 0; i < N; i++) { step(); write(i); }

    // The tail fades out; additive blending makes the faded end vanish into the background.
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) col.fill((i / N) ** 1.6, i * 3, i * 3 + 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Line(geo, tint.add(new THREE.LineBasicMaterial({
        vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }))));
    const head = dots([0, 0, 0], tint.add(glowMaterial(glow, 0.26)));
    head.position.fromArray(pos, (N - 1) * 3);
    group.add(head);

    let acc = 0;
    return {
        object: group,
        spin: 0.4,
        update(dt, _time, energy, reduceMotion) {
            tint.sync();
            if (reduceMotion) return;
            acc += dt * (120 + 380 * energy);
            const n = Math.min(Math.floor(acc), 60);
            if (!n) return;
            acc -= n;
            pos.copyWithin(0, n * 3);
            for (let j = N - n; j < N; j++) { step(); write(j); }
            geo.attributes.position.needsUpdate = true;
            head.position.fromArray(pos, (N - 1) * 3);
        },
    };
}

// ── ~/bucketlist ─────────────────────────────────────

/** A celestial sphere with a star per goal — lit once done — and a constellation per category. */
function celestial(mat: THREE.LineBasicMaterial, glow: THREE.Texture): NodeShape {
    const tint = tracker(mat);
    const group = new THREE.Group();
    const rand = mulberry32(7);
    const R = 0.8;
    const centers: [number, number][] = [[0.45, 0], [-0.25, 2.1], [0.2, 4.2]];   // lat, lon
    const todo: number[] = [], done: number[] = [], links: number[] = [];

    bucketlist.forEach((cat, ci) => {
        const [lat, lon] = centers[ci % centers.length];
        const c = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
        const e1 = new THREE.Vector3(0, 1, 0).cross(c).normalize();
        const e2 = new THREE.Vector3().crossVectors(c, e1);
        const spread = 0.12 * Math.sqrt(cat.items.length);
        const pts = cat.items.map(item => {
            const r = spread * Math.sqrt(rand()), a = rand() * TAU;
            const p = c.clone().addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a))
                .normalize().multiplyScalar(R * (0.92 + 0.08 * rand()));
            (itemDone(item) ? done : todo).push(p.x, p.y, p.z);
            return p;
        });
        // The constellation: a minimum spanning tree over the category's stars (Prim).
        const n = pts.length;
        if (!n) return;
        const used = new Array<boolean>(n).fill(false);
        const best = pts.map(p => p.distanceTo(pts[0]));
        const from = new Array<number>(n).fill(0);
        used[0] = true;
        for (let it = 1; it < n; it++) {
            let j = -1;
            for (let q = 0; q < n; q++) if (!used[q] && (j < 0 || best[q] < best[j])) j = q;
            used[j] = true;
            links.push(...pts[from[j]].toArray(), ...pts[j].toArray());
            for (let q = 0; q < n; q++) {
                const d = pts[q].distanceTo(pts[j]);
                if (!used[q] && d < best[q]) { best[q] = d; from[q] = j; }
            }
        }
    });
    group.add(lines(links, tint.add(new THREE.LineBasicMaterial(), 0.3)));

    // Celestial equator and the ecliptic, tilted 23.4°.
    const ringMat = tint.add(new THREE.LineBasicMaterial(), 0.22);
    const equator = lines(circle([], 0, 0, 0.9, 72), ringMat);
    equator.rotation.x = Math.PI / 2;
    const ecliptic = lines(circle([], 0, 0, 0.9, 72), ringMat);
    ecliptic.rotation.x = Math.PI / 2 + 23.4 * Math.PI / 180;
    group.add(equator, ecliptic);

    const todoStars = dots(todo, tint.add(glowMaterial(glow, 0.1, true), 0.9));
    const twinkle = new Float32Array(todo.length).fill(1);
    todoStars.geometry.setAttribute('color', new THREE.BufferAttribute(twinkle, 3));
    group.add(todoStars, dots(done, tint.add(glowMaterial(glow, 0.26))));

    return {
        object: group,
        spin: 0.35,
        update(_dt, time, energy, reduceMotion) {
            tint.sync();
            const amount = reduceMotion ? 0 : 0.35 + 0.65 * energy;
            for (let i = 0; i < twinkle.length / 3; i++) {
                const v = 0.6 + 0.4 * amount * Math.sin(time * (1.3 + (i % 7) * 0.25) + i * 2.4);
                twinkle.fill(v, i * 3, i * 3 + 3);
            }
            todoStars.geometry.attributes.color.needsUpdate = true;
        },
    };
}

// ── ~/about ──────────────────────────────────────────

/** Guitar strings over a sound hole, strummed now and then. Frets sit at 12-TET spacing. */
function guitar(mat: THREE.LineBasicMaterial): NodeShape {
    const tint = tracker(mat);
    const dim = tint.add(new THREE.LineBasicMaterial(), 0.45);
    const group = new THREE.Group();
    const X0 = -0.85, X1 = 0.85, L = X1 - X0, STRINGS = 6, M = 40, GAP = 0.11;
    const yOf = (i: number) => (i - (STRINGS - 1) / 2) * GAP;   // i = 5 is the low E, on top

    const frame: number[] = [];
    frame.push(X0, -0.33, 0, X0, 0.33, 0, X0 - 0.03, -0.33, 0, X0 - 0.03, 0.33, 0);   // nut
    for (let n = 1; n <= 7; n++) {
        const fx = X0 + L * (1 - 2 ** (-n / 12));   // fret n shortens the string by a factor 2^(-n/12)
        frame.push(fx, -0.32, 0, fx, 0.32, 0);
    }
    frame.push(X1, -0.33, 0, X1, 0.33, 0, X1 + 0.06, -0.33, 0, X1 + 0.06, 0.33, 0,
        X1, -0.33, 0, X1 + 0.06, -0.33, 0, X1, 0.33, 0, X1 + 0.06, 0.33, 0);   // bridge
    circle(frame, 0.22, 0, 0.3, 48);   // sound hole
    circle(frame, 0.22, 0, 0.35, 48);  // rosette
    group.add(lines(frame, dim));

    const pos = new Float32Array(STRINGS * M * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.LineSegments(geo, mat));

    // A pluck at 28% of the length: mode k has amplitude ∝ sin(kπ·0.28) / k².
    const modes = [1, 2, 3].map(kk => Math.sin(kk * Math.PI * 0.28) / (kk * kk));
    const lastHit = new Array<number>(STRINGS).fill(-100);
    const pending = new Array<number>(STRINGS).fill(Infinity);
    let nextStrum = 0.5;

    return {
        object: group,
        spin: 0,
        update(_dt, time, energy, reduceMotion, cameraPos) {
            tint.sync();
            faceCamera(group, cameraPos, time, reduceMotion);
            if (!reduceMotion && time >= nextStrum) {
                // A downstroke: the low E first, the rest a few ms apart.
                for (let i = 0; i < STRINGS; i++) pending[i] = time + (STRINGS - 1 - i) * 0.045;
                nextStrum = time + 3.4 - 2.2 * energy;
            }
            for (let i = 0; i < STRINGS; i++) {
                if (pending[i] <= time) { lastHit[i] = pending[i]; pending[i] = Infinity; }
                const since = time - lastHit[i];
                const amp = reduceMotion ? 0 : 0.045 * Math.exp(-since / 1.0) / modes[0];
                const freq = 1.6 + 0.35 * (STRINGS - 1 - i);
                const w = modes.map((m, kk) => m * Math.cos(TAU * (kk + 1) * freq * since));
                const shape = (s: number) => yOf(i) + amp * w.reduce((sum, wk, kk) => sum + wk * Math.sin((kk + 1) * Math.PI * s), 0);
                for (let j = 0; j < M; j++) {
                    const o = (i * M + j) * 6;
                    pos[o] = X0 + L * j / M;
                    pos[o + 1] = shape(j / M);
                    pos[o + 3] = X0 + L * (j + 1) / M;
                    pos[o + 4] = shape((j + 1) / M);
                }
            }
            geo.attributes.position.needsUpdate = true;
        },
    };
}

// ── ~/projects ───────────────────────────────────────

/** Building blocks: a 3×3×3 lattice of cubes that turns a layer now and then, like a Rubik's cube. */
function rubik(mat: THREE.LineBasicMaterial): NodeShape {
    const group = new THREE.Group();
    const STEP = 0.29;
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.25, 0.25, 0.25));
    const cubes: THREE.LineSegments[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) {
        const c = new THREE.LineSegments(edges, mat);
        c.position.set(i * STEP, j * STEP, l * STEP);
        c.userData.home = c.position.clone();
        cubes.push(c);
        group.add(c);
    }
    const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const q = new THREE.Quaternion();
    let wait = 1;
    let move: { axis: THREE.Vector3; dir: number; t: number; members: THREE.LineSegments[] } | null = null;

    return {
        object: group,
        spin: 0.6,
        tumble: true,
        update(dt, _time, energy, reduceMotion) {
            if (reduceMotion) return;
            if (!move) {
                if ((wait -= dt) > 0) return;
                const a = Math.floor(Math.random() * 3), layer = Math.floor(Math.random() * 3) - 1;
                move = {
                    axis: AXES[a],
                    dir: Math.random() < 0.5 ? 1 : -1,
                    t: 0,
                    members: cubes.filter(c => Math.round((c.userData.home as THREE.Vector3).getComponent(a) / STEP) === layer),
                };
            }
            move.t = Math.min(1, move.t + dt / 0.55);
            q.setFromAxisAngle(move.axis, smooth(move.t) * move.dir * Math.PI / 2);
            for (const c of move.members) {
                c.position.copy(c.userData.home).applyQuaternion(q);
                c.quaternion.copy(q);
            }
            if (move.t >= 1) {
                // The cubes are identical, so a quarter turn ends where it started: snap back home.
                for (const c of move.members) { c.position.copy(c.userData.home); c.quaternion.identity(); }
                move = null;
                wait = 2.2 - 1.6 * energy;
            }
        },
    };
}

// ── ~/books ──────────────────────────────────────────

/** An open book, turning a page every few seconds. */
function book(mat: THREE.LineBasicMaterial): NodeShape {
    const tint = tracker(mat);
    const dim = tint.add(new THREE.LineBasicMaterial(), 0.4);
    const group = new THREE.Group();
    const W = 0.62, H = 0.4, REST = 0.3, SEG = 10;

    /** Top, outer and bottom edges of a page at angle `phi` about the spine; its free edge lags by `bend`. */
    function page(out: number[], phi: number, bend = 0, width = W, half = H): number[] {
        const at = (s: number, y: number) => {
            const a = phi - bend * s;
            out.push(Math.cos(a) * s * width, y, Math.sin(a) * s * width);
        };
        for (const y of [half, -half]) for (let i = 0; i < SEG; i++) { at(i / SEG, y); at((i + 1) / SEG, y); }
        at(1, half); at(1, -half);
        return out;
    }

    const still: number[] = [0, H, 0, 0, -H, 0];   // spine
    for (let j = 0; j < 3; j++) { page(still, REST + j * 0.04); page(still, Math.PI - REST - j * 0.04); }
    group.add(lines(still, mat));

    const back: number[] = [];
    page(back, REST - 0.08, 0, W + 0.04, H + 0.03);
    page(back, Math.PI - REST + 0.08, 0, W + 0.04, H + 0.03);
    // A few lines of text on the open pages.
    const rand = mulberry32(3);
    for (const phi of [REST + 0.08, Math.PI - REST - 0.08]) {
        for (let r = 0; r < 6; r++) {
            const y = 0.28 - r * 0.1, s1 = 0.18 + 0.64 * (0.55 + 0.45 * rand());
            back.push(Math.cos(phi) * 0.18 * W, y, Math.sin(phi) * 0.18 * W, Math.cos(phi) * s1 * W, y, Math.sin(phi) * s1 * W);
        }
    }
    group.add(lines(back, dim));

    const turning = new Float32Array((2 * SEG + 1) * 6);
    const turnGeo = new THREE.BufferGeometry();
    turnGeo.setAttribute('position', new THREE.BufferAttribute(turning, 3));
    const turn = new THREE.LineSegments(turnGeo, mat);
    turn.visible = false;
    group.add(turn);

    let clock = -1;   // < 0: waiting for the next turn
    const from = REST + 0.12, to = Math.PI - REST - 0.12;
    const scratch: number[] = [];

    return {
        object: group,
        spin: 0,
        update(dt, time, energy, reduceMotion, cameraPos) {
            tint.sync();
            faceCamera(group, cameraPos, time, reduceMotion);
            if (reduceMotion) return;
            clock += dt / (clock < 0 ? 2.6 - 1.4 * energy : 1.0);
            turn.visible = clock >= 0 && clock < 1;
            if (clock >= 1) { clock = -1; return; }
            if (clock < 0) return;
            scratch.length = 0;
            turning.set(page(scratch, from + (to - from) * smooth(clock), 0.6 * Math.sin(Math.PI * clock)));
            turnGeo.attributes.position.needsUpdate = true;
        },
    };
}

// ── ~/lol ────────────────────────────────────────────

const TIER_COLORS: Record<string, number> = {
    iron: 0x9a8a82, bronze: 0xc98b5a, silver: 0xb4c0d0, gold: 0xe0af68, platinum: 0x5fd4c4,
    emerald: 0x4fd08a, diamond: 0x8ab4ff, master: 0xbb9af7, grandmaster: 0xf7768e, challenger: 0xf2d27a,
};

/** A hextech crystal, in the color of the current rank (from the cached stats snapshot). */
function hextech(mat: THREE.LineBasicMaterial): NodeShape {
    const tint = tracker(mat);
    const dim = tint.add(new THREE.LineBasicMaterial(), 0.5);
    const group = new THREE.Group();
    const outer = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.5)), mat);
    outer.scale.set(1, 1.7, 1);
    const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.22)), dim);
    inner.scale.set(1, 1.7, 1);
    const hex = lines(circle([], 0, 0, 0.78, 6), dim);
    hex.rotation.x = Math.PI / 2;
    const ring = new THREE.Group();
    ring.add(hex);
    group.add(outer, inner, ring);

    const shape: NodeShape = {
        object: group,
        spin: 0.8,
        update(dt, time, energy, reduceMotion) {
            tint.sync();
            if (reduceMotion) return;
            inner.rotation.y -= dt * (1.2 + 2 * energy);
            ring.rotation.y -= dt * 0.4;
            group.position.y = Math.sin(time * 1.3) * 0.07;
        },
    };
    fetch('/data/lol_snapshot.json')
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
            const tier = String(data?.overview?.currentRank ?? '').split(' ')[0].toLowerCase();
            if (tier in TIER_COLORS) shape.color = TIER_COLORS[tier];
        })
        .catch(() => { /* keep the default color */ });
    return shape;
}

// ── ~/contact ────────────────────────────────────────

/** An envelope sending out rings, like a ping. */
function ping(mat: THREE.LineBasicMaterial): NodeShape {
    const tint = tracker(mat);
    const group = new THREE.Group();
    const w = 0.34, h = 0.22;
    group.add(lines([
        -w, -h, 0, w, -h, 0, w, -h, 0, w, h, 0, w, h, 0, -w, h, 0, -w, h, 0, -w, -h, 0,
        -w, h, 0, 0, -0.02, 0, 0, -0.02, 0, w, h, 0,
    ], mat));
    const unit = circle([], 0, 0, 1, 64);
    const rings = [0, 1, 2, 3].map(() => {
        const ring = lines(unit, tint.add(new THREE.LineBasicMaterial()));
        group.add(ring);
        return ring;
    });

    let phase = 0;
    return {
        object: group,
        spin: 0,
        update(dt, time, energy, reduceMotion, cameraPos) {
            tint.sync();
            faceCamera(group, cameraPos, time, reduceMotion);
            if (!reduceMotion) phase += dt * (0.3 + 0.6 * energy);
            rings.forEach((ring, i) => {
                const p = (phase + i / rings.length) % 1;
                ring.scale.setScalar(0.5 + 0.75 * p);
                (ring.material as THREE.LineBasicMaterial).opacity *= 0.8 * (1 - p) ** 1.5;
            });
        },
    };
}

const builders: Record<string, Build> = {
    about: guitar,
    projects: rubik,
    learning: gradientDescent,
    books: book,
    thoughts: lorenz,
    bucketlist: celestial,
    lol: hextech,
    contact: ping,
};
