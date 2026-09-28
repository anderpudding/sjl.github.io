/**
 * The ~/journey set piece: a dotted globe with the education route drawn as
 * great-circle arcs. `progress` is a continuous hop index (0 = first city,
 * hops.length - 1 = last) driven by scroll on the journey page.
 */
import * as THREE from 'three';
import { LAND_POINTS, LAND_BITS } from '../data/land-dots';
import { hops } from '../data/journey';
import { makeGlowTexture, makeLabel } from './three-utils';

export const GLOBE_RADIUS = 4;
const R = GLOBE_RADIUS;
const DEG = Math.PI / 180;
const ARC_SEGMENTS = 96;
const C = {
    sphere: 0x1f2335,
    land: 0x9aa5ce,
    grid: 0x565f89,
    atmosphere: 0x7aa2f7,
    orange: 0xff9e64,
    cyan: 0x7dcfff,
    dim: 0x565f89,
};

export interface Globe {
    group: THREE.Group;
    /** Advance animation. `focus` is 0 (mini globe in the constellation) … 1 (journey page). */
    update(dt: number, time: number, progress: number, focus: number, reduceMotion: boolean, cameraPos: THREE.Vector3): void;
    /** World-space camera pose looking at the route at `progress`. */
    pose(progress: number, pos: THREE.Vector3, target: THREE.Vector3): void;
}

