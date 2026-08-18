// Wirklich tippen — in ein fremdes Fenster, und danach nachlesen.
//
//   node pruefe-tippen.mjs
//
// pruefe.mjs rechnet den Rhythmus aus, pruefe-browser.mjs drückt die Knöpfe.
// Keiner von beiden beantwortet die Frage, die dem Nutzer wirklich wichtig ist:
// kommt der Text drüben an, Zeichen für Zeichen, mit den Leerzeichen dazwischen?
//
// Genau da lag der schlimmste Fehler dieses Programms: auf dem Mac schrieb der
// gewählte Weg fürs Leerzeichen gar nichts, und im Dokument stand
// "Erstezeilehier". Aufgefallen ist das nicht beim Rechnen, sondern erst beim
// Nachlesen. Also wird hier nachgelesen.
//
// Unter Linux geht das mit Bordmitteln: ein Terminalfenster, das alles in eine
// Datei schreibt, was es zu sehen bekommt. Auf dem Mac übernimmt das
// "node hilfe.mjs --tippen" mit TextEdit — dort ist ein Terminalfenster nicht
// zuverlässig fernsteuerbar.
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { entwirren, istVerklebt } from './server/entwirren.js'

const pexec = promisify(execFile)
const PORT = Number(process.env.PORT) || 3098
const warte = (ms) => new Promise((f) => setTimeout(f, ms))

let gut = 0
let schlecht = 0
const ok = (was, b, info = '') => {
  b ? gut++ : schlecht++
  console.log(`   ${b ? '✓' : '✗'} ${was}${info ? '  ' + info : ''}`)
}

if (process.platform !== 'linux') {
  console.log('\n  Diese Probe läuft nur unter Linux.')
  console.log('  Auf dem Mac:  node hilfe.mjs --tippen\n')
  process.exit(0)
}
for (const werkzeug of ['xdotool', 'xterm']) {
  const da = await pexec('which', [werkzeug]).then(() => true).catch(() => false)
  if (!da) {
    console.log(`\n  ${werkzeug} fehlt — Probe übersprungen.`)
    console.log('  Nachrüsten mit:  sudo apt install xdotool xterm xvfb\n')
    process.exit(0)
  }
}
if (!process.env.DISPLAY) {
  console.log('\n  Kein DISPLAY — Probe übersprungen.')
  console.log('  Mit eigenem Bildschirm:  Xvfb :98 & DISPLAY=:98 node pruefe-tippen.mjs\n')
  process.exit(0)
}

// Absichtlich mit doppelten Leerzeichen, Umlauten und Satzzeichen: genau die
// Zeichen, an denen es auf dem Mac scheiterte.
const TEXT = 'Ein Satz mit Lücken, Umlauten (äöü) und Zeichen: 1/2 - fertig.'
const ZIEL = path.join(os.tmpdir(), `handschrift-probe-${process.pid}.txt`)

const hole = async (weg, daten) => {
  const antwort = await fetch(`http://localhost:${PORT}${weg}`, {
    method: daten ? 'POST' : 'GET',
    headers: daten ? { 'content-type': 'application/json' } : {},
    body: daten ? JSON.stringify(daten) : undefined,
  })
  const inhalt = await antwort.json()
  if (!antwort.ok) throw new Error(inhalt.fehler || antwort.statusText)
  return inhalt
}

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
})
// Ein Terminal, das schluckt, was ankommt, und es in die Datei schreibt.
// -u8: sonst schreibt xterm die Umlaute als einzelne Latin-1-Bytes in die
// Datei, und der Vergleich schlägt fehl, obwohl richtig getippt wurde.
const fenster = spawn('xterm', ['-u8', '-T', 'handschrift-probe', '-e', `cat > ${ZIEL}`], {
  stdio: 'ignore',
  env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
})

