import { createWorker } from 'mediasoup';

const mediasoupConfig = {
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
    },
  ],
};

const rooms = new Map(); // roomName => { router, peers }

export async function initializeMediasoup() {
  const worker = await createWorker();
  console.log('✅ mediasoup worker created');
  return worker;
}

export async function getOrCreateRoom(worker, roomName) {
  if (rooms.has(roomName)) return rooms.get(roomName);

  // here try to authenticate before creating a room
  const router = await worker.createRouter({ mediaCodecs: mediasoupConfig.mediaCodecs });
  const peers = new Map(); // peerId => { transports, producer, consumer }

  rooms.set(roomName, { router, peers });
  console.log(`🆕 Created new room: ${roomName}`);
  return rooms.get(roomName);
}

export function getRoom(roomName) {
  return rooms.get(roomName);
}

export function removePeerFromRoom(roomName, peerId) {
    // authenticate before removing someone from the room
  const room = rooms.get(roomName);
  if (!room) return;
  const peer = room.peers.get(peerId);
  if (!peer) return;

  // Cleanup all transports and media
  peer.transports.forEach(t => t.close());
  if (peer.producer) peer.producer.close();
  if (peer.consumer) peer.consumer.close();

  room.peers.delete(peerId);
  console.log(`❌ Cleaned up peer ${peerId} from room ${roomName}`);
}
