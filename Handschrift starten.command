#!/bin/bash
# Doppelklicken startet Handschrift. Mehr braucht es nicht.
cd "$(dirname "$0")" || exit 1

printf '\n  Handschrift\n  ───────────\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf '  Node fehlt noch.\n'
  printf '  Hol es bei https://nodejs.org — Version 20 oder neuer.\n'
  printf '  Danach diese Datei nochmal doppelklicken.\n\n'
  read -r -p '  Enter zum Schliessen '
  exit 1
fi

if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  printf '  Node %s ist zu alt — Handschrift braucht 20 oder neuer.\n' "$(node -v)"
  printf '  Neue Version bei https://nodejs.org\n\n'
  read -r -p '  Enter zum Schliessen '
  exit 1
fi

# Kein npm install: Handschrift hat keine Abhängigkeiten.

# Den Browser macht der Server selbst auf, sobald er wirklich lauscht — und
# zwar auf dem Port, den er bekommen hat. Hier stand früher eine eigene
# Warteschleife dafür; die riet den Port nur und lag daneben, sobald der
# gewohnte belegt war.
printf '  Dieses Fenster offen lassen. Zum Beenden: Strg+C\n\n'
node server/index.js
