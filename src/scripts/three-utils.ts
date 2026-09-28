/** Small canvas-texture helpers shared by the 3D scenes. */
import * as THREE from 'three';

export function makeGlowTexture(): THREE.Texture {
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

export function makeLabel(title: string, subtitle: string, height = 1.1): THREE.Sprite {
    const font = '"Consolas", "Monaco", "Andale Mono", monospace, sans-serif';
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const big = 44, small = 26, pad = 12;
    ctx.font = `bold ${big}px ${font}`;
    const w1 = ctx.measureText(title).width;
    ctx.font = `${small}px ${font}`;
    const w2 = ctx.measureText(subtitle).width;
    c.width = Math.ceil(Math.max(w1, w2) + pad * 2);
    c.height = big + small + pad * 3;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${big}px ${font}`;
    ctx.fillStyle = '#C0CAF5';
    ctx.fillText(title, c.width / 2, pad);
    ctx.font = `${small}px ${font}`;
    ctx.fillStyle = '#565F89';
    ctx.fillText(subtitle, c.width / 2, pad * 2 + big);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(height * c.width / c.height, height, 1);
    return sprite;
}
