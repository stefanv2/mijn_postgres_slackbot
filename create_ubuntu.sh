#!/bin/bash

CONTAINER_NAME=$1
CONTAINER_IP=$2
PORT_MAPPING=$3
SSH_PUBKEY=$(cat /home/stefan/.ssh/id_rsa.pub)

if [[ -z "$CONTAINER_NAME" || -z "$CONTAINER_IP" ]]; then
  echo "Gebruik: $0 <container_naam> <ip_adres> \"<poortmapping bv 2224:22 5432:5432>\""
  exit 1
fi

# Verwijder bestaande container als die bestaat
docker rm -f "$CONTAINER_NAME" 2>/dev/null

# Start de container
docker run -dit \
  --name "$CONTAINER_NAME" \
  --hostname "$CONTAINER_NAME" \
  --network ansible-net \
  --ip "$CONTAINER_IP" \
  $(for port in $PORT_MAPPING; do echo -n "-p $port "; done) \
  ubuntu:20.04

# Installeer benodigde tools + stel SSH in
docker exec -i "$CONTAINER_NAME" bash -c "
  export DEBIAN_FRONTEND=noninteractive &&
  apt update &&
  apt install -y openssh-server sudo curl iputils-ping net-tools vim &&
  useradd -m ansible &&
  echo 'ansible ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ansible &&
  mkdir -p /home/ansible/.ssh &&
  echo \"$SSH_PUBKEY\" > /home/ansible/.ssh/authorized_keys &&
  chown -R ansible:ansible /home/ansible/.ssh &&
  chmod 700 /home/ansible/.ssh &&
  chmod 600 /home/ansible/.ssh/authorized_keys &&
  service ssh restart
"

# Verwijder oude key uit known_hosts (handig bij rebuilds)
sudo -u "$SUDO_USER" ssh-keygen -R "$CONTAINER_IP" >/dev/null 2>&1

# Forceer acceptatie van nieuwe SSH-host key
sudo -u "$SUDO_USER" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -q ansible@"$CONTAINER_IP" exit

echo "✅ Container $CONTAINER_NAME aangemaakt op $CONTAINER_IP en bereikbaar via poorten: $PORT_MAPPING"

