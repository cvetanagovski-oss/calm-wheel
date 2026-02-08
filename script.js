const wheel = document.getElementById("wheel");

let isDragging = false;
let angle = 0;
let lastPointerAngle = 0;
let lastTime = 0;
let velocity = 0;
let inertiaId = null;

const tickAngle = Math.PI / 12; // 15 degrees
let tickAccumulator = 0;

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function clickSound() {
  if (!audioCtx) return;

  const duration = 0.018;
  const sampleRate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    const envelope = Math.exp(-t * 20);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2800;
  filter.Q.value = 0.6;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.18;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  source.start();
}

function emitTicks(delta) {
  tickAccumulator += delta;

  const step = tickAccumulator > 0 ? 1 : -1;
  while (Math.abs(tickAccumulator) >= tickAngle) {
    clickSound();
    tickAccumulator -= step * tickAngle;
  }
}

function applyAngle(nextAngle) {
  const prev = angle;
  angle = nextAngle;
  wheel.style.transform = `rotate(${angle}rad)`;
  emitTicks(angle - prev);
}

function getPointerAngle(event) {
  const rect = wheel.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  return Math.atan2(dy, dx);
}

function normalizeDelta(delta) {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

function stopInertia() {
  if (inertiaId) {
    cancelAnimationFrame(inertiaId);
    inertiaId = null;
  }
}

function startInertia() {
  stopInertia();
  const friction = 0.92;
  let lastFrame = performance.now();

  function step(now) {
    const dt = Math.max(1, now - lastFrame);
    lastFrame = now;

    const nextAngle = angle + velocity * dt;
    velocity *= Math.pow(friction, dt / 16);

    applyAngle(nextAngle);

    if (Math.abs(velocity) > 0.0004) {
      inertiaId = requestAnimationFrame(step);
    } else {
      inertiaId = null;
      velocity = 0;
    }
  }

  inertiaId = requestAnimationFrame(step);
}

wheel.addEventListener("pointerdown", (event) => {
  ensureAudio();
  stopInertia();
  wheel.setPointerCapture(event.pointerId);
  isDragging = true;
  lastPointerAngle = getPointerAngle(event);
  lastTime = performance.now();
});

wheel.addEventListener("pointermove", (event) => {
  if (!isDragging) return;

  const now = performance.now();
  const currentAngle = getPointerAngle(event);
  const delta = normalizeDelta(currentAngle - lastPointerAngle);
  lastPointerAngle = currentAngle;

  const dt = Math.max(1, now - lastTime);
  lastTime = now;

  applyAngle(angle + delta);
  velocity = delta / dt;
});

function finishDrag(event) {
  if (!isDragging) return;
  isDragging = false;
  wheel.releasePointerCapture(event.pointerId);

  if (Math.abs(velocity) > 0.0006) {
    startInertia();
  }
}

wheel.addEventListener("pointerup", finishDrag);
wheel.addEventListener("pointercancel", finishDrag);

// Initialize tick accumulator
applyAngle(0);
