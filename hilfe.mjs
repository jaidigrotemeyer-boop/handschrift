#!/usr/bin/env node
// Selbstauskunft: einmal alles durchgehen und in einem Stück ausgeben.
//
//   node hilfe.mjs
//
// Gedacht für den Fall "geht nicht". Statt zu fragen, was genau nicht geht,
// probiert Handschrift hier jeden Schritt selbst durch und schreibt auf, was
// dabei herauskommt — samt der echten Ablehnungsgründe des eigenen Modells.
// Das Ergebnis lässt sich in einem Stück weitergeben.
import os from 'node:os'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { messen } from './server/messen.js'
import { bloecke, lektorierbar } from './server/bloecke.js'
import { istVerklebt, entwirren } from './server/entwirren.js'
import { anbieter, ollamaDa, bestesModell, speicherBudget, umschreiben } from './server/gehirn.js'
import { bereit, tippProbe, cliclickBefehl } from './server/schreiben.js'
import { standText } from './server/stand.js'
import { lesen } from './server/config.js'

const pexec = promisify(execFile)
const zeile = (a, b) => console.log(`  ${String(a).padEnd(22)} ${b}`)
const GB = 1e9

console.log('\n══ Handschrift — Selbstauskunft ══\n')

console.log('RECHNER')
zeile('Fassung', standText())
zeile('Node', process.version)
zeile('System', `${process.platform} ${os.release()}`)
zeile('Arbeitsspeicher', `${(os.totalmem() / GB).toFixed(1)} GB · Budget fürs Modell ${(speicherBudget() / GB).toFixed(1)} GB`)

