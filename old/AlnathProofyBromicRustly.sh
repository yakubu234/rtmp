AlnathProofyBromicRustly

sudo /usr/local/nginx/sbin/nginx -t
sudo mkdir -p /usr/local/nginx/sites-available /usr/local/nginx/sites-enabled
sudo nano /usr/local/nginx/sites-available/anthena.i.ng	
sudo ln -s /usr/local/nginx/sites-available/anthena.i.ng /usr/local/nginx/sites-enabled/

Step 3: Modify the Main Nginx Configuration to Include Sites-Enabled
Edit the main Nginx configuration file (/usr/local/nginx/conf/nginx.conf) to include configurations from the sites-enabled directory:

bash
Copy code
sudo nano /usr/local/nginx/conf/nginx.conf
Add the following line within the http context (usually towards the end of the file):

nginx
Copy code
include /usr/local/nginx/sites-enabled/*;

Step 4: Test and Reload Nginx
Test the configuration to make sure there are no syntax errors:

bash
Copy code
sudo /usr/local/nginx/sbin/nginx -t
Reload Nginx to apply the new configuration:

bash
Copy code
sudo /usr/local/nginx/sbin/nginx -s reload

Remove the Old PID File

If the PID file is corrupted or empty, you might need to remove it:

sh
Copy code
sudo rm /usr/local/nginx/logs/nginx.pid
Start Nginx Again

After removing the PID file, start Nginx again:

sh
Copy code
sudo /usr/local/nginx/sbin/nginx
This will create a new PID file and start Nginx.

Reload Configuration

Once Nginx is running, try reloading the configuration:

sh
Copy code
sudo /usr/local/nginx/sbin/nginx -s reload