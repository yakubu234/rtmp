import * as mediasoupClient from 'mediasoup-client';

let socket;
let pendingProducerCallback;
let device, producerTransport, consumerTransport;
let mode, room, streamKey, role;

function send(action, data = {}) {
  socket.send(JSON.stringify({ action, data }));
}

// 👇 Step 1: Extract from URL
const params = new URLSearchParams(location.search);
room = params.get("room") || "demo-room";
streamKey = params.get("key") || "demo-key"; // You can make this dynamic
role = location.pathname.includes("producer") ? "moderator" : "viewer";

// 👇 Step 2: Establish WebSocket and JOIN
socket = new WebSocket(`wss://${location.host}`);
socket.onopen = () => {
  console.log('Viewer Room:', room, 'Stream Key:', streamKey);

  send("join", { room, streamKey, role });
};

socket.onmessage = async ({ data }) => {
  const msg = JSON.parse(data);
  const { action, data: d } = msg;

  if (action === "joined") {
    device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: d.rtpCapabilities });
    // ✅ Only producers immediately createTransport
    if (mode === "producer") {
      send("createTransport", { direction: mode });
    }
  }

  if (action === "transportCreated") {
    const { direction, ...transportOptions } = d;

    const transport = direction === "producer"
      ? device.createSendTransport(transportOptions)
      : device.createRecvTransport(transportOptions);

    transport.on("connect", ({ dtlsParameters }, callback) => {
      send("connectTransport", { direction, dtlsParameters });
      callback();
    });

    if (direction === "producer") {
      transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
        pendingProducerCallback = callback;
        send("produce", { kind, rtpParameters });
      });

      producerTransport = transport;

      navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        document.getElementById("preview").srcObject = stream;
        const track = stream.getVideoTracks()[0];
        producerTransport.produce({ track });
      });
    }
    //  else {
    //   consumerTransport = transport;
    //   send("consume", { rtpCapabilities: device.rtpCapabilities });
    // }
  }

  // ✅ ADD THIS new if block
  if (action === "produced") {
    console.log('Producer WebSocket connected. Joining room:', room, 'with key:', streamKey, 'as role:', role);

    if (pendingProducerCallback) {
      pendingProducerCallback({ id: d.id });
      pendingProducerCallback = null;
    }
  }

  if (action === "consumed") {
    console.log('Viewer WebSocket connected. Joining room:', room, 'with key:', streamKey, 'as role:', role);

    const { kind, rtpParameters } = d;
    consumerTransport.consume({ id: d.id, producerId: d.producerId, kind, rtpParameters }).then((consumer) => {
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      
      const remoteVideo = document.getElementById("remote");
      remoteVideo.srcObject = stream;
      remoteVideo.play(); // ✅
    });
  }

  if (action === "error") {
    if (d.message.includes("No active producer")) {
      console.warn("Producer not ready yet. Retrying consume in 2s...");
      setTimeout(() => {
        send("consume", { rtpCapabilities: device.rtpCapabilities });
      }, 2000);
    } else {
      alert("🚫 Error: " + d.message);
    }
  }
};

window.startProducer = () => {
  mode = "producer";
};

window.startConsumer = () => {
  mode = "consumer";
};

if (window.location.pathname.includes('producer')) {
  startProducer();
}

if (window.location.pathname.includes('consumer')) {
  startConsumer();
}