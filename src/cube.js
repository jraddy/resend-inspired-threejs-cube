import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1)
};

const TURN_AXES = /** @type {const} */ (["x", "y", "z"]);
const TURN_LAYERS = [-1, 0, 1];
const easeInOutQuint = (value) =>
  value < 0.5 ? 16 * value ** 5 : 1 - ((-2 * value + 2) ** 5) / 2;

/**
 * Mount the interactive cube in an element containing a `[data-cube-canvas]` canvas.
 *
 * The caller owns the returned handle and should call `dispose()` when the host is removed.
 * The scene automatically pauses while off-screen, when the document is hidden, or when
 * the user has paused it through the handle.
 *
 * @param {HTMLElement} container Host element for the scene.
 * @returns {{ pause: () => void, resume: () => void, reset: () => void, dispose: () => void } | undefined}
 */
export function mountCubeScene(container) {
  const canvas = container.querySelector("[data-cube-canvas]");
  const compactMode = matchMedia("(max-width: 640px), (pointer: coarse)");

  if (!(canvas instanceof HTMLCanvasElement)) {
    setRenderState("fallback", "canvas-missing");
    return undefined;
  }

  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: !compactMode.matches,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
    stencil: false
  });

  if (!context) {
    setRenderState("fallback", "webgl2-unavailable");
    return undefined;
  }

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
  camera.position.set(0, 0.15, 10.2);

  const stage = new THREE.Group();
  scene.add(stage);

  const geometry = new RoundedBoxGeometry(1, 1, 1, compactMode.matches ? 2 : 4, 0.15);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x11151d,
    emissiveIntensity: 0.3,
    metalness: 0.62,
    roughness: 0.21,
    vertexColors: true
  });

  const cubies = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const edgeBias = (x + y - z + 3) / 12;
        cubies.push({
          coordinate: new THREE.Vector3(x, y, z),
          initialCoordinate: new THREE.Vector3(x, y, z),
          quaternion: new THREE.Quaternion(),
          tint: new THREE.Color().setHSL(0.61, 0.035 + edgeBias * 0.04, 0.48 + edgeBias * 0.12)
        });
      }
    }
  }

  const mesh = new THREE.InstancedMesh(geometry, material, cubies.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  cubies.forEach((cubie, index) => mesh.setColorAt(index, cubie.tint));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  stage.add(mesh);

  const ambient = new THREE.AmbientLight(0xdbe4f6, 1.05);
  const hemisphere = new THREE.HemisphereLight(0xf0f4ff, 0x252b37, 4.2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 7.2);
  keyLight.position.set(-3.7, 5.2, 5.8);
  const rimLight = new THREE.PointLight(0x8aa9ff, 30, 15, 2);
  rimLight.position.set(4.6, -1.9, 2.8);
  const violetLight = new THREE.PointLight(0xb39cff, 17, 13, 2);
  violetLight.position.set(-4.2, -3.5, 1.2);
  scene.add(ambient, hemisphere, keyLight, rimLight, violetLight);

  const dummy = new THREE.Object3D();
  const turnQuaternion = new THREE.Quaternion();
  const composedQuaternion = new THREE.Quaternion();
  const dragQuaternion = new THREE.Quaternion();
  const screenTurnQuaternion = new THREE.Quaternion();
  const automaticQuaternion = new THREE.Quaternion();
  const automaticEuler = new THREE.Euler();
  const workingPosition = new THREE.Vector3();
  const spacing = 1.08;

  let layerTurn;
  let nextTurnAt = performance.now() + 1450;
  let frame = 0;
  let disposed = false;
  let inView = true;
  let manualPaused = false;
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerAt = 0;
  let yawVelocity = 0;
  let pitchVelocity = 0;

  function setRenderState(state, reason) {
    container.dataset.renderState = state;
    if (reason) container.dataset.renderReason = reason;
    else delete container.dataset.renderReason;
  }

  const applyScreenRotation = (yawAngle, pitchAngle) => {
    if (yawAngle) {
      screenTurnQuaternion.setFromAxisAngle(AXES.y, yawAngle);
      dragQuaternion.premultiply(screenTurnQuaternion);
    }
    if (pitchAngle) {
      screenTurnQuaternion.setFromAxisAngle(AXES.x, pitchAngle);
      dragQuaternion.premultiply(screenTurnQuaternion);
    }
    dragQuaternion.normalize();
  };

  const chooseTurn = (now) => {
    const axis = TURN_AXES[Math.floor(Math.random() * TURN_AXES.length)];
    layerTurn = {
      axis,
      layer: TURN_LAYERS[Math.floor(Math.random() * TURN_LAYERS.length)],
      direction: Math.random() > 0.5 ? 1 : -1,
      startedAt: now,
      duration: compactMode.matches ? 920 : 1180
    };
  };

  const commitTurn = (turn) => {
    const finalRotation = turnQuaternion.setFromAxisAngle(
      AXES[turn.axis],
      turn.direction * Math.PI / 2
    );

    cubies.forEach((cubie) => {
      if (Math.round(cubie.coordinate[turn.axis]) !== turn.layer) return;
      cubie.coordinate
        .applyQuaternion(finalRotation)
        .set(
          Math.round(cubie.coordinate.x),
          Math.round(cubie.coordinate.y),
          Math.round(cubie.coordinate.z)
        );
      cubie.quaternion.premultiply(finalRotation).normalize();
    });
  };

  const updateInstances = (now) => {
    let activeRotation;

    if (layerTurn) {
      const progress = Math.min(1, Math.max(0, (now - layerTurn.startedAt) / layerTurn.duration));
      activeRotation = turnQuaternion.setFromAxisAngle(
        AXES[layerTurn.axis],
        layerTurn.direction * Math.PI / 2 * easeInOutQuint(progress)
      );

      if (progress >= 1) {
        commitTurn(layerTurn);
        layerTurn = undefined;
        activeRotation = undefined;
        nextTurnAt = now + 1500 + Math.random() * 2100;
      }
    }

    cubies.forEach((cubie, index) => {
      const selected =
        layerTurn && Math.round(cubie.coordinate[layerTurn.axis]) === layerTurn.layer;
      workingPosition.copy(cubie.coordinate);
      composedQuaternion.copy(cubie.quaternion);

      if (selected && activeRotation) {
        workingPosition.applyQuaternion(activeRotation);
        composedQuaternion.premultiply(activeRotation);
      }

      dummy.position.copy(workingPosition).multiplyScalar(spacing);
      dummy.quaternion.copy(composedQuaternion);
      dummy.scale.setScalar(0.96);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  };

  const canAnimate = () =>
    inView && !document.hidden && !reducedMotion.matches && !manualPaused;

  const render = (now) => {
    if (disposed) return;
    frame = 0;
    const animate = canAnimate();

    if (animate) {
      if (!layerTurn && now >= nextTurnAt && !dragging) chooseTurn(now);

      if (!dragging) {
        yawVelocity *= 0.94;
        pitchVelocity *= 0.92;
        applyScreenRotation(yawVelocity, pitchVelocity);
      }

      const elapsedSeconds = now * 0.001;
      automaticEuler.set(
        -0.39 + Math.sin(elapsedSeconds * 0.23) * 0.13 + Math.sin(elapsedSeconds * 0.071 + 0.9) * 0.035,
        0.62 + elapsedSeconds * 0.16,
        -0.08 + Math.sin(elapsedSeconds * 0.17) * 0.05 + Math.sin(elapsedSeconds * 0.063 + 1.4) * 0.02
      );
      automaticQuaternion.setFromEuler(automaticEuler);
      stage.quaternion.copy(dragQuaternion).multiply(automaticQuaternion);
    }

    if (layerTurn || !container.classList.contains("is-ready")) updateInstances(now);
    renderer.render(scene, camera);
    container.classList.add("is-ready");
    setRenderState(
      animate || layerTurn ? "running" : "paused",
      manualPaused ? "manual" : undefined
    );

    if (
      animate ||
      layerTurn ||
      dragging ||
      Math.abs(yawVelocity) + Math.abs(pitchVelocity) > 0.0001
    ) {
      frame = requestAnimationFrame(render);
    }
  };

  const requestRender = () => {
    if (!frame && inView && !document.hidden) frame = requestAnimationFrame(render);
  };

  const resize = () => {
    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compactMode.matches ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 520 ? 38 : 31;
    camera.position.z = width < 520 ? 10.9 : 10.2;
    camera.updateProjectionMatrix();
    requestRender();
  };

  const onMotionChange = () => {
    if (reducedMotion.matches) {
      layerTurn = undefined;
      yawVelocity = 0;
      pitchVelocity = 0;
      cancelAnimationFrame(frame);
      frame = 0;
    }
    requestRender();
  };

  const onPointerDown = (event) => {
    if (reducedMotion.matches || manualPaused) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastPointerAt = event.timeStamp;
    canvas.setPointerCapture(event.pointerId);
    requestRender();
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    const elapsed = Math.max(8, event.timeStamp - lastPointerAt);
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    applyScreenRotation(deltaX * 0.006, deltaY * 0.0045);
    yawVelocity = THREE.MathUtils.clamp((deltaX / elapsed) * 0.085, -0.055, 0.055);
    pitchVelocity = THREE.MathUtils.clamp((deltaY / elapsed) * 0.06, -0.04, 0.04);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastPointerAt = event.timeStamp;
    requestRender();
  };

  const onPointerUp = (event) => {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    requestRender();
  };

  const onVisibility = () => requestRender();

  const onContextLost = (event) => {
    event.preventDefault();
    container.classList.remove("is-ready");
    setRenderState("fallback", "webgl-context-lost");
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const onContextRestored = () => {
    if (disposed) return;
    setRenderState("restoring");
    resize();
    requestRender();
  };

  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) requestRender();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        setRenderState("paused", "off-screen");
      }
    },
    { threshold: 0.02 }
  );

  resizeObserver.observe(container);
  intersectionObserver.observe(container);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  reducedMotion.addEventListener("change", onMotionChange);
  compactMode.addEventListener("change", resize);
  document.addEventListener("visibilitychange", onVisibility);
  renderer.toneMappingExposure = 1.23;
  updateInstances(performance.now());
  resize();

  const pause = () => {
    if (disposed) return;
    manualPaused = true;
    dragging = false;
    yawVelocity = 0;
    pitchVelocity = 0;
    cancelAnimationFrame(frame);
    frame = 0;
    setRenderState("paused", "manual");
    requestRender();
  };

  const resume = () => {
    if (disposed) return;
    manualPaused = false;
    nextTurnAt = performance.now() + 800;
    requestRender();
  };

  const reset = () => {
    if (disposed) return;
    layerTurn = undefined;
    dragQuaternion.identity();
    yawVelocity = 0;
    pitchVelocity = 0;
    cubies.forEach((cubie) => {
      cubie.coordinate.copy(cubie.initialCoordinate);
      cubie.quaternion.identity();
    });
    stage.rotation.set(-0.39, 0.62, -0.08);
    updateInstances(performance.now());
    nextTurnAt = performance.now() + 1000;
    requestRender();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    reducedMotion.removeEventListener("change", onMotionChange);
    compactMode.removeEventListener("change", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    stage.remove(mesh);
    geometry.dispose();
    material.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
    container.classList.remove("is-ready");
    setRenderState("disposed");
  };

  return { pause, resume, reset, dispose };
}
