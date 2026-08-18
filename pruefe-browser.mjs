// Die Oberfläche wirklich bedienen — klicken, tippen, schauen was passiert.
//
//   node pruefe-browser.mjs
//
// pruefe.mjs prüft das Rechnen, dieser hier die Seite. Der Unterschied ist
// nicht akademisch: der Knopf "Absätze wiederherstellen" war einmal da,
// sichtbar, ohne Fehler in der Konsole — und tat nichts, weil sein Klick-Ohr
// nie angehängt wurde. Über die Schnittstelle allein ist das unsichtbar.
//
// Playwright ist keine Abhängigkeit von Handschrift. Ist es nicht da, wird
// dieser Test übersprungen statt zu scheitern.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const PORT = Number(process.env.PORT) || 3099

// Erst im Projekt suchen, dann global — global ist der übliche Ort, und von
// dort findet ein einfaches require() es nicht.
const verlangen = createRequire(import.meta.url)
const global = path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright')
let chromium
for (const wo of ['playwright', global]) {
  try {
    chromium = verlangen(wo).chromium
    break
  } catch {}
}
if (!chromium) {
  console.log('\n  Playwright nicht da — Browser-Test übersprungen.')
  console.log('  Nachrüsten mit:  npm i -g playwright && npx playwright install chromium\n')
  process.exit(0)
}

let gut = 0
let schlecht = 0
const ok = (was, b, info = '') => {
  b ? gut++ : schlecht++
  console.log(`   ${b ? '✓' : '✗'} ${was}${info ? '  ' + info : ''}`)
}

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
})
const warte = (ms) => new Promise((f) => setTimeout(f, ms))
await warte(1500)

const browser = await chromium.launch()
const seite = await browser.newPage()
const fehler = []
seite.on('pageerror', (e) => fehler.push('JS: ' + e.message))
seite.on('console', (m) => m.type() === 'error' && fehler.push('Konsole: ' + m.text()))

try {
  console.log('\n  Handschrift Browser-Test\n')
  await seite.goto(`http://localhost:${PORT}/`)
  await warte(600)

  const gezeigt = (await seite.locator('#stand').textContent()) || ''
  ok('die laufende Fassung steht auf der Seite', /Fassung/.test(gezeigt), gezeigt.trim())

  console.log('  SCHRIFTGRÖSSE')
  const groesse = () => seite.evaluate(() => getComputedStyle(document.querySelector('#text')).fontSize)
  const g0 = await groesse()
  await seite.click('#groesser')
  await warte(150)
  const g1 = await groesse()
  ok('A+ macht größer', parseFloat(g1) > parseFloat(g0), `${g0} → ${g1}`)
  await seite.click('#kleiner')
  await warte(150)
  ok('A− macht wieder kleiner', (await groesse()) === g0)
  await seite.reload()
  await warte(500)
  ok('Größe überlebt das Neuladen', (await groesse()) === g0)

  console.log('\n  REGLER')
  await seite.fill('#text', 'Ein Text mit ein paar Wörtern drin, damit sich ein Tempo überhaupt rechnen lässt.')
  await warte(150)
  const dauer = () => seite.locator('#dauerText').textContent()
  const d0 = await dauer()
  await seite.locator('#regler').fill('800')
  await warte(150)
  ok('Regler ändert die Dauer', (await dauer()) !== d0, `${d0} → ${await dauer()}`)
  ok('Tempo wird genannt', ((await seite.locator('#tempoText').textContent()) || '').includes('Zeichen je Minute'))

  console.log('\n  MESSEN')
  const FLACH =
    'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. ' +
    'Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst. ' +
    'Zudem bietet moderne Technologie eine breite Palette an neuen Möglichkeiten für Firmen.'
  await seite.fill('#text', FLACH)
  await seite.click('#messen')
  await warte(800)
  ok('ein Urteil erscheint', /maschinell|Ordnung|Unauffällig/.test((await seite.locator('#befund').textContent()) || ''))
  ok('Zahlen liegen eingeklappt darunter', (await seite.locator('#befund details').count()) > 0)
  await seite.locator('#befund details summary').click()
  await warte(200)
  ok('und lassen sich aufklappen', ((await seite.locator('#befund details').textContent()) || '').includes('Wörter'))

  console.log('\n  VERKLEBTER TEXT')
  const KLUMPEN =
    'Laboratory Report: Heart Dissection1. Title Page / Cover PageTitle: Dissection of the Mammalian Heart' +
    'Student Name: Jaidi GrotemeyerCourse: BiologyDate: August 17, 20262. IntroductionThe mammalian heart ' +
    'is a four-chambered pump managing pulmonary and systemic circuits. The left ventricle wall is thicker ' +
    'due to higher systemic resistance. Animal hearts mirror human anatomy closely.3. MethodologyMaterials: ' +
    'Sheep heart, dissection kit, tray, gloves, camera.Procedure:Examine the external anatomy first.'
  await seite.fill('#text', KLUMPEN)
  await seite.click('#messen')
  await warte(800)
  const knopf = seite.locator('#entwirren')
  ok('Handschrift bietet das Auftrennen an', (await knopf.count()) > 0)
  if (await knopf.count()) {
    await knopf.click()
    await warte(1000)
    const danach = await seite.inputValue('#text')
    ok('der Knopf tut auch etwas', danach.split('\n').length > 5, `${danach.split('\n').length} Zeilen`)
    ok('die Abschnitte stehen einzeln', danach.split('\n').some((z) => z.trim() === '2. Introduction'))
  }

  console.log('\n  TIPPEN')
  await seite.fill('#text', FLACH)
  await seite.locator('#regler').fill('500')
  await seite.fill('#vorlauf', '1')
  const tippen = seite.locator('#tippen')
  if (await tippen.isDisabled()) {
    console.log('   – kein Tipp-Weg auf diesem Rechner, übersprungen')
  } else {
    await tippen.click()
    await warte(2500)
    ok('der Lauf meldet Fortschritt', /Tippt|Zielfenster/.test((await seite.locator('#laufstand').textContent()) || ''),
      ((await seite.locator('#laufstand').textContent()) || '').slice(0, 55))
    ok('Stopp ist bedienbar', !(await seite.locator('#stopp').isDisabled()))
    await seite.click('#stopp')
    await warte(1200)
    ok('Stopp beendet den Lauf', /Gestoppt|Fertig/.test((await seite.locator('#laufstand').textContent()) || ''))
  }

  ok('keine Fehler auf der Seite', fehler.length === 0, fehler.join(' · '))
} finally {
  await browser.close()
  server.kill()
}

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
