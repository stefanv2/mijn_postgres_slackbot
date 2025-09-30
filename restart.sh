#!/bin/bash

HOSTS_FILE="hosts.ini"

# Alleen regels die een geldige hostnaam bevatten (geen = teken)
CONTAINERS=$(grep -vE '^$|^#|\[' "$HOSTS_FILE" | awk '$1 !~ /=/ {print $1}' | sort -u)

echo "🚀 Containers starten:"
for c in $CONTAINERS; do
  echo "➡️ docker start $c"
  sudo docker start "$c" >/dev/null 2>&1
done

echo "🔄 SSH herstarten in containers:"
for c in $CONTAINERS; do
  echo "➡️ SSH restart in $c"
  sudo docker exec -it "$c" service ssh restart
done

echo "📡 Ansible ping controle:"
ansible -i hosts.ini all -m ping

