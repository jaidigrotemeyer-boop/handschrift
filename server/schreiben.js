// Tippen ins vorderste Fenster — also in das, was gerade offen ist: ein
// Google-Dokument im Browser, ein Textfeld, ein Editor. Handschrift selbst hat
// dabei nichts zu melden; sie schlägt nur Tasten an, wie eine Hand es täte.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import { lesen, schreiben } from './config.js'

const pexec = promisify(execFile)
export const SYSTEM = process.platform

const CLICLICK = ['/opt/homebrew/bin/cliclick', '/usr/local/bin/cliclick'].find((p) => fs.existsSync(p))

async function osa(skript) {
  await pexec('osascript', ['-e', skript])
}

/** Kann auf diesem Rechner überhaupt getippt werden? */
export async function bereit() {
  if (SYSTEM === 'darwin')
    return {
      ok: true,
      hinweis: CLICLICK
        ? 'cliclick gefunden — schnell und zuverlässig.'
        : 'Ohne cliclick geht es über AppleScript, das ist langsamer. Schneller mit: brew install cliclick',
      rechte: 'Beim ersten Tippen fragt macOS nach „Bedienungshilfen". Ohne die Erlaubnis kommt kein Zeichen an.',
    }
  if (SYSTEM === 'win32') return { ok: true, hinweis: 'Windows: getippt wird über PowerShell.' }
  const hat = await pexec('which', ['xdotool']).then(() => true).catch(() => false)
  return hat
    ? { ok: true, hinweis: 'Linux: getippt wird über xdotool.' }
    : { ok: false, hinweis: 'Linux braucht xdotool: sudo apt install xdotool' }
}

// SendKeys deutet diese Zeichen als Steuerbefehle — ungeschützt tippt Windows
// statt eines Pluszeichens eine Umschalt-Taste.
const winEscape = (z) => (/[+^%~(){}[\]]/.test(z) ? `{${z}}` : z)

/** Ein einzelnes Zeichen anschlagen. */
// Das Leerzeichen ist auf dem Mac der wunde Punkt.
//
// "t: " übergibt cliclick ein Leerzeichen am Rand, und Rand wird abgeschnitten —
// im Dokument stand "Erstezeilehier". Der naheliegende Ersatz "kp:space" tat
// auf einem echten Rechner (macOS 26, cliclick installiert) schlicht gar
// nichts: von drei Leerzeichen kam keines an. Nachgemessen, nicht vermutet.
//
// Darum gibt es mehrere Wege und eine Probe, die herausfindet, welcher hier
// wirklich schreibt. Der gefundene Weg steht danach in den Einstellungen.
export const LEER_WEGE = {
  'applescript-keystroke': () => osa('tell application "System Events" to keystroke " "'),
  // Tastencode 49 ist die Leertaste — geht auch dort, wo keystroke streikt.
  'applescript-keycode': () => osa('tell application "System Events" to key code 49'),
  'cliclick-kp': () => pexec(CLICLICK, ['kp:space']),
  'cliclick-t': () => pexec(CLICLICK, ['t: ']),
}

export const LEER_REIHE = ['applescript-keystroke', 'applescript-keycode', 'cliclick-kp', 'cliclick-t']

const CLICLICK_TASTE = { '\t': 'kp:tab', '\n': 'kp:return', '\r': 'kp:return' }
const OSA_TASTE = { '\t': 'tab', '\n': 'return', '\r': 'return' }

/** Welchen cliclick-Befehl bekommt dieses Zeichen? Getrennt, damit prüfbar. */
export const cliclickBefehl = (z) => CLICLICK_TASTE[z] || `t:${z}`

/** Der Weg fürs Leerzeichen: eingestellter, sonst der erste der Reihe. */
export const leerWeg = () => {
  const gewaehlt = lesen().leerzeichenWeg
  return LEER_WEGE[gewaehlt] ? gewaehlt : LEER_REIHE[0]
}

