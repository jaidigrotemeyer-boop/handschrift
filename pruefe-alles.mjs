// Alles auf einmal — ein Befehl, ein Urteil.
//
//   node pruefe-alles.mjs
//
// Die einzelnen Proben prüfen jede etwas anderes, und keine von ihnen allein
// beantwortet die Frage "klappt das jetzt?". Zusammen tun sie es:
//
//   pruefe.mjs          das Rechnen — Messen, Rhythmus, Tore, Gliedern
//   pruefe-ollama.mjs   der Weg zum Modell, über echtes HTTP
//   pruefe-browser.mjs  die Oberfläche, wirklich angeklickt
//   pruefe-tippen.mjs   das Tippen, in ein fremdes Fenster und zurückgelesen
//   pruefe-update.mjs   das Selbst-Aktualisieren, mit echtem Neustart
//
// Was auf diesem Rechner nicht geht, wird übersprungen und gesagt — nicht als
// Fehler gezählt und nicht verschwiegen.
import { spawn } from 'node:child_process'

const PROBEN = [
  ['Rechnen', 'pruefe.mjs'],
  ['Modell', 'pruefe-ollama.mjs'],
  ['Oberfläche', 'pruefe-browser.mjs'],
  ['Tippen', 'pruefe-tippen.mjs'],
  ['Aktualisieren', 'pruefe-update.mjs'],
]

const lauf = (datei) =>
  new Promise((fertig) => {
    const k = spawn(process.execPath, [datei], { stdio: ['ignore', 'pipe', 'pipe'] })
    let raus = ''
    k.stdout.on('data', (d) => (raus += d))
    k.stderr.on('data', (d) => (raus += d))
    k.on('close', (code) => fertig({ code, raus }))
  })

console.log('\n══ Handschrift — alle Proben ══')

const zeilen = []
let kaputt = 0
for (const [name, datei] of PROBEN) {
  process.stdout.write(`\n  ${name} … `)
  const { code, raus } = await lauf(datei)
  const urteil = raus.split('\n').reverse().find((z) => /in Ordnung|übersprungen|nicht da|fehlt|läuft nur/.test(z))
  const uebersprungen = /übersprungen|nicht da|fehlt|läuft nur/.test(urteil || '')
  if (code !== 0) kaputt++
  console.log(code === 0 ? (uebersprungen ? '–' : '✓') : '✗')
  zeilen.push(`  ${code === 0 ? (uebersprungen ? '–' : '✓') : '✗'} ${name.padEnd(14)} ${(urteil || '').trim()}`)
  // Bei einem Fehler das ganze Protokoll: sonst weiß niemand, was schieflief.
  if (code !== 0) console.log('\n' + raus.trim().split('\n').map((z) => '    ' + z).join('\n') + '\n')
}

console.log('\n──────────────────────────────')
for (const z of zeilen) console.log(z)
console.log(
  kaputt
    ? `\n  ${kaputt} Probe(n) kaputt — oben steht, welche.\n`
    : '\n  Alles in Ordnung.\n',
)
process.exit(kaputt ? 1 : 0)
