# Backend




## Database Server

the database server used is dgraph with mutation disabled.

### Installation
The commands should be exectued as `root`. For exposing dgraph via https we'll be using caddy.
Also this guide assumes that you have cloned the repository into `/data/covid19-research`

1. Install dgraph
```
# curl https://get.dgraph.io -sSf | bash -s -- --systemd -y
```

2. Disable mutations

Edit the systemd script in `/etc/systemd/system/dgraph-alpha.service`, and modifiy the `ExecStart` command adding the `--mutation disallow` parameter.
It should look like this:
```
ExecStart=/usr/bin/bash -c 'dgraph alpha --lru_mb 2048 -p /var/lib/dgraph/p -w /var/lib/dgraph/w  --mutations disallow'
```

and fix the dgraph installation by creating a symlink for bash
```
ln -s /bin/bash /usr/bin/bash
```

3. Reload services and restart dgraph
```
systemctl daemon-reload
service dgraph-alpha restart 
```

4. download and unzip the caddy binary from [this issue](https://github.com/metasphere-xyz/covid19-research/issues/9) to `/usr/local/bin/caddy`

```
apt install unzip
cd /tmp
curl -LO https://github.com/metasphere-xyz/covid19-research/files/4432331/caddy.zip
unzip caddy.zip 
mv caddy /usr/local/bin/caddy
chmod +x /usr/local/bin/caddy
```

5. Create caddy config folder
```
mkdir -p /etc/caddy 
mkdir -p /etc/ssl/caddy
chown www-data:www-data /etc/ssl/caddy && chmod 0700 /etc/ssl/caddy
```

6. Create the caddy config file in `/etc/caddy/Caddyfile`
paste the following content:

```
dev.metasphere.xyz {
    root /data/covid19-research/backend
    proxy  /query localhost:8080 {
	transparent
    }
}
```

7. create the systemd connfig for caddy in `/etc/systemd/system/caddy.service`

paste the following content:

```
[Unit]
Description=Caddy HTTP/2 web server
Documentation=https://caddyserver.com/docs
After=network-online.target
Wants=network-online.target systemd-networkd-wait-online.service

[Service]
#Restart=on-failure
StartLimitInterval=86400
StartLimitBurst=100

; User and group the process will run as.
User=www-data
Group=www-data

; Letsencrypt-issued certificates will be written to this directory.
Environment=CADDYPATH=/etc/ssl/caddy

; Always set "-root" to something safe in case it gets forgotten in the Caddyfile.
ExecStart=/usr/local/bin/caddy -log stdout -agree=true -conf=/etc/caddy/Caddyfile -root=/var/tmp
ExecReload=/bin/kill -USR1 $MAINPID

; Limit the number of file descriptors; see `man systemd.exec` for more limit settings.
LimitNOFILE=1048576
; Unmodified caddy is not expected to use more than that.
LimitNPROC=64

; Use private /tmp and /var/tmp, which are discarded after caddy stops.
PrivateTmp=true
; Use a minimal /dev
PrivateDevices=true
; Hide /home, /root, and /run/user. Nobody will steal your SSH-keys.
ProtectHome=true
; Make /usr, /boot, /etc and possibly some more folders read-only.
ProtectSystem=full
; … except /etc/ssl/caddy, because we want Letsencrypt-certificates there.
;   This merely retains r/w access rights, it does not add any new. Must still be writable on the host!
ReadWriteDirectories=/etc/ssl/caddy

; The following additional security directives only work with systemd v229 or later.
; They further retrict privileges that can be gained by caddy. Uncomment if you like.
; Note that you may have to add capabilities required by any plugins in use.
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
;NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

8. enable caddy service
```
systemctl enable caddy.service
service caddy start
```

9. check the logs
```
journalctl -fu dgraph-alpha
journalctl -fu caddy
```

## Hosting a test page locally

There is a test page in [test](./test) directory.
To host a test page on your `localhost`, please take the following steps,

1. Install Node modules.

    ```
    npm ci
    ```

2. Start a service.

    ```
    npm start
    ```

3. A test page will be served at [`http://localhost:9001`](http://localhost:9001).