import "./styles.css";

const scene = document.querySelector("[data-cube-scene]");
const pauseButton = document.querySelector("[data-pause]");
const resetButton = document.querySelector("[data-reset]");
const status = document.querySelector("[data-status]");
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

let handle;
let loading = false;
let manuallyPaused = false;

const statusLabels = {
  disposed: "Disposed",
  fallback: "Static fallback",
  loading: "Loading",
  paused: "Paused",
  reduced: "Reduced motion",
  restoring: "Restoring",
  running: "Running"
};

function updateInterface() {
  if (!(scene instanceof HTMLElement)) return;
  const state = scene.dataset.renderState || "loading";
  const reason = scene.dataset.renderReason;

  if (status) {
    status.textContent = reason === "off-screen" ? "Off-screen pause" : statusLabels[state] || state;
  }

  const interactive = Boolean(handle) && state !== "fallback" && state !== "disposed";
  if (pauseButton instanceof HTMLButtonElement) {
    pauseButton.disabled = !interactive;
    pauseButton.textContent = manuallyPaused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(manuallyPaused));
  }
  if (resetButton instanceof HTMLButtonElement) resetButton.disabled = !interactive;
}

async function loadScene() {
  if (!(scene instanceof HTMLElement) || loading || handle || motionPreference.matches) return;
  loading = true;
  scene.dataset.renderState = "loading";
  updateInterface();

  try {
    const { mountCubeScene } = await import("./cube.js");
    handle = mountCubeScene(scene);
  } catch (error) {
    scene.dataset.renderState = "fallback";
    scene.dataset.renderReason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn("Interactive cube unavailable; using the static preview.", error);
  } finally {
    loading = false;
    updateInterface();
  }
}

function applyMotionPreference() {
  if (!(scene instanceof HTMLElement)) return;

  if (motionPreference.matches) {
    handle?.dispose();
    handle = undefined;
    manuallyPaused = false;
    scene.dataset.renderState = "reduced";
    scene.dataset.renderReason = "prefers-reduced-motion";
    updateInterface();
    return;
  }

  delete scene.dataset.renderReason;
  void loadScene();
}

pauseButton?.addEventListener("click", () => {
  if (!handle) return;
  manuallyPaused = !manuallyPaused;
  if (manuallyPaused) handle.pause();
  else handle.resume();
  updateInterface();
});

resetButton?.addEventListener("click", () => {
  handle?.reset();
});

const statusObserver = new MutationObserver(updateInterface);
if (scene) {
  statusObserver.observe(scene, {
    attributes: true,
    attributeFilter: ["data-render-state", "data-render-reason"]
  });
}

motionPreference.addEventListener("change", applyMotionPreference);
window.addEventListener(
  "pagehide",
  () => {
    statusObserver.disconnect();
    motionPreference.removeEventListener("change", applyMotionPreference);
    handle?.dispose();
    handle = undefined;
  },
  { once: true }
);

applyMotionPreference();

