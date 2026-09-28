/**
 * ASCII torus that folds out of its fundamental parallelogram (C/Λ).
 *
 * Usage: const torus = mountAsciiTorus(preElement, { morph: 0, onProgress(m) {} });
 *        torus.fold(); torus.unfold(); torus.toggle(); torus.spin(true | false); torus.destroy();
 *
 * morph runs 0 → 2:  0 = flat sheet,  1 = cylinder (first pair of edges glued),  2 = torus.
 */
export interface AsciiTorusOptions {
    morph?: number;
    heightRatio?: number;
    onProgress?: (morph: number) => void;
}

export interface AsciiTorus {
    fold(): void;
    unfold(): void;
    toggle(): void;
    spin(on: boolean): void;
    reset(): void;
    destroy(): void;
    readonly morph: number;
}

type Vec3 = [number, number, number];

export function mountAsciiTorus(pre: HTMLElement, options: AsciiTorusOptions = {}): AsciiTorus {
    const RAMP = '.,-~:;=!*#$@';
    const R = 2, r = 0.9;         // core radius, tube radius
    const GRID_U = 12, GRID_V = 6; // lattice cells drawn on the sheet
    const K2 = 11;                // camera distance
    const MORPH_MS = 1500;        // duration per unit of morph
    const TAU = Math.PI * 2;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const heightRatio = options.heightRatio || 0.6;
    const onProgress = options.onProgress || (() => {});

    let cols = 0, rows = 0, aspect = 0.5, Nu = 0, Nv = 0;
    let zbuf = new Float32Array(0), glyph = new Int8Array(0), kind = new Uint8Array(0);
    let secY = new Float64Array(0), secW = new Float64Array(0), secNY = new Float64Array(0), secNW = new Float64Array(0);
    let secGrid = new Uint8Array(0);

    // Brightness (0..1) → ramp index, with a little ambient and a gamma curve.
    const LUT_SIZE = 256;
    const lumToGlyph = new Uint8Array(LUT_SIZE + 1);
    for (let i = 0; i <= LUT_SIZE; i++) {
        lumToGlyph[i] = Math.round((0.06 + 0.94 * Math.pow(i / LUT_SIZE, 1.4)) * (RAMP.length - 1));
    }

    let yaw = -0.2, pitch = -0.1;
    let lastUserInput = -Infinity;    // camera drifts back to a rest pose after this
    const idleSpin = reduceMotion ? 0 : 0.005;
    let spinning = true;
    let vYaw = idleSpin, vPitch = 0;

    let morph = options.morph ?? 2;
    let morphFrom = morph, morphTo = morph, morphStart = 0, morphDur = 1;

    const lightRest = normalize([-0.55, 0.75, -0.4]);
    const light: Vec3 = [...lightRest];
    let lightTarget = lightRest;

    let dragging = false, lastX = 0, lastY = 0, travel = 0;
    let visible = true, rafId = 0, lastReported = -1, lastFrame = 0;

    let destroyed = false;

    function clamp(x: number, lo: number, hi: number) { return x < lo ? lo : x > hi ? hi : x; }
    function normalize(v: Vec3): Vec3 { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; }
    function ease(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function measure() {
        const probe = document.createElement('span');
        probe.textContent = 'M'.repeat(40);
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
        pre.appendChild(probe);
        const cw = probe.getBoundingClientRect().width / 40;
        pre.removeChild(probe);
        const ch = parseFloat(getComputedStyle(pre).lineHeight) || cw / 0.55;

        aspect = cw / ch;
        cols = Math.max(24, Math.floor(pre.clientWidth / cw));
        rows = Math.max(12, Math.round(cols * aspect * heightRatio));
        pre.style.height = (rows * ch) + 'px';

        Nu = Math.round(cols * 2.2);   // ~1 sample per cell on the near side of the ring
        Nv = Math.round(cols * 0.9);
        zbuf = new Float32Array(cols * rows);
        glyph = new Int8Array(cols * rows);
        kind = new Uint8Array(cols * rows);
        secY = new Float64Array(Nv + 1);
        secW = new Float64Array(Nv + 1);
        secNY = new Float64Array(Nv + 1);
        secNW = new Float64Array(Nv + 1);
        secGrid = new Uint8Array(Nv + 1);
        for (let iv = 0; iv <= Nv; iv++) {
            const gv = iv * GRID_V / Nv;
            secGrid[iv] = Math.abs(gv - Math.round(gv)) * Nv / GRID_V < 0.5 ? 1 : 0;
        }
    }

    function render() {
        // Stage 1 (a): roll the sheet into a cylinder.  Stage 2 (b): bend the cylinder into a ring.
        const a = clamp(morph, 0, 1), b = clamp(morph - 1, 0, 1);
        const ea = Math.max(a, 1e-4), eb = Math.max(b, 1e-4);
        const rho = r / ea, P = R / eb;                               // bending radii
        const wShift = r - rho * (1 - Math.cos(ea * Math.PI)) / 2;    // keep cross-section centred
        const zShift = P * (1 - Math.cos(eb * Math.PI)) / 2;          // keep ring centred
        const gamma = a * Math.PI / 2;                                // turn the seam to the top
        const cg = Math.cos(gamma), sg = Math.sin(gamma);

        const crossHalf = rho * Math.sin(Math.min(ea * Math.PI, Math.PI / 2));
        const axisHalf = (P + r) * Math.sin(Math.min(eb * Math.PI, Math.PI / 2));
        const scale = 3 / Math.hypot(axisHalf, crossHalf);

        for (let iv = 0; iv <= Nv; iv++) {
            const th = ea * (iv / Nv * TAU - Math.PI);
            const s = Math.sin(th), c = Math.cos(th);
            const y = rho * s, w = rho * c + r - rho - wShift;
            secY[iv] = y * cg - w * sg;
            secW[iv] = y * sg + w * cg;
            secNY[iv] = s * cg - c * sg;
            secNW[iv] = s * sg + c * cg;
        }

        const cyw = Math.cos(yaw), syw = Math.sin(yaw);
        const cpt = Math.cos(pitch), spt = Math.sin(pitch);
        const halfW = cols / 2, halfH = rows / 2;
        const K1 = Math.min(cols, rows / aspect) * 0.5 * K2 / 3 * 0.85;
        const lx = light[0], ly = light[1], lz = light[2];

        zbuf.fill(0);
        glyph.fill(-1);
        kind.fill(0);

        for (let iu = 0; iu <= Nu; iu++) {
            const phi = eb * (iu / Nu * TAU - Math.PI);
            const sphi = Math.sin(phi), cphi = Math.cos(phi);
            const edgeB = iu === 0 || iu === Nu;
            const gu = iu * GRID_U / Nu, gridU = Math.abs(gu - Math.round(gu)) * Nu / GRID_U < 0.5;

            for (let iv = 0; iv <= Nv; iv++) {
                const rad = P + secW[iv];
                const X = rad * sphi * scale;
                const Y = secY[iv] * scale;
                const Z = (rad * cphi - P + zShift) * scale;

                const x1 = X * cyw + Z * syw, z1 = Z * cyw - X * syw;
                const y2 = Y * cpt - z1 * spt, z2 = Y * spt + z1 * cpt;
                const ooz = 1 / (z2 + K2);
                const xp = Math.floor(halfW + K1 * ooz * x1);
                const yp = Math.floor(halfH - K1 * ooz * y2 * aspect);
                if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;

                const edgeA = iv === 0 || iv === Nv;
                const depth = ooz + (edgeA || edgeB ? 0.0015 : 0);
                const idx = yp * cols + xp;
                if (depth <= zbuf[idx]) continue;
                zbuf[idx] = depth;

                const nX = secNW[iv] * sphi, nY = secNY[iv], nZ = secNW[iv] * cphi;
                const nx1 = nX * cyw + nZ * syw, nz1 = nZ * cyw - nX * syw;
                const ny2 = nY * cpt - nz1 * spt, nz2 = nY * spt + nz1 * cpt;
                let lum = nx1 * lx + ny2 * ly + nz2 * lz;
                if (nz2 > 0) lum = -lum;                                 // two-sided sheet

                let g = lum > 0 ? lumToGlyph[(lum * LUT_SIZE) | 0] : lumToGlyph[0];
                if ((edgeA || edgeB) && g < 6) g = 6;
                glyph[idx] = g;
                kind[idx] = edgeA ? 1 : edgeB ? 2 : (gridU || secGrid[iv]) ? 4 : g <= 2 ? 3 : 0;
            }
        }

        const CLASS = ['', 'ta', 'tb', 'td', 'tg'];
        let html = '';
        for (let y = 0; y < rows; y++) {
            let run = 0;
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                const k = glyph[i] < 0 ? 0 : kind[i];
                if (k !== run) {
                    if (run) html += '</span>';
                    if (k) html += '<span class="' + CLASS[k] + '">';
                    run = k;
                }
                html += glyph[i] < 0 ? ' ' : RAMP[glyph[i]];
            }
            if (run) html += '</span>';
            html += '\n';
        }
        pre.innerHTML = html;
    }

    function tick(now: number) {
        rafId = 0;
        if (morph !== morphTo) {
            const t = Math.min(1, (now - morphStart) / morphDur);
            morph = t >= 1 ? morphTo : morphFrom + (morphTo - morphFrom) * ease(t);
        }
        // Motion constants are tuned per 60fps frame; k rescales them for any refresh rate.
        const dt = now - lastFrame;
        const k = dt > 0 && dt < 100 ? dt / 16.7 : 1;        // treat a resume after a pause as one frame
        lastFrame = now;
        if (!dragging) {
            yaw += vYaw * k;
            pitch += vPitch * k;
            if (now - lastUserInput > 3000) pitch += (restPitch() - pitch) * (1 - Math.pow(0.97, k));
            vYaw += ((spinning ? idleSpin : 0) - vYaw) * (1 - Math.pow(0.97, k));
            vPitch *= Math.pow(0.92, k);
        }
        pitch = clamp(pitch, -1.45, 1.45);
        const lk = 1 - Math.pow(0.88, k);
        for (let i = 0; i < 3; i++) light[i] += (lightTarget[i] - light[i]) * lk;

        render();
        if (Math.abs(morph - lastReported) > 1e-3) {
            lastReported = morph;
            onProgress(morph);
        }
        schedule();
    }

    // Face the flat sheet head-on; look down on the finished torus so its hole shows.
    function restPitch() { return -0.1 - 0.75 * clamp(morph / 2, 0, 1); }

    function schedule() {
        if (!destroyed && visible && !document.hidden && !rafId) rafId = requestAnimationFrame(tick);
    }

    function setMorph(target: number) {
        morphFrom = morph;
        morphTo = clamp(target, 0, 2);
        morphStart = performance.now();
        morphDur = reduceMotion ? 1 : Math.max(1, Math.abs(morphTo - morph) * MORPH_MS);
        schedule();
    }

    // ── Interaction ─────────────────────────────────────────
    pre.addEventListener('pointerdown', (e: PointerEvent) => {
        dragging = true;
        travel = 0;
        lastX = e.clientX;
        lastY = e.clientY;
        pre.setPointerCapture(e.pointerId);
    });

    pre.addEventListener('pointermove', (e: PointerEvent) => {
        const rect = pre.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width * 2 - 1;
        const py = (e.clientY - rect.top) / rect.height * 2 - 1;
        lightTarget = normalize([px * 1.2, -py * 1.2, -0.9]);    // light follows the cursor

        if (!dragging) return;
        lastUserInput = performance.now();
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        travel += Math.abs(dx) + Math.abs(dy);
        yaw -= dx * 0.01;
        pitch -= dy * 0.01;
        vYaw = -dx * 0.01;
        vPitch = -dy * 0.01;
    });

    pre.addEventListener('pointerup', () => {
        dragging = false;
        if (travel < 5) api.toggle();
    });
    pre.addEventListener('pointercancel', () => { dragging = false; });
    pre.addEventListener('pointerleave', () => { if (!dragging) lightTarget = lightRest; });

    pre.addEventListener('keydown', (e: KeyboardEvent) => {
        const step = 0.15;
        if (e.key === 'Enter' || e.key === ' ') api.toggle();
        else if (e.key === 'ArrowLeft') yaw += step;
        else if (e.key === 'ArrowRight') yaw -= step;
        else if (e.key === 'ArrowUp') pitch += step;
        else if (e.key === 'ArrowDown') pitch -= step;
        else return;
        lastUserInput = performance.now();
        e.preventDefault();
    });

    const resizeObserver = new ResizeObserver(() => { measure(); schedule(); });
    resizeObserver.observe(pre);
    const intersectionObserver = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        schedule();
    });
    intersectionObserver.observe(pre);
    document.addEventListener('visibilitychange', schedule);

    const api: AsciiTorus = {
        fold()   { setMorph(2); },
        unfold() { setMorph(0); },
        toggle() { setMorph(morphTo > 1 ? 0 : 2); },
        spin(on: boolean) { spinning = on; schedule(); },
        reset()  { yaw = -0.2; pitch = restPitch(); vYaw = idleSpin; vPitch = 0; spinning = true; lastUserInput = -Infinity; },
        destroy() {
            destroyed = true;
            if (rafId) cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            document.removeEventListener('visibilitychange', schedule);
        },
        get morph() { return morph; },
    };

    measure();
    schedule();
    return api;
}
