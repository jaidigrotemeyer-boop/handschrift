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

// Reihenfolge nach Geschwindigkeit, nicht nach Vertrauen — welcher Weg hier
// überhaupt schreibt, entscheidet ohnehin die Probe, und die ist ehrlicher als
// jede Vermutung.
//
// Es geht dabei nicht um Bequemlichkeit. Ein osascript-Aufruf braucht rund
// hundert Millisekunden; bei 1200 Zeichen je Minute stehen für ein Zeichen
// fünfzig zur Verfügung. Dann staut es sich, und System Events antwortet
// irgendwann mit "Die Verbindung ist ungültig (-609)" — auf dem Rechner des
// Nutzers mitten im Lauf passiert. cliclick ist ein kleines Programm und
// vielfach schneller.
export const LEER_REIHE = ['cliclick-kp', 'cliclick-t', 'applescript-keystroke', 'applescript-keycode']

// Der Zeilenumbruch hat dasselbe Problem, und es fällt schlimmer aus.
//
// Ein verschlucktes Leerzeichen klebt zwei Wörter zusammen. Ein verschluckter
// Umbruch klebt das ganze Dokument zusammen: der Text, den Handschrift gerade
// mühsam in Überschriften, Stichpunkte und Schritte zerlegt hat, kommt drüben
// wieder als ein Klumpen an. Genau davon war die Rede.
//
// Also wird auch dieser Weg gesucht statt geraten.
export const UMBRUCH_WEGE = {
  'applescript-return': () => osa('tell application "System Events" to keystroke return'),
  // Tastencode 36 ist die Zeilenschalttaste.
  'applescript-keycode': () => osa('tell application "System Events" to key code 36'),
  'cliclick-kp': () => pexec(CLICLICK, ['kp:return']),
}

export const UMBRUCH_REIHE = ['cliclick-kp', 'applescript-return', 'applescript-keycode']

const CLICLICK_TASTE = { '\t': 'kp:tab', '\n': 'kp:return', '\r': 'kp:return' }
const OSA_TASTE = { '\t': 'tab', '\n': 'return', '\r': 'return' }

/** Welchen cliclick-Befehl bekommt dieses Zeichen? Getrennt, damit prüfbar. */
export const cliclickBefehl = (z) => CLICLICK_TASTE[z] || `t:${z}`

/** Der Weg fürs Leerzeichen: eingestellter, sonst der erste der Reihe. */
export const leerWeg = () => {
  const gewaehlt = lesen().leerzeichenWeg
  return LEER_WEGE[gewaehlt] ? gewaehlt : LEER_REIHE[0]
}

/** Der Weg für den Umbruch: eingestellter, sonst der erste der Reihe. */
export const umbruchWeg = () => {
  const gewaehlt = lesen().umbruchWeg
  return UMBRUCH_WEGE[gewaehlt] ? gewaehlt : UMBRUCH_REIHE[0]
}

/**
 * Wie schnell darf hier höchstens getippt werden?
 *
 * Nicht der Rhythmus setzt die Grenze, sondern das Werkzeug. Ein Aufruf von
 * osascript dauert rund hundert Millisekunden — verlangt man alle fünfzig ein
 * Zeichen, staut sich das, bis System Events aussteigt. Genau so starb ein Lauf
 * beim Nutzer: 3609 Zeichen in drei Minuten, also 47 ms je Zeichen, davon
 * mehrere hundert Leerzeichen über AppleScript.
 *
 * Entscheidend ist dabei, wie oft die langsame Taste vorkommt, nicht ob es sie
 * gibt.
 */
// Die Lage wird hereingereicht statt abgefragt, damit sich alle drei Fälle
// prüfen lassen — auch die beiden, die es nur auf einem Mac gibt.
export function mindestAbstandMs({ system = SYSTEM, cliclick = !!CLICLICK, leer = leerWeg() } = {}) {
  if (system !== 'darwin') return 45
  // Ohne cliclick läuft jedes einzelne Zeichen über AppleScript.
  if (!cliclick) return 120
  // Etwa jedes sechste Zeichen ist ein Leerzeichen. Geht das über AppleScript,
  // bestimmt es das Tempo des ganzen Laufs.
  if (leer.startsWith('applescript')) return 120
  // Der Umbruch allein zählt nicht. Er kommt vielleicht alle hundert Zeichen,
  // und an einer Absatzgrenze wird ohnehin am längsten gewartet — dort ist Zeit
  // für einen langsamen Anschlag. Auf einem Mac, wo cliclick zwar das
  // Leerzeichen schreibt, aber kp:return nichts tut, hätten 120 ms sonst das
  // ganze Dokument ausgebremst, wegen dreißig Tasten.
  return 45
}

