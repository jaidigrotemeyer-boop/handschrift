// Den Weg zum Modell wirklich gehen — über HTTP, wie daheim auch.
//
//   node pruefe-ollama.mjs
//
// pruefe.mjs setzt das Modell ein, statt es anzurufen: die Tore, die Bewertung
// und die Absatz-Schleife lassen sich so einzeln prüfen. Was dabei ungeprüft
// bleibt, ist das Stück dazwischen — ob Handschrift Ollama überhaupt findet,
// das richtige Modell wählt, die Anfrage im erwarteten Format stellt und mit
// der Antwort etwas anfangen kann.
//
// Genau dort ging es beim Nutzer schief, und über die Rechenprüfung war davon
// nichts zu sehen. Hier steht darum eine Attrappe bereit, die das echte
// Protokoll spricht: /api/tags und /api/chat, mehr braucht es nicht.
import { spawn } from 'node:child_process'
import http from 'node:http'

const PORT = Number(process.env.PORT) || 3097
const OLLAMA_PORT = 11435
const warte = (ms) => new Promise((f) => setTimeout(f, ms))

let gut = 0
let schlecht = 0
const ok = (was, b, info = '') => {
  b ? gut++ : schlecht++
  console.log(`   ${b ? '✓' : '✗'} ${was}${info ? '  ' + info : ''}`)
}

// So antwortet ein Modell, das seine Arbeit tut: dieselbe Aussage, ohne die
// Floskeln davor. Kürzer, aber nicht halbiert — sonst greift zu Recht das Tor.
const ANTWORT =
  'Digitalisierung betrifft jede Firma, ob groß oder klein. Was am Ende zählt, ' +
  'hängt an mehr Stellen als den offensichtlichen. Die wenigsten davon stehen in ' +
  'der Broschüre des Anbieters, und genau die kosten später Zeit.'

const gefragt = []
const attrappe = http.createServer((req, res) => {
  if (req.url === '/api/tags') {
    res.writeHead(200, { 'content-type': 'application/json' })
    // Absichtlich mit Größen: Handschrift soll das größte Modell nehmen, das
    // in den Arbeitsspeicher passt — nicht einfach das größte.
    return res.end(
      JSON.stringify({
        models: [
          { name: 'nomic-embed-text', size: 3e8 },
          { name: 'llama3.2:3b', size: 2e9 },
          { name: 'qwen2.5:400b', size: 4e11 },
        ],
      }),
    )
  }
  if (req.url === '/api/chat') {
    let roh = ''
    req.on('data', (s) => (roh += s))
    return req.on('end', () => {
      gefragt.push(JSON.parse(roh))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: { content: ANTWORT } }))
    })
  }
  res.writeHead(404).end()
})
await new Promise((f) => attrappe.listen(OLLAMA_PORT, '127.0.0.1', f))

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), OLLAMA_URL: `http://127.0.0.1:${OLLAMA_PORT}` },
  stdio: 'ignore',
})

const hole = async (weg, daten) => {
  const antwort = await fetch(`http://localhost:${PORT}${weg}`, {
    method: daten ? 'POST' : 'GET',
    headers: daten ? { 'content-type': 'application/json' } : {},
    body: daten ? JSON.stringify(daten) : undefined,
  })
  return { code: antwort.status, ...(await antwort.json()) }
}

const FLACH =
  'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. ' +
  'Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst. ' +
  'Zudem bietet moderne Technologie eine breite Palette an neuen Möglichkeiten für Firmen.'

try {
  console.log('\n  Handschrift Ollama-Probe\n')
  await warte(1500)

  const stand = await hole('/api/stand')
  ok('Handschrift findet das Modell', /ollama/i.test(stand.gehirne?.join(' ') || ''), (stand.gehirne || []).join(', '))
  ok('und wählt eines, das in den Speicher passt', /llama3\.2:3b/.test((stand.gehirne || []).join(' ')), (stand.gehirne || []).join(', '))

  const r = await hole('/api/umschreiben', { text: FLACH })
  ok('das Umschreiben antwortet', r.code === 200, r.fehler || '')
  ok('es wurde wirklich gefragt', gefragt.length > 0, `${gefragt.length} Anfrage(n)`)

  if (gefragt.length) {
    const erste = gefragt[0]
    ok('die Anfrage nennt ein Modell', typeof erste.model === 'string' && erste.model.length > 0, erste.model)
    ok('sie schickt Nachrichten mit Rollen', Array.isArray(erste.messages) && erste.messages.every((n) => n.role && n.content))
    ok('sie will keine häppchenweise Antwort', erste.stream === false, JSON.stringify(erste.stream))
    // Ein einzelner Absatz je Anfrage: einen ganzen Bericht am Stück verdaut
    // ein kleines Modell daheim nicht.
    const laengste = Math.max(...gefragt.map((a) => a.messages[a.messages.length - 1].content.length))
    ok('sie schickt nicht das ganze Dokument auf einmal', laengste < FLACH.length + 800, `${laengste} Zeichen`)
  }

  ok('die Antwort steht im Ergebnis', (r.text || '').includes('Broschüre'), (r.text || '').slice(0, 50))
  ok('es wurde messbar besser', r.punkte?.nachher < r.punkte?.vorher, `${r.punkte?.vorher} → ${r.punkte?.nachher}`)
  ok('der Anbieter wird genannt', /ollama/i.test(r.anbieter || ''), r.anbieter)

  // Fällt Ollama aus, muss die Meldung sagen, was zu tun ist — nicht nur, dass
  // etwas schiefging.
  await new Promise((f) => attrappe.close(f))
  const tot = await hole('/api/umschreiben', { text: FLACH })
  ok('ohne Ollama kommt ein brauchbarer Hinweis', /ollama serve/i.test(tot.fehler || ''), (tot.fehler || '').slice(0, 70))
} catch (err) {
  ok('die Probe läuft durch', false, err.message.split('\n')[0])
} finally {
  server.kill()
  attrappe.close()
}

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
