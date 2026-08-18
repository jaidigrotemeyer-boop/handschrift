// Handschrift — kleiner lokaler Server, damit die Oberfläche im Browser laufen
// kann. Bewusst mit dem eingebauten http-Modul und ohne ein einziges Paket:
// „npm install" lädt so gar nichts, und die App bleibt für sich.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messen } from './messen.js'
import { zeichenPlan, aufDauer, dauerLesen, abspielen, zeitText, MAX_DAUER_MS } from './tippen.js'
import { umschreiben, anbieter, textArt } from './gehirn.js'
import { istVerklebt, entwirren } from './entwirren.js'
import { stand as fassung, standText } from './stand.js'
import { nachsehen, holen, istGitOrdner } from './aktualisieren.js'
import { spawn } from 'node:child_process'
import { zeichen, bereit, SYSTEM, sondertastenFinden } from './schreiben.js'
import { lesen, schreiben, oeffentlich } from './config.js'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT) || 3018

// Immer nur ein Tipp-Lauf. Zwei gleichzeitig würden sich im selben Fenster
// die Zeichen ineinander schreiben.
let lauf = null

async function tippenStarten({ text, dauer, zeichenProMinute, vorlauf = 5 }) {
  if (lauf?.laeuft) throw new Error('Es läuft schon ein Tipp-Lauf. Erst stoppen.')
  const plan = aufDauer(zeichenPlan(text, { zeichenProMinute }), dauerLesen(dauer))
  const schnitt = plan.gesamtMs / Math.max(1, plan.schritte.length)
  if (schnitt < 45)
    throw new Error(
      `Zu schnell für Tastendruck um Tastendruck (∅ ${Math.round(schnitt)} ms). Nimm eine längere Dauer.`,
    )

  const abbruch = new AbortController()
  lauf = {
    laeuft: true,
    phase: 'vorlauf',
    getippt: 0,
    gesamt: plan.schritte.length,
    gesamtMs: plan.gesamtMs,
    bis: Date.now() + vorlauf * 1000,
    abbruch,
    fehler: null,
  }

  // Erst der Vorlauf: Zeit, ins Zielfenster zu klicken. Ohne den landet der
  // Anfang des Textes in Handschrift selbst statt im Dokument.
  ;(async () => {
    try {
      // Einmalig auf dem Mac: herausfinden, wie ein Leerzeichen und wie ein
      // Zeilenumbruch hier wirklich ankommen. Das muss vor dem Vorlauf
      // passieren, denn dabei geht TextEdit kurz auf — währenddessen ins
      // Zielfenster zu klicken wäre vergeblich.
      //
      // Beide zusammen, denn beide gehen einzeln verloren: ohne Leerzeichen
      // kleben die Wörter, ohne Umbruch klebt das ganze Dokument.
      if (SYSTEM === 'darwin' && !(lesen().leerzeichenWeg && lesen().umbruchWeg)) {
        lauf.phase = 'kalibriert'
        const such = await sondertastenFinden().catch(() => null)
        lauf.kalibriert = [
          `Leerzeichen: ${such?.leer?.sieger || 'keiner'}`,
          `Umbruch: ${such?.umbruch?.sieger || 'keiner'}`,
        ].join(', ')
        lauf.bis = Date.now() + vorlauf * 1000
      }
      // Der Horcher wird wieder abgenommen. warte() läuft einmal pro Zeichen —
      // bei einem langen Text sammelten sich sonst zehntausende Horcher auf
      // demselben Signal an, mitsamt Warnung und wachsendem Speicher.
      const warte = (ms) =>
        new Promise((fertig, schief) => {
          if (abbruch.signal.aborted) return schief(Object.assign(new Error('Gestoppt.'), { name: 'AbortError' }))
          const abbrechen = () => {
            clearTimeout(t)
            schief(Object.assign(new Error('Gestoppt.'), { name: 'AbortError' }))
          }
          const t = setTimeout(() => {
            abbruch.signal.removeEventListener('abort', abbrechen)
            fertig()
          }, ms)
          abbruch.signal.addEventListener('abort', abbrechen, { once: true })
        })
      await warte(vorlauf * 1000)
      lauf.phase = 'tippt'
      lauf.bis = Date.now() + plan.gesamtMs
      await abspielen(plan, {
        tippe: zeichen,
        warte,
        signal: abbruch.signal,
        melde: ({ getippt }) => (lauf.getippt = getippt),
      })
      lauf.getippt = lauf.gesamt
    } catch (err) {
      if (err?.name !== 'AbortError') lauf.fehler = err.message
    } finally {
      lauf.laeuft = false
      lauf.phase = 'fertig'
    }
  })()

  return { gesamt: plan.schritte.length, dauer: zeitText(plan.gesamtMs), vorlauf }
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }

