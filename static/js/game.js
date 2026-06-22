const TOTAL_ROUNDS = 12;
const TARGET_RADIUS = 120;
const ROUND_TIME_LIMIT_MS = 8500;
const BETWEEN_ROUND_DELAY_MS = 1200;
const MAX_SCORE = TOTAL_ROUNDS * 2;

const COLOR_SCHEMES = [
  { leftHex: "#43a047", rightHex: "#e53935", neutralHex: "#8e24aa", leftLabel: "เขียว", rightLabel: "แดง" },
  { leftHex: "#1e88e5", rightHex: "#fb8c00", neutralHex: "#6d4c41", leftLabel: "ฟ้า", rightLabel: "ส้ม" },
  { leftHex: "#ab47bc", rightHex: "#fdd835", neutralHex: "#3949ab", leftLabel: "ม่วง", rightLabel: "เหลือง" },
  { leftHex: "#e91e63", rightHex: "#00bcd4", neutralHex: "#5e35b1", leftLabel: "ชมพู", rightLabel: "ฟ้าอมเขียว" },
  { leftHex: "#00e676", rightHex: "#ff5252", neutralHex: "#263238", leftLabel: "เขียวสด", rightLabel: "แดงสด" },
  { leftHex: "#26c6da", rightHex: "#ff7043", neutralHex: "#7cb342", leftLabel: "ฟ้าอ่อน", rightLabel: "ส้มอ่อน" },
  { leftHex: "#7cb342", rightHex: "#e040fb", neutralHex: "#ff8a65", leftLabel: "เขียวอ่อน", rightLabel: "ม่วงสด" },
  { leftHex: "#ff8a65", rightHex: "#42a5f5", neutralHex: "#c0ca33", leftLabel: "ส้มพีช", rightLabel: "ฟ้าสว่าง" },
  { leftHex: "#00acc1", rightHex: "#d81b60", neutralHex: "#8bc34a", leftLabel: "ฟ้าเข้ม", rightLabel: "ชมพูเข้ม" },
  { leftHex: "#f4511e", rightHex: "#00897b", neutralHex: "#5c6bc0", leftLabel: "ส้มเข้ม", rightLabel: "เขียวน้ำทะเล" },
  { leftHex: "#6d4c41", rightHex: "#039be5", neutralHex: "#c0ca33", leftLabel: "น้ำตาล", rightLabel: "ฟ้าสด" },
  { leftHex: "#8e24aa", rightHex: "#43a047", neutralHex: "#e53935", leftLabel: "ม่วงเข้ม", rightLabel: "เขียวเข้ม" },
];

const ZONE_IDS = {
  left: "targetRed",
  right: "targetBlue",
  neutral: "targetPurple",
};

const ENCOURAGEMENT = ["เก่งมาก!", "ยอดเยี่ยม!", "ทำได้ดีมาก!", "สุดยอด!", "แม่นมาก!"];
const GENTLE_MISS = ["ไม่เป็นไร ลองรอบถัดไป", "ใกล้แล้ว ลองใหม่อีกครั้ง", "เกือบผ่านแล้ว"];

const PREDICTION_LABELS = {
  right_dominant: "มือขวาถนัด",
  left_dominant: "มือซ้ายถนัด",
  learned_non_use_left: "แนวโน้ม Learned Non-Use (มือซ้าย)",
  learned_non_use_right: "แนวโน้ม Learned Non-Use (มือขวา)",
};

class ColorMatchGame {
  constructor() {
    this.sessionId = null;
    this.tracker = null;
    this.state = "idle";
    this.totalTrials = 0;
    this.score = 0;
    this.currentSchemeIdx = 0;
    this.currentScheme = COLOR_SCHEMES[0];
    this.currentRound = null;
    this.trialStartTime = null;
    this.trajectory = [];
    this.roundHits = { left: false, right: false };
    this.roundReactionTimes = { left: null, right: null };
    this.roundHitDistances = { left: null, right: null };
    this.roundTimer = null;
    this.advanceTimer = null;

    this.video = document.getElementById("webcam");
    this.canvas = document.getElementById("skeletonCanvas");
    this.container = document.getElementById("videoContainer");
    this.dotLeft = document.getElementById("handDotLeft");
    this.dotRight = document.getElementById("handDotRight");

    this.bindUI();
    this.updateScoreDisplay();
    this.updateProgress();
  }

  bindUI() {
    document.getElementById("btnStartWelcome").addEventListener("click", () => this.start());
    document.getElementById("btnStop").addEventListener("click", () => this.stop());
    document.getElementById("btnFinish").addEventListener("click", () => this.showResults());
    document.getElementById("btnPlayAgain").addEventListener("click", () => this.reset());
  }

