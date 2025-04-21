const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { PassThrough } = require('stream');
const passThrough = new PassThrough();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const PORT = 4000;
const activeStreams = new Map();
const streamSessions = {};
const hlsStarted = new Set();
const viewerStatus = new Map();

const statusWSS = new WebSocket.Server({ noServer: true });


app.use(express.static(path.join(__dirname, 'public')));
app.use('/hls', express.static('/tmp/hls'));

function hlsFfmpeg(streamKey){
  const outputDir = `/var/www/rtmp/hls/${streamKey}`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = spawn('ffmpeg', [
    '-i', `rtmp://anthena.i.ng/live/${streamKey}`,
    '-map', '0:v:0', '-s:v:0', '640x360', '-b:v:0', '800k',
    '-map', '0:v:0', '-s:v:1', '1280x720', '-b:v:1', '2800k',
    '-map', '0:v:0', '-s:v:2', '1920x1080', '-b:v:2', '5000k',
    '-c:v', 'libx264', '-preset', 'veryfast',
    '-g', '50', '-keyint_min', '50', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', '128k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_playlist_type', 'event',//check this one very well
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+program_date_time+independent_segments',
    '-master_pl_name', 'index.m3u8',
    '-var_stream_map', 'v:0,a:0 v:1,a:0 v:2,a:0',
    `${outputDir}/stream_%v.m3u8`
  ]);

  ffmpeg.stderr.on('data', data => console.error('HLS FFmpeg:', data.toString()));
  ffmpeg.on('close', code => console.log(`HLS FFmpeg exited with code ${code}`));

};

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
  res.sendFile(path.join(__dirname, 'public', 'lists.html'));
});
app.get('/api/list-streams', (req, res) => {
  const base = '/var/www/rtmp/hls';
  const streams = fs.existsSync(base)
    ? fs.readdirSync(base).filter(name => fs.existsSync(`${base}/${name}/index.m3u8`))
    : [];

  res.json({ streams });
});


app.get('/watch', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'watch.html')); });
app.get('/watch/:streamKey', (req, res) => { 
  const streamKey = req.params.streamKey; res.redirect(`/watch?streamKey=${encodeURIComponent(streamKey)}`); 
});

app.get('/api/stream-exists/:streamKey', (req, res) => {
  const streamKey = req.params.streamKey;
  const masterPlaylist = path.join('/var/www/rtmp/hls', streamKey, 'index.m3u8');

  if (fs.existsSync(masterPlaylist)) {
    res.json({ exists: true });
  } else {
    res.json({ exists: false });
  }
});

const validTokens = ['YOUR_SECRET'];

server.on('upgrade', (req, socket, head) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const streamKey = searchParams.get('streamKey');
  const token = searchParams.get('token');

  
  if (!validTokens.includes(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // for status
  if (pathname === '/stream-status') { 
    const streamKey = searchParams.get('streamKey'); 
    statusWSS.handleUpgrade(req, socket, head, (ws) => { 
      ws.streamKey = streamKey; 
      statusWSS.emit('connection', ws, req); 
    }); 

    return; // ✅ IMPORTANT: prevent fallthrough to wss
  } 
  //ended

  wss.handleUpgrade(req, socket, head, (ws) => {

    // metrics
    activeStreams.set(streamKey, {
      startedAt: Date.now(),
      bytesReceived: 0,
      clientIP: ws._socket.remoteAddress
    });
    ///
    handleStream(ws, streamKey);

    //
    if (!hlsStarted.has(streamKey)) { 
      hlsStarted.add(streamKey);

      (async () => { 
        try { 
          hlsFfmpeg(streamKey);
          console.log(`🔁 Auto-triggered HLS for ${streamKey}: ${response.data}`); 
        } catch (err) { 
          console.error(`❌ Failed to trigger HLS:`, err.message); 
        } 
      })(); 
    }
  });
});

// for status will be broken down into smalled pieces
statusWSS.on('connection', (ws) => { 
  const key = ws.streamKey; 
  if (!viewerStatus.has(key)){
    viewerStatus.set(key, new Set()); 
    viewerStatus.get(key).add(ws);
  }

  const broadcast = () => { 
    const viewers = viewerStatus.get(key).size; 
    const isLive = activeStreams.has(key); 
    const message = JSON.stringify({ status: isLive ? 'live' : 'waiting', viewers, }); 
    for (const client of viewerStatus.get(key)) { 
      if (client.readyState === WebSocket.OPEN) { 
        client.send(message); 
      } 
    } 
  };

  const interval = setInterval(broadcast, 3000); 
  ws.on('close', () => { 
    viewerStatus.get(key).delete(ws); 
    if (viewerStatus.get(key).size === 0){
      viewerStatus.delete(key); 
      clearInterval(interval); 
    }
  });

  broadcast(); 
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

  // ✅ Add this block right here:
  ffmpeg.on('error', (err) => {
    console.error(`FFmpeg process error for ${streamKey}:`, err.message);
    hlsStarted.delete(streamKey);
  });

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

  // when a data is received wether error or not.
  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.toLowerCase().includes('error')) {
      console.error(`FFmpeg error for ${streamKey}:`, text);
    } else {
      console.log(`FFmpeg for ${streamKey}:`, text);
    }
  });

  // when closed
  ffmpeg.on('close', (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    hlsStarted.delete(streamKey);
  });
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
