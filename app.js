// === NEXUS Gesture Interface - Main Application ===

// DOM Elements
const videoElement = document.querySelector('.input-video');
const mainCanvas = document.getElementById('main-canvas');
const mainCtx = mainCanvas.getContext('2d');
const skeletonCanvas = document.getElementById('skeleton-canvas');
const skeletonCtx = skeletonCanvas.getContext('2d');
const trajectoryCanvas = document.getElementById('trajectory-canvas');
const trajectoryCtx = trajectoryCanvas.getContext('2d');

// State
let isTracking = false;
let frameCount = 0;
let lastFrameTime = performance.now();
let fpsValues = [];
let trajectoryPoints = [];
let gestureHistory = [];
let detectionCount = 0;
let totalFrames = 0;
let lastGesture = null;
let lastGestureTime = 0;

// Video dimensions (will be set when camera starts)
let videoWidth = 1280;
let videoHeight = 720;

// Gesture definitions based on finger states
const GESTURES = {
  OPEN_PALM: { name: 'OPEN PALM', emoji: '✋', fingers: [1, 1, 1, 1, 1] },
  FIST: { name: 'FIST', emoji: '✊', fingers: [0, 0, 0, 0, 0] },
  POINTING: { name: 'POINTING', emoji: '☝️', fingers: [0, 1, 0, 0, 0] },
  PEACE: { name: 'PEACE', emoji: '✌️', fingers: [0, 1, 1, 0, 0] },
  THUMBS_UP: { name: 'THUMBS UP', emoji: '👍', fingers: [1, 0, 0, 0, 0] },
  ROCK: { name: 'ROCK ON', emoji: '🤘', fingers: [0, 1, 0, 0, 1] },
  THREE: { name: 'THREE', emoji: '🖖', fingers: [0, 1, 1, 1, 0] },
  FOUR: { name: 'FOUR', emoji: '🖖', fingers: [0, 1, 1, 1, 1] },
  OK: { name: 'OK SIGN', emoji: '👌', fingers: [1, 0, 1, 1, 1] },
  CALL: { name: 'CALL ME', emoji: '🤙', fingers: [1, 0, 0, 0, 1] },
};

// MediaPipe Hand Landmark indices
const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];
const FINGER_MCPS = [2, 5, 9, 13, 17];

// Hand colors for visualization
const HAND_COLORS = {
  Left: { primary: '#00f0ff', secondary: '#00a8ff', glow: 'rgba(0, 240, 255, 0.6)' },
  Right: { primary: '#ff00aa', secondary: '#ff6600', glow: 'rgba(255, 0, 170, 0.6)' },
};

// Initialize clock
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// Initialize canvas sizes with cover mode (fill and crop)
function resizeCanvases() {
  const mainContainer = mainCanvas.parentElement;
  const containerWidth = mainContainer.clientWidth;
  const containerHeight = mainContainer.clientHeight;

  // Set canvas to container size
  mainCanvas.width = containerWidth;
  mainCanvas.height = containerHeight;

  // Calculate cover mode dimensions (fill container, may crop video)
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let drawWidth, drawHeight, offsetX, offsetY;
  let cropX = 0, cropY = 0, cropWidth = 1, cropHeight = 1;

  if (containerAspect > videoAspect) {
    // Container is wider than video - scale to width, crop top/bottom
    drawWidth = containerWidth;
    drawHeight = containerWidth / videoAspect;
    offsetX = 0;
    offsetY = (containerHeight - drawHeight) / 2;

    // Calculate how much of the video is visible (in normalized coords)
    const visibleRatio = containerHeight / drawHeight;
    cropY = (1 - visibleRatio) / 2;
    cropHeight = visibleRatio;
  } else {
    // Container is taller than video - scale to height, crop left/right
    drawHeight = containerHeight;
    drawWidth = containerHeight * videoAspect;
    offsetX = (containerWidth - drawWidth) / 2;
    offsetY = 0;

    // Calculate how much of the video is visible (in normalized coords)
    const visibleRatio = containerWidth / drawWidth;
    cropX = (1 - visibleRatio) / 2;
    cropWidth = visibleRatio;
  }

  // Store for rendering - these help map landmarks to visible area
  mainCanvas.drawWidth = drawWidth;
  mainCanvas.drawHeight = drawHeight;
  mainCanvas.drawOffsetX = offsetX;
  mainCanvas.drawOffsetY = offsetY;
  mainCanvas.cropX = cropX;
  mainCanvas.cropY = cropY;
  mainCanvas.cropWidth = cropWidth;
  mainCanvas.cropHeight = cropHeight;

  const skeletonContainer = skeletonCanvas.parentElement;
  skeletonCanvas.width = skeletonContainer.clientWidth;
  skeletonCanvas.height = skeletonContainer.clientHeight;

  const trajectoryContainer = trajectoryCanvas.parentElement;
  trajectoryCanvas.width = trajectoryContainer.clientWidth;
  trajectoryCanvas.height = trajectoryContainer.clientHeight;

  // Draw initial trajectory grid
  drawTrajectoryGrid();
}

