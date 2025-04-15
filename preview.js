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
                '-g', '50',
                '-map', '0:v:0', '-s:v:0', '640x360', '-b:v:0', '800k', '-maxrate:v:0', '856k', '-bufsize:v:0', '1200k', '-b:a:0', '96k',
                '-map', '0:v:0', '-s:v:1', '1280x720', '-b:v:1', '2800k', '-maxrate:v:1', '2996k', '-bufsize:v:1', '4200k', '-b:a:1', '128k',
                '-map', '0:v:0', '-s:v:2', '1920x1080', '-b:v:2', '5000k', '-maxrate:v:2', '5350k', '-bufsize:v:2', '7500k', '-b:a:2', '192k',
                '-f', 'hls',
                '-hls_time', '6',
                '-hls_playlist_type', 'vod',
                '-master_pl_name', 'master.m3u8',
                '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
                `http://your-server-ip:8080/hls/${streamKey}.m3u8` // Output location for each resolution
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

app.get('/', (req, res) => {
    const streams = getActiveStreams();
    let streamList = streams.map(stream => `
        <li><a href="/watch?stream=${stream}">Watch Stream: ${stream}</a></li>
    `).join('');

    res.send(`
        <h1>Available Streams</h1>
        <ul>
            ${streamList}
        </ul>
    `);
});

app.get('/watch', (req, res) => {
    const stream = req.query.stream;
    res.send(`
        <h1>Watching Stream: ${stream}</h1>
        <video id="video" width="640" height="360" controls autoplay>
            <source src="http://your-server-ip:8080/hls/${stream}/master.m3u8" type="application/x-mpegURL">
            Your browser does not support the video tag.
        </video>
    `);
});


// https://stackoverflow.com/questions/49213850/multiple-party-peer-js-application
// https://github.com/mluketin/peerjs-helloworld-conference/blob/master/index.html
// https://stackoverflow.com/questions/72092677/peerjs-on-node-cannot-connect-sender-receiver
// https://github.com/spine001/working_peer_js_WebRTC_Nodejs_example/blob/main/views/room.ejs
// https://stackoverflow.com/questions/61428318/is-there-any-working-example-that-uses-nodejs-peerjs
// https://www.google.com/search?q=peerjs+nodejs&oq=peerjs+no&gs_lcrp=EgZjaHJvbWUqBwgBEAAYgAQyBggAEEUYOTIHCAEQABiABDIICAIQABgWGB4yCAgDEAAYFhgeMggIBBAAGBYYHjIKCAUQABgPGBYYHjIMCAYQABgKGA8YFhgeMggIBxAAGBYYHjIICAgQABgWGB4yCAgJEAAYFhge0gEINjM4MGowajeoAgCwAgA&sourceid=chrome&ie=UTF-8