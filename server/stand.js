// Welche Fassung läuft hier gerade?
//
// Klingt nebensächlich, war es aber nicht: nach einem Fehler stand die Frage
// "läuft der neue Stand überhaupt schon?" im Raum, und niemand konnte sie
// beantworten — weder der Nutzer noch ich. Ein neu gestarteter Server sieht
// aus wie ein alter.
//
// Gelesen wird direkt aus .git, ohne das Programm git aufzurufen. Wer den
// Quelltext als Archiv geladen hat, hat kein .git — dann steht dort ehrlich
// "unbekannt" statt einer erfundenen Nummer.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function ausGit() {
  try {
    const kopf = fs.readFileSync(path.join(WURZEL, '.git', 'HEAD'), 'utf8').trim()
    const zeiger = kopf.match(/^ref:\s*(.+)$/)
    if (!zeiger) return kopf.slice(0, 7)
    const ref = path.join(WURZEL, '.git', zeiger[1])
    if (fs.existsSync(ref)) return fs.readFileSync(ref, 'utf8').trim().slice(0, 7)
    // Frisch geklont liegen die Zeiger gepackt in einer Datei statt einzeln.
    const gepackt = fs.readFileSync(path.join(WURZEL, '.git', 'packed-refs'), 'utf8')
    const treffer = gepackt.split('\n').find((z) => z.endsWith(' ' + zeiger[1]))
    return treffer ? treffer.slice(0, 7) : null
  } catch {
    return null
  }
}

function datum() {
  try {
    // Wann wurde zuletzt etwas geholt? Sagt mehr als das Datum der Dateien.
    const s = fs.statSync(path.join(WURZEL, '.git', 'FETCH_HEAD'))
    return s.mtime.toISOString().slice(0, 10)
  } catch {
    try {
      return fs.statSync(path.join(WURZEL, 'server', 'index.js')).mtime.toISOString().slice(0, 10)
    } catch {
      return null
    }
  }
}

const fassung = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(WURZEL, 'package.json'), 'utf8')).version || '0'
  } catch {
    return '0'
  }
})()

export const stand = { fassung, commit: ausGit(), datum: datum() }

export const standText = () =>
  `Fassung ${stand.fassung}${stand.commit ? ` · ${stand.commit}` : ' · Stand unbekannt (kein .git)'}${stand.datum ? ` · ${stand.datum}` : ''}`