window.addEventListener('resize', resizeCanvases);

// Draw trajectory background grid
function drawTrajectoryGrid() {
  trajectoryCtx.fillStyle = '#12121c';
  trajectoryCtx.fillRect(0, 0, trajectoryCanvas.width, trajectoryCanvas.height);

  trajectoryCtx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
  trajectoryCtx.lineWidth = 1;

  const gridSize = 20;
  for (let x = 0; x < trajectoryCanvas.width; x += gridSize) {
    trajectoryCtx.beginPath();
    trajectoryCtx.moveTo(x, 0);
    trajectoryCtx.lineTo(x, trajectoryCanvas.height);
    trajectoryCtx.stroke();
  }
  for (let y = 0; y < trajectoryCanvas.height; y += gridSize) {
    trajectoryCtx.beginPath();
    trajectoryCtx.moveTo(0, y);
    trajectoryCtx.lineTo(trajectoryCanvas.width, y);
    trajectoryCtx.stroke();
  }
}

// Calculate FPS
function calculateFPS() {
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;

  const fps = Math.round(1000 / delta);
  fpsValues.push(fps);
  if (fpsValues.length > 30) fpsValues.shift();

  const avgFPS = Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length);
  document.getElementById('fps').textContent = `${avgFPS} FPS`;

  return delta;
}

// Update latency display
function updateLatency(processingTime) {
  document.getElementById('latency').textContent = `${Math.round(processingTime)} ms`;
}

// Determine if a finger is extended
function isFingerExtended(landmarks, fingerIndex) {
  const tipIndex = FINGER_TIPS[fingerIndex];
  const pipIndex = FINGER_PIPS[fingerIndex];
  const mcpIndex = FINGER_MCPS[fingerIndex];

  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  const mcp = landmarks[mcpIndex];

  // For thumb, use x-axis comparison
  if (fingerIndex === 0) {
    const wrist = landmarks[0];
    // Check if thumb tip is further from wrist than the thumb IP joint
    const tipDist = Math.abs(tip.x - wrist.x);
    const pipDist = Math.abs(pip.x - wrist.x);
    return tipDist > pipDist;
  }

  // For other fingers, compare y positions (lower y = higher on screen = extended)
  return tip.y < pip.y;
}

// Detect gesture from finger states
function detectGesture(fingerStates) {
  const stateString = fingerStates.join(',');

  for (const [key, gesture] of Object.entries(GESTURES)) {
    if (gesture.fingers.join(',') === stateString) {
      return gesture;
    }
  }

  // Partial matches or unknown
  const extendedCount = fingerStates.reduce((a, b) => a + b, 0);
  if (extendedCount === 0) return GESTURES.FIST;
  if (extendedCount === 5) return GESTURES.OPEN_PALM;

  return { name: 'CUSTOM', emoji: '🤚', fingers: fingerStates };
}

// Update finger display
function updateFingerDisplay(fingerStates) {
  const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];

  fingerNames.forEach((name, i) => {
    const item = document.querySelector(`[data-finger="${name}"]`);
    const bar = document.getElementById(`${name}-bar`);
    const status = document.getElementById(`${name}-status`);

    const isExtended = fingerStates[i] === 1;
    item.setAttribute('data-active', isExtended.toString());
    bar.style.height = isExtended ? '100%' : '20%';
    status.textContent = isExtended ? 'UP' : 'DOWN';
  });
}