function json(res, code, daten) {
  const text = JSON.stringify(daten)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) })
  res.end(text)
}

function koerper(req) {
  return new Promise((fertig, schief) => {
    let roh = ''
    req.on('data', (stueck) => {
      roh += stueck
      // Ohne Deckel könnte ein versehentlicher Riesen-Upload den Speicher füllen.
      if (roh.length > 5_000_000) schief(new Error('Text zu groß (über 5 MB).'))
    })
    req.on('end', () => {
      try {
        fertig(roh ? JSON.parse(roh) : {})
      } catch {
        schief(new Error('Konnte die Anfrage nicht lesen.'))
      }
    })
    req.on('error', schief)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const weg = url.pathname

  try {
    if (req.method === 'GET' && (weg === '/' || weg === '/index.html')) {
      const datei = path.join(WURZEL, 'web', 'index.html')
      const inhalt = fs.readFileSync(datei)
      res.writeHead(200, { 'content-type': TYPEN['.html'], 'content-length': inhalt.length })
      return res.end(inhalt)
    }

    if (req.method === 'GET' && weg === '/api/stand') {
      const gehirne = await anbieter()
      return json(res, 200, {
        einstellungen: oeffentlich(),
        gehirn: gehirne.length > 0,
        gehirne: gehirne.map((g) => g.name),
        tippen: await bereit(),
        system: SYSTEM,
        stand: fassung,
        neu: await nachsehen(),
        maxStunden: MAX_DAUER_MS / 3600000,
        lauf: lauf && {
          laeuft: lauf.laeuft,
          phase: lauf.phase,
          getippt: lauf.getippt,
          gesamt: lauf.gesamt,
          kalibriert: lauf.kalibriert,
          restMs: Math.max(0, lauf.bis - Date.now()),
          fehler: lauf.fehler,
        },
      })
    }

    if (req.method === 'POST' && weg === '/api/messen') {
      const roh = String((await koerper(req)).text || '')
      return json(res, 200, { ...messen(roh), art: textArt(roh), verklebt: istVerklebt(roh) })
    }

    if (req.method === 'POST' && weg === '/api/entwirren') {
      const roh = String((await koerper(req)).text || '')
      const r = entwirren(roh)
      return json(res, 200, { ...r, ...messen(r.text), art: textArt(r.text), verklebt: istVerklebt(r.text) })
    }

    if (req.method === 'POST' && weg === '/api/umschreiben') {
      const { text, ton, extra } = await koerper(req)
      return json(res, 200, await umschreiben(text, { ton: ton || lesen().ton, extra }))
    }

    if (req.method === 'POST' && weg === '/api/tippen') {
      const daten = await koerper(req)
      if (!String(daten.text || '').length) throw new Error('Kein Text da.')
      // Ohne Absätze kommt der Text auch ohne Absätze im Dokument an. Das ist
      // selten gewollt und ärgert erst, wenn schon alles getippt ist.
      if (istVerklebt(daten.text) && !daten.trotzdem)
        throw new Error(
          'Dieser Text hat keine Absätze — so landet er auch im Dokument. Erst „Absätze wiederherstellen" drücken, oder das Tippen noch einmal starten, um es trotzdem zu tun.',
        )
      return json(res, 200, await tippenStarten(daten))
    }

    if (req.method === 'POST' && weg === '/api/aktualisieren') {
      const r = await holen()
      if (!r.geaendert) return json(res, 200, { ...r, neustart: false })
      // Antwort erst rausschicken, dann sich selbst ersetzen: der Browser soll
      // wissen, dass es geklappt hat, bevor die Verbindung wegbricht.
      json(res, 200, { ...r, neustart: true })
      setTimeout(() => {
        // Das Kind erbt die Konsole, damit im Terminal weiterläuft, was vorher
        // dort lief — sonst wirkt der Neustart wie ein Absturz.
        spawn(process.execPath, [fileURLToPath(import.meta.url)], {
          detached: true,
          stdio: 'inherit',
          // Die neue Fassung soll denselben Port zurückerobern und nicht auf
          // einen freien ausweichen — der Tab im Browser zeigt ja auf diesen.
          env: { ...process.env, HANDSCHRIFT_NEUSTART: '1' },
        }).unref()
        server.close(() => process.exit(0))
        setTimeout(() => process.exit(0), 1500).unref()
      }, 300)
      return
    }

    if (req.method === 'POST' && weg === '/api/stopp') {
      lauf?.abbruch?.abort()
      return json(res, 200, { gestoppt: true, getippt: lauf?.getippt ?? 0 })
    }

    if (req.method === 'POST' && weg === '/api/einstellungen') {
      const daten = await koerper(req)
      // Leere Felder sollen einen gespeicherten Schlüssel nicht löschen — sonst
      // wäre er nach jedem Speichern der Oberfläche weg.
      const sauber = Object.fromEntries(Object.entries(daten).filter(([, v]) => v !== '' && v != null))
      schreiben(sauber)
      return json(res, 200, oeffentlich())
    }

    json(res, 404, { fehler: 'Gibt es hier nicht.' })
  } catch (err) {
    json(res, 400, { fehler: err.message })
  }
})

/**
 * Die Seite selbst aufmachen.
 *
 * "Die Website ist nicht erreichbar — ERR_CONNECTION_REFUSED" heißt immer
 * dasselbe: der Server läuft nicht, oder er läuft woanders. Der Browser kann
 * das nicht wissen, und im Terminal steht die richtige Adresse zwar da, aber
 * eine Zeile weiter oben. Also macht Handschrift die Seite selbst auf, statt
 * darauf zu warten, dass jemand die richtige Nummer abtippt.
 *
 * Nicht, wenn kein Mensch davorsitzt: bei den Proben läuft der Server ohne
 * Terminal, und zwanzig aufspringende Fenster wären kein Fortschritt.
 */
function seiteOeffnen(port) {
  if (process.env.KEIN_BROWSER || !process.stdout.isTTY) return
  const url = `http://localhost:${port}`
  const befehl = SYSTEM === 'darwin' ? 'open' : SYSTEM === 'win32' ? 'start' : 'xdg-open'
  // Klappt es nicht, bleibt es dabei — die Adresse steht ja im Terminal.
  spawn(befehl, [url], { stdio: 'ignore', detached: true, shell: SYSTEM === 'win32' }).unref()
}

// Nach einem Neustart hält der alte Prozess den Port noch einen Moment. Ohne
// dieses Nachfassen schlüge genau der Selbst-Neustart fehl, den es einfacher
// machen soll.
//
// Hält den Port dagegen etwas Fremdes besetzt, hilft Warten nichts: dann wird
// der nächste genommen. Vorher endete Handschrift hier mit "Start nicht
// möglich" — und wer danach die gewohnte Adresse aufrief, bekam die abgelehnte
// Verbindung zu sehen, ohne einen Hinweis, woran es lag.
// Einmal angemeldet, nicht bei jedem Versuch: sonst sammeln sich die Horcher
// über die Versuche hinweg an, und beim Erfolg meldet sich der erste von
// ihnen — mit dem Port des ersten Versuchs. Auf dem Bildschirm stand dann eine
// Adresse, unter der Handschrift gerade nicht läuft.
server.on('listening', async () => {
  const port = server.address().port
  console.log(`\n  Handschrift — ${standText()}`)
  console.log(`  läuft auf http://localhost:${port}`)
  console.log('  Nur dieser Rechner kommt dran. Beenden mit Strg+C\n')
  seiteOeffnen(port)
  if (istGitOrdner()) {
    const neu = await nachsehen({ jetzt: true })
    if (neu.da) console.log(`  ⟳ Neuere Fassung bereit (${neu.commits} Änderung(en)) — in der Oberfläche holen.\n`)
  }
})

function starten(port = PORT, versuche = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // Zwei verschiedene Lagen, zwei verschiedene Antworten.
      //
      // Beim Selbst-Neustart hält die alte Fassung den Port noch einen Moment.
      // Da hilft Warten, und ein anderer Port wäre sogar falsch: der offene
      // Tab im Browser zeigt auf diesen hier.
      if (process.env.HANDSCHRIFT_NEUSTART && versuche < 12)
        return setTimeout(() => starten(port, versuche + 1), 400)
      // Hält dagegen etwas Fremdes den Port, gibt es nichts abzuwarten.
      if (!process.env.HANDSCHRIFT_NEUSTART && port < PORT + 10) {
        console.log(`  Port ${port} ist belegt — Handschrift nimmt ${port + 1}.`)
        return starten(port + 1, 0)
      }
    }
    console.error(`\n  Start nicht möglich: ${err.message}\n`)
    process.exit(1)
  })
  server.listen(port, '127.0.0.1')
}
starten()
