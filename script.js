const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

const urlParams = new URLSearchParams(window.location.search);
const maxNumFaces = parseInt(urlParams.get("maxNumFaces") || "1", 10);
const refineLandmarks = urlParams.get("refineLandmarks") === "true"; // Crucial for detailed lips/eyes
const minDetectionConfidence = parseFloat(
  urlParams.get("minDetectionConfidence") || "0.5"
);
const minTrackingConfidence = parseFloat(
  urlParams.get("minTrackingConfidence") || "0.5"
);
const isBackCamera = urlParams.get("isBackCamera") === "true";
const flipHorizontal = urlParams.get("flipHorizontal") === "true";
const isFullScreen = urlParams.get("isFullScreen") === "true";
const enableDrawing = urlParams.get("enableDrawing") === "true"; // For debugging on canvas

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  if (!isBackCamera && flipHorizontal) {
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

  const allFacesData = [];
  if (results.multiFaceLandmarks) {
    for (const landmarks of results.multiFaceLandmarks) {
      if (enableDrawing) {
        // Draw face mesh connectors and landmarks (optional, for debugging)
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
          color: "#C0C0C070",
          lineWidth: 1,
        });
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {
          color: "#FF3030",
        });
        // ... (add other FACEMESH_ parts if needed for drawing)
        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {
          color: "#E0E0E0",
          lineWidth: 2,
        }); // Draw lips outline
      }
      // Send all 468/478 landmarks
      const processedLandmarks = landmarks.map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      }));
      allFacesData.push({ landmarks: processedLandmarks });
    }
  }

  if (
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === "function"
  ) {
    window.ReactNativeWebView.postMessage(JSON.stringify(allFacesData));
  }
  canvasCtx.restore();
}

const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: maxNumFaces,
  refineLandmarks: refineLandmarks, // Enable for more detailed landmarks (eyes, lips)
  minDetectionConfidence: minDetectionConfidence,
  minTrackingConfidence: minTrackingConfidence,
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    if (!isFullScreen) {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        if (canvasElement.width !== videoElement.videoWidth)
          canvasElement.width = videoElement.videoWidth;
        if (canvasElement.height !== videoElement.videoHeight)
          canvasElement.height = videoElement.videoHeight;
      }
    } else {
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
    }
    await faceMesh.send({ image: videoElement });
  },
  width: isFullScreen ? window.innerWidth : 640,
  height: isFullScreen ? window.innerHeight : 480,
  facingMode: isBackCamera ? "environment" : "user",
});

camera
  .start()
  .then(() => {
    console.log("Face Mesh Camera started successfully");
    if (videoElement.readyState >= 3) {
      videoElement
        .play()
        .catch((e) => console.error("Error playing video:", e));
    } else {
      videoElement.addEventListener("canplay", () => {
        videoElement
          .play()
          .catch((e) => console.error("Error playing video after canplay:", e));
      });
    }
  })
  .catch((err) => {
    console.error("Error starting camera for Face Mesh:", err);
    if (
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === "function"
    ) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ error: "Camera start failed: " + err.message })
      );
    }
  });

window.addEventListener("resize", () => {
  if (isFullScreen) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
  }
});
if (isFullScreen) {
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  canvasElement.style.position = "absolute";
  canvasElement.style.top = "0";
  canvasElement.style.left = "0";
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
} else {
  canvasElement.width = 640;
  canvasElement.height = 480;
}