try {
  console.log('\n  Handschrift Tipp-Probe\n')
  await warte(2000)

  // Das Zielfenster nach vorn holen — sonst tippt Handschrift ins Leere, und
  // genau das ist der häufigste Grund für "es kommt nichts an".
  const { stdout: id } = await pexec('xdotool', ['search', '--name', 'handschrift-probe'])
  const fensterId = id.trim().split('\n')[0]
  ok('das Zielfenster ist da', !!fensterId, fensterId)
  // Auf einem nackten Xvfb läuft kein Fenstermanager, und dann lehnt
  // windowactivate ab. windowfocus genügt hier — der Versuch bleibt trotzdem
  // drin, weil er auf einem echten Bildschirm der zuverlässigere Weg ist.
  await pexec('xdotool', ['windowactivate', '--sync', fensterId]).catch(() => {})
  await pexec('xdotool', ['windowfocus', fensterId])
  await warte(500)

  const stand = await hole('/api/stand')
  ok('der Server sagt, dass getippt werden kann', stand.tippen?.ok === true, stand.tippen?.hinweis)

  // Vorlauf 1 Sekunde: hier ist schon geklickt, es muss nur losgehen.
  const start = await hole('/api/tippen', { text: TEXT + '\n', dauer: '25s', vorlauf: 1 })
  ok('der Lauf startet', start.gesamt === TEXT.length + 1, `${start.gesamt} Zeichen, ${start.dauer}`)

  let letzter = null
  for (let i = 0; i < 120; i++) {
    await warte(500)
    letzter = (await hole('/api/stand')).lauf
    if (!letzter?.laeuft) break
  }
  ok('der Lauf endet von selbst', letzter?.laeuft === false, letzter?.fehler || `${letzter?.getippt} Zeichen`)
  ok('kein Fehler unterwegs', !letzter?.fehler, letzter?.fehler || '')
  ok('jedes Zeichen wurde angeschlagen', letzter?.getippt === letzter?.gesamt, `${letzter?.getippt} von ${letzter?.gesamt}`)

  await warte(800)
  const kam = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8').replace(/\r/g, '').trim() : ''

  ok('drüben ist überhaupt etwas angekommen', kam.length > 0, JSON.stringify(kam.slice(0, 40)))
  // Das ist die eigentliche Frage. Fehlende Leerzeichen sind der Fehler, der
  // das Ergebnis unbrauchbar macht, ohne dass irgendwo ein Fehler gemeldet wird.
  ok(
    'die Leerzeichen sind mitgekommen',
    (kam.match(/ /g) || []).length === (TEXT.match(/ /g) || []).length,
    `${(kam.match(/ /g) || []).length} von ${(TEXT.match(/ /g) || []).length}`,
  )
  ok('die Umlaute sind mitgekommen', /äöü/.test(kam))
  ok('es steht Zeichen für Zeichen richtig da', kam === TEXT, kam === TEXT ? '' : JSON.stringify(kam))

  // Und jetzt die eigentliche Frage: was aufgetrennt losgeschickt wurde, muss
  // auch aufgetrennt ankommen. Fällt der Umbruch aus, klebt drüben wieder
  // alles zusammen — ohne Fehlermeldung, denn getippt wurde ja.
  console.log('')
  fs.rmSync(ZIEL, { force: true })
  const fenster2 = spawn('xterm', ['-u8', '-T', 'handschrift-probe2', '-e', `cat > ${ZIEL}`], {
    stdio: 'ignore',
    env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' },
  })
  await warte(2000)
  const { stdout: id2 } = await pexec('xdotool', ['search', '--name', 'handschrift-probe2'])
  await pexec('xdotool', ['windowactivate', '--sync', id2.trim().split('\n')[0]]).catch(() => {})
  await pexec('xdotool', ['windowfocus', id2.trim().split('\n')[0]])
  await warte(500)

  const KLUMPEN =
    'Laboratory Report: Heart Dissection1. Title Page / Cover PageTitle: Dissection of the Mammalian Heart' +
    'Student Name: Jaidi GrotemeyerCourse: BiologyDate: August 17, 20262. IntroductionThe mammalian heart ' +
    'is a four-chambered pump managing pulmonary and systemic circuits. The left ventricle wall is thicker ' +
    'due to higher systemic resistance.3. MethodologyMaterials: Sheep heart, dissection kit, tray, gloves.' +
    'Procedure:Examine external anatomy. Cut open a ventricle.'
  const GEGLIEDERT = entwirren(KLUMPEN).text

  await hole('/api/tippen', { text: GEGLIEDERT + '\n', dauer: '40s', vorlauf: 1 })
  let zweiter = null
  for (let i = 0; i < 160; i++) {
    await warte(500)
    zweiter = (await hole('/api/stand')).lauf
    if (!zweiter?.laeuft) break
  }
  ok('der gegliederte Text geht durch', zweiter?.getippt === zweiter?.gesamt, `${zweiter?.getippt} von ${zweiter?.gesamt}`)

  await warte(800)
  const kam2 = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8').replace(/\r/g, '').trim() : ''
  fenster2.kill()

  ok(
    'die Umbrüche sind mitgekommen',
    kam2.split('\n').length === GEGLIEDERT.split('\n').length,
    `${kam2.split('\n').length} von ${GEGLIEDERT.split('\n').length} Zeilen`,
  )
  ok('die Stichpunkte stehen einzeln', kam2.split('\n').filter((z) => z.startsWith('* ')).length >= 3)
  ok('die Einrückung der Schritte bleibt', /\n {3}1\. /.test('\n' + kam2))
  ok('drüben klebt nichts mehr', !istVerklebt(kam2), istVerklebt(kam2) ? 'wieder ein Klumpen!' : '')
  ok('und es steht genau so da wie geschickt', kam2 === GEGLIEDERT.trim())
} catch (err) {
  // Ein Absturz mitten in der Probe ist ein kaputter Punkt, kein Seitenroman.
  ok('die Probe läuft durch', false, err.message.split('\n')[0])
} finally {
  await hole('/api/stopp', {}).catch(() => {})
  fenster.kill()
  server.kill()
  fs.rmSync(ZIEL, { force: true })
}

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
