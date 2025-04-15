// server.js
const express = require('express');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const server = app.listen(9000, () => {
    console.log('PeerJS server listening on http://localhost:9000');
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: '/'
});

app.use('/peerjs', peerServer);
app.use(express.static(path.join(__dirname)));
