const API = {
  async startSession() {
    const res = await fetch("/api/session/start", { method: "POST" });
    if (!res.ok) throw new Error("ไม่สามารถเริ่ม session ได้");
    return res.json();
  },

  async submitTrial(trial) {
    const res = await fetch("/api/session/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trial),
    });
    if (!res.ok) throw new Error("บันทึกรอบไม่สำเร็จ");
    return res.json();
  },

  async analyze(sessionId) {
    const res = await fetch(`/api/session/analyze?session_id=${encodeURIComponent(sessionId)}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("วิเคราะห์ผลไม่สำเร็จ");
    return res.json();
  },
};