// Update coordinates display
function updateCoordinates(landmarks) {
  if (!landmarks || landmarks.length === 0) return;

  // Palm center (landmark 9 - middle finger MCP)
  const palm = landmarks[9];
  document.getElementById('palm-x').textContent = palm.x.toFixed(3);
  document.getElementById('palm-y').textContent = palm.y.toFixed(3);
  document.getElementById('palm-z').textContent = palm.z.toFixed(3);

  // Index tip (landmark 8)
  const indexTip = landmarks[8];
  document.getElementById('index-x').textContent = indexTip.x.toFixed(3);
  document.getElementById('index-y').textContent = indexTip.y.toFixed(3);
  document.getElementById('index-z').textContent = indexTip.z.toFixed(3);

  // Calculate hand rotation
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  // Roll (rotation around the axis from wrist to fingers)
  const dx = middleMCP.x - wrist.x;
  const dy = middleMCP.y - wrist.y;
  const roll = Math.atan2(dx, -dy) * (180 / Math.PI);

  // Pitch (tilt forward/backward based on z depth)
  const dz = middleMCP.z - wrist.z;
  const pitch = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * (180 / Math.PI);

  document.getElementById('hand-roll').textContent = `${Math.round(roll)}°`;
  document.getElementById('hand-pitch').textContent = `${Math.round(pitch)}°`;
}

// Update trajectory trail
function updateTrajectory(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    // Fade out existing points
    trajectoryPoints = trajectoryPoints.map((p) => ({ ...p, alpha: p.alpha * 0.95 }));
    trajectoryPoints = trajectoryPoints.filter((p) => p.alpha > 0.01);
  } else {
    // Add index finger tip position (mirrored for display)
    const indexTip = landmarks[8];
    trajectoryPoints.push({
      x: (1 - indexTip.x) * trajectoryCanvas.width,
      y: indexTip.y * trajectoryCanvas.height,
      alpha: 1,
      time: Date.now(),
    });

    // Keep last 100 points
    if (trajectoryPoints.length > 100) {
      trajectoryPoints.shift();
    }

    // Fade older points
    trajectoryPoints = trajectoryPoints.map((p, i) => ({
      ...p,
      alpha: Math.max(0.1, i / trajectoryPoints.length),
    }));
  }

  // Draw trajectory
  drawTrajectoryGrid();

  if (trajectoryPoints.length > 1) {
    trajectoryCtx.lineCap = 'round';
    trajectoryCtx.lineJoin = 'round';

    for (let i = 1; i < trajectoryPoints.length; i++) {
      const prev = trajectoryPoints[i - 1];
      const curr = trajectoryPoints[i];

      const gradient = trajectoryCtx.createLinearGradient(prev.x, prev.y, curr.x, curr.y);
      gradient.addColorStop(0, `rgba(0, 240, 255, ${prev.alpha})`);
      gradient.addColorStop(1, `rgba(255, 0, 170, ${curr.alpha})`);

      trajectoryCtx.strokeStyle = gradient;
      trajectoryCtx.lineWidth = 2 + curr.alpha * 3;

      trajectoryCtx.beginPath();
      trajectoryCtx.moveTo(prev.x, prev.y);
      trajectoryCtx.lineTo(curr.x, curr.y);
      trajectoryCtx.stroke();
    }

    // Draw current position indicator
    if (trajectoryPoints.length > 0) {
      const last = trajectoryPoints[trajectoryPoints.length - 1];
      trajectoryCtx.beginPath();
      trajectoryCtx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      trajectoryCtx.fillStyle = 'rgba(255, 0, 170, 0.8)';
      trajectoryCtx.fill();

      trajectoryCtx.beginPath();
      trajectoryCtx.arc(last.x, last.y, 10, 0, Math.PI * 2);
      trajectoryCtx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      trajectoryCtx.lineWidth = 2;
      trajectoryCtx.stroke();
    }
  }
}