  showScreen(name) {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
    document.getElementById(`${name}Screen`).classList.add("active");
    document.body.classList.toggle("game-active", name === "game");
  }

  setFeedback(message) {
    document.getElementById("feedbackBanner").textContent = message;
  }

  speak(text) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  clearTimers() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  updateScoreDisplay() {
    document.getElementById("scoreValue").textContent = String(this.score);
    const scoreMax = document.getElementById("scoreMaxValue");
    if (scoreMax) scoreMax.textContent = String(MAX_SCORE);
  }

  updateProgress() {
    document.getElementById("levelText").textContent = `รอบ ${this.totalTrials} / ${TOTAL_ROUNDS}`;
    document.getElementById("progressText").textContent = `แตะถูก ${this.score} / ${MAX_SCORE}`;
    const badgeText =
      this.state === "done"
        ? "จบเกม"
        : this.totalTrials === 0
          ? "เตรียมพร้อม"
          : `รอบ ${this.totalTrials} / ${TOTAL_ROUNDS}`;
    document.getElementById("levelBadge").textContent = badgeText;

    const pct = (this.totalTrials / TOTAL_ROUNDS) * 100;
    document.getElementById("progressFill").style.width = `${pct}%`;
    document.querySelector(".progress-bar").setAttribute("aria-valuenow", String(this.totalTrials));
    document.querySelector(".progress-bar").setAttribute("aria-valuemax", String(TOTAL_ROUNDS));
  }

  applyScheme() {
    const scheme = this.currentScheme;

    document.getElementById(ZONE_IDS.left).style.background = scheme.leftHex;
    document.getElementById(ZONE_IDS.right).style.background = scheme.rightHex;
    document.getElementById(ZONE_IDS.neutral).style.background = scheme.neutralHex;

    this.dotLeft.style.background = scheme.leftHex;
    this.dotRight.style.background = scheme.rightHex;
    this.dotLeft.style.opacity = "1";
    this.dotRight.style.opacity = "1";

    if (this.tracker) {
      this.tracker.setHandColors(scheme.leftHex, scheme.rightHex);
    }
  }

  setTargetHighlight(targets) {
    document.querySelectorAll(".target-zone").forEach((zone) => zone.classList.remove("active"));

    if (targets === "neutral") {
      const neutralZone = document.getElementById(ZONE_IDS.neutral);
      if (neutralZone) neutralZone.classList.add("active");
      return;
    }

    for (const target of targets) {
      const id = ZONE_IDS[target];
      if (id) document.getElementById(id).classList.add("active");
    }
  }

  getTargetCenter(which) {
    const containerRect = this.container.getBoundingClientRect();
    const zoneRect = document.getElementById(ZONE_IDS[which]).getBoundingClientRect();

    return {
      x: zoneRect.left + zoneRect.width / 2 - containerRect.left,
      y: zoneRect.top + zoneRect.height / 2 - containerRect.top,
    };
  }

