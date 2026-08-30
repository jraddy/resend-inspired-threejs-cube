# Provenance audit

Audit date: 31 August 2026

## Sources reviewed

The current files below were retrieved directly from the public Devs Love Coffee repository and reviewed before this repository was published:

- `public/assets/resend_cube.html`
- `public/assets/resend_cube_2.html`
- `public/assets/resend_cube_3.html`

Source: <https://github.com/devslovecoffee/devs-love-coffee>

The three associated tutorial articles were also reviewed:

- <https://www.devslovecoffee.com/blog/making-the-resend-cube-from-scratch-using-three-js>
- <https://www.devslovecoffee.com/blog/resend-cube-lookalike-part-2>
- <https://www.devslovecoffee.com/blog/resend-cube-lookalike-part-3>

## Comparison

| Concern | Devs Love Coffee examples | This public implementation |
| --- | --- | --- |
| Cubie construction | Separate `Mesh` and geometry instances | One `InstancedMesh` with 27 transforms |
| Rounded geometry | Custom `createBoxWithRoundedEdges` helper | Official Three.js `RoundedBoxGeometry` addon |
| Layer model | Nested wrapper/group structure | Coordinate and quaternion state per cubie |
| Layer animation | Tweened wrapper rotations | Time-based quaternion interpolation and committed coordinates |
| View interaction | OrbitControls or custom angle tracking | Pointer capture with direct quaternion rotation and inertia |
| Lighting/effects | Point/rect lights, bloom and FXAA variants | Ambient, hemisphere, directional and two colored point lights; no post-processing |
| Render lifecycle | Continuous requestAnimationFrame loop | View-, tab-, preference- and user-aware scheduling |
| Failure behavior | No equivalent complete fallback path | Static poster plus WebGL unavailable/context-loss states |
| Cleanup | No equivalent complete disposal contract | Public handle and explicit observer, listener and GPU cleanup |

## Findings

- No copy of the tutorial’s distinctive `createBoxWithRoundedEdges`, `makeCubes`, `tRotate`, `constructScene`, `addControls`, `addCamera` or `addRendering` functions is present.
- No tutorial comments, HTML shell, CSS, bloom configuration or third-party control code is reproduced.
- Shared names such as `scene`, `camera`, `renderer`, `material` and `animate` are conventional Three.js terminology. The public implementation uses its own scene organization and control flow.
- The visual and historical influence is acknowledged prominently in the demo, README and NOTICE rather than being obscured.

This audit records an engineering comparison and attribution boundary; it is not legal advice.

