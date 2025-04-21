const express = require('express');
const { ExpressPeerServer } = require('peer');
const { spawn } = require('child_process');
const path = require('path');
let serverPeerId;

const app = express();
const server = app.listen(3001, () => {
    console.log('Streaming Source server running on http://localhost:3001');
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
});

app.use('/peerjs', peerServer);
app.use(express.static(path.join(__dirname, 'public')));

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
                `rtmp://your-server-ip/live/${streamKey}` // Replace with your server's IP or domain
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

