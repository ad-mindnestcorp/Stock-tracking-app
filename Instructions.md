FIGMA design - FigmaDesign folder

Your application is basically:

---

# 🧠 Simple Explanation

👉 **“A smart stock alert system for your portfolio”**

---

# 📱 What it does (in plain English)

* You add all your stocks
* The system keeps watching them continuously
* Whenever something important happens, it notifies you

---

# 🔔 What kind of alerts?

* Stock hits **52-week high** 📈
* Stock hits **52-week low** 📉
* RSI goes **above 70** (overbought)
* RSI goes **below 30** (oversold)

---

# ⚙️ How it behaves

👉 You don’t need to check charts all day

Instead:

* The system monitors everything in the background
* Sends you alerts only when action is needed

---

# 💡 One-line version (startup pitch style)

👉 **“Set-and-forget stock monitoring that alerts you when your stocks hit key technical signals.”**

# 📱 MVP Context: Smart Stock Alert App (Expo Go)

## 🧠 What we are building

A mobile app where users add their stocks, and the system automatically monitors them and sends alerts when:

* Stock reaches 52-week high
* Stock reaches 52-week low
* RSI > 70 (overbought)
* RSI < 30 (oversold)

The app should work in the background and notify users without them checking charts.

---

## 🧰 Tech Stack (Simple)

### Frontend (Mobile App)

* Framework: React Native (Expo Go)
* Navigation: Expo Router or React Navigation
* UI: Basic components (no heavy design needed for MVP)

---

### Backend

* Runtime: Node.js (Express) OR Python (FastAPI)
* API: REST APIs

---

### Stock Data API

Use:

* Finnhub (primary)
* Twelve Data (fallback)

---

### Database

* Use: Supabase (PostgreSQL)
* Store:

  * users
  * user_stocks
  * alerts_log

---

### Background Job / Scheduler

* Cron job (every 5 minutes)
* Runs alert-checking logic

---

### Notifications

* Expo Push Notifications (for mobile alerts)
* Optional: Telegram bot (for testing)

---

## ⚙️ Core Backend Logic

For each user:

1. Fetch all their stocks
2. Get latest price + historical data
3. Calculate RSI
4. Check conditions:

   * RSI > 70 → send alert
   * RSI < 30 → send alert
   * Price >= 52W high → send alert
   * Price <= 52W low → send alert
5. Save alert in database (avoid duplicate alerts)

---

## 📱 App Screens (MVP)

1. Login / Signup (use Supabase auth)
2. Dashboard:

   * List of user stocks
3. Add Stock:

   * Input stock symbol
4. Alerts Screen:

   * Show triggered alerts

---

## 🔌 API Endpoints

* POST /add-stock
* GET /stocks
* GET /alerts
* DELETE /stock

---

## 🚀 Flow

User adds stock →
Backend stores it →
Scheduler runs every 5 min →
Checks conditions →
Triggers notification →
User gets alert on phone

---

## ⚠️ Important Notes

* Avoid duplicate alerts (store last alert state)
* Handle API rate limits
* Keep MVP simple (no charts needed)

---

## 🎯 Goal of MVP

* User can add stocks
* System sends alerts correctly
* Notifications work reliably

No need for:

* Fancy UI
* Advanced analytics
* Trading integration

---

## 💡 Future Improvements (not MVP)

* Auto portfolio sync (brokers)
* More indicators (MACD, EMA)
* AI-based signals
* Web dashboard
* Paid plans

---




