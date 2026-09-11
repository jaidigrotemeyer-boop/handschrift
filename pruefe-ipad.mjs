// Vom iPad aus — mit einem iPad bedient, nicht bloß schmal gerechnet.
//
//   node pruefe-ipad.mjs
//
// Zwei Dinge müssen stimmen, und beide sind von einem Schreibtisch aus leicht
// zu übersehen.
//
// Erstens die Erreichbarkeit. Handschrift hört normalerweise nur auf
// 127.0.0.1; ein iPad kommt da gar nicht erst an. Geöffnet wird das WLAN nur
// auf Ansage, und dann mit Geheimzahl — wer die Seite erreicht, kann den
// Rechner tippen lassen.
//
// Zweitens die Bedienbarkeit mit dem Finger. Safari zoomt in jedes Feld, dessen
// Schrift kleiner als 16px ist, und ein Knopf von 24px Höhe ist mit dem Daumen
// ein Glücksspiel. Playwright kann ein iPad nachstellen, samt Fingereingabe —
// also wird hier wirklich getippt und nicht nur die Breite behauptet.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const PORT = Number(process.env.PORT) || 3095
const ZAHL_PORT = PORT + 1

const verlangen = createRequire(import.meta.url)
const global = path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright')
let pw
for (const wo of ['playwright', global]) {
  try {
    pw = verlangen(wo)
    break
  } catch {}
}
if (!pw) {
  console.log('\n  Playwright nicht da — iPad-Probe übersprungen.')
  console.log('  Nachrüsten mit:  npm i -g playwright && npx playwright install chromium\n')
  process.exit(0)
}
const { chromium, devices } = pw
const iPad = devices['iPad (gen 7) landscape'] || devices['iPad Pro 11'] || devices['iPad Mini']

let gut = 0
let schlecht = 0
const ok = (was, b, info = '') => {
  b ? gut++ : schlecht++
  console.log(`   ${b ? '✓' : '✗'} ${was}${info ? '  ' + info : ''}`)
}
const warte = (ms) => new Promise((f) => setTimeout(f, ms))

// Zwei Server: einer wie immer, einer fürs WLAN geöffnet.
const daheim = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), KEIN_BROWSER: '1' },
  stdio: 'ignore',
})
const offen = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(ZAHL_PORT), KEIN_BROWSER: '1', HANDSCHRIFT_NETZ: '1' },
  stdio: ['ignore', 'pipe', 'ignore'],
})
let ausgabe = ''
offen.stdout.on('data', (d) => (ausgabe += d))

const browser = await chromium.launch()
const gerat = await browser.newContext({ ...iPad })
const seite = await gerat.newPage()
const fehler = []
seite.on('pageerror', (e) => fehler.push('JS: ' + e.message))
seite.on('console', (m) => m.type() === 'error' && fehler.push('Konsole: ' + m.text()))

