/* ─── Constants ──────────────────────────────────────────────── */
const TOTAL_TRIALS  = 12;
const TARGET_RADIUS = 120;

/* Color pairs — each trial uses the next pair */
const COLOR_SCHEMES = [
  { leftHex: "#e53935", rightHex: "#1e88e5", neutralHex: "#9c27b0", leftLabel: "แดง",    rightLabel: "น้ำเงิน" },
  { leftHex: "#43a047", rightHex: "#fb8c00", neutralHex: "#8e24aa", leftLabel: "เขียว",   rightLabel: "ส้ม"     },
  { leftHex: "#e91e63", rightHex: "#00bcd4", neutralHex: "#7e57c2", leftLabel: "ชมพู",    rightLabel: "ฟ้า"     },
  { leftHex: "#fdd835", rightHex: "#5e35b1", neutralHex: "#ef6c00", leftLabel: "เหลือง",  rightLabel: "ม่วง"    },
  { leftHex: "#00e676", rightHex: "#ff5252", neutralHex: "#3949ab", leftLabel: "เขียวอ่อน", rightLabel: "แดง"   },
  { leftHex: "#26c6da", rightHex: "#ff7043", neutralHex: "#66bb6a", leftLabel: "ฟ้าอ่อน", rightLabel: "ส้มแดง" },
  { leftHex: "#ab47bc", rightHex: "#ffee58", neutralHex: "#29b6f6", leftLabel: "ม่วง",    rightLabel: "เหลือง" },
  { leftHex: "#ff8a65", rightHex: "#42a5f5", neutralHex: "#ec407a", leftLabel: "ส้มอ่อน", rightLabel: "ฟ้า"    },
  { leftHex: "#7cb342", rightHex: "#e040fb", neutralHex: "#ffa726", leftLabel: "เขียวเข้ม", rightLabel: "ชมพูม่วง" },
  { leftHex: "#00acc1", rightHex: "#d81b60", neutralHex: "#8bc34a", leftLabel: "เขียวน้ำ", rightLabel: "แดงเข้ม" },
  { leftHex: "#f4511e", rightHex: "#00897b", neutralHex: "#5c6bc0", leftLabel: "ส้มเข้ม", rightLabel: "เขียวเทา" },
  { leftHex: "#6d4c41", rightHex: "#039be5", neutralHex: "#c0ca33", leftLabel: "น้ำตาล", rightLabel: "ฟ้าสด" },
];

/* Maps logical target name → existing HTML element ID */
const ZONE_IDS = {
  left:    "targetRed",
  right:   "targetBlue",
  neutral: "targetPurple",
};

/* ─── Text pools ──────────────────────────────────────────────── */
const ENCOURAGEMENT = ["เก่งมาก!", "ดีมากเลย!", "ทำได้ดีมาก!", "เยี่ยมเลย!", "สุดยอด!"];
const GENTLE_MISS   = ["ไม่เป็นไร ลองอีกครั้งนะ", "ครั้งหน้าทำได้แน่นอน", "ใกล้แล้ว ลองใหม่อีกนิด"];

const PREDICTION_LABELS = {
  right_dominant:        "มือขวาถนัด",
  left_dominant:         "มือซ้ายถนัด",
  learned_non_use_left:  "แนวโน้ม Learned Non-Use (มือซ้าย)",
  learned_non_use_right: "แนวโน้ม Learned Non-Use (มือขวา)",
};

/* ─── Main Game Class ─────────────────────────────────────────── */
class ColorMatchGame {
  constructor() {
    this.sessionId      = null;
    this.tracker        = null;
    this.state          = "idle";
    this.totalTrials    = 0;
    this.score          = 0;
    this.currentTarget  = null; // "left" | "right" | "neutral"
    this.trialStartTime = null;
    this.trajectory     = [];
    this.containerRect  = null;
    this.currentSchemeIdx = 0;
    this.currentScheme   = COLOR_SCHEMES[0];

    this.video     = document.getElementById("webcam");
    this.canvas    = document.getElementById("skeletonCanvas");
    this.container = document.getElementById("videoContainer");
    this.dotLeft   = document.getElementById("handDotLeft");
    this.dotRight  = document.getElementById("handDotRight");

    this.bindUI();
  }

