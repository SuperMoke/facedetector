const videoElement = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const modelSelection = parseInt(urlParams.get("modelSelection") || "0", 10); // 0 for short-range, 1 for full-range
const minDetectionConfidence = parseFloat(
  urlParams.get("minDetectionConfidence") || "0.5"
);
const isBackCamera = urlParams.get("isBackCamera") === "true";
const flipHorizontal = urlParams.get("flipHorizontal") === "true"; // For mirroring the drawing
const isFullScreen = urlParams.get("isFullScreen") === "true";
const enableDrawing = urlParams.get("enableDrawing") === "true";
const drawBoundingBoxColor = urlParams.get("drawBoundingBoxColor") || "255,0,0"; // RGB string
const drawLandmarksColor = urlParams.get("drawLandmarksColor") || "0,255,0"; // RGB string

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Flip horizontally if front camera and flipHorizontal is true (for selfie view)
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

  const processedDetections = [];
  if (results.detections && results.detections.length > 0) {
    for (const detection of results.detections) {
      if (enableDrawing) {
        // drawDetection (from drawing_utils) can draw both bounding box and landmarks
        // Or use drawRectangle and drawLandmarks separately for more control
        drawDetection(
          canvasCtx,
          detection,
          {
            color: `rgb(${drawBoundingBoxColor})`, // For bounding box
            lineWidth: 2,
          },
          {
            color: `rgb(${drawLandmarksColor})`, // For landmarks
            radius: 3,
          }
        );
      }

      // Prepare data for React Native
      // MediaPipe provides normalized coordinates (0.0 to 1.0)
      const boundingBox = detection.boundingBox; // { xMin, yMin, width, height, xCenter, yCenter }
      const landmarks = detection.landmarks.map((lm) => ({ x: lm.x, y: lm.y })); // Array of {x, y}
      const confidence =
        detection.score && detection.score.length > 0 ? detection.score[0] : 0;

      processedDetections.push({
        boundingBox: {
          xMin: boundingBox.xMin,
          yMin: boundingBox.yMin,
          width: boundingBox.width,
          height: boundingBox.height,
          xCenter: boundingBox.xCenter,
          yCenter: boundingBox.yCenter,
        },
        landmarks: landmarks,
        confidence: confidence,
      });
    }
  }

  if (
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === "function"
  ) {
    window.ReactNativeWebView.postMessage(JSON.stringify(processedDetections));
  } else {
    // console.log("ReactNativeWebView.postMessage is not available. Detections:", processedDetections);
  }
  canvasCtx.restore();
}

const faceDetection = new FaceDetection({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
});

faceDetection.setOptions({
  modelSelection: modelSelection, // 0 for short-range, 1 for full-range
  minDetectionConfidence: minDetectionConfidence,
});

faceDetection.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    // Ensure canvas dimensions match video intrinsic dimensions if not fullscreen
    if (!isFullScreen) {
      if (videoElement.videoWidth && videoElement.videoHeight) {
        if (canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
        }
        if (canvasElement.height !== videoElement.videoHeight) {
          canvasElement.height = videoElement.videoHeight;
        }
      }
    } else {
      // Fullscreen logic
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
    }
    await faceDetection.send({ image: videoElement });
  },
  width: isFullScreen ? window.innerWidth : 640, // Request a reasonable resolution
  height: isFullScreen ? window.innerHeight : 480,
  facingMode: isBackCamera ? "environment" : "user",
});

camera
  .start()
  .then(() => {
    console.log("Camera started successfully");
    if (videoElement.readyState >= 3) {
      // HAVE_FUTURE_DATA or more
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
    console.error("Error starting camera:", err);
    if (
      window.ReactNativeWebView &&
      typeof window.ReactNativeWebView.postMessage === "function"
    ) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ error: "Camera start failed: " + err.message })
      );
    }
  });

// Handle window resize for fullscreen mode
window.addEventListener("resize", () => {
  if (isFullScreen) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
  }
});

// Initial setup for fullscreen
if (isFullScreen) {
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  canvasElement.style.position = "absolute";
  canvasElement.style.top = "0";
  canvasElement.style.left = "0";
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
} else {
  // If not fullscreen, you might want to set canvas size based on video or fixed values
  // This is handled in onFrame now, but initial sizing might be good.
  canvasElement.width = 640;
  canvasElement.height = 480;
}
