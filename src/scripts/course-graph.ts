/**
 * The ~/courses set piece: a prerequisite graph laid out on a timeline.
 * x = term, y = slot within the term, z = subject (CPSC in front, electives at the back).
 * Focusing a course lights up what led to it (orange) and what it unlocked (cyan).
 */
import * as THREE from 'three';
import { terms, titles, edges, subjectOf, type Subject, type EdgeInfo } from '../data/courses';
import { makeGlowTexture, makeLabel } from './three-utils';

const TERM_GAP = 2.6;
const ROW_GAP = 0.95;
const DEPTH: Record<Subject, number> = { cpsc: 1.3, math: 0.2, data: -0.6, other: -1.6 };
const SUBJECT_COLOR: Record<Subject, number> = { cpsc: 0x7dcfff, math: 0xbb9af7, data: 0x9ece6a, other: 0x565f89 };
const SUBJECT_ORDER: Subject[] = ['cpsc', 'math', 'data', 'other'];
const C = { orange: 0xff9e64, amber: 0xe0af68, cyan: 0x7dcfff, edge: 0x9aa5ce };

interface GNode {
    id: number;
    code: string;
    term: number;
    subject: Subject;
    pos: THREE.Vector3;
    dot: THREE.Sprite;
    label: THREE.Sprite;
    detail: THREE.Sprite;
    glow: number;          // eased highlight 0..1
}

interface GEdge {
    from: GNode;
    to: GNode;
    kind: EdgeInfo['kind'];
    line: THREE.Line;
    material: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
}

export interface CourseGraph {
    group: THREE.Group;
    update(dt: number, time: number, focus: number, termProgress: number, focusCode: string | null, reduceMotion: boolean): void;
    pose(termProgress: number, pos: THREE.Vector3, target: THREE.Vector3): void;
    /** Course code under the ray, if any (only meaningful while the graph is in focus). */
    pick(raycaster: THREE.Raycaster): string | null;
}

const termX = (t: number) => (t - (terms.length - 1) / 2) * TERM_GAP;

