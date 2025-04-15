# 📺 MediaRecorder + WebSocket + FFmpeg → RTMP → HLS Streaming System

This project provides a production-ready, scalable architecture for live video broadcasting. It allows users to capture camera, screen share, or upload video files directly in the browser and stream them in real-time using:

- **MediaRecorder API**
- **WebSocket** (to Node.js backend)
- **FFmpeg** (for encoding and streaming to RTMP)
- **NGINX with RTMP module** (to serve HLS playlists)

---

## 🚀 Why This Is Better Than PeerJS Approach

| Criteria                    | Old PeerJS-based (WebRTC)           | New MediaRecorder → RTMP → HLS         |
|----------------------------|--------------------------------------|-----------------------------------------|
| Browser Compatibility      | Limited to P2P clients               | Works with any video-capable browser    |
| Scalability                | Limited (1:1 or 1:N via SFU)         | ✅ Easily supports 10–1000+ viewers     |
| Stream Quality Control     | Complex with WebRTC                  | ✅ Adaptive HLS quality with FFmpeg     |
| Recording Support          | Manual with WebRTC                   | ✅ Easy VOD with `.m3u8` / `.ts`        |
| Server Load                | High for many viewers (WebRTC mesh)  | ✅ Centralized RTMP → HTTP delivery     |
| Deployment Complexity      | Needs SFU (e.g. mediasoup, Janus)    | ✅ Simpler Docker-based stack           |

This system eliminates the scaling and maintenance bottlenecks of PeerJS/WebRTC by offloading stream distribution to battle-tested RTMP and HLS delivery infrastructure.

---

## 🐳 Deployment Instructions

### 1. Clone the project
```bash
git clone <your-repo>
cd mediarecorder-rtmp-hls
```

### 2. Build and Run with Docker Compose
```bash
docker-compose up --build
```

### 3. Access the App
| Component          | URL                                 |
|-------------------|--------------------------------------|
| Broadcast UI      | http://localhost:4000                |
| HLS Playback      | http://localhost:8080/hls/{key}/...  |
| Stream List Page  | http://localhost:4000                |
| Metrics Dashboard | http://localhost:4000/metrics        |

---

## ✅ Features Summary

- 📹 Stream from camera, screen, or video file
- 🔐 Token-based WebSocket authentication
- 📦 Dockerized setup (Node + FFmpeg + NGINX)
- 📈 Live metrics endpoint `/metrics`
- 🧪 Adaptive bitrate via FFmpeg
- 🎥 HLS playback on any browser or mobile device

---

## 📄 Security: Authenticated WebSocket Ingest
Each stream is protected using a token, passed in the WebSocket URL:
```js
ws = new WebSocket('ws://localhost:4000/ws?streamKey=abc123&token=YOUR_SECRET');
```
The server validates this token before accepting the stream.

---

## 🧠 Future Enhancements

- Add JWT-based auth for users
- Enable stream key regeneration and session management
- Add Grafana + Prometheus for dashboard analytics
- Push HLS to CDN (Cloudflare Stream, AWS CloudFront, etc)

---

## 👏 Credits
Built with ❤️ using Node.js, FFmpeg, and NGINX RTMP module.

---

Ready to stream at scale? You've got the infrastructure for it. 🚀

