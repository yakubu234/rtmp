AlnathProofyBromicRustly
Install prerequisite  on a linux server   

sudo apt-get update
sudo apt-get install -y build-essential libpcre3 libpcre3-dev libssl-dev zlib1g zlib1g-dev git ffmpeg

Download and install Nginx with RTMP:

```bash
cd /usr/local/src
sudo wget http://nginx.org/download/nginx-1.26.2.tar.gz
sudo tar -zxvf nginx-1.26.2.tar.gz
sudo git clone https://github.com/arut/nginx-rtmp-module.git
cd nginx-1.26.2
sudo ./configure --with-http_ssl_module --add-module=../nginx-rtmp-module
sudo make
sudo make install

```


Verify installation:
/usr/local/nginx/sbin/nginx -V


Install FFmpeg
FFmpeg is usually available in the official repositories:
sudo apt-get install ffmpeg


Install Node.js:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
source ~/.bashrc
nvm install --lts


2. Configure Nginx for RTMP Streaming
Edit the Nginx configuration file (/usr/local/nginx/conf/nginx.conf):
cd /usr/local/nginx/conf/sites-available  -> paths to conf file.
sudo mkdir -p /usr/local/nginx/sites-available /usr/local/nginx/sites-enabled
sudo nano /usr/local/nginx/sites-available/rtmp.conf

sudo ln -s /usr/local/nginx/sites-available/rtmp.conf /usr/local/nginx/sites-enabled/



worker_processes  auto;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    server {
        listen       8080;
        server_name  localhost;

        location / {
            root   html;
            index  index.html index.htm;
        }

        # Serving HLS segments
        location /hls {
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            root /tmp;
            add_header Cache-Control no-cache;
        }
    }
}

rtmp {
    server {
        listen 1935;  # RTMP listening port

        application live {
            live on;
            record off;

            # HLS configuration
            hls on;
            hls_path /tmp/hls;
            hls_fragment 3;
            hls_playlist_length 60;
        }
    }
}

Step 3: Modify the Main Nginx Configuration to Include Sites-Enabled
Edit the main Nginx configuration file (/usr/local/nginx/conf/nginx.conf) to include configurations from the sites-enabled directory:

bash
Copy code
sudo nano /usr/local/nginx/conf/nginx.conf
Add the following line within the http context (usually towards the end of the file):

nginx
Copy code
include /usr/local/nginx/sites-enabled/*;
Save the file and exit the editor.

Step 4: Test and Reload Nginx
Test the configuration to make sure there are no syntax errors:

bash
Copy code
sudo /usr/local/nginx/sbin/nginx -t
Reload Nginx to apply the new configuration:

bash
Copy code
sudo /usr/local/nginx/sbin/nginx -s reload
After editing, restart Nginx:

Stream Video Using FFmpeg
To stream a video from your local machine to the Nginx server using FFmpeg, run:
```bash
ffmpeg -re -i /path/to/your/video.mp4 -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ar 44100 -f flv rtmp://your-server-ip/live/stream
```


~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Run the Node.js server:

bash
Copy code
node index.js
5. Accessing the Stream
Visit http://localhost:3000 on your browser. The stream should be available for viewing.

6. Optional: Securing and Scaling
SSL: To secure the streaming, set up SSL certificates and configure Nginx to use HTTPS.
Scaling: Use multiple servers or a CDN to distribute the load if you expect a large number of viewers.
This setup provides a basic live video streaming server. You can further enhance it by adding features such as user authentication, stream recording, or adaptive bitrate streaming.

``````````````````` for the camera side ```` and optimization ``````
Run the Node.js Application:

bash
Copy code
node index.js
Stream to Nginx using FFmpeg:

You can use FFmpeg to capture the WebRTC stream and send it to your Nginx RTMP server. This will require some manual configuration to pipe the WebRTC stream to FFmpeg.

A possible command might look like this:

bash
Copy code
ffmpeg -i <input_stream> -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ar 44100 -f flv rtmp://your-server-ip/live/stream
Replace <input_stream> with the WebRTC stream source, which you might need to handle programmatically depending on your implementation.

2. Adaptive Bitrate Streaming Configuration
Adaptive bitrate streaming involves creating multiple stream variants with different bitrates and resolutions. You can achieve this using FFmpeg and Nginx.

A. Modify Nginx Configuration for HLS with Multiple Resolutions
Update your Nginx configuration (nginx.conf):

nginx
Copy code
rtmp {
    server {
        listen 1935;  # RTMP listening port

        application live {
            live on;
            record off;

            # HLS configuration with multiple qualities
            hls on;
            hls_path /tmp/hls;
            hls_nested on;
            hls_variant _low BANDWIDTH=640000;
            hls_variant _mid BANDWIDTH=1280000;
            hls_variant _hi BANDWIDTH=2560000;
        }
    }
}

B. Use FFmpeg to Generate Multiple Streams
To generate multiple quality streams from your source, you can use FFmpeg with the following command:

bash
Copy code
ffmpeg -re -i <input_stream> \
    -vf "scale=w=640:h=360:force_original_aspect_ratio=decrease" -c:a aac -ar 44100 -c:v libx264 -crf 23 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 4 -hls_segment_filename /tmp/hls/360p_%03d.ts -hls_playlist_type vod /tmp/hls/360p.m3u8 \
    -vf "scale=w=1280:h=720:force_original_aspect_ratio=decrease" -c:a aac -ar 44100 -c:v libx264 -crf 23 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 4 -hls_segment_filename /tmp/hls/720p_%03d.ts -hls_playlist_type vod /tmp/hls/720p.m3u8 \
    -vf "scale=w=1920:h=1080:force_original_aspect_ratio=decrease" -c:a aac -ar 44100 -c:v libx264 -crf 23 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 4 -hls_segment_filename /tmp/hls/1080p_%03d.ts -hls_playlist_type vod /tmp/hls/1080p.m3u8
Replace <input_stream> with your WebRTC stream source or another input stream.

3. Update Your Node.js Application to Serve ABR Stream
Update your index.html in the Node.js application to support ABR:

html
Copy code
<video id="video" width="640" height="360" controls>
    <source src="http://your-server-ip:8080/hls/720p.m3u8" type="application/x-mpegURL">
    Your browser does not support the video tag.
</video>
This video element will adapt to the available bandwidth and switch between the available qualities (360p, 720p, 1080p).

Summary
Set up a WebRTC application to capture video from your camera or screen.
Stream the captured video to Nginx using FFmpeg.
Configure Nginx for adaptive bitrate streaming with multiple qualities.
Serve the adaptive bitrate stream through your Node.js application.
This setup will allow you to stream from your home, support multiple devices and network conditions, and deliver a smooth streaming experience.




// Start streaming based on the chosen type
app.post('/start-stream', (req, res) => {
    const { type } = req.body; // Expect 'rtmp' or 'hls'
    const streamKey = `stream_${serverPeerId}`;

    if (type === 'rtmp') {
        // Spawn FFmpeg for RTMP
        const ffmpegRTMP = spawn('ffmpeg', [
            '-i', 'pipe:0',
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
            `rtmp://your-server-ip/live/${streamKey}`
        ]);

        ffmpegProcesses[streamKey] = ffmpegRTMP;

    }

    <!-- https://chatgpt.com/share/dc11e710-1673-41d2-8306-d81aa1734a64 -->