// Hinkt der Quelltext hinterher? Das ist die häufigste Ursache von "geht nicht".
try {
  const { stdout: zweig } = await pexec('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  await pexec('git', ['fetch', '--quiet', 'origin'])
  const { stdout: hinten } = await pexec('git', ['rev-list', '--count', 'HEAD..@{u}'])
  const n = Number(hinten.trim())
  zeile('Zweig', zweig.trim() + (n ? ` — ${n} Commit(s) hinterher!` : ' — aktuell'))
  if (n) console.log('\n  ⚠ Der Quelltext ist nicht aktuell. Erst "git pull", dann neu starten.\n')
} catch {
  zeile('Zweig', 'kein git — Stand nicht prüfbar')
}

console.log('\nGEHIRN (fürs Umschreiben)')
const o = await ollamaDa()
if (o) {
  zeile('Ollama', `erreichbar unter ${o.url}`)
  zeile(
    'Modelle da',
    o.modelle.length
      ? o.modelle.map((m) => `${m.name}${m.size ? ` (${(m.size / GB).toFixed(1)} GB)` : ''}`).join(', ')
      : 'KEINE — "ollama pull llama3.2:3b"',
  )
  zeile('gewählt', bestesModell(o.modelle) || '—')
  if (lesen().ollamaModell) zeile('fest eingestellt', lesen().ollamaModell)
} else {
  zeile('Ollama', 'nicht erreichbar — läuft "ollama serve"?')
}
const kette = await anbieter()
zeile('Kette', kette.length ? kette.map((a) => a.name).join(' → ') : 'LEER — Umschreiben ist aus')

console.log('\nTIPPEN')
const b = await bereit()
zeile('möglich', b.ok ? 'ja' : 'NEIN')
zeile('Hinweis', b.hinweis)
if (b.rechte) zeile('Rechte', b.rechte)
zeile('Leerzeichen als', cliclickBefehl(' '))
zeile('Umbruch als', cliclickBefehl('\n'))

// Die eigentliche Frage bei "der getippte Text klebt" lässt sich nur auf dem
// Rechner selbst beantworten: einmal wirklich tippen und zurücklesen.
if (process.argv.includes('--tippen')) {
  console.log('\n  Tipp-Probe: TextEdit geht gleich auf, bitte nichts anklicken …')
  try {
    const p = await tippProbe()
    if (!p.moeglich) {
      zeile('Probe', p.grund)
    } else {
      zeile('Weg', p.weg)
      zeile('gewollt', JSON.stringify(p.gewollt))
      zeile('angekommen', JSON.stringify(p.angekommen))
      zeile('Leerzeichen', `${p.leerzeichenAngekommen} von ${p.leerzeichenGewollt} angekommen`)
      zeile('Leerzeichen ok', p.leerzeichenOk ? 'ja' : '✗ NEIN — hier klebt es')
      zeile('Ergebnis', p.gleich ? 'stimmt genau überein' : p.leerzeichenOk ? 'Leerzeichen stimmen (TextEdit hat sonst etwas geändert)' : '✗ Zeichen gehen verloren')
    }
  } catch (err) {
    zeile('Probe', 'ging schief: ' + err.message)
  }
} else {
  console.log('  (echte Tipp-Probe mit:  node hilfe.mjs --tippen)')
}

console.log('\nMESSEN (rechnet lokal, muss immer gehen)')
const PROBE =
  'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. ' +
  'Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst. ' +
  'Zudem bietet moderne Technologie eine breite Palette an neuen Möglichkeiten für Firmen.'
const m = messen(PROBE)
zeile('Urteil', m.urteil)
zeile('Floskeln gefunden', m.floskeln.anzahl)
zeile('Absätze zum Bearbeiten', bloecke(PROBE).filter(lektorierbar).length)

console.log('\nVERKLEBTEN TEXT AUFTRENNEN')
// Lang genug, damit die Erkennung überhaupt anspringt — unter 300 Zeichen
// hält sich Handschrift bewusst zurück.
const KLUMPEN =
  'Laboratory Report: Heart Dissection1. Title Page / Cover PageTitle: Dissection of the Mammalian Heart' +
  'Student Name: Jaidi GrotemeyerCourse: BiologyDate: August 17, 20262. IntroductionThe mammalian heart ' +
  'is a four-chambered pump managing pulmonary and systemic circuits. The left ventricle wall is thicker ' +
  'due to higher systemic resistance. Animal hearts mirror human anatomy closely.3. MethodologyMaterials: ' +
  'Sheep heart, dissection kit, tray, gloves, camera.Procedure:Examine the external anatomy first.'
zeile('erkannt', istVerklebt(KLUMPEN) ? 'ja' : 'nein')
zeile('Schnitte', entwirren(KLUMPEN).schnitte)

console.log('\nUMSCHREIBEN — echter Versuch mit deinem Modell')
if (!kette.length) {
  console.log('  übersprungen: kein Gehirn erreichbar (siehe oben)')
} else {
  const start = Date.now()
  try {
    const r = await umschreiben(PROBE)
    zeile('Anbieter', r.anbieter)
    zeile('Dauer', `${((Date.now() - start) / 1000).toFixed(1)} s`)
    zeile('Absätze', `${r.absaetze.lektoriert} von ${r.absaetze.gesamt} überarbeitet`)
    zeile('Punkte', `${r.punkte.vorher} → ${r.punkte.nachher} (klein ist gut)`)
    if (r.absaetze.behalten.length) zeile('stehen gelassen', r.absaetze.behalten.join(' · '))
    console.log('\n  Ergebnis:')
    console.log('  ' + r.text.split('\n').join('\n  '))
  } catch (err) {
    zeile('Dauer', `${((Date.now() - start) / 1000).toFixed(1)} s`)
    console.log(`\n  ✗ ${err.message}`)
    console.log('\n  Das ist der Punkt, an dem es klemmt. Der Grund oben sagt, warum.')
  }
}

console.log('\nSELBSTTEST')
try {
  const { stdout } = await pexec(process.execPath, ['pruefe.mjs'])
  zeile('Rechenteil', stdout.trim().split('\n').pop().trim())
} catch (err) {
  zeile('Rechenteil', 'FEHLER — ' + String(err.stdout || err.message).trim().split('\n').pop())
}
if (fs.existsSync('data/einstellungen.json')) {
  const c = lesen()
  const schluessel = ['geminiKey', 'groqKey', 'openrouterKey', 'cerebrasKey'].filter((k) => c[k])
  zeile('Schlüssel gesetzt', schluessel.length ? schluessel.join(', ') : 'keine (Ollama genügt)')
}

console.log('\n══ Ende — dieses ganze Stück weitergeben ══\n')