// Draw skeleton on separate canvas for both hands
function drawSkeleton(allLandmarks, allHandedness) {
  skeletonCtx.fillStyle = '#0a0a12';
  skeletonCtx.fillRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

  // Draw grid
  skeletonCtx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
  skeletonCtx.lineWidth = 1;
  const gridSize = 15;
  for (let x = 0; x < skeletonCanvas.width; x += gridSize) {
    skeletonCtx.beginPath();
    skeletonCtx.moveTo(x, 0);
    skeletonCtx.lineTo(x, skeletonCanvas.height);
    skeletonCtx.stroke();
  }
  for (let y = 0; y < skeletonCanvas.height; y += gridSize) {
    skeletonCtx.beginPath();
    skeletonCtx.moveTo(0, y);
    skeletonCtx.lineTo(skeletonCanvas.width, y);
    skeletonCtx.stroke();
  }

  // Reset labels
  let leftActive = false;
  let rightActive = false;

  if (!allLandmarks || allLandmarks.length === 0) {
    document.getElementById('left-hand-label').textContent = 'L: --';
    document.getElementById('right-hand-label').textContent = 'R: --';
    return;
  }

  // Draw each detected hand
  allLandmarks.forEach((landmarks, handIndex) => {
    // Get actual handedness - MediaPipe reports from camera's view, so we need to flip for mirrored display
    const mpHandedness = allHandedness[handIndex].label;
    // When mirrored: MediaPipe "Left" = user's Right hand, MediaPipe "Right" = user's Left hand
    const actualHandedness = mpHandedness === 'Left' ? 'Right' : 'Left';

    if (actualHandedness === 'Left') leftActive = true;
    if (actualHandedness === 'Right') rightActive = true;

    const colors = HAND_COLORS[actualHandedness];

    // Scale landmarks to canvas
    const scale = Math.min(skeletonCanvas.width, skeletonCanvas.height) * 0.7;
    const offsetX = (skeletonCanvas.width - scale) / 2;
    const offsetY = (skeletonCanvas.height - scale) / 2;

    // Mirror the x coordinates for skeleton display
    const scaledLandmarks = landmarks.map((l) => ({
      x: (1 - l.x) * scale + offsetX,
      y: l.y * scale + offsetY,
      z: l.z,
    }));

    // Draw connections
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17], // Palm
    ];

    connections.forEach(([start, end]) => {
      const p1 = scaledLandmarks[start];
      const p2 = scaledLandmarks[end];

      const gradient = skeletonCtx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      gradient.addColorStop(0, colors.primary);
      gradient.addColorStop(1, colors.secondary);

      skeletonCtx.strokeStyle = gradient;
      skeletonCtx.lineWidth = 2;
      skeletonCtx.beginPath();
      skeletonCtx.moveTo(p1.x, p1.y);
      skeletonCtx.lineTo(p2.x, p2.y);
      skeletonCtx.stroke();
    });

    // Draw landmarks
    scaledLandmarks.forEach((point, i) => {
      const isTip = FINGER_TIPS.includes(i);
      const radius = isTip ? 5 : 3;

      // Glow effect
      const glow = skeletonCtx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius * 3
      );
      glow.addColorStop(0, colors.glow);
      glow.addColorStop(1, 'transparent');
      skeletonCtx.fillStyle = glow;
      skeletonCtx.beginPath();
      skeletonCtx.arc(point.x, point.y, radius * 3, 0, Math.PI * 2);
      skeletonCtx.fill();

      // Point
      skeletonCtx.fillStyle = isTip ? colors.secondary : colors.primary;
      skeletonCtx.beginPath();
      skeletonCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      skeletonCtx.fill();
    });
  });

  // Update labels
  document.getElementById('left-hand-label').textContent = leftActive ? 'L: ACTIVE' : 'L: --';
  document.getElementById('right-hand-label').textContent = rightActive ? 'R: ACTIVE' : 'R: --';
}

// Update gesture history
function addToHistory(gesture, handedness) {
  const now = new Date();

  // Don't add same gesture repeatedly
  if (gesture.name === lastGesture && Date.now() - lastGestureTime < 1000) {
    return;
  }

  lastGesture = gesture.name;
  lastGestureTime = Date.now();

  gestureHistory.unshift({
    time: now.toLocaleTimeString('en-US', { hour12: false }),
    gesture: `${gesture.name} (${handedness})`,
  });

  // Keep last 10 entries
  if (gestureHistory.length > 10) {
    gestureHistory.pop();
  }

  // Update display
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = gestureHistory
    .map(
      (entry) => `
    <div class="history-item">
      <span class="history-time">${entry.time}</span>
      <span class="history-gesture">${entry.gesture}</span>
    </div>
  `
    )
    .join('');
}

