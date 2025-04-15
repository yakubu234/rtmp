# 📦 Storing Streams in RTMP + HLS Architectures

This guide explains how stream data is handled when using RTMP + HLS for video broadcasting, and whether or not videos are stored permanently.

---

## ❓ Are Videos Stored Permanently?

### ❌ No — Not by Default

When using RTMP + HLS:
- The incoming RTMP stream is **transcoded** (typically via FFmpeg)
- FFmpeg produces:
  - `.ts` segment files (video chunks)
  - `.m3u8` playlist files (index of segments)

By default:
- These are stored in a temporary folder like `/tmp/hls`
- They may be **deleted automatically** if you use:
  - `-hls_flags delete_segments`
  - or limit the number of segments with `-hls_list_size`

---

## ✅ How to Store Recordings Permanently

To persist stream recordings:

### 🎥 Option 1: Archive RTMP to `.mp4`
Use FFmpeg to store the entire stream:
```bash
ffmpeg -i rtmp://localhost/live/stream_key \
  -c:v libx264 -c:a aac \
  -f mp4 /var/www/recordings/stream_key.mp4
```

### 📂 Option 2: Store HLS chunks permanently
Save the HLS output to a permanent location:
```bash
ffmpeg -i rtmp://localhost/live/stream_key \
  -c:v libx264 -c:a aac \
  -f hls -hls_time 6 -hls_list_size 10 -hls_flags delete_segments \
  /var/www/hls/stream_key/playlist.m3u8
```

Or omit `-hls_flags delete_segments` to **keep all chunks**, but be careful with disk usage.

### 🧹 Option 3: Archive periodically
- Move or compress `.ts` files from `/tmp/hls` to permanent storage
- Run cleanup cron jobs to avoid overflow

---

## ⚠️ Disk Usage Warning

| Risk                       | Impact                              |
|----------------------------|--------------------------------------|
| Not deleting `.ts` chunks  | Disk fills rapidly over time         |
| Multiple resolutions       | Higher disk usage per stream         |
| Long broadcasts            | Thousands of segment files generated |

---

## ✅ Best Practices

| Use Case              | Recommendation                             |
|-----------------------|---------------------------------------------|
| Live only (no replay) | Use `-hls_flags delete_segments` ✅         |
| Keep some for VOD     | Schedule cron to move files                 |
| Full recording needed | Use `-f mp4` in FFmpeg output               |
| Avoid overload        | Monitor and purge `/tmp/hls` regularly     |

---

## 🔒 Add Authentication (Optional)

To prevent unauthorized streaming:

### ✅ Add Token to WebSocket URL
The client sends:
```js
ws = new WebSocket('ws://localhost:4000/ws?streamKey=stream_demo&token=YOUR_SECRET');
```

### ✅ Validate on Server
Update your server's `handleStream()` logic:
```js
const validTokens = ['YOUR_SECRET'];

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const streamKey = url.searchParams.get('streamKey');
  const token = url.searchParams.get('token');

  if (!validTokens.includes(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleStream(ws, streamKey);
  });
});
```

### 🧠 Tip:
- Replace `validTokens` with DB lookup or signed JWT check in production

---

## 🔚 Summary

RTMP + HLS doesn’t store streams permanently unless you **explicitly configure** it to. For VOD or archive access:
- Save `.mp4` or `.ts` chunks intentionally
- Clean or compress files to avoid storage issues
- Protect your ingest WebSocket with authentication to prevent abuse

---

Let this serve as your storage and security strategy cheat sheet for any streaming system based on FFmpeg, RTMP, and HLS.

