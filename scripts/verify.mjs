import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const failures = [];

const requiredFiles = [
  "index.html",
  "src/cube.js",
  "src/main.js",
  "src/styles.css",
  "public/cube-fallback.png",
  "public/favicon.svg",
  "README.md",
  "LICENSE",
  "NOTICE.md",
  "PROVENANCE.md",
  "THIRD_PARTY_NOTICES.md"
];

for (const file of requiredFiles) {
  try {
    await access(path.join(root, file));
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

const [html, cube, main, readme, notice, provenance, packageJson] = await Promise.all([
  read("index.html"),
  read("src/cube.js"),
  read("src/main.js"),
  read("README.md"),
  read("NOTICE.md"),
  read("PROVENANCE.md"),
  read("package.json")
]);

const requiredLinks = [
  "https://www.devslovecoffee.com/blog/making-the-resend-cube-from-scratch-using-three-js",
  "https://www.devslovecoffee.com/blog/resend-cube-lookalike-part-2",
  "https://www.devslovecoffee.com/blog/resend-cube-lookalike-part-3",
  "https://github.com/devslovecoffee/devs-love-coffee",
  "https://www.linkedin.com/in/dariosimic-de",
  "https://revodev.de"
];

for (const link of requiredLinks) {
  if (!`${html}\n${readme}\n${notice}`.includes(link)) failures.push(`Required link is absent: ${link}`);
}

const requiredCubeTokens = [
  "new THREE.InstancedMesh",
  "new RoundedBoxGeometry",
  "webglcontextlost",
  "IntersectionObserver",
  "ResizeObserver",
  "pause, resume, reset, dispose"
];

for (const token of requiredCubeTokens) {
  if (!cube.includes(token)) failures.push(`Cube contract is absent: ${token}`);
}

for (const token of ["prefers-reduced-motion", "data-pause", "data-reset"]) {
  if (!`${html}\n${main}`.includes(token)) failures.push(`Accessible control behavior is absent: ${token}`);
}

for (const upstreamIdentifier of [
  "createBoxWithRoundedEdges",
  "makeCubes",
  "tRotate",
  "constructScene",
  "addControls",
  "addCamera",
  "addRendering"
]) {
  if (cube.includes(upstreamIdentifier)) failures.push(`Upstream identifier remains in public code: ${upstreamIdentifier}`);
  if (!provenance.includes(upstreamIdentifier)) failures.push(`Provenance audit omits: ${upstreamIdentifier}`);
}

const packageData = JSON.parse(packageJson);
if (packageData.private !== true) failures.push("package.json must prevent accidental npm publication.");
if (packageData.dependencies?.three !== "0.185.1") failures.push("Three.js must remain pinned to 0.185.1.");
if (!html.includes('type="module" src="/src/main.js"')) failures.push("The demo module entry is missing.");
if (/<(script|link)[^>]+(?:src|href)=["']https?:\/\//i.test(html)) {
  failures.push("Runtime HTML contains a third-party script or stylesheet request.");
}
if (!readme.includes("not affiliated with, sponsored by or endorsed by Resend")) {
  failures.push("README independent-project disclaimer is missing.");
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Static verification passed (${requiredFiles.length} files, ${requiredLinks.length} credited links).`);
