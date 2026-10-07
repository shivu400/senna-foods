# 🚀 Free Cloud Deployment Guide - Senna Foods LMS Engine

This guide explains how to deploy the entire **Senna Foods Logistics Management System** (React Frontend + Python FastAPI Backend + SQLite) to **100% Free Cloud Providers** in under 5 minutes.

---

## 1. 🐍 Backend Deployment: Render.com (Free Web Service)

[Render](https://render.com) offers a 100% free tier for hosting Python FastAPI applications.

### Steps:
1. Push your project to a GitHub repository.
2. Sign up at [Render.com](https://render.com) (free).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Configure the settings:
   - **Name:** `senna-lms-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
6. Click **Create Web Service**.

Render will deploy your Python FastAPI app and give you a free live URL:  
`https://senna-lms-backend.onrender.com`

---

## 2. ⚛️ Frontend Deployment: Vercel (Free Frontend Hosting)

[Vercel](https://vercel.com) provides instant, zero-configuration hosting for React/Vite applications.

### Steps:
1. Sign up at [Vercel.com](https://vercel.com) with GitHub.
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository.
4. Configure settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**.

Vercel will deploy your React dashboard in seconds with a free production URL:  
`https://senna-foods-lms.vercel.app`

---

## 3. 📦 Alternative: Docker Deployment (Fly.io / Railway)

If you prefer deploying via Docker, run the provided `docker-compose.yml`:

```bash
# Build and run locally or on any cloud VPS
docker-compose up --build
```
