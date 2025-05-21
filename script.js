const videoElement = document.getElementById("video");
videoElement.muted = true;
videoElement.playsInline = true;
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

let url = new URL(window.location.href);
let params = new URLSearchParams(url.search);

const isFullScreen = params.get("isFullScreen") === "true" || false; // Ensure boolean conversion
const isBackCamera = params.get("isBackCamera") === "true" || false; // Ensure boolean conversion

if (isFullScreen) {
  canvasCtx.canvas.width = window.innerWidth;
  canvasCtx.canvas.height = window.innerHeight;
  canvasCtx.canvas.style.width = "100vw";
  canvasCtx.canvas.style.height = "100vh";
}

function onWindowResized() {
  if (isFullScreen) {
    canvasCtx.canvas.width = window.innerWidth;
    canvasCtx.canvas.height = window.innerHeight;
    // No need to set style width/height here again if already 100vw/vh
  }
}

window.addEventListener("resize", onWindowResized);

let lastTimestamp = performance.now();
let frameCount = 0;

function onResults(results) {
  const now = performance.now();
  const elapsed = now - lastTimestamp;
  frameCount++;

  if (elapsed > 1000) {
    lastTimestamp = now;
    const fps = frameCount / (elapsed / 1000);
    console.log(`FPS: ${fps.toFixed(2)}`);
    frameCount = 0;
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Flip horizontally for mirrored view if using front camera
  if (!isBackCamera) {
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
  }

  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      // Send landmarks to React Native WebView if present
      window?.ReactNativeWebView?.postMessage(JSON.stringify(landmarks));

      // Draw the face mesh tesselation
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
      }); // Light grey, semi-transparent
      // Draw specific facial features if desired (example: lips, eyes, irises)
      drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {
        color: "#E0E0E0",
        lineWidth: 2,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {
        color: "#FF3030",
        lineWidth: 2,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {
        color: "#FF3030",
        lineWidth: 2,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {
        color: "#FF3030",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {
        color: "#30FF30",
        lineWidth: 2,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {
        color: "#30FF30",
        lineWidth: 2,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {
        color: "#30FF30",
        lineWidth: 1,
      });
      // drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 2}); // Optional: draw face oval

      // To draw individual landmark points (can be performance intensive for all 468+ points)
      // drawLandmarks(canvasCtx, landmarks, {color: '#FFFFFF', radius: 0.5});
    }
  }
  canvasCtx.restore();
}

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  },
});

faceMesh.setOptions({
  maxNumFaces: 1, // Detect one face for this example, adjust as needed
  refineLandmarks: true, // Get more detailed landmark coordinates, e.g., for irises
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1080, // You might want to use smaller resolutions like 640x480 for better performance
  height: 720,
  facingMode: isBackCamera ? "environment" : "user",
});

camera
  .start()
  .then(() => {
    if (videoElement.readyState >= 3) {
      // HAVE_FUTURE_DATA or more
      videoElement.play();
    } else {
      videoElement.addEventListener("canplay", () => videoElement.play());
    }
  })
  .catch((err) => {
    console.error("Camera start failed:", err);
  });
