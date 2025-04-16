
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const passThrough = new PassThrough();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const PORT = 4000;
const activeStreams = new Map();
const streamSessions = {};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/hls', express.static('/tmp/hls'));

app.get('/generate-hls/:streamKey', (req, res) => {
  const streamKey = req.params.streamKey;
  const outputDir = `/tmp/hls/${streamKey}`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = spawn('ffmpeg', [
    '-i', `rtmp://anthena.i.ng/live/${streamKey}`,
    '-map', '0:v:0', '-s:v:0', '640x360', '-b:v:0', '800k',
    '-map', '0:v:0', '-s:v:1', '1280x720', '-b:v:1', '2800k',
    '-map', '0:v:0', '-s:v:2', '1920x1080', '-b:v:2', '5000k',
    '-c:v', 'libx264', '-preset', 'veryfast',
    '-c:a', 'aac', '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'event',
    '-hls_list_size', '6',
    '-hls_flags', 'delete_segments',
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', 'v:0,a:0 v:1,a:0 v:2,a:0',
    `${outputDir}/stream_%v.m3u8`
  ]);

  ffmpeg.stderr.on('data', data => console.error('HLS FFmpeg:', data.toString()));
  ffmpeg.on('close', code => console.log(`HLS FFmpeg exited with code ${code}`));

  res.send(`Started HLS generation for ${streamKey}`);
});

app.get('/metrics', (req, res) => {
  const metrics = Array.from(activeStreams.entries()).map(([key, data]) => ({
    streamKey: key,
    uptime: ((Date.now() - data.startedAt) / 1000).toFixed(1) + 's',
    dataMB: (data.bytesReceived / (1024 * 1024)).toFixed(2) + ' MB',
    clientIP: data.clientIP
  }));
  res.json({ active: metrics });
});

app.get('/lists', (req, res) => {
  const base = '/tmp/hls';
  const streams = fs.existsSync(base) ? fs.readdirSync(base) : [];
  res.send('<h1>Streams</h1><ul>' +
    streams.map(s => `<li><a href="/watch/${s}">${s}</a></li>`).join('') +
    '</ul>');
});

app.get('/watch/:streamKey', (req, res) => {
  const key = req.params.streamKey;
  res.send(`
    <h1>Watching ${key}</h1>
    <video width="640" height="360" controls autoplay>
      <source src="/hls/${key}/master.m3u8" type="application/x-mpegURL">
      Your browser does not support the video tag.
    </video>
  `);
});


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

    // metrics
    activeStreams.set(streamKey, {
      startedAt: Date.now(),
      bytesReceived: 0,
      clientIP: ws._socket.remoteAddress
    });
    ///
    handleStream(ws, streamKey);
  });
});

function handleStream(ws, streamKey) {
  console.log(`Incoming stream for ${streamKey}`);
  const ffmpeg = spawn('ffmpeg', [
    '-f', 'webm',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    `rtmp://anthena.i.ng/live/${streamKey}`
  ]);

  streamSessions[streamKey] = ffmpeg;
  passThrough.pipe(ffmpeg.stdin);
  ws.on('message', async (msg) => {
     // If msg is not a Buffer (e.g. a Blob), convert it
    const chunk = Buffer.isBuffer(msg) ? msg : Buffer.from(new Uint8Array(await msg.arrayBuffer?.()));
    console.log('First 10 bytes:', chunk.slice(0, 10));
    console.log(`Received chunk: ${chunk.length} bytes`);
    activeStreams.get(streamKey).bytesReceived += chunk.length;

    const canWrite = passThrough.write(chunk);
    if (!canWrite) {
      console.warn('FFmpeg is overwhelmed. Applying backpressure...');
      ws.pause(); // prevent overload
      passThrough.once('drain', () => ws.resume());
    }
  });

  ws.on('close', () => {
    // when a stream ended
    activeStreams.delete(streamKey);
    ffmpeg.stdin.end();
    ffmpeg.kill();
    delete streamSessions[streamKey];
    console.log(`Closed stream for ${streamKey}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`FFmpeg error for ${streamKey}:`, data.toString());
  });
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