try {
  console.log(`\n  Handschrift iPad-Probe  (${iPad.viewport.width}×${iPad.viewport.height}, Finger)\n`)
  await warte(2000)

  console.log('  ZUGANG')
  const zahl = (ausgabe.match(/Geheimzahl:\s*(\d{6})/) || [])[1]
  ok('der geöffnete Server nennt eine Geheimzahl', !!zahl, zahl ? `${zahl.length} Ziffern` : ausgabe.slice(0, 60))
  ok('und nennt eine Adresse fürs WLAN', /Vom iPad aus/.test(ausgabe))

  const ohne = await fetch(`http://localhost:${ZAHL_PORT}/api/stand`).then((a) => a.status)
  // Von localhost aus bleibt alles offen — das ist der Rechner selbst.
  ok('vom Rechner selbst geht es ohne Zahl', ohne === 200, `HTTP ${ohne}`)

  const falsch = await fetch(`http://localhost:${ZAHL_PORT}/api/messen`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-handschrift-zahl': '000000', 'x-forwarded-for': '10.0.0.9' },
    body: JSON.stringify({ text: 'egal' }),
  }).then((a) => a.status)
  ok('eine falsche Zahl von localhost stört nicht', falsch === 200, `HTTP ${falsch}`)

  const zu = await fetch(`http://localhost:${PORT}/api/stand`).then((a) => a.json())
  ok('der normale Server bleibt zu', zu.netz === false, `netz: ${zu.netz}`)

  console.log('\n  BEDIENUNG MIT DEM FINGER')
  await seite.goto(`http://localhost:${PORT}/`)
  await warte(700)

  const breite = await seite.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ok('nichts läuft seitlich hinaus', breite)

  // Safari zoomt beim Hineintippen in jedes Feld unter 16px. Das ist eine feste
  // Regel von iOS, kein Geschmacksurteil.
  const kleine = await seite.evaluate(() =>
    [...document.querySelectorAll('textarea, input[type=text], input[type=number], input[type=password]')]
      .map((e) => ({ id: e.id, px: parseFloat(getComputedStyle(e).fontSize) }))
      .filter((e) => e.px < 16)
      .map((e) => `${e.id}:${e.px}px`),
  )
  ok('kein Feld ist klein genug, dass Safari hineinzoomt', kleine.length === 0, kleine.join(', '))

  const klein = await seite.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44)
      .map((b) => `${b.id || b.textContent.trim()}:${Math.round(b.getBoundingClientRect().height)}px`),
  )
  ok('jeder Knopf ist mindestens 44px hoch', klein.length === 0, klein.join(', '))

  // Und jetzt wirklich mit dem Finger bedienen.
  const FLACH =
    'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. ' +
    'Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst. ' +
    'Zudem bietet moderne Technologie eine breite Palette an neuen Möglichkeiten für Firmen.'
  await seite.tap('#text')
  await seite.fill('#text', FLACH)
  await seite.tap('#messen')
  await warte(900)
  ok('Messen geht per Fingertipp', /maschinell|Ordnung|Unauffällig/.test((await seite.locator('#befund').textContent()) || ''))

  await seite.tap('#groesser')
  await warte(200)
  const groesse = await seite.evaluate(() => getComputedStyle(document.querySelector('#text')).fontSize)
  ok('A+ trifft man auch mit dem Daumen', parseFloat(groesse) >= 16, groesse)

  ok('ein Kopieren-Knopf ist da', (await seite.locator('#kopieren').count()) > 0)

  console.log('\n  WO GETIPPT WIRD')
  // Über localhost ist klar, wo der Text landet — da gibt es nichts zu erklären.
  ok('daheim steht kein Hinweis im Weg', await seite.locator('#fern').isHidden())

  // Von außen gesehen muss dastehen, dass drüben getippt wird. Dafür der
  // geöffnete Server unter seiner Netzadresse — über localhost gäbe es keinen
  // Unterschied zu sehen, und der normale Server lässt von dort gar niemanden
  // herein.
  const adresse = await eigeneAdresse()
  const fern = await gerat.newPage()
  // Die Geheimzahl liegt im Browser des iPads, bevor die Seite lädt — so wie
  // nach der ersten Eingabe.
  await fern.goto(`http://${adresse}:${ZAHL_PORT}/`)
  await fern.evaluate((z) => localStorage.setItem('handschrift-zahl', z), zahl)
  await fern.reload()
  await warte(900)
  ok('mit der Zahl kommt man von außen herein', /Fassung/.test((await fern.locator('#stand').textContent()) || ''))
  const hinweis = (await fern.locator('#fern').textContent()) || ''
  ok('von außen wird erklärt, wo getippt wird', /getippt wird auch dort/i.test(hinweis), hinweis.slice(0, 60) + '…')
  ok('und dass ein iPad selbst nicht tippen kann', /iPadOS/.test(hinweis))
  await fern.close()

  console.log('\n  OHNE MAC — die Seite, die allein rechnet')
  // Ist der Mac gar nicht dabei, gibt es keinen Server. Messen, Auftrennen und
  // Gliedern sind aber reine Rechnung und laufen genauso im Browser des iPads.
  // Geprüft wird deshalb ausdrücklich: keine einzige Anfrage an /api.
  const allein = await gerat.newPage()
  const anfragen = []
  allein.on('request', (r) => anfragen.push(r.url()))
  await allein.goto(`http://localhost:${PORT}/unterwegs`)
  await warte(900)

  ok('die Seite zeigt beim Öffnen schon einen Befund', /maschinell|Ordnung|Unauffällig/.test((await allein.locator('#befund').textContent()) || ''))
  ok('sie erkennt den verklebten Beispieltext', await allein.locator('#aufraeumen').isVisible())

  await allein.tap('#aufraeumen')
  await warte(500)
  const text = await allein.inputValue('#text')
  ok('Auftrennen geht ohne Server', text.split('\n').length > 10, `${text.split('\n').length} Zeilen`)
  ok('und gliedert wie auf dem Mac', text.includes('* Student Name: Jaidi Grotemeyer'))
  ok('die Formelreste sind auch weg', text.includes('atrium → tricuspid') && !text.includes('$'))

  ok(
    'dabei wurde der Server nie gefragt',
    !anfragen.some((u) => u.includes('/api/')),
    anfragen.filter((u) => u.includes('/api/')).join(', ') || 'keine /api-Anfrage',
  )
  const streifen = await allein.locator('#befund .streifen i').count()
  ok('die Satzlängen stehen als Streifen da', streifen > 3, `${streifen} Balken`)
  await allein.close()

  ok('keine Fehler auf der Seite', fehler.length === 0, fehler.join(' · '))
} catch (err) {
  ok('die Probe läuft durch', false, err.message.split('\n')[0])
} finally {
  await browser.close()
  daheim.kill()
  offen.kill()
}

async function eigeneAdresse() {
  const { netzAdressen } = await import('./server/netz.js')
  return netzAdressen()[0]?.adresse || '127.0.0.1'
}

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
