import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = path.join(root, "node_modules/lucide-react/dist/esm/icons");
const GREEN = "#026A4E";

function iconNode(name) {
    const source = fs.readFileSync(path.join(iconDir, `${name}.mjs`), "utf8");
    const start = source.indexOf("const __iconData = ");
    const end = source.indexOf(";\n", start);
    const literal = source.slice(start + "const __iconData = ".length, end).trim();
    return Function(`"use strict"; return (${literal});`)().node;
}

function markup(node) {
    return node
        .map(([tag, attrs]) => {
            const rendered = Object.entries(attrs)
                .filter(([key]) => key !== "key")
                .map(([key, value]) => `${key}="${value}"`)
                .join(" ");
            return `<${tag} ${rendered}/>`;
        })
        .join("");
}

function drawing(node, size, inset, color, background) {
    const box = size * (1 - inset * 2);
    const scale = box / 24;
    const offset = size * inset;
    const backdrop = background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : "";
    return Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${backdrop}
            <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${markup(node)}
            </g>
        </svg>`,
    );
}

async function writePng(file, svg) {
    await sharp(svg).png().toFile(file);
}

const pinned = iconNode("map-pinned");
const map = iconNode("map");
const messages = iconNode("messages-square");
const bell = iconNode("bell");
const out = path.join(root, "public/icons");
fs.mkdirSync(out, { recursive: true });

await writePng(path.join(out, "icon-192.png"), drawing(pinned, 192, 0.16, "#FFFFFF", GREEN));
await writePng(path.join(out, "icon-512.png"), drawing(pinned, 512, 0.16, "#FFFFFF", GREEN));
await writePng(path.join(out, "icon-maskable-192.png"), drawing(pinned, 192, 0.2, "#FFFFFF", GREEN));
await writePng(path.join(out, "icon-maskable-512.png"), drawing(pinned, 512, 0.2, "#FFFFFF", GREEN));
await writePng(path.join(out, "badge-96.png"), drawing(bell, 96, 0.12, "#FFFFFF", null));
await writePng(path.join(out, "shortcut-map-96.png"), drawing(map, 96, 0.16, "#FFFFFF", GREEN));
await writePng(path.join(out, "shortcut-messages-96.png"), drawing(messages, 96, 0.16, "#FFFFFF", GREEN));
await writePng(path.join(out, "shortcut-notification-96.png"), drawing(bell, 96, 0.16, "#FFFFFF", GREEN));
await writePng(path.join(root, "src/app/apple-icon.png"), drawing(pinned, 180, 0.16, "#FFFFFF", GREEN));
