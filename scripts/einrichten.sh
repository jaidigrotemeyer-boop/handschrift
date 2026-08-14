#!/bin/bash
# Handschrift einrichten — ein Befehl, dann läuft es.
#
#   curl -fsSL https://raw.githubusercontent.com/jaidigrotemeyer-boop/handschrift/main/scripts/einrichten.sh | bash
#
# Anders als install.sh baut das hier keine Mac-App, sondern holt den Quelltext,
# prüft alles Nötige, startet den Server und sagt am Ende genau, was noch von
# Hand fehlt. Läuft auf macOS und Linux.
set -euo pipefail

REPO="${HANDSCHRIFT_REPO:-https://github.com/jaidigrotemeyer-boop/handschrift}"
ZWEIG="${HANDSCHRIFT_ZWEIG:-main}"
ZIEL="${HANDSCHRIFT_ZIEL:-$HOME/handschrift}"
PORT="${PORT:-3018}"

blau()  { printf '\033[36m%s\033[0m\n' "$1"; }
gruen() { printf '\033[32m%s\033[0m\n' "$1"; }
gelb()  { printf '\033[33m%s\033[0m\n' "$1"; }
rot()   { printf '\033[31m%s\033[0m\n' "$1"; }

offen=()

printf '\n'
blau '  Handschrift einrichten'
printf '  ──────────────────────\n\n'

# ── Node ─────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  rot '  Node fehlt.'
  printf '  Hol es bei https://nodejs.org — Version 20 oder neuer, dann nochmal.\n\n'
  exit 1
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  rot "  Node $(node -v) ist zu alt — Handschrift braucht 20 oder neuer."
  printf '\n'
  exit 1
fi
printf '  ✓ Node %s\n' "$(node -v)"

# ── Quelltext holen oder auffrischen ─────────────────────────────────
if [ -d "$ZIEL/.git" ]; then
  printf '  … frischt %s auf\n' "$ZIEL"
  git -C "$ZIEL" fetch --quiet origin "$ZWEIG"
  git -C "$ZIEL" checkout --quiet "$ZWEIG"
  git -C "$ZIEL" reset --quiet --hard "origin/$ZWEIG"
else
  printf '  … lädt nach %s\n' "$ZIEL"
  # Mit und ohne .git versuchen: GitHub-URLs mögen beides, ein lokaler Pfad
  # oder eine URL, die schon darauf endet, verträgt das Anhängen nicht.
  if ! git clone --quiet --branch "$ZWEIG" "${REPO%.git}.git" "$ZIEL" 2>/dev/null &&
     ! git clone --quiet --branch "$ZWEIG" "$REPO" "$ZIEL" 2>/dev/null; then
    rot "  Konnte $REPO nicht laden."
    printf '  Gibt es den Zweig "%s"? Steht das Repo auf öffentlich?\n' "$ZWEIG"
    printf '  Bei privat antwortet GitHub mit 404, als gäbe es das Repo nicht.\n\n'
    exit 1
  fi
fi
cd "$ZIEL"
printf '  ✓ Quelltext da (keine Pakete nötig)\n'

# ── Selbsttest ───────────────────────────────────────────────────────
if node pruefe.mjs > /tmp/handschrift-pruefung.txt 2>&1; then
  printf '  ✓ %s\n' "$(tail -2 /tmp/handschrift-pruefung.txt | head -1 | xargs)"
else
  gelb "  ! Selbsttest meckert — siehe /tmp/handschrift-pruefung.txt"
fi

# ── Gehirn fürs Umschreiben ──────────────────────────────────────────
if curl -s -m 2 -o /dev/null "http://127.0.0.1:11434/api/tags"; then
  printf '  ✓ Ollama läuft — Umschreiben geht ohne Schlüssel\n'
  if ! curl -s -m 2 "http://127.0.0.1:11434/api/tags" | grep -q '"name"'; then
    gelb '  ! Ollama hat noch kein Modell'
    offen+=("Ein Modell holen:  ollama pull llama3.2:3b")
  fi
elif command -v ollama >/dev/null 2>&1; then
  gelb '  ! Ollama ist da, läuft aber nicht'
  offen+=("Ollama starten:  ollama serve   (danach: ollama pull llama3.2:3b)")
else
  gelb '  – kein Ollama gefunden'
  offen+=("Fürs Umschreiben eins von beidem: Ollama installieren (ollama.com) oder einen Gratis-Schlüssel in den Einstellungen eintragen (aistudio.google.com/apikey)")
fi

# ── Tippen ───────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin)
    if command -v cliclick >/dev/null 2>&1; then
      printf '  ✓ cliclick da — tippt flott\n'
    else
      gelb '  – cliclick fehlt (geht auch ohne, nur langsamer)'
      offen+=("Schneller tippen:  brew install cliclick")
    fi
    offen+=("Beim ersten Tippen fragt macOS nach Bedienungshilfen — erlauben. Fragt es nicht: Systemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen → Terminal anhaken.")
    ;;
  Linux)
    if command -v xdotool >/dev/null 2>&1; then
      printf '  ✓ xdotool da\n'
    else
      gelb '  – xdotool fehlt, ohne das tippt nichts'
      offen+=("Tippen freischalten:  sudo apt install xdotool")
    fi
    ;;
esac

# ── Starten ──────────────────────────────────────────────────────────
printf '\n'
gruen "  Fertig. Handschrift startet auf http://localhost:$PORT"
if [ ${#offen[@]} -gt 0 ]; then
  printf '\n  Das fehlt noch:\n'
  for z in "${offen[@]}"; do printf '    • %s\n' "$z"; done
fi
printf '\n  Fenster offen lassen. Zum Beenden: Strg+C\n\n'

# Der Browser geht erst auf, wenn der Server wirklich antwortet.
(
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "http://localhost:$PORT"; then
      command -v open >/dev/null 2>&1 && open "http://localhost:$PORT"
      command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT" >/dev/null 2>&1
      exit 0
    fi
    sleep 0.5
  done
) &

PORT="$PORT" exec node server/index.js