export function latLonToVec(lat: number, lon: number, out = new THREE.Vector3()): THREE.Vector3 {
    const la = lat * DEG, lo = lon * DEG;
    return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/** Must match the generator in scripts/gen-land-dots.mjs. */
function fibonacciPoint(i: number, n: number, out: THREE.Vector3): THREE.Vector3 {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - 2 * (i + 0.5) / n;
    const r = Math.sqrt(1 - y * y);
    return out.set(Math.cos(i * golden) * r, y, Math.sin(i * golden) * r);
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

export function createGlobe(): Globe {
    const group = new THREE.Group();
    const spin = new THREE.Group();          // idle rotation lives here so poses can follow it
    group.add(spin);

    // Occluding core so back-side dots are hidden.
    spin.add(new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.995, 64, 48),
        new THREE.MeshBasicMaterial({ color: C.sphere }),
    ));

    // Land dots rebuilt from the bitset.
    const bits = Uint8Array.from(atob(LAND_BITS), ch => ch.charCodeAt(0));
    const landPos: number[] = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < LAND_POINTS; i++) {
        if (!(bits[i >> 3] & (1 << (i & 7)))) continue;
        fibonacciPoint(i, LAND_POINTS, v).multiplyScalar(R * 1.004);
        landPos.push(v.x, v.y, v.z);
    }
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute('position', new THREE.Float32BufferAttribute(landPos, 3));
    spin.add(new THREE.Points(landGeo, new THREE.PointsMaterial({
        color: C.land, size: 0.075, map: makeDotTexture(), transparent: true, alphaTest: 0.3,
    })));

    // Graticule every 30°.
    const grid: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
        for (let lon = 0; lon < 360; lon += 3) {
            latLonToVec(lat, lon, v).multiplyScalar(R * 1.001); grid.push(v.x, v.y, v.z);
            latLonToVec(lat, lon + 3, v).multiplyScalar(R * 1.001); grid.push(v.x, v.y, v.z);
        }
    }
    for (let lon = 0; lon < 360; lon += 30) {
        for (let lat = -87; lat < 87; lat += 3) {
            latLonToVec(lat, lon, v).multiplyScalar(R * 1.001); grid.push(v.x, v.y, v.z);
            latLonToVec(lat + 3, lon, v).multiplyScalar(R * 1.001); grid.push(v.x, v.y, v.z);
        }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
    spin.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.22 })));

    // Fresnel rim glow.
    spin.add(new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.08, 64, 48),
        new THREE.ShaderMaterial({
            uniforms: { color: { value: new THREE.Color(C.atmosphere) } },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal);
                    vView = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform vec3 color;
                varying vec3 vNormal;
                varying vec3 vView;
                void main() {
                    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
                    gl_FragColor = vec4(color, rim * 0.55);
                }`,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
    ));

    // Cities: glowing marker + label.
    const glowTexture = makeGlowTexture();
    const cityDirs = hops.map(h => latLonToVec(h.lat, h.lon));
    const cities = hops.map((hop, i) => {
        const marker = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture, color: C.dim, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        }));
        marker.position.copy(cityDirs[i]).multiplyScalar(R * 1.01);
        marker.scale.setScalar(0.55);
        const label = makeLabel(hop.city, hop.native, 0.55);
        // Abbotsford and Vancouver are 72 km apart: hang Abbotsford's label below-left, Vancouver's above-right.
        const anchors: Record<string, [number, number]> = { Abbotsford: [1.02, 1.15], Vancouver: [-0.02, -0.15] };
        label.center.set(...(anchors[hop.city] ?? [-0.05, 0.5]));
        label.position.copy(cityDirs[i]).multiplyScalar(R * 1.06);
        spin.add(marker, label);
        return { marker, label };
    });

    // Great-circle arcs between consecutive hops, lifted in proportion to their length.
    const arcs = hops.slice(0, -1).map((_, i) => {
        const a = cityDirs[i], b = cityDirs[i + 1];
        const angle = a.angleTo(b);
        const lift = 0.03 + 0.28 * angle / (Math.PI / 2);
        const q = new THREE.Quaternion().setFromUnitVectors(a, b);
        const qt = new THREE.Quaternion();
        const points = Array.from({ length: ARC_SEGMENTS + 1 }, (_, k) => {
            const t = k / ARC_SEGMENTS;
            qt.identity().slerp(q, t);
            return a.clone().applyQuaternion(qt).multiplyScalar(R * (1.01 + lift * Math.sin(Math.PI * t)));
        });
        const curve = new THREE.CatmullRomCurve3(points);
        const radial = 6;
        const tube = new THREE.Mesh(
            new THREE.TubeGeometry(curve, ARC_SEGMENTS, 0.03, radial, false),
            new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.95 }),
        );
        spin.add(tube);
        return { curve, tube, radial };
    });

    const head = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: C.orange, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    head.scale.setScalar(0.7);
    spin.add(head);

    const color = new THREE.Color();
    const dir = new THREE.Vector3();
    const worldQ = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const center = new THREE.Vector3();
    const toCamera = new THREE.Vector3();

    return {
        group,

        update(dt, time, progress, focus, reduceMotion, cameraPos) {
            // Idle spin only while it is a mini globe in the constellation.
            if (!reduceMotion) spin.rotation.y += dt * 0.15 * (1 - focus);
            group.scale.setScalar(0.3 + 0.7 * focus);

            // Out of focus, show the whole route; in focus, draw it as the page scrolls.
            const shown = THREE.MathUtils.lerp(hops.length - 1, progress, focus);

            arcs.forEach((arc, i) => {
                const t = THREE.MathUtils.clamp(shown - i, 0, 1);
                const segs = Math.floor(t * ARC_SEGMENTS);
                arc.tube.geometry.setDrawRange(0, segs * arc.radial * 6);
                arc.tube.visible = segs > 0;
                if (t > 0 && t < 1) arc.curve.getPoint(t, head.position);
            });
            const drawing = shown % 1 > 0.001 && shown < hops.length - 1;
            head.visible = drawing;
            head.scale.setScalar(0.6 + (reduceMotion ? 0 : 0.15 * Math.sin(time * 8)));

            // Labels on the far side would float past the rim; fade them by how much they face the camera.
            spin.getWorldQuaternion(worldQ);
            group.getWorldPosition(center);
            toCamera.copy(cameraPos).sub(center).normalize();

            cities.forEach(({ marker, label }, i) => {
                const facing = THREE.MathUtils.clamp(dir.copy(cityDirs[i]).applyQuaternion(worldQ).dot(toCamera) * 5 - 1.2, 0, 1);
                const current = Math.abs(shown - i) < 0.5;
                const reached = shown >= i - 0.5;
                color.set(current ? C.orange : reached ? C.cyan : C.dim);
                const m = marker.material as THREE.SpriteMaterial;
                m.color.copy(color);
                m.opacity = current ? 1 : reached ? 0.8 : 0.5;
                marker.scale.setScalar((current ? 0.75 : 0.5) + (current && !reduceMotion ? 0.12 * Math.sin(time * 4) : 0));
                (label.material as THREE.SpriteMaterial).opacity = focus * facing * (current ? 1 : 0.55);
            });
        },

        pose(progress, pos, target) {
            const n = hops.length;
            const p = THREE.MathUtils.clamp(progress, 0, n - 1);
            const i = Math.min(n - 2, Math.floor(p));
            const f = smooth(p - i);
            const a = cityDirs[i], b = cityDirs[i + 1];
            dir.copy(a).lerp(b, f).normalize();
            // Pull back mid-hop, more for longer hops (Tokyo → Canada crosses the Pacific).
            const lift = Math.sin(Math.PI * f) * a.angleTo(b) * 1.6;

            spin.getWorldQuaternion(worldQ);
            group.getWorldScale(worldScale);
            group.getWorldPosition(target);
            dir.applyQuaternion(worldQ);
            const r = R * worldScale.x;
            // Sit a little south of the city so the view looks up the globe, north on top.
            pos.copy(dir).multiplyScalar(r * (3.8 + lift)).add(target);
            pos.y -= r * 0.9;
            target.addScaledVector(dir, r * 0.35);
        },
    };
}

function makeDotTexture(): THREE.Texture {
    const size = 32;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
}