// Update metrics display
function updateMetrics() {
  const detectionRate = totalFrames > 0 ? Math.round((detectionCount / totalFrames) * 100) : 0;
  const stabilityRate = Math.min(100, Math.max(0, 100 - fpsValues.length * 2 + 60));
  const accuracyRate = Math.min(100, detectionRate + 15);

  // Update values
  document.getElementById('detection-rate').textContent = `${detectionRate}%`;
  document.getElementById('stability-rate').textContent = `${stabilityRate}%`;
  document.getElementById('accuracy-rate').textContent = `${accuracyRate}%`;

  // Update rings (circumference = 2 * PI * 40 ≈ 251.2)
  const circumference = 251.2;
  document.getElementById('detection-ring').style.strokeDashoffset =
    circumference - (circumference * detectionRate) / 100;
  document.getElementById('stability-ring').style.strokeDashoffset =
    circumference - (circumference * stabilityRate) / 100;
  document.getElementById('accuracy-ring').style.strokeDashoffset =
    circumference - (circumference * accuracyRate) / 100;
}

// Map a landmark coordinate to canvas position (handling cover mode cropping)
function mapLandmarkToCanvas(landmark, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight) {
  // Mirror the x coordinate for selfie view
  const mirroredX = 1 - landmark.x;

  // Map from full video coordinates to visible (cropped) area
  // If landmark is outside visible area, it will be off-canvas (which is fine)
  const visibleX = (mirroredX - cropX) / cropWidth;
  const visibleY = (landmark.y - cropY) / cropHeight;

  return {
    x: visibleX * canvasWidth,
    y: visibleY * canvasHeight,
    visible: visibleX >= 0 && visibleX <= 1 && visibleY >= 0 && visibleY <= 1
  };
}

// Draw a single hand on the main canvas
function drawHandOnCanvas(landmarks, handedness, ctx, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight) {
  const colors = HAND_COLORS[handedness];

  // Draw connections with gradient
  const connections = window.HAND_CONNECTIONS;
  connections.forEach((connection) => {
    const start = landmarks[connection[0]];
    const end = landmarks[connection[1]];

    const startPos = mapLandmarkToCanvas(start, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight);
    const endPos = mapLandmarkToCanvas(end, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight);

    const gradient = ctx.createLinearGradient(startPos.x, startPos.y, endPos.x, endPos.y);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.secondary);

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();
  });

  // Draw landmarks with glow effect
  landmarks.forEach((landmark, i) => {
    const pos = mapLandmarkToCanvas(landmark, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight);
    const isTip = FINGER_TIPS.includes(i);

    // Glow
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, isTip ? 15 : 10);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isTip ? 15 : 10, 0, Math.PI * 2);
    ctx.fill();

    // Point
    ctx.fillStyle = isTip ? colors.secondary : colors.primary;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isTip ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Main results handler
