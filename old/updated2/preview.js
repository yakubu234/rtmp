// preview.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 4000; // run this separately from index.js

app.use(express.static(path.join(__dirname, 'public')));

// Start HLS generation from RTMP
app.get('/generate-hls/:streamKey', (req, res) => {
    const streamKey = req.params.streamKey;

    const outputDir = `/tmp/hls/${streamKey}`;
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const ffmpeg = spawn('ffmpeg', [
        '-i', `rtmp://localhost/live/${streamKey}`,
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

    ffmpeg.stderr.on('data', (data) => {
        console.error(`FFmpeg stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
    });

    res.send(`Started HLS generation for stream: ${streamKey}`);
});

// List active streams (optional)
app.get('/', (req, res) => {
    const streamsDir = '/tmp/hls';
    const streams = fs.readdirSync(streamsDir);
    let html = `<h1>Available Streams</h1><ul>`;
    streams.forEach(stream => {
        html += `<li><a href="/watch/${stream}">${stream}</a></li>`;
    });
    html += `</ul>`;
    res.send(html);
});

// Watch a stream
app.get('/watch/:streamKey', (req, res) => {
    const streamKey = req.params.streamKey;
    res.send(`
        <h1>Watching Stream: ${streamKey}</h1>
        <video id="video" width="640" height="360" controls autoplay>
            <source src="/hls/${streamKey}/master.m3u8" type="application/x-mpegURL">
            Your browser does not support the video tag.
        </video>
    `);
});

// Serve HLS segments
app.use('/hls', express.static('/tmp/hls'));

app.listen(port, () => {
    console.log(`Preview server running on http://localhost:${port}`);
});
// http://localhost:4000/watch/stream_key