/**
 * Wie wird auf diesem Rechner wirklich getippt? Nur für die Selbstauskunft.
 *
 * Es lohnt sich, das getrennt zu beantworten: die Selbstauskunft meldete auf
 * einem Linux-Rechner "Leerzeichen über applescript-keystroke", weil sie den
 * Mac-Weg ungefragt mit ausgab. Das ist keine Kleinigkeit — wer bei "geht
 * nicht" die Auskunft liest, sucht dann an einer Stelle, die es hier gar nicht
 * gibt.
 */
export function tippWege() {
  if (SYSTEM === 'darwin')
    return {
      werkzeug: CLICLICK ? `cliclick (${CLICLICK})` : 'AppleScript',
      leerzeichen: leerWeg(),
      umbruch: umbruchWeg(),
    }
  if (SYSTEM === 'win32')
    return { werkzeug: 'PowerShell SendKeys', leerzeichen: 'läuft normal mit', umbruch: '{ENTER}' }
  return { werkzeug: 'xdotool type', leerzeichen: 'läuft normal mit', umbruch: 'xdotool key Return' }
}

/**
 * Eine Sondertaste anschlagen — und nicht beim ersten Zucken aufgeben.
 *
 * Auf dem Rechner des Nutzers starb ein Lauf über 3609 Zeichen mitten drin an
 * einer einzigen Meldung:
 *
 *   System Events hat einen Fehler erhalten: Die Verbindung ist ungültig. (-609)
 *
 * Das ist kein dauerhafter Defekt, sondern ein überfahrenes System Events. Ein
 * kurzes Durchatmen genügt meist. Hilft auch das nicht, wird der nächste Weg
 * aus der Reihe genommen und, wenn er trägt, gemerkt — der Lauf geht weiter,
 * statt nach zwei Minuten Tippen abzubrechen.
 */
export async function sondertaste(wege, reihe, jetziger, schluessel) {
  const versuche = [jetziger, jetziger, ...reihe.filter((n) => n !== jetziger)]
  let letzter = null
  for (let i = 0; i < versuche.length; i++) {
    const name = versuche[i]
    if (name.startsWith('cliclick') && !CLICLICK) continue
    try {
      await wege[name]()
      // Ein anderer Weg hat es getan: ab jetzt gleich diesen nehmen.
      // Ohne Schlüssel wird nichts gemerkt — das braucht die Prüfung, die den
      // Weg nur durchspielen und nicht die Einstellungen umschreiben will.
      if (name !== jetziger && schluessel) schreiben({ [schluessel]: name })
      return
    } catch (err) {
      letzter = err
      await new Promise((f) => setTimeout(f, 120))
    }
  }
  throw letzter || new Error('Keine Taste ging.')
}

