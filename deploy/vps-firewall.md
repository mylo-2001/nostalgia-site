# VPS firewall and host hardening

Run these commands directly on the VPS as `root` or with `sudo`. Do not run
them against the local development machine.

## UFW baseline

First confirm the SSH port. If SSH uses a port other than `22`, replace `22`
below before enabling the firewall. Keep the current SSH session open while
testing a second SSH session.

```bash
sudo apt update
sudo apt install -y ufw fail2ban

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP for ACME and redirect'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
sudo ufw status verbose
```

Only ports `22`, `80` and `443` should be publicly reachable. Do not open:

- `8000` — Node listens on loopback behind Nginx
- `5432` — PostgreSQL must not be public
- `55432` — test-only PostgreSQL port
- admin or monitoring ports unless a specific private-network rule exists

If PostgreSQL is self-hosted on the VPS, bind it to localhost or the private
network only and still keep `5432/tcp` closed to the Internet. If Docker is
used, check published ports separately because Docker rules can bypass a
simple UFW expectation:

```bash
sudo ss -lntup
sudo ufw status numbered
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

## SSH hardening

After confirming key-based login from a second terminal, configure the SSH
daemon according to the VPS provider's recovery process:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Validate before reloading:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

## Fail2ban

Enable the SSH jail after verifying SSH logs and the distribution's service
name:

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

## Go-live verification

From a different network, verify only `22`, `80` and `443` are exposed. From
the VPS, verify the app is listening only on loopback:

```bash
sudo ss -lntup
curl -I https://your-domain.example
sudo nginx -t
sudo systemctl status nostalgia --no-pager
```

Never commit VPS passwords, private keys, firewall dumps containing internal
addresses, or production `.env` files to the repository.