  /* ─── UI binding ────────────────────────────────────────────── */
  bindUI() {
    document.getElementById("btnStartWelcome").addEventListener("click", () => this.start());
    document.getElementById("btnStop")        .addEventListener("click", () => this.stop());
    document.getElementById("btnFinish")      .addEventListener("click", () => this.showResults());
    document.getElementById("btnPlayAgain")   .addEventListener("click", () => this.reset());
  }

  showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(`${name}Screen`).classList.add("active");
    // toggle fullscreen body class for game screen
    document.body.classList.toggle("game-active", name === "game");
  }

  setFeedback(msg) {
    document.getElementById("feedbackBanner").textContent = msg;
  }

  /* ─── Progress display ──────────────────────────────────────── */
  updateProgress() {
    document.getElementById("levelText")   .textContent = `รอบ ${this.totalTrials} / ${TOTAL_TRIALS}`;
    document.getElementById("progressText").textContent = `คะแนน ${this.score} / ${this.totalTrials}`;
    const pct = (this.totalTrials / TOTAL_TRIALS) * 100;
    document.getElementById("progressFill").style.width = `${pct}%`;
    document.querySelector(".progress-bar").setAttribute("aria-valuenow", String(this.totalTrials));
    document.getElementById("levelBadge").textContent = `รอบ ${this.totalTrials} / ${TOTAL_TRIALS}`;
  }

  /* ─── TTS ───────────────────────────────────────────────────── */
  speak(text) {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "th-TH";
      u.rate = 0.85;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  /* ─── Apply color scheme to DOM ─────────────────────────────── */
  applyColors() {
    const c = this.currentScheme;

    document.getElementById(ZONE_IDS.left)   .style.background = c.leftHex;
    document.getElementById(ZONE_IDS.right)  .style.background = c.rightHex;
    document.getElementById(ZONE_IDS.neutral).style.background = c.neutralHex;

    /* hand dots — start neutral until first trial */
    this.dotLeft .style.background = c.leftHex;
    this.dotRight.style.background = c.rightHex;
    this.dotLeft .style.opacity    = "1";
    this.dotRight.style.opacity    = "1";

    /* pass to tracker for skeleton circle colors */
    if (this.tracker) this.tracker.setHandColors(c.leftHex, c.rightHex);
  }

  /* ─── Update hand-dot colors to reflect current target ──────── */
  updateHandColors(target) {
    const c = this.currentScheme;
    const DIMMED = "#555566"; // neutral grey for inactive hand

    if (target === "left") {
      this.dotLeft .style.background = c.leftHex;
      this.dotRight.style.background = DIMMED;
      this.dotLeft .style.opacity    = "1";
      this.dotRight.style.opacity    = "0.45";
      if (this.tracker) this.tracker.setHandColors(c.leftHex, DIMMED);
    } else if (target === "right") {
      this.dotLeft .style.background = DIMMED;
      this.dotRight.style.background = c.rightHex;
      this.dotLeft .style.opacity    = "0.45";
      this.dotRight.style.opacity    = "1";
      if (this.tracker) this.tracker.setHandColors(DIMMED, c.rightHex);
    } else {
      /* calibration / neutral */
      this.dotLeft .style.background = c.leftHex;
      this.dotRight.style.background = c.rightHex;
      this.dotLeft .style.opacity    = "1";
      this.dotRight.style.opacity    = "1";
      if (this.tracker) this.tracker.setHandColors(c.leftHex, c.rightHex);
    }
  }

  /* ─── Start game ────────────────────────────────────────────── */
  async start() {
    try {
      const { session_id } = await API.startSession();
      this.sessionId = session_id;
    } catch {
      this.setFeedback("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      return;
    }

    this.showScreen("game");
    this.score       = 0;
    this.totalTrials = 0;
    document.getElementById("scoreValue").textContent = "0";
    document.getElementById("btnStop")  .disabled = false;
    document.getElementById("btnFinish").disabled = true;

    this.applyColors();
    this.updateProgress();

    this.tracker = new HandTracker(this.video, this.canvas, (hands) => this.onHands(hands));
    await this.tracker.init();

    this.state = "calibrating";
    this.setFeedback("ยกมือทั้งสองข้างให้กล้องเห็น...");
    document.getElementById("subInstruction").textContent = "เตรียมตัว — ยกมือซ้ายและขวา";
    this.highlightTarget("neutral");

    setTimeout(() => {
      if (this.state === "calibrating") {
        this.state = "playing";
        this.nextTrial();
      }
    }, 5000);
  }

  /* ─── Target highlight ──────────────────────────────────────── */
  highlightTarget(which) {
    document.querySelectorAll(".target-zone").forEach((z) => z.classList.remove("active"));
    const id = ZONE_IDS[which];
    if (id) document.getElementById(id).classList.add("active");
  }

  getTargetCenter(which) {
    const container = this.container.getBoundingClientRect();
    const zone      = document.getElementById(ZONE_IDS[which]).getBoundingClientRect();
    return {
      x: zone.left + zone.width  / 2 - container.left,
      y: zone.top  + zone.height / 2 - container.top,
    };
  }

  handToScreen(hand) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (1 - hand.x) * rect.width,
      y: hand.y * rect.height,
    };
  }

  /* ─── Per-frame hand callback ───────────────────────────────── */
  onHands(hands) {
    this.containerRect = this.container.getBoundingClientRect();

    if (hands.left) {
      const pos = this.handToScreen(hands.left);
      this.dotLeft.style.left = `${pos.x}px`;
      this.dotLeft.style.top  = `${pos.y}px`;
      this.dotLeft.classList.add("visible");
    } else {
      this.dotLeft.classList.remove("visible");
    }

    if (hands.right) {
      const pos = this.handToScreen(hands.right);
      this.dotRight.style.left = `${pos.x}px`;
      this.dotRight.style.top  = `${pos.y}px`;
      this.dotRight.classList.add("visible");
    } else {
      this.dotRight.classList.remove("visible");
    }

    if (this.state !== "trial") return;

    const now = performance.now();
    const t   = (now - this.trialStartTime) / 1000;

    if (hands.left) {
      const pos = this.handToScreen(hands.left);
      this.trajectory.push({ t, x: pos.x, y: pos.y, hand: "Left" });
    }
    if (hands.right) {
      const pos = this.handToScreen(hands.right);
      this.trajectory.push({ t, x: pos.x, y: pos.y, hand: "Right" });
    }

    this.checkHit(hands);
  }

  /* ─── Collision check ───────────────────────────────────────── */
  checkHit(hands) {
    if (!this.currentTarget || this.currentTarget === "neutral") return;

    const hand = this.currentTarget === "left" ? hands.left : hands.right;
    if (!hand) return;

    const pos    = this.handToScreen(hand);
    const target = this.getTargetCenter(this.currentTarget);
    const dist   = Math.hypot(pos.x - target.x, pos.y - target.y);

    if (dist <= TARGET_RADIUS) {
      const expectedHand = this.currentTarget === "left" ? "Left" : "Right";
      this.completeTrial(true, expectedHand, dist);
    }
  }

  /* ─── Advance trial ─────────────────────────────────────────── */
  nextTrial() {
    /* Game ends after TOTAL_TRIALS */
    if (this.totalTrials >= TOTAL_TRIALS) {
      this.finishPlaying();
      return;
    }

    this.currentTarget = Math.random() < 0.5 ? "left" : "right";
    this.totalTrials++;

    /* ─ Pick next color scheme for this trial ─ */
    this.currentSchemeIdx = (this.totalTrials - 1) % COLOR_SCHEMES.length;
    this.currentScheme   = COLOR_SCHEMES[this.currentSchemeIdx];
    this.applyColors();

    this.updateProgress();

    const isLeft = this.currentTarget === "left";
    const label  = isLeft ? this.currentScheme.leftLabel  : this.currentScheme.rightLabel;
    const hand   = isLeft ? "ซ้าย"                        : "ขวา";

    this.highlightTarget(this.currentTarget);
    this.updateHandColors(this.currentTarget); // ← เปลี่ยนสีมือทุกรอบ
    document.getElementById("subInstruction").textContent =
      `เอามือ${hand} (${label}) ไปแตะวงสี${label}`;
    this.speak(`ใส่สี${label}`);

    this.trajectory     = [];
    this.trialStartTime = performance.now();
    this.state          = "trial";
  }

  /* ─── Complete one trial ────────────────────────────────────── */
  async completeTrial(hit, hitHand, dist) {
    if (this.state !== "trial") return;
    this.state = "between";

    const reactionTime = hit ? (performance.now() - this.trialStartTime) / 1000 : null;
    const target       = this.getTargetCenter(this.currentTarget);
    const expectedHand = this.currentTarget === "left" ? "Left" : "Right";
    const correct      = hit && hitHand === expectedHand;

    if (correct) {
      this.score++;
      document.getElementById("scoreValue").textContent = String(this.score);
      this.setFeedback(ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)]);
    } else {
      this.setFeedback(GENTLE_MISS[Math.floor(Math.random() * GENTLE_MISS.length)]);
    }

    const trial = {
      session_id:    this.sessionId,
      trial_index:   this.totalTrials - 1,
      target_color:  this.currentTarget === "left" ? "red" : "blue",
      target_x:      target.x,
      target_y:      target.y,
      target_radius: TARGET_RADIUS,
      hit:           correct,
      hit_hand:      hitHand,
      reaction_time: reactionTime,
      points:        this.trajectory,
    };

    try { await API.submitTrial(trial); } catch { console.warn("Trial submit failed"); }

    this.highlightTarget("neutral");
    setTimeout(() => this.nextTrial(), 1500);
  }

  /* ─── All trials done ───────────────────────────────────────── */
  finishPlaying() {
    this.state = "done";
    this.highlightTarget("neutral");
    this.updateHandColors("neutral"); // ← คืนสีมือกลับปกติ
    document.getElementById("subInstruction").textContent = "จบเกมแล้ว — กดดูผลเพื่อวิเคราะห์";
    this.setFeedback("เสร็จแล้ว! กดปุ่ม ดูผล เพื่อดูการประเมิน");
    document.getElementById("btnFinish").disabled = false;
    document.getElementById("btnStop")  .disabled = true;
  }

  /* ─── Show results ──────────────────────────────────────────── */
  async showResults() {
    if (!this.sessionId) return;
    try {
      const result = await API.analyze(this.sessionId);
      this.renderResults(result);
      this.showScreen("result");
      if (this.tracker) this.tracker.stop();
    } catch {
      this.setFeedback("วิเคราะห์ผลไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  renderResults(result) {
    const predLabel = PREDICTION_LABELS[result.prediction] || result.prediction;
    document.getElementById("resultSummary")   .textContent = `${predLabel}: ${result.summary_th}`;
    document.getElementById("resultScore")     .textContent = result.total_score;
    document.getElementById("resultTotal")     .textContent = result.trials_completed;
    document.getElementById("resultConfidence").textContent = Math.round(result.confidence * 100);

    const fmt = (v) => `${Math.round(v * 100)}%`;
    document.getElementById("leftSpeed")   .textContent = fmt(result.left_scores.speed);
    document.getElementById("leftAccuracy").textContent = fmt(result.left_scores.accuracy);
    document.getElementById("leftQuality") .textContent = fmt(result.left_scores.quality);
    document.getElementById("leftSuccess") .textContent = fmt(result.left_scores.success_rate);

    document.getElementById("rightSpeed")   .textContent = fmt(result.right_scores.speed);
    document.getElementById("rightAccuracy").textContent = fmt(result.right_scores.accuracy);
    document.getElementById("rightQuality") .textContent = fmt(result.right_scores.quality);
    document.getElementById("rightSuccess") .textContent = fmt(result.right_scores.success_rate);
  }

  stop() {
    this.state = "done";
    if (this.tracker) this.tracker.stop();
    document.getElementById("btnFinish").disabled = false;
    document.getElementById("btnStop")  .disabled = true;
    this.setFeedback("หยุดแล้ว — กด ดูผล เพื่อวิเคราะห์จากรอบที่เล่นไป");
  }

  reset() {
    if (this.tracker) this.tracker.stop();
    this.tracker     = null;
    this.sessionId   = null;
    this.state       = "idle";
    this.totalTrials = 0;
    this.score       = 0;
    this.showScreen("welcome");
    this.setFeedback("");
    document.getElementById("scoreValue").textContent = "0";
    this.updateProgress();
  }
}

document.addEventListener("DOMContentLoaded", () => { new ColorMatchGame(); });