export async function zeichen(z) {
  if (SYSTEM === 'darwin') {
    // Leerzeichen und Umbruch gehen ihren eigenen Weg — siehe oben.
    if (z === ' ') return void (await sondertaste(LEER_WEGE, LEER_REIHE, leerWeg(), 'leerzeichenWeg'))
    if (z === '\n' || z === '\r')
      return void (await sondertaste(UMBRUCH_WEGE, UMBRUCH_REIHE, umbruchWeg(), 'umbruchWeg'))
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
  // Umlaute und alles andere jenseits von ASCII gehen über den Tastennamen,
  // nicht über "type" — siehe unten.
  if (z.codePointAt(0) > 127) return void (await pexec('xdotool', ['key', '--clearmodifiers', tastenName(z)]))
  await pexec('xdotool', ['type', '--clearmodifiers', '--delay', '0', '--', z])
}

// "xdotool type" und die Umlaute — zweimal falsch, bis es gemessen war.
//
// Ohne UTF-8 in der Umgebung bricht es hart ab: "Invalid multi-byte sequence
// encountered". Weil jedes Zeichen einzeln getippt wird, endet der ganze Lauf
// dann mitten im ersten Wort mit Umlaut. Ein deutscher Text kommt nie durch.
//
// Setzt man LC_ALL=C.UTF-8 dazu, ist der Fehler weg — und das Zeichen trotzdem
// auch: "Lücken" kam als "Lcken" an, "(äöü)" als "()". Kein Fehler, keine
// Meldung, nur weniger Text. Das ist derselbe stille Verlust wie beim
// Leerzeichen auf dem Mac, und er fällt genauso erst beim Nachlesen auf.
//
// Über den Tastennamen kommt das Zeichen an, nachgemessen als 303 274 — ü.
/** Der Tastenname für ein Zeichen — "ü" wird zu "U00FC". Getrennt, damit prüfbar. */
export const tastenName = (z) => 'U' + z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')

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
async function wegSuchen({ reihe, wege, erkennen, schluessel }) {
  const ergebnisse = []
  let sieger = null
  for (const name of reihe) {
    if (name.startsWith('cliclick') && !CLICLICK) {
      ergebnisse.push({ name, geht: false, grund: 'cliclick nicht installiert' })
      continue
    }
    try {
      await osa('tell application "TextEdit" to make new document')
      await new Promise((f) => setTimeout(f, 700))
      await zeichenRoh('a')
      await new Promise((f) => setTimeout(f, 120))
      await wege[name]()
      await new Promise((f) => setTimeout(f, 120))
      await zeichenRoh('b')
      await new Promise((f) => setTimeout(f, 400))
      const { stdout } = await pexec('osascript', [
        '-e',
        'tell application "TextEdit" to get text of front document',
      ])
      const kam = stdout.replace(/\n$/, '')
      await pexec('osascript', ['-e', 'tell application "TextEdit" to close front document saving no']).catch(() => {})
      const geht = erkennen(kam)
      ergebnisse.push({ name, geht, kam })
      if (geht && !sieger) sieger = name
    } catch (err) {
      ergebnisse.push({ name, geht: false, grund: err.message.split('\n')[0] })
    }
  }
  if (sieger) schreiben({ [schluessel]: sieger })
  return { moeglich: true, ergebnisse, sieger, gemerkt: !!sieger }
}

export async function leerzeichenFinden() {
  if (SYSTEM !== 'darwin') return { moeglich: false, grund: 'Die Probe gibt es bisher nur auf dem Mac.' }
  await osa('tell application "TextEdit" to activate')
  await new Promise((f) => setTimeout(f, 900))
  return wegSuchen({
    reihe: LEER_REIHE,
    wege: LEER_WEGE,
    erkennen: (kam) => kam.includes('a b'),
    schluessel: 'leerzeichenWeg',
  })
}

/**
 * Und welcher Weg macht hier wirklich eine neue Zeile auf?
 *
 * Dieselbe Probe, dieselbe Not. Fällt der Umbruch aus, kommt der Text, den
 * Handschrift gerade in Überschriften, Stichpunkte und Schritte zerlegt hat,
 * drüben wieder als ein einziger Klumpen an — verklebt, obwohl er entklebt
 * losgeschickt wurde.
 *
 * TextEdit gibt seine Zeilen mal mit \n, mal mit \r zurück. Geprüft wird
 * darum, ob zwischen "a" und "b" überhaupt ein Zeilenende steht.
 */
export async function umbruchFinden() {
  if (SYSTEM !== 'darwin') return { moeglich: false, grund: 'Die Probe gibt es bisher nur auf dem Mac.' }
  await osa('tell application "TextEdit" to activate')
  await new Promise((f) => setTimeout(f, 900))
  return wegSuchen({
    reihe: UMBRUCH_REIHE,
    wege: UMBRUCH_WEGE,
    erkennen: (kam) => /a[\r\n]+b/.test(kam),
    schluessel: 'umbruchWeg',
  })
}

/** Beide Sondertasten hintereinander — was der erste Lauf braucht. */
export async function sondertastenFinden() {
  const leer = await leerzeichenFinden()
  if (!leer.moeglich) return { moeglich: false, grund: leer.grund }
  const umbruch = await umbruchFinden()
  return { moeglich: true, leer, umbruch }
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
 *
 * Und ein Umbruch steht mit drin, seit klar ist, dass er genauso ausfallen
 * kann wie das Leerzeichen. Fällt er aus, kommt ein gegliedertes Dokument
 * drüben wieder als ein Klumpen an.
 */
export async function tippProbe(text = 'abc def\nghi jkl') {
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
  // TextEdit gibt seine Zeilenenden mal als \r zurück, mal als \n. Das ist
  // kein Unterschied, um den es hier geht.
  const angekommen = stdout.replace(/\n$/, '').replace(/\r\n?/g, '\n')
  await pexec('osascript', ['-e', 'tell application "TextEdit" to close front document saving no']).catch(() => {})

  const zaehlen = (s, muster) => (s.match(muster) || []).length
  const leerzeichenGewollt = zaehlen(text, / /g)
  const leerzeichenAngekommen = zaehlen(angekommen, / /g)
  const umbruecheGewollt = zaehlen(text, /\n/g)
  const umbruecheAngekommen = zaehlen(angekommen, /\n/g)
  return {
    moeglich: true,
    weg: CLICLICK ? 'cliclick' : 'AppleScript',
    gewollt: text,
    angekommen,
    gleich: angekommen === text,
    leerzeichenGewollt,
    leerzeichenAngekommen,
    umbruecheGewollt,
    umbruecheAngekommen,
    // Darum geht es. Groß- und Kleinschreibung kann TextEdit von sich aus
    // ändern; fehlende Leerzeichen und fehlende Umbrüche kann es nicht.
    leerzeichenOk: leerzeichenAngekommen === leerzeichenGewollt,
    umbruchOk: umbruecheAngekommen === umbruecheGewollt,
  }
}
