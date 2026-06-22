/* ─── MediaPipe Hand Connections ──────────────────────────────── */
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],           // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],           // index
  [5, 9], [9, 10], [10, 11], [11, 12],      // middle
  [9, 13], [13, 14], [14, 15], [15, 16],    // ring
  [13, 17], [17, 18], [18, 19], [19, 20],   // pinky
  [0, 17],                                   // palm base
];

/* ─── Pose connections — upper body only ─────────────────────── */
/*  Landmark indices (MediaPipe Pose):
    11=left_shoulder  12=right_shoulder
    13=left_elbow     14=right_elbow
    15=left_wrist     16=right_wrist
    23=left_hip       24=right_hip               */
const POSE_CONNECTIONS = [
  [11, 12], // shoulders bar
  [11, 13], // left upper arm
  [13, 15], // left forearm
  [12, 14], // right upper arm
  [14, 16], // right forearm
  [11, 23], // left torso side
  [12, 24], // right torso side
  [23, 24], // waist / hip bar
];
const POSE_JOINT_INDICES = [11, 12, 13, 14, 15, 16, 23, 24];

class HandTracker {
  constructor(videoEl, canvasEl, onResults) {
    this.videoEl   = videoEl;
    this.canvasEl  = canvasEl;
    this.ctx       = canvasEl ? canvasEl.getContext("2d") : null;
    this.onResults = onResults;
    this.hands     = null;
    this.poseModel = null;
    this.camera    = null;
    this.leftHand  = null;
    this.rightHand = null;

    /* last pose results — stored in pose callback, consumed in hands callback */
    this.lastPoseLandmarks = null;

    /* current hand colors — updated by game.js via setHandColors() per trial */
    this.leftColor  = "#e53935";
    this.rightColor = "#1e88e5";

    /* fix canvas to video native resolution */
    if (this.canvasEl) {
      this.canvasEl.width  = 640;
      this.canvasEl.height = 480;
    }
  }

  setHandColors(leftColor, rightColor) {
    this.leftColor  = leftColor;
    this.rightColor = rightColor;
  }

  /* ─── Draw upper-body pose skeleton ─────────────────────────── */
  drawPoseSkeleton(landmarks) {
    if (!this.ctx || !this.canvasEl || !landmarks) return;
    const ctx = this.ctx;
    const W   = this.canvasEl.width;
    const H   = this.canvasEl.height;

    /* MediaPipe Pose x is already "raw" (0=left in image = user's right).
       The canvas is CSS-flipped like the video, so we just use lm.x * W. */
    const px = (lm) => ({ x: lm.x * W, y: lm.y * H });

    /* 1 — Torso / arm connection lines — fixed dark colour */
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth   = 5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    for (const [a, b] of POSE_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      if ((la.visibility ?? 1) < 0.4 || (lb.visibility ?? 1) < 0.4) continue;

      ctx.beginPath();
      ctx.moveTo(px(la).x, px(la).y);
      ctx.lineTo(px(lb).x, px(lb).y);
      ctx.stroke();
    }
    ctx.restore();

    /* 2 — Joint dots — fixed white */
    for (const idx of POSE_JOINT_INDICES) {
      const lm = landmarks[idx];
      if (!lm || (lm.visibility ?? 1) < 0.4) continue;
      const { x, y } = px(lm);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle   = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  /* ─── Draw one hand skeleton ────────────────────────────────── */
  drawSkeleton(landmarks, label) {
    if (!this.ctx || !this.canvasEl) return;
    const ctx   = this.ctx;
    const W     = this.canvasEl.width;
    const H     = this.canvasEl.height;
    const isLeft = label === "Left";
    const color  = isLeft ? this.leftColor : this.rightColor;
    const handLabel = isLeft ? "มือซ้าย" : "มือขวา";

    /* helper: landmark → canvas pixel */
    const px = (lm) => ({ x: lm.x * W, y: lm.y * H });

    /* colorBg: translucent version for hand circle fill */
    const colorBg   = color + "30";

    /* 1 — Connection lines — fixed BLACK */
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.lineWidth   = 3;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    for (const [a, b] of HAND_CONNECTIONS) {
      const p1 = px(landmarks[a]);
      const p2 = px(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();

    /* 2 — Landmark dots — use current trial color */
    for (const lm of landmarks) {
      const { x, y } = px(lm);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }

    /* 3 — Hand circle — use current trial color */
    const center = px(landmarks[9]);
    const R = 44;

    ctx.beginPath();
    ctx.arc(center.x, center.y, R, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center.x, center.y, R, 0, Math.PI * 2);
    ctx.fillStyle = colorBg;
    ctx.fill();

    /* 4 — Hand label above circle */
    ctx.save();
    ctx.font         = 'bold 18px "Noto Sans Thai","Segoe UI",sans-serif';
    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor  = "rgba(0,0,0,0.85)";
    ctx.shadowBlur   = 6;
    ctx.fillStyle    = "#ffffff";
    ctx.fillText(handLabel, center.x, center.y - R - 6);
    ctx.restore();
  }

  /* ─── Init MediaPipe Pose + Hands + Camera ──────────────────── */
  async init() {
    /* --- 1. Pose model ----------------------------------------- */
    this.poseModel = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.poseModel.setOptions({
      modelComplexity:        1,
      smoothLandmarks:        true,
      enableSegmentation:     false,
      smoothSegmentation:     false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence:  0.5,
    });

    /* store pose results; drawing happens inside the hands callback */
    this.poseModel.onResults((results) => {
      this.lastPoseLandmarks =
        results.poseLandmarks?.length ? results.poseLandmarks : null;
    });

    /* --- 2. Hands model ---------------------------------------- */
    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands:            2,
      modelComplexity:        1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence:  0.6,
    });

    this.hands.onResults((results) => {
      this.leftHand  = null;
      this.rightHand = null;

      /* Clear canvas once per frame */
      if (this.ctx && this.canvasEl) {
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      }

      /* Draw pose skeleton first (background layer) */
      this.drawPoseSkeleton(this.lastPoseLandmarks);

      /* Draw hand skeletons on top */
      if (results.multiHandLandmarks && results.multiHandedness) {
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
          const landmarks = results.multiHandLandmarks[i];
          const label     = results.multiHandedness[i].label;
          const point     = landmarks[9];
          const handData  = { x: point.x, y: point.y, landmarks };

          if (label === "Left") {
            this.leftHand = handData;
          } else {
            this.rightHand = handData;
          }

          this.drawSkeleton(landmarks, label);
        }
      }

      this.onResults({ left: this.leftHand, right: this.rightHand });
    });

    /* --- 3. Camera — send to Pose FIRST, then Hands ------------ */
    this.camera = new Camera(this.videoEl, {
      onFrame: async () => {
        /* Pose runs first so lastPoseLandmarks is populated
           before the Hands callback fires and draws everything */
        await this.poseModel.send({ image: this.videoEl });
        await this.hands.send({ image: this.videoEl });
      },
      width:  640,
      height: 480,
    });

    await this.camera.start();
  }

  stop() {
    if (this.camera) this.camera.stop();
  }
}