  handToScreen(hand) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: (1 - hand.x) * rect.width,
      y: hand.y * rect.height,
    };
  }

  updateRoundCopy() {
    const leftLabel = this.currentScheme.leftLabel;
    const rightLabel = this.currentScheme.rightLabel;
    document.getElementById("mainInstruction").textContent = `มือซ้ายแตะ ${leftLabel} มือขวาแตะ ${rightLabel}`;
    document.getElementById("subInstruction").textContent =
      `รอบนี้ มือซ้าย = ${leftLabel} และ มือขวา = ${rightLabel}`;
  }

  async start() {
    try {
      const { session_id } = await API.startSession();
      this.sessionId = session_id;
    } catch {
      this.setFeedback("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      return;
    }

    this.clearTimers();
    this.showScreen("game");
    this.score = 0;
    this.totalTrials = 0;
    this.currentSchemeIdx = 0;
    this.currentScheme = COLOR_SCHEMES[0];
    this.currentRound = null;
    this.roundHits = { left: false, right: false };
    this.roundReactionTimes = { left: null, right: null };
    this.roundHitDistances = { left: null, right: null };
    this.trajectory = [];
    this.trialStartTime = null;

    this.updateScoreDisplay();
    this.updateProgress();
    document.getElementById("btnStop").disabled = false;
    document.getElementById("btnFinish").disabled = true;

    this.applyScheme();
    this.setTargetHighlight("neutral");
    this.setFeedback("เตรียมตัว: ยกมือทั้งสองข้างให้กล้องเห็น");
    document.getElementById("mainInstruction").textContent = "เตรียมตัวให้พร้อม";
    document.getElementById("subInstruction").textContent = "รอเริ่มรอบแรกและยกมือทั้งสองข้างให้อยู่ในเฟรม";

    try {
      this.tracker = new HandTracker(this.video, this.canvas, (hands) => this.onHands(hands));
      await this.tracker.init();
    } catch {
      this.setFeedback("ไม่สามารถเริ่มกล้องหรือระบบตรวจจับมือได้");
      document.getElementById("btnStop").disabled = true;
      document.getElementById("btnFinish").disabled = true;
      this.state = "idle";
      return;
    }

    this.state = "calibrating";

    setTimeout(() => {
      if (this.state === "calibrating") {
        this.nextRound();
      }
    }, 5000);
  }

  nextRound() {
    if (this.state === "done") return;
    if (this.totalTrials >= TOTAL_ROUNDS) {
      this.finishPlaying();
      return;
    }

    this.clearTimers();

    this.totalTrials += 1;
    this.currentSchemeIdx = (this.totalTrials - 1) % COLOR_SCHEMES.length;
    this.currentScheme = COLOR_SCHEMES[this.currentSchemeIdx];
    this.applyScheme();

    const leftTarget = this.getTargetCenter("left");
    const rightTarget = this.getTargetCenter("right");
    this.currentRound = {
      left: {
        color: this.currentScheme.leftHex,
        target_x: leftTarget.x,
        target_y: leftTarget.y,
        target_radius: TARGET_RADIUS,
      },
      right: {
        color: this.currentScheme.rightHex,
        target_x: rightTarget.x,
        target_y: rightTarget.y,
        target_radius: TARGET_RADIUS,
      },
    };

    this.roundHits = { left: false, right: false };
    this.roundReactionTimes = { left: null, right: null };
    this.roundHitDistances = { left: null, right: null };
    this.trajectory = [];
    this.trialStartTime = performance.now();
    this.state = "trial";

    this.updateProgress();
    this.updateRoundCopy();
    this.setTargetHighlight(["left", "right"]);
    this.setFeedback(
      `รอบ ${this.totalTrials}: มือซ้ายแตะ ${this.currentScheme.leftLabel} มือขวาแตะ ${this.currentScheme.rightLabel}`
    );
    this.speak(`มือซ้าย ${this.currentScheme.leftLabel} มือขวา ${this.currentScheme.rightLabel}`);

    this.roundTimer = setTimeout(() => this.endRound("timeout"), ROUND_TIME_LIMIT_MS);
  }

  onHands(hands) {
    if (!this.container) return;

    if (hands.left) {
      const leftPos = this.handToScreen(hands.left);
      this.dotLeft.style.left = `${leftPos.x}px`;
      this.dotLeft.style.top = `${leftPos.y}px`;
      this.dotLeft.classList.add("visible");
    } else {
      this.dotLeft.classList.remove("visible");
    }

    if (hands.right) {
      const rightPos = this.handToScreen(hands.right);
      this.dotRight.style.left = `${rightPos.x}px`;
      this.dotRight.style.top = `${rightPos.y}px`;
      this.dotRight.classList.add("visible");
    } else {
      this.dotRight.classList.remove("visible");
    }

    if (this.state !== "trial") return;

    const now = performance.now();
    const t = (now - this.trialStartTime) / 1000;

    if (hands.left) {
      const leftPos = this.handToScreen(hands.left);
      this.trajectory.push({ t, x: leftPos.x, y: leftPos.y, hand: "Left" });
      this.checkHandHit("left", hands.left);
    }

    if (hands.right) {
      const rightPos = this.handToScreen(hands.right);
      this.trajectory.push({ t, x: rightPos.x, y: rightPos.y, hand: "Right" });
      this.checkHandHit("right", hands.right);
    }
  }

  checkHandHit(handKey, handData) {
    if (this.state !== "trial" || !this.currentRound || this.roundHits[handKey]) return;

    const attempt = this.currentRound[handKey];
    const pos = this.handToScreen(handData);
    const dist = Math.hypot(pos.x - attempt.target_x, pos.y - attempt.target_y);

    if (dist > attempt.target_radius) return;

    const reactionTime = (performance.now() - this.trialStartTime) / 1000;
    this.roundHits[handKey] = true;
    this.roundReactionTimes[handKey] = reactionTime;
    this.roundHitDistances[handKey] = dist;
    this.score += 1;
    this.updateScoreDisplay();

    if (this.roundHits.left && this.roundHits.right) {
      this.setFeedback("ครบทั้งสองมือแล้ว!");
      this.endRound("completed");
      return;
    }

    const remaining = handKey === "left" ? "มือขวา" : "มือซ้าย";
    this.setFeedback(`${handKey === "left" ? "มือซ้าย" : "มือขวา"}ถูกแล้ว เหลือ${remaining}อีกข้าง`);
  }

  async endRound(reason) {
    if (this.state !== "trial") return;

    this.state = "between";
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    const trial = {
      session_id: this.sessionId,
      trial_index: this.totalTrials - 1,
      left: {
        ...this.currentRound.left,
        hit: this.roundHits.left,
        reaction_time: this.roundReactionTimes.left,
        hit_distance: this.roundHitDistances.left,
      },
      right: {
        ...this.currentRound.right,
        hit: this.roundHits.right,
        reaction_time: this.roundReactionTimes.right,
        hit_distance: this.roundHitDistances.right,
      },
      points: this.trajectory,
      round_duration: (performance.now() - this.trialStartTime) / 1000,
    };

    try {
      await API.submitTrial(trial);
    } catch {
      console.warn("Trial submit failed");
    }

    this.setTargetHighlight("neutral");
    this.setFeedback(
      reason === "completed"
        ? "รอบนี้ครบแล้ว เตรียมรอบถัดไป"
        : "หมดเวลารอบนี้ เตรียมรอบถัดไป"
    );

    this.advanceTimer = setTimeout(() => this.nextRound(), BETWEEN_ROUND_DELAY_MS);
  }

  finishPlaying() {
    this.clearTimers();
    this.state = "done";
    this.setTargetHighlight("neutral");
    document.getElementById("mainInstruction").textContent = "จบเกมแล้ว";
    document.getElementById("subInstruction").textContent = "กดดูผลเพื่อประเมินภาพรวมของมือทั้งสองข้าง";
    this.setFeedback("จบเกมแล้ว กดดูผลเพื่อประเมินภาพรวม");
    document.getElementById("btnFinish").disabled = false;
    document.getElementById("btnStop").disabled = true;
  }

  async showResults() {
    if (!this.sessionId) return;

    this.clearTimers();
    try {
      const result = await API.analyze(this.sessionId);
      this.renderResults(result);
      this.showScreen("result");
      if (this.tracker) this.tracker.stop();
      this.state = "done";
    } catch {
      this.setFeedback("วิเคราะห์ผลไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  renderResults(result) {
    const predLabel = PREDICTION_LABELS[result.prediction] || result.prediction;
    document.getElementById("resultSummary").textContent = `${predLabel}: ${result.summary_th}`;
    document.getElementById("resultScore").textContent = result.total_score;
    document.getElementById("resultMaxScore").textContent = result.trials_completed * 2;
    document.getElementById("resultTotal").textContent = result.trials_completed;
    document.getElementById("resultConfidence").textContent = Math.round(result.confidence * 100);

    const fmt = (value) => `${Math.round(value * 100)}%`;
    document.getElementById("leftSpeed").textContent = fmt(result.left_scores.speed);
    document.getElementById("leftAccuracy").textContent = fmt(result.left_scores.accuracy);
    document.getElementById("leftQuality").textContent = fmt(result.left_scores.quality);
    document.getElementById("leftSuccess").textContent = fmt(result.left_scores.success_rate);
    document.getElementById("rightSpeed").textContent = fmt(result.right_scores.speed);
    document.getElementById("rightAccuracy").textContent = fmt(result.right_scores.accuracy);
    document.getElementById("rightQuality").textContent = fmt(result.right_scores.quality);
    document.getElementById("rightSuccess").textContent = fmt(result.right_scores.success_rate);
  }

  stop() {
    this.clearTimers();
    this.state = "done";
    if (this.tracker) this.tracker.stop();
    document.getElementById("mainInstruction").textContent = "หยุดการเล่นแล้ว";
    document.getElementById("subInstruction").textContent = "กดดูผลเพื่อวิเคราะห์รอบที่เล่นไปแล้ว";
    document.getElementById("btnFinish").disabled = false;
    document.getElementById("btnStop").disabled = true;
    this.setFeedback("หยุดการเล่นแล้ว กดดูผลเพื่อวิเคราะห์");
  }

  reset() {
    this.clearTimers();
    if (this.tracker) this.tracker.stop();
    this.tracker = null;
    this.sessionId = null;
    this.state = "idle";
    this.totalTrials = 0;
    this.score = 0;
    this.currentSchemeIdx = 0;
    this.currentScheme = COLOR_SCHEMES[0];
    this.currentRound = null;
    this.roundHits = { left: false, right: false };
    this.roundReactionTimes = { left: null, right: null };
    this.roundHitDistances = { left: null, right: null };
    this.trajectory = [];
    this.trialStartTime = null;

    this.showScreen("welcome");
    this.updateScoreDisplay();
    this.updateProgress();
    this.setFeedback("");
    document.getElementById("btnFinish").disabled = true;
    document.getElementById("btnStop").disabled = true;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ColorMatchGame();
});
