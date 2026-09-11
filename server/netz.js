// Vom iPad aus — also von einem anderen Gerät im selben WLAN.
//
// Auf dem iPad selbst kann Handschrift nicht laufen: es gibt dort kein Node,
// und vor allem darf unter iPadOS keine App in eine andere hineintippen. Das
// ist keine Lücke, die sich schließen ließe, sondern die Bauart des Systems.
//
// Was geht, ist die Arbeitsteilung: das iPad ist der Bildschirm, der Mac bleibt
// die Hand. Messen, Auftrennen, Umschreiben laufen ohnehin auf dem Server, und
// getippt wird dort, wo Handschrift läuft.
//
// Dafür muss der Server aus dem WLAN erreichbar sein, und genau da hört der
// Spaß auf. Wer die Seite öffnen kann, kann den Mac tippen lassen — in das
// Fenster, das dort gerade vorn ist. Das ist Fernsteuerung, nicht Textverarbeitung.
// Darum:
//
//   1. Ungefragt passiert das nie. Ohne HANDSCHRIFT_NETZ=1 hört Handschrift
//      wie bisher nur auf 127.0.0.1.
//   2. Wer hereinkommt, braucht die Geheimzahl, die beim Start im Terminal
//      steht. Sie gilt, solange der Server läuft.
import os from 'node:os'
import crypto from 'node:crypto'

export const netzOffen = () => process.env.HANDSCHRIFT_NETZ === '1'

// Sechs Ziffern, zufällig, bei jedem Start neu. Kurz genug zum Abtippen auf
// einem iPad, lang genug, dass Raten im WLAN nicht lohnt — zumal jeder
// Fehlversuch gezählt wird.
export const geheimzahl = netzOffen() ? String(crypto.randomInt(100000, 1000000)) : null

// Gegen Durchprobieren: nach zwanzig falschen Zahlen ist für fünf Minuten Ruhe.
// Ohne das wären sechs Ziffern in ein paar Minuten durch.
let fehlversuche = 0
let gesperrtBis = 0

export function pruefen(req) {
  if (!netzOffen()) return { ok: true }
  // Vom Rechner selbst bleibt alles wie vorher — dort ist keine Zahl nötig.
  const woher = req.socket.remoteAddress || ''
  if (woher === '127.0.0.1' || woher === '::1' || woher === '::ffff:127.0.0.1') return { ok: true }

  if (Date.now() < gesperrtBis)
    return { ok: false, code: 429, fehler: 'Zu viele falsche Geheimzahlen. In fünf Minuten wieder versuchen.' }

  const gegeben = String(req.headers['x-handschrift-zahl'] || '')
  // Zeitgleicher Vergleich: sonst verrät die Dauer, wie viele Ziffern stimmen.
  const gleich =
    gegeben.length === geheimzahl.length &&
    crypto.timingSafeEqual(Buffer.from(gegeben), Buffer.from(geheimzahl))
  if (gleich) {
    fehlversuche = 0
    return { ok: true }
  }

  if (++fehlversuche >= 20) {
    gesperrtBis = Date.now() + 5 * 60 * 1000
    fehlversuche = 0
  }
  return { ok: false, code: 401, fehler: 'Geheimzahl fehlt oder stimmt nicht. Sie steht im Terminal auf dem Rechner.' }
}

/** Unter welchen Adressen ist der Rechner im eigenen Netz zu erreichen? */
export function netzAdressen() {
  const raus = []
  for (const [name, liste] of Object.entries(os.networkInterfaces())) {
    for (const a of liste || []) {
      // Nur IPv4 und nichts Internes: eine fe80::-Adresse tippt niemand ab.
      if (a.family !== 'IPv4' || a.internal) continue
      raus.push({ name, adresse: a.address })
    }
  }
  return raus
}

/** Was beim Start im Terminal stehen soll, wenn das Netz offen ist. */
export function netzHinweis(port) {
  const adressen = netzAdressen()
  const zeilen = [
    '',
    '  ── Vom iPad aus ──────────────────────────────',
    adressen.length
      ? adressen.map((a) => `  http://${a.adresse}:${port}   (${a.name})`).join('\n')
      : '  Keine Netzadresse gefunden — hängt der Rechner im WLAN?',
    `  Geheimzahl: ${geheimzahl}`,
    '',
    '  Die Seite fragt einmal danach. Sie gilt, bis Handschrift beendet wird.',
    '  Wer sie hat, kann diesen Rechner tippen lassen — also nur im',
    '  eigenen WLAN und nicht im Café-Netz.',
    '  ──────────────────────────────────────────────',
    '',
  ]
  return zeilen.join('\n')
}
