const express = require('express');
const { ExpressPeerServer } = require('peer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
let serverPeerId;

const app = express();
const port = 4000; // run this separately from index.js

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());


// Start HLS generation from RTMP
app.get('/generate-hls/:streamKey', (req, res) => {
    const streamKey = req.params.streamKey;

    const outputDir = `/tmp/hls/${streamKey}`;
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const ffmpeg = spawn('ffmpeg', [
        '-i', `rtmp://104.251.217.179/live/${streamKey}`,
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

const server = app.listen(port, () => {
    console.log('Streaming Source server running on http://localhost:3001');
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
});

app.use('/peerjs', peerServer);

let activeStreams = [];

// Function to add a new stream to the list
function addStream(streamKey) {
    activeStreams.push(streamKey);
}

// Function to remove a stream from the list
function removeStream(streamKey) {
    activeStreams = activeStreams.filter(key => key !== streamKey);
}

// Function to get the list of active streams
function getActiveStreams() {
    return activeStreams;
}

// Capture server's Peer ID and expose it via an API
peerServer.on('connection', (client) => {
    serverPeerId = client.id;
    console.log(`Server connected with ID: ${serverPeerId}`);
});

// Start FFmpeg when a call is received
    peerServer.on('call', (call) => {
        call.answer(); // Answer the call, triggering the stream event

        call.on('stream', (remoteStream) => {
            const streamKey =  `stream_${serverPeerId}`;
            addStream(streamKey);

            // Spawn FFmpeg with the input stream from the call
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0', // Input from stdin
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-maxrate', '3000k',
                '-bufsize', '6000k',
                '-pix_fmt', 'yuv420p',
                '-g', '50',
                '-c:a', 'aac',
                '-b:a', '160k',
                '-ar', '44100',
                '-f', 'flv',
                `rtmp://104.251.217.179/live/${streamKey}` // Replace with your server's IP or domain
            ]);

            // Pipe the incoming WebRTC stream to FFmpeg
            remoteStream.pipe(ffmpeg.stdin);

            // Log FFmpeg output
            ffmpeg.stdout.on('data', (data) => {
                console.log(`FFmpeg stdout: ${data}`);
            });

            ffmpeg.stderr.on('data', (data) => {
                console.error(`FFmpeg stderr: ${data}`);
            });

            ffmpeg.on('close', (code) => {
                console.log(`FFmpeg process exited with code ${code}`);
                removeStream(streamKey);
            });
        });
    });

app.get('/server-peer-id', (req, res) => {
    res.json({ id: serverPeerId });
});

app.get('/start-broadcast', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
     // Construct the path to the index.html file in the public directory
    //  const indexPath = path.join(__dirname, 'public', 'index.html');

    //  // Send the index.html file as the response
    //  res.sendFile(indexPath);
});

app.post('/end-stream', (req, res) => {
    const { streamKey } = req.body;

    // Logic to terminate the FFmpeg process for the stream
    if (streamKey && activeStreams.includes(streamKey)) {
        removeStream(streamKey);
        console.log(`Stream ${streamKey} has ended.`);
        res.status(200).send('Stream ended successfully');
    } else {
        res.status(400).send('Invalid stream key');
    }
});

