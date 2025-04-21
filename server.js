import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  initializeMediasoup,
  getOrCreateRoom,
  getRoom,
  removePeerFromRoom
} from './mediasoupManager.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app.use(express.static(path.join(__dirname, 'public')));

const peers = new Map(); // socket.id => { peerId, roomName }

// Serve Vite build
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});
// app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const worker = await initializeMediasoup();

wss.on('connection', async (ws) => {
  const peerId = crypto.randomUUID();
  let roomName;

  ws.on('message', async (msg) => {
    const { action, data } = JSON.parse(msg);
    const streamKey = data.streamKey; // this will be used

    // uncomment if streamkey is being used 
    // if (!VALID_STREAM_KEYS[streamKey]) {
    //     ws.send(JSON.stringify({ action: "error", data: { message: "Invalid stream key" } }));
    //     ws.close();
    //   }

    if (action === 'join') {
      roomName = data.room;
      peers.set(ws, { peerId, roomName });
      const room = await getOrCreateRoom(worker, roomName);
      room.peers.set(peerId, { transports: [] });
      ws.send(JSON.stringify({ action: 'joined', data: { rtpCapabilities: room.router.rtpCapabilities } }));
    }

    if (action === 'createTransport') {
      const { direction } = data;
      const room = getRoom(roomName);
      const transport = await room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      room.peers.get(peerId).transports.push(transport);
      if (direction === 'producer') room.peers.get(peerId).producerTransport = transport;
      else room.peers.get(peerId).consumerTransport = transport;

      ws.send(JSON.stringify({
        action: 'transportCreated',
        data: {
          direction,
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        }
      }));
    }

    if (action === 'connectTransport') {
      const { direction, dtlsParameters } = data;
      const transport = direction === 'producer'
        ? getRoom(roomName).peers.get(peerId).producerTransport
        : getRoom(roomName).peers.get(peerId).consumerTransport;

      await transport.connect({ dtlsParameters });
    }

    if (action === 'produce') {
      const { kind, rtpParameters } = data;
      const transport = getRoom(roomName).peers.get(peerId).producerTransport;
      const producer = await transport.produce({ kind, rtpParameters });
      getRoom(roomName).peers.get(peerId).producer = producer;
      ws.send(JSON.stringify({ action: 'produced', data: { id: producer.id } }));
    }

    if (action === 'consume') {
      const { rtpCapabilities } = data;
      const room = getRoom(roomName);
      const producer = Array.from(room.peers.values()).find(p => p.producer)?.producer;
      const consumerTransport = room.peers.get(peerId).consumerTransport;

      const consumer = await consumerTransport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: false
      });

      room.peers.get(peerId).consumer = consumer;

      ws.send(JSON.stringify({
        action: 'consumed',
        data: {
          id: consumer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        }
      }));
    }
  });

  ws.on('close', () => {
    if (roomName) removePeerFromRoom(roomName, peerId);
    peers.delete(ws);
  });
});

server.listen(4000, () => {
  console.log('🚀 mediasoup preview server running at http://localhost:3000');
});