export async function zeichen(z) {
  if (SYSTEM === 'darwin') {
    // Leerzeichen gehen ihren eigenen Weg — siehe oben.
    if (z === ' ') return void (await LEER_WEGE[leerWeg()]())
    if (CLICLICK) {
      // cliclick ist deutlich schneller als ein AppleScript-Aufruf pro Zeichen
      // und hält damit auch flottere Tempi durch.
      return void (await pexec(CLICLICK, [cliclickBefehl(z)]))
    }
    if (OSA_TASTE[z]) return void (await osa(`tell application "System Events" to keystroke ${OSA_TASTE[z]}`))
    const esc = z.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return void (await osa(`tell application "System Events" to keystroke "${esc}"`))
  }

  if (SYSTEM === 'win32') {
    const s = z === '\n' || z === '\r' ? '{ENTER}' : winEscape(z)
    return void (await pexec('powershell', [
      '-NoProfile',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait([char[]]@(${[...s]
        .map((c) => c.charCodeAt(0))
        .join(',')}) -join '')`,
    ]))
  }

  if (z === '\n' || z === '\r') return void (await pexec('xdotool', ['key', 'Return']))
  await pexec('xdotool', ['type', '--clearmodifiers', '--delay', '0', '--', z])
}

/**
 * Welcher Weg schreibt hier wirklich ein Leerzeichen?
 *
 * Probiert alle Wege der Reihe nach in einem frischen TextEdit-Fenster: "a",
 * Leerzeichen, "b" — und schaut, ob "a b" ankommt. Der erste, der es schafft,
 * wird in den Einstellungen vermerkt und ab dann benutzt.
 *
 * Das ist der einzige ehrliche Weg. Ob cliclick auf einer bestimmten
 * macOS-Fassung ein Leerzeichen setzt, steht in keiner Dokumentation
 * verlässlich — auf einem echten Rechner lieferte "kp:space" gar nichts.
 */
export async function leerzeichenFinden() {
  if (SYSTEM !== 'darwin') return { moeglich: false, grund: 'Die Probe gibt es bisher nur auf dem Mac.' }

  await osa('tell application "TextEdit" to activate')
  await new Promise((f) => setTimeout(f, 900))

  const ergebnisse = []
  let sieger = null
  for (const name of LEER_REIHE) {
    if (name.startsWith('cliclick') && !CLICLICK) {
      ergebnisse.push({ name, geht: false, grund: 'cliclick nicht installiert' })
      continue
    }
    try {
      await osa('tell application "TextEdit" to make new document')
      await new Promise((f) => setTimeout(f, 700))
      await zeichenRoh('a')
      await new Promise((f) => setTimeout(f, 120))
      await LEER_WEGE[name]()
      await new Promise((f) => setTimeout(f, 120))
      await zeichenRoh('b')
      await new Promise((f) => setTimeout(f, 400))
      const { stdout } = await pexec('osascript', [
        '-e',
        'tell application "TextEdit" to get text of front document',
      ])
      const kam = stdout.replace(/\n$/, '')
      await pexec('osascript', ['-e', 'tell application "TextEdit" to close front document saving no']).catch(() => {})
      const geht = kam.includes('a b')
      ergebnisse.push({ name, geht, kam })
      if (geht && !sieger) sieger = name
    } catch (err) {
      ergebnisse.push({ name, geht: false, grund: err.message.split('\n')[0] })
    }
  }

  if (sieger) schreiben({ leerzeichenWeg: sieger })
  return { moeglich: true, ergebnisse, sieger, gemerkt: !!sieger }
}

// Ein Zeichen ohne die Leerzeichen-Sonderbehandlung — für die Probe selbst.
async function zeichenRoh(z) {
  if (CLICLICK) return void (await pexec(CLICLICK, [cliclickBefehl(z)]))
  await osa(`tell application "System Events" to keystroke "${z}"`)
}

/**
 * Tipp-Probe auf dem Mac: in ein frisches TextEdit-Fenster schreiben und
 * zurücklesen, was wirklich angekommen ist.
 *
 * Ohne das lässt sich "der getippte Text klebt" nicht klären — auf einem
 * fremden Rechner sieht man nur das Ergebnis, nicht den Weg dorthin. Hier
 * schreibt Handschrift eine bekannte Zeichenfolge und vergleicht.
 *
 * Die Probe ist absichtlich ohne Satzzeichen und ohne echte Wörter: TextEdit
 * schreibt sonst selbst groß oder korrigiert, und die Probe meldete einen
 * Fehler, den es gar nicht gibt. Fehlende Leerzeichen kann es nicht erfinden —
 * darum ist deren Zahl das eigentliche Urteil.
 */
export async function tippProbe(text = 'abc def ghi jkl') {
  if (SYSTEM !== 'darwin') return { moeglich: false, grund: 'Die Probe gibt es bisher nur auf dem Mac.' }

  await osa('tell application "TextEdit" to activate')
  await new Promise((f) => setTimeout(f, 900))
  await osa('tell application "TextEdit" to make new document')
  await new Promise((f) => setTimeout(f, 900))

  for (const z of text) {
    await zeichen(z)
    await new Promise((f) => setTimeout(f, 45))
  }
  await new Promise((f) => setTimeout(f, 600))

  const { stdout } = await pexec('osascript', ['-e', 'tell application "TextEdit" to get text of front document'])
  const angekommen = stdout.replace(/\n$/, '')
  await pexec('osascript', ['-e', 'tell application "TextEdit" to close front document saving no']).catch(() => {})

  const leerzeichenGewollt = (text.match(/ /g) || []).length
  const leerzeichenAngekommen = (angekommen.match(/ /g) || []).length
  return {
    moeglich: true,
    weg: CLICLICK ? 'cliclick' : 'AppleScript',
    gewollt: text,
    angekommen,
    gleich: angekommen === text,
    leerzeichenGewollt,
    leerzeichenAngekommen,
    // Das ist die Frage, um die es geht. Groß- und Kleinschreibung kann TextEdit
    // von sich aus ändern; fehlende Leerzeichen kann es nicht.
    leerzeichenOk: leerzeichenAngekommen === leerzeichenGewollt,
  }
}