export function createCourseGraph(): CourseGraph {
    const group = new THREE.Group();
    const glowTexture = makeGlowTexture();

    // ── Nodes ────────────────────────────────────────────
    const nodes: GNode[] = [];
    terms.forEach((term, t) => {
        const sorted = [...term.courses].sort((a, b) =>
            SUBJECT_ORDER.indexOf(subjectOf(a)) - SUBJECT_ORDER.indexOf(subjectOf(b)));
        sorted.forEach((code, row) => {
            const subject = subjectOf(code);
            const pos = new THREE.Vector3(termX(t), ((sorted.length - 1) / 2 - row) * ROW_GAP, DEPTH[subject]);
            const dot = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTexture, color: SUBJECT_COLOR[subject],
                blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
            }));
            dot.position.copy(pos);
            dot.scale.setScalar(subject === 'other' ? 0.45 : 0.6);

            const label = makeLabel(code, '', 0.26);
            label.center.set(-0.12, 0.5);
            label.position.copy(pos);

            const detail = makeLabel(code, titles[code] ?? '', 0.62);
            detail.center.set(0.5, -0.35);
            detail.position.copy(pos);
            (detail.material as THREE.SpriteMaterial).opacity = 0;

            group.add(dot, label, detail);
            nodes.push({ id: nodes.length, code, term: t, subject, pos, dot, label, detail, glow: 0 });
        });
    });

    // ── Edges: link each course to the latest earlier (or same-term, for coreqs) occurrence of its prerequisite ──
    const gEdges: GEdge[] = [];
    for (const e of edges) {
        for (const to of nodes.filter(n => n.code === e.to)) {
            const from = nodes
                .filter(n => n.code === e.from && n.term <= to.term && n !== to)
                .sort((a, b) => b.term - a.term)[0];
            if (!from) continue;
            const mid = from.pos.clone().lerp(to.pos, 0.5);
            mid.z += 0.9;
            mid.y += 0.12 * Math.abs(to.pos.x - from.pos.x);
            const curve = new THREE.QuadraticBezierCurve3(from.pos, mid, to.pos);
            const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));
            const solid = e.kind === 'req';
            const material = solid
                ? new THREE.LineBasicMaterial({ color: C.edge, transparent: true })
                : new THREE.LineDashedMaterial({ color: C.edge, transparent: true, dashSize: 0.14, gapSize: 0.1 });
            const line = new THREE.Line(geometry, material);
            if (!solid) line.computeLineDistances();
            group.add(line);
            gEdges.push({ from, to, kind: e.kind, line, material });
        }
    }
    const incoming = new Map<GNode, GEdge[]>(nodes.map(n => [n, gEdges.filter(e => e.to === n)]));
    const outgoing = new Map<GNode, GEdge[]>(nodes.map(n => [n, gEdges.filter(e => e.from === n)]));

    function closure(start: GNode[], next: (n: GNode) => GNode[]): Set<GNode> {
        const seen = new Set<GNode>();
        const stack = [...start];
        while (stack.length) {
            const n = stack.pop()!;
            for (const m of next(n)) if (!seen.has(m)) { seen.add(m); stack.push(m); }
        }
        return seen;
    }

    // Term ticks along the bottom.
    terms.forEach((term, t) => {
        const tick = makeLabel(term.id, '', 0.34);
        tick.position.set(termX(t), -4.4, 0);
        (tick.material as THREE.SpriteMaterial).opacity = 0.7;
        group.add(tick);
    });
    const axis = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(termX(0) - 1, -4, 0), new THREE.Vector3(termX(terms.length - 1) + 1, -4, 0)]),
        new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.35 }),
    );
    group.add(axis);

    let lastFocus: string | null = null;
    // Eased framing: while a course is focused, the camera frames its whole chain instead of the scroll position.
    let chainWeight = 0, chainCenter = 0, chainSpan = 0;
    let ancestors = new Set<GNode>(), descendants = new Set<GNode>(), focused = new Set<GNode>();
    const color = new THREE.Color();
    const tmp = new THREE.Vector3();
    const worldQ = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    return {
        group,

        update(dt, time, focus, termProgress, focusCode, reduceMotion) {
            group.scale.setScalar(0.14 + 0.86 * focus);

            if (focusCode !== lastFocus) {
                lastFocus = focusCode;
                focused = new Set(nodes.filter(n => n.code === focusCode));
                ancestors = closure([...focused], n => incoming.get(n)!.map(e => e.from));
                descendants = closure([...focused], n => outgoing.get(n)!.map(e => e.to));
            }
            const anyFocus = focused.size > 0;
            const k = 1 - Math.exp(-dt * 8);

            if (anyFocus) {
                const xs = [...focused, ...ancestors, ...descendants].map(n => n.pos.x);
                const lo = Math.min(...xs), hi = Math.max(...xs);
                chainCenter += ((lo + hi) / 2 - chainCenter) * k * 0.5;
                chainSpan += (hi - lo - chainSpan) * k * 0.5;
            }
            chainWeight += ((anyFocus ? 1 : 0) - chainWeight) * k * 0.5;
            const currentTerm = Math.round(termProgress);

            for (const n of nodes) {
                const isFocus = focused.has(n);
                const lit = isFocus || ancestors.has(n) || descendants.has(n);
                n.glow += ((lit ? 1 : 0) - n.glow) * k;
                const m = n.dot.material as THREE.SpriteMaterial;
                color.set(SUBJECT_COLOR[n.subject]);
                if (isFocus) color.set(C.orange);
                else if (ancestors.has(n)) color.lerp(tmpColor.set(C.amber), n.glow);
                else if (descendants.has(n)) color.lerp(tmpColor.set(C.cyan), n.glow);
                m.color.copy(color);
                const dim = anyFocus && !lit ? 0.25 : 1;
                const inTerm = n.term === currentTerm ? 1 : 0.75;
                m.opacity = focus * dim * inTerm;
                const pulse = isFocus && !reduceMotion ? 0.12 * Math.sin(time * 5) : 0;
                n.dot.scale.setScalar((n.subject === 'other' ? 0.45 : 0.6) * (1 + 0.5 * (isFocus ? 1 : 0) + pulse));

                const labelBase = n.subject === 'other' ? 0.35 : 0.85;
                (n.label.material as THREE.SpriteMaterial).opacity = focus * dim * labelBase * (isFocus ? 0 : 1);
                (n.detail.material as THREE.SpriteMaterial).opacity = focus * (isFocus ? 1 : 0);
            }

            for (const e of gEdges) {
                const up = ancestors.has(e.from) && (focused.has(e.to) || ancestors.has(e.to));
                const down = (focused.has(e.from) || descendants.has(e.from)) && descendants.has(e.to);
                e.material.color.set(up ? C.amber : down ? C.cyan : C.edge);
                const base = e.kind === 'req' ? 0.7 : e.kind === 'rec' ? 0.3 : 0.45;
                e.material.opacity = focus * (anyFocus ? (up || down ? 1 : 0.07) : base);
            }
        },

        pose(termProgress, pos, target) {
            const p = THREE.MathUtils.clamp(termProgress, 0, terms.length - 1);
            // Aim a little ahead of the current term so the next one is in view…
            const scrollX = termX(p) + TERM_GAP * 0.4;
            // …unless a course is focused: then frame its whole prerequisite chain.
            const x = THREE.MathUtils.lerp(scrollX, chainCenter, chainWeight);
            const dist = THREE.MathUtils.lerp(9.5, Math.max(9.5, chainSpan * 1.15 + 5), chainWeight);
            target.set(x, -0.3, 0);
            group.localToWorld(target);
            group.getWorldQuaternion(worldQ);
            group.getWorldScale(worldScale);
            const s = worldScale.x;
            pos.set(0, 0, 1).applyQuaternion(worldQ).multiplyScalar(dist * s).add(target);
            pos.y += 1.6 * s;
        },

        pick(raycaster) {
            group.getWorldScale(worldScale);
            let best: GNode | null = null, bestD = 0.35 * worldScale.x;
            for (const n of nodes) {
                const d = raycaster.ray.distanceToPoint(n.dot.getWorldPosition(tmp));
                if (d < bestD) { bestD = d; best = n; }
            }
            return best?.code ?? null;
        },
    };
}

const tmpColor = new THREE.Color();
