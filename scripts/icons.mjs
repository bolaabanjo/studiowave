#!/usr/bin/env node
/**
 * Regenerates src/ui/icon-data.ts (and the tab bar PNGs) from the icon
 * packages the web Studio uses, so the phone draws exactly the web's icons.
 *
 *   node scripts/icons.mjs                 every icon already in icon-data.ts
 *   node scripts/icons.mjs share qr-code   just these (adds them if new)
 *   node scripts/icons.mjs --tabs          also redraw assets/tabs/*.png (needs rsvg-convert)
 *
 * Names: Solar bold duotone by default; `name:linear` / `name:bold` for other
 * Solar styles, `name:lucide` for lucide-react, `name:huge` for Hugeicons.
 * The packages are read from the web repo's node_modules: ../cencori, or
 * CENCORI_DIR.
 *
 * Groups keep their children: Solar's duotone puts its faded layer in a <g>,
 * and flattening that away is what once left share and QR half drawn.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = path.join(path.resolve(root, process.env.CENCORI_DIR ?? "../cencori"), "node_modules");
const dataFile = path.join(root, "src/ui/icon-data.ts");
const tabsDir = path.join(root, "assets/tabs");

const BASES = {
    solar: { fill: "currentColor" },
    "solar-linear": { fill: "none", stroke: "currentColor", strokeWidth: 1.5 },
    lucide: { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    huge: { fill: "none" },
};

const element = (type, props) => ({ type, props });

/** What the packages' modules import, by imported name (minified local names differ per file). */
const STUBS = { default: () => null, forwardRef: (render) => render, jsx: element, jsxs: element };

/** Runs one of the packages' prebuilt modules with its imports stubbed out, returning what it exports. */
function evaluate(file) {
    const source = fs.readFileSync(file, "utf8")
        .replace(/\bimport\s*(?:(\w+)|\{([^}]*)\})\s*from\s*["'][^"']*["'];?/g, (_, local, named) => {
            const bindings = local ? [["default", local]] : named.split(",").map((part) => part.trim().split(/\s+as\s+/)).map(([imported, as]) => [imported, as ?? imported]);
            return bindings.map(([imported, as]) => `const ${as} = STUBS[${JSON.stringify(imported)}];`).join("");
        })
        .replace(/export\s*\{([^}]*)\};?/, (_, names) => {
            const exported = names.split(",").map((part) => part.trim().split(/\s+as\s+/)).map(([local, as]) => `${JSON.stringify(as ?? local)}: ${local}`);
            return `return { ${exported.join(", ")} };`;
        });
    return new Function("STUBS", source)(STUBS);
}

/** A React element tree (Solar) as [tag, attrs, children?] nodes. */
function fromElement({ type, props }) {
    const { children, style, ...attrs } = props;
    if (style?.opacity !== undefined) attrs.opacity = Number(/([\d.]+)\)?$/.exec(String(style.opacity))?.[1] ?? style.opacity);
    const kids = [children].flat().filter((child) => child && typeof child === "object").map(fromElement);
    return kids.length ? [type, attrs, kids] : [type, attrs];
}

/** Lucide and Hugeicons ship [tag, attrs] lists; drop React's keys. */
const fromList = (list) => list.map(([tag, { key, ...attrs }]) => [tag, attrs]);

function load(name) {
    const [icon, style = "bold-duotone"] = name.split(":");
    if (style === "lucide") {
        const { __iconNode } = evaluate(path.join(modules, "lucide-react/dist/esm/icons", `${icon}.js`));
        return { base: BASES.lucide, nodes: fromList(__iconNode) };
    }
    if (style === "huge") {
        const pascal = icon.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join("");
        const { default: list } = evaluate(path.join(modules, "@hugeicons/core-free-icons/dist/esm", `${pascal}Icon.js`));
        return { base: BASES.huge, nodes: fromList(list) };
    }
    const exported = evaluate(path.join(modules, "@solar-icons/react/dist/icons", style, `${icon}.mjs`));
    const tree = Object.values(exported)[0]({});
    return { base: style === "linear" ? BASES["solar-linear"] : BASES.solar, nodes: [tree.props.children].flat().map(fromElement) };
}

let data = fs.readFileSync(dataFile, "utf8");
const entry = (name) => new RegExp(`^(\\s*)${JSON.stringify(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: \\{.*\\},?$`, "m");
const existing = [...data.matchAll(/^\s*("[^"]+"): \{/gm)].map((match) => JSON.parse(match[1]));
const args = process.argv.slice(2);
const names = args.filter((arg) => !arg.startsWith("--"));

for (const name of names.length ? names : existing) {
    const icon = load(name);
    const current = entry(name).exec(data);
    if (current) {
        // Keep a hand-set base (e.g. a different stroke width); only the drawing is regenerated.
        const base = JSON.parse(current[0].trim().replace(/,$/, "").slice(JSON.stringify(name).length + 1)).base;
        data = data.replace(entry(name), (line, indent) => `${indent}${JSON.stringify(name)}: ${JSON.stringify({ base, nodes: icon.nodes })}${line.trimEnd().endsWith(",") ? "," : ""}`);
    } else {
        data = data.replace(/\n\} satisfies/, `\n    ${JSON.stringify(name)}: ${JSON.stringify(icon)},\n} satisfies`);
    }
}
fs.writeFileSync(dataFile, data);

if (args.includes("--tabs")) {
    // Tab icons are template images: black, with the duotone's faded layer kept as alpha.
    const ICONS = Object.fromEntries([...data.matchAll(/^\s*("[^"]+"): (\{.*\}),?$/gm)].map((match) => [JSON.parse(match[1]), JSON.parse(match[2])]));
    const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const svg = ([tag, attrs, children = []]) =>
        `<${tag} ${Object.entries(attrs).map(([key, value]) => `${kebab(key)}="${String(value).replace("currentColor", "#000")}"`).join(" ")}>${children.map(svg).join("")}</${tag}>`;
    for (const file of fs.readdirSync(tabsDir).filter((file) => /^[^@]+\.png$/.test(file))) {
        const tab = file.replace(/\.png$/, "");
        const icon = ICONS[tab] ?? ICONS[`${tab}:huge`] ?? ICONS[`${tab}:lucide`];
        if (!icon) throw new Error(`No icon for tab ${file}`);
        const base = Object.entries(icon.base).map(([key, value]) => `${kebab(key)}="${String(value).replace("currentColor", "#000")}"`).join(" ");
        const document = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${base}>${icon.nodes.map(svg).join("")}</svg>`;
        for (const [scale, suffix] of [[1, ""], [2, "@2x"], [3, "@3x"]]) {
            execFileSync("rsvg-convert", ["-w", String(25 * scale), "-h", String(25 * scale), "-o", path.join(tabsDir, `${tab}${suffix}.png`)], { input: document });
        }
    }
}
