<!-- http://localhost:9000/broadcaster.html -->

<!-- http://localhost:9000/viewer.html -->


One PeerJS server is shared for signaling

Real-time WebRTC peer-to-peer connection

Works best with STUN/TURN servers if you deploy publicly


 This minimal PeerJS solution WILL work — under the right conditions.
🔒 But here’s the catch:
WebRTC (which PeerJS uses under the hood) needs STUN/TURN servers to help devices discover and connect to each other across networks — especially behind NATs, firewalls, or different Wi-Fi networks.

🚦 So when does this minimal solution work?
Scenario	Will it Work?	Notes
🖥 Same local machine	✅ YES	Always works (loopback)
🧑‍🤝‍🧑 Same Wi-Fi/network	✅ YES	Usually works via LAN
🌍 Different networks (e.g., 4G vs. Wi-Fi)	⚠️ MAYBE	Depends on NAT/firewall; STUN may help
🧱 Strict firewall/enterprise network	❌ NO	Needs TURN server fallback
🧠 STUN vs TURN: Quick Primer
Server Type	What it does	Cost
STUN	Helps peers discover their public IP (cheap NAT traversal)	✅ Free (e.g., Google STUN)
TURN	Relays media when direct P2P fails	❗Requires bandwidth → can be $$