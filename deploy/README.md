# Server-side auto-deploy

Because the GitHub Actions `deploy` job needs the `VPS_SSH_KEY` repo secret
(which requires repo-admin to set), this provides an alternative that runs on
the server itself: a systemd timer polls `origin/master` and rebuilds when it
advances. It coexists safely with the GitHub Actions deploy (a `flock` prevents
overlap, and it no-ops when the server is already at the latest commit).

## Install (run once on the server)

```bash
cd /opt/taranom
git pull origin master
sudo cp deploy/systemd/taranom-autodeploy.service /etc/systemd/system/
sudo cp deploy/systemd/taranom-autodeploy.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now taranom-autodeploy.timer
```

## Operate

```bash
# timer status / next run
systemctl status taranom-autodeploy.timer
systemctl list-timers taranom-autodeploy.timer

# trigger a deploy immediately
sudo systemctl start taranom-autodeploy.service

# view logs
journalctl -u taranom-autodeploy.service -n 100 --no-pager
```

The deploy script itself is `scripts/auto-deploy.sh`.