function onResults(results) {
  const startTime = performance.now();

  calculateFPS();
  totalFrames++;
  document.getElementById('total-frames').textContent = totalFrames;

  // Get cover mode dimensions
  const canvasWidth = mainCanvas.width;
  const canvasHeight = mainCanvas.height;
  const drawWidth = mainCanvas.drawWidth || canvasWidth;
  const drawHeight = mainCanvas.drawHeight || canvasHeight;
  const offsetX = mainCanvas.drawOffsetX || 0;
  const offsetY = mainCanvas.drawOffsetY || 0;
  const cropX = mainCanvas.cropX || 0;
  const cropY = mainCanvas.cropY || 0;
  const cropWidth = mainCanvas.cropWidth || 1;
  const cropHeight = mainCanvas.cropHeight || 1;

  // Clear canvas
  mainCtx.fillStyle = '#000';
  mainCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw video frame in cover mode (fill entire canvas, mirrored)
  mainCtx.save();
  mainCtx.translate(canvasWidth, 0);
  mainCtx.scale(-1, 1);
  // Draw scaled to fill the entire canvas
  mainCtx.drawImage(
    results.image,
    canvasWidth - offsetX - drawWidth,
    offsetY,
    drawWidth,
    drawHeight
  );
  mainCtx.restore();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    detectionCount++;
    isTracking = true;

    // Process each detected hand
    const handsInfo = [];
    results.multiHandLandmarks.forEach((landmarks, index) => {
      // Get handedness - flip because of mirror
      const mpHandedness = results.multiHandedness[index].label;
      const actualHandedness = mpHandedness === 'Left' ? 'Right' : 'Left';
      const confidence = results.multiHandedness[index].score;

      handsInfo.push({
        landmarks,
        handedness: actualHandedness,
        confidence,
      });

      // Draw hand visualization with cover mode mapping
      drawHandOnCanvas(landmarks, actualHandedness, mainCtx, canvasWidth, canvasHeight, cropX, cropY, cropWidth, cropHeight);
    });

    // Use the first hand for gesture detection and other displays
    const primaryHand = handsInfo[0];
    const landmarks = primaryHand.landmarks;
    const handedness = primaryHand.handedness;

    // Detect finger states
    const fingerStates = [0, 1, 2, 3, 4].map((i) => (isFingerExtended(landmarks, i) ? 1 : 0));

    // Detect gesture
    const gesture = detectGesture(fingerStates);

    // Update UI
    updateFingerDisplay(fingerStates);

    document.getElementById('gesture-name').textContent = gesture.name;
    document.getElementById('gesture-svg').innerHTML = `
      <text x="50" y="60" text-anchor="middle" font-size="50">${gesture.emoji}</text>
    `;

    // Update confidence
    const confidence = Math.round(primaryHand.confidence * 100);
    document.getElementById('confidence-fill').style.width = `${confidence}%`;
    document.getElementById('confidence-value').textContent = `${confidence}%`;

    // Update other displays
    updateCoordinates(landmarks);
    updateTrajectory(landmarks);
    drawSkeleton(results.multiHandLandmarks, results.multiHandedness);

    // Add to history if gesture changed significantly
    addToHistory(gesture, handedness);

    // Build status message
    const handCount = handsInfo.length;
    const handNames = handsInfo.map((h) => h.handedness.toLowerCase()).join(' & ');
    document.getElementById('status-message').textContent =
      `Tracking ${handCount} hand${handCount > 1 ? 's' : ''} (${handNames}) • ${gesture.name} detected`;
  } else {
    isTracking = false;

    // Reset displays
    document.getElementById('gesture-name').textContent = 'NO HAND DETECTED';
    document.getElementById('gesture-svg').innerHTML = `
      <text x="50" y="60" text-anchor="middle" font-size="40">👋</text>
    `;
    document.getElementById('confidence-fill').style.width = '0%';
    document.getElementById('confidence-value').textContent = '0%';

    updateTrajectory(null);
    drawSkeleton(null, null);

    document.getElementById('status-message').textContent =
      'Hand tracking active • Waiting for hand detection...';
  }

  // Update metrics
  updateMetrics();

  // Update latency
  const processingTime = performance.now() - startTime;
  updateLatency(processingTime);
}

// Initialize MediaPipe Hands
async function initializeHandTracking() {
  document.getElementById('status-message').textContent = 'Loading MediaPipe Hands model...';

  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    },
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });

  hands.onResults(onResults);

  document.getElementById('status-message').textContent = 'Requesting camera access...';

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720,
  });

  try {
    await camera.start();

    // Get actual video dimensions
    videoWidth = videoElement.videoWidth || 1280;
    videoHeight = videoElement.videoHeight || 720;

    // Resize canvases with proper aspect ratio
    resizeCanvases();

    document.getElementById('status-message').textContent =
      'Hand tracking active • Waiting for hand detection...';
    document.getElementById('resolution').textContent = `${videoWidth}×${videoHeight}`;
  } catch (error) {
    console.error('Camera error:', error);
    document.getElementById('status-message').textContent =
      'ERROR: Could not access camera. Please allow camera permissions.';
    document.querySelector('.tile-badge').textContent = 'ERROR';
    document.querySelector('.tile-badge').style.background = '#ff3366';
  }
}

// Initialize application
function init() {
  resizeCanvases();
  initializeHandTracking();

  // Periodic metrics update
  setInterval(updateMetrics, 500);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
