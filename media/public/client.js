let socket;
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
socket = new WebSocket(`ws://${location.host}`);
socket.onopen = () => {
  send("join", { room, streamKey, role });
};

socket.onmessage = async ({ data }) => {
  const msg = JSON.parse(data);
  const { action, data: d } = msg;

  if (action === "joined") {
    device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: d.rtpCapabilities });
    send("createTransport", { direction: mode });
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
      producerTransport = transport;

      navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        document.getElementById("preview").srcObject = stream;
        const track = stream.getVideoTracks()[0];
        producerTransport.produce({ track }).then(({ id }) => {
          send("produce", { kind: "video", rtpParameters: track.getSettings() });
        });
      });
    } else {
      consumerTransport = transport;
      send("consume", { rtpCapabilities: device.rtpCapabilities });
    }
  }

  if (action === "consumed") {
    const { kind, rtpParameters } = d;
    consumerTransport.consume({ id: d.id, producerId: d.producerId, kind, rtpParameters }).then((consumer) => {
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      document.getElementById("remote").srcObject = stream;
    });
  }

  if (action === "error") {
    alert("🚫 Error: " + d.message);
  }
};

window.startProducer = () => {
  mode = "producer";
};

window.startConsumer = () => {
  mode = "consumer";
};
