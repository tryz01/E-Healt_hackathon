# Hand Dexterity Assessment — ใส่สีให้ตรง

เว็บแอปประเมินความคล่องแคล่วมือผ่านเกมจับคู่สี สำหรับ **Digital Aiding 4 Aging Hackathon 2026** (AI Vibe Coding Track)

ผู้ใช้ยกมือทั้งสองข้างต่อกล้อง — มือซ้าย , มือขวา แล้วแตะวงเป้าหมายสีที่ตรงกัน ระบบวิเคราะห์ **ความเร็ว**, **ความแม่นยำ**, และ **คุณภาพการเคลื่อนไหว** เพื่อทำนายมือถนัดและแนวโน้ม Learned Non-Use

## Key Focus

- **Accessible UX** — ฟอนต์ใหญ่, contrast สูง, ปุ่มใหญ่, รองรับ keyboard
- **Easy Interface** — flow 3 ขั้น: ยินดีต้อนรับ → เล่นเกม → ดูผล
- **Empathetic Design** — ข้อความให้กำลังใจ, ไม่กดดัน, ออกแบบสำหรับผู้สูงอายุ เข้าใจง่าย

## Requirements

- Python 3.10+
- Webcam
- Chrome หรือ Edge (แนะนำ)
- แสงสว่างเพียงพอ

## ติดตั้งและรัน

```powershell
pip install -r requirements.txt
python scripts/train_model.py
python -m uvicorn app.main:app --reload
```

เปิดเบราว์เซอร์ที่ [http://127.0.0.1:8000](http://127.0.0.1:8000)

## วิธีเล่น

1. กด **เริ่มเล่น** และอนุญาตให้ใช้กล้อง
2. ยกมือซ้ายและขวาให้กล้องเห็น (calibration 5 วินาที)
3. เมื่อมีสีเป้าหมาย — เอามือที่มีสีตรงกันไปแตะวงด้านบนของภาพ
4. เล่นครบ 12 รอบ จะแสดงผลหน้าต่างข้อมูลคะแนน ไม่แสดงข้อมูลการเป็นภาวะ learned Non-used และจะมีคำให้กำลังใจ

## โครงสร้างโปรเจกต์

```
Hackathonvibe/
├── README.md
├── context.md          # บริบทโปรเจกต์และ UX guidelines
├── Agents.md           # บทบาท AI agents
├── app/
│   ├── main.py         # FastAPI routes
│   ├── metrics.py      # คำนวณ speed / accuracy / quality
│   ├── predictor.py    # ML inference
│   ├── schemas.py      # Pydantic models
│   └── data/model.joblib
├── scripts/train_model.py
├── static/             # CSS + JS (MediaPipe hand tracking)
└── templates/index.html
```

## API

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/` | หน้าเกม |
| POST | `/api/session/start` | เริ่ม session |
| POST | `/api/session/trial` | ส่งข้อมูล 1 รอบ |
| POST | `/api/session/analyze?session_id=...` | วิเคราะห์และทำนาย |
| GET | `/api/health` | health check |

## Retrain Model

```powershell
python scripts/train_model.py
```

โมเดลใช้ RandomForest กับ synthetic data (~2000 samples) สำหรับ demo hackathon

## ข้อจำกัด

- **ไม่ใช่เครื่องมือวินิจฉัยทางการแพทย์** — ใช้เพื่อการประเมินเบื้องต้นและ demo เท่านั้น
- ML train จากข้อมูล synthetic — production ต้อง calibrate ด้วยข้อมูลจริง
- ต้องการ webcam และสภาพแสงที่เหมาะสม

## Hackathon

**Digital Aiding 4 Aging Hackathon 2026** — Innovation for the Elderly Care: Hack the Future with AI Vibe Coding
