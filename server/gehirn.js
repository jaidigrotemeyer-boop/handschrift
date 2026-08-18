// Umschreiben braucht ein Sprachmodell.
//
// Ollama läuft daheim und kostet nichts — es wird zuerst gefragt und braucht
// keinen Schlüssel. Danach vier Anbieter mit Gratis-Kontingent. Ohne alles
// bleibt das Messen nutzbar; nur das Umschreiben fehlt dann.
//
// Wichtiger als der Anbieter ist, was danach passiert: die Antwort wird
// nachgemessen. Ein Modell, das "mach es weniger nach Fließband" hört, liefert
// oft dieselben Floskeln in neuer Reihenfolge. Darum zählt hier nicht die
// Absicht, sondern das Ergebnis — und wenn es nicht besser ist, wird noch
// einmal gefragt, diesmal mit dem, was übrig geblieben ist.
import os from 'node:os'
import { lesen } from './config.js'
import { messen } from './messen.js'
import { bloecke, zusammensetzen, lektorierbar } from './bloecke.js'

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'

const OPENAI_ART = {
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', modell: 'llama-3.3-70b', schluessel: 'cerebrasKey' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', modell: 'llama-3.3-70b-versatile', schluessel: 'groqKey' },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    modell: 'meta-llama/llama-3.3-70b-instruct:free',
    schluessel: 'openrouterKey',
  },
}

async function openaiArt(name, nachrichten, signal) {
  const { url, modell, schluessel } = OPENAI_ART[name]
  const antwort = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${lesen()[schluessel]}` },
    body: JSON.stringify({ model: modell, messages: nachrichten, temperature: 0.85 }),
    signal,
  })
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status} ${(await antwort.text()).slice(0, 160)}`)
  return (await antwort.json()).choices?.[0]?.message?.content || ''
}

async function gemini(nachrichten, signal) {
  const system = nachrichten.find((n) => n.role === 'system')?.content
  const antwort = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${lesen().geminiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: nachrichten.filter((n) => n.role !== 'system').map((n) => ({ role: 'user', parts: [{ text: n.content }] })),
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature: 0.85 },
      }),
      signal,
    },
  )
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status} ${(await antwort.text()).slice(0, 160)}`)
  const daten = await antwort.json()
  return (daten.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
}

/**
 * Welches Modell nehmen, wenn mehrere da sind? Größer ist beim Lektorieren
 * spürbar besser, darum wird nach der Milliarden-Zahl im Namen sortiert.
 * Modelle ohne Zahl landen dazwischen; reine Einbettungs- und Bildmodelle
 * fliegen raus, die können keinen Text schreiben.
 */
/**
 * Wie viel Arbeitsspeicher darf ein Modell belegen? Nicht alles: das
 * Betriebssystem, der Browser und Handschrift selbst brauchen auch etwas.
 * Auf einem 8-GB-Rechner bleiben so gut vier Gigabyte — und genau dort ist die
 * Entscheidung wichtig, denn ein zu großes Modell lädt nicht, sondern
 * beginnt zu tauschen und braucht Minuten je Absatz.
 */
export function speicherBudget(gesamtBytes = os.totalmem()) {
  return Math.max(1.2e9, Math.round(gesamtBytes * 0.55))
}

const KANN_KEIN_TEXT = /embed|bge|clip|llava|moondream|vision|whisper|stable-?diffusion/i

// Ohne Größenangabe: aus dem Namen schätzen. Ein Modell mit "7b" belegt grob
// vier Gigabyte in der üblichen Quantisierung, also ungefähr 0,6 GB je
// Milliarde Parameter.
const ausNamen = (name) => {
  const t = String(name).match(/(\d+(?:[.,]\d+)?)\s*b\b/i)
  return t ? Number(t[1].replace(',', '.')) * 0.6e9 : 2.5e9
}

/**
 * Das größte Modell, das noch in den Speicher passt — nicht das größte
 * überhaupt. Passt keines, wird das kleinste genommen und die Entscheidung
 * dem Rechner überlassen; gar nichts anzubieten wäre schlechter.
 *
 * Nimmt Namen (dann wird geschätzt) oder die Einträge aus /api/tags mit ihrer
 * echten Größe.
 */
export function bestesModell(modelle, budget = speicherBudget()) {
  const liste = (modelle || [])
    .map((m) => (typeof m === 'string' ? { name: m, size: ausNamen(m) } : { name: m.name, size: m.size || ausNamen(m.name) }))
    .filter((m) => m.name && !KANN_KEIN_TEXT.test(m.name))
  if (!liste.length) return null
  const passend = liste.filter((m) => m.size <= budget).sort((a, b) => b.size - a.size)
  if (passend.length) return passend[0].name
  return liste.sort((a, b) => a.size - b.size)[0].name
}

// Ein 3B-Modell schafft diese Aufgabe oft nicht. Es liefert dieselben Floskeln
// in neuer Reihenfolge, bläht den Absatz auf oder erfindet etwas dazu — auf dem
// Rechner des Nutzers nachgelesen. Die Tore fangen das ab, aber dann bleibt der
// Absatz eben stehen, und das ist auch keine Lösung.
//
// Größen wie bei Ollama angegeben. Sie sind grob; es geht darum, ob überhaupt
// etwas Besseres in den Speicher passt.
const BESSER = [
  { name: 'qwen2.5:7b', size: 4.7e9, warum: 'folgt Anweisungen deutlich genauer' },
  { name: 'llama3.1:8b', size: 4.9e9, warum: 'gutes Deutsch, etwas größer' },
  { name: 'gemma2:9b', size: 5.4e9, warum: 'sehr ordentliches Deutsch' },
  { name: 'qwen2.5:14b', size: 9.0e9, warum: 'merklich besser, braucht aber Platz' },
]

/**
 * Gibt es ein besseres Modell, das hier noch hineinpasst?
 *
 * Nur zum Vorschlagen — geladen wird nichts von selbst. Es ist die Leitung und
 * die Festplatte des Nutzers.
 */
export function modellVorschlag(vorhandene = [], budget = speicherBudget()) {
  const daten = (vorhandene || []).map((m) => (typeof m === 'string' ? m : m.name))
  const jetzt = bestesModell(vorhandene, budget)
  const jetztGross = jetzt ? (vorhandene.find((m) => (m.name || m) === jetzt)?.size ?? ausNamen(jetzt)) : 0
  const passt = BESSER.filter(
    (m) => m.size <= budget && m.size > jetztGross && !daten.some((n) => String(n).startsWith(m.name)),
  )
  return passt.sort((a, b) => b.size - a.size)[0] || null
}

async function ollama(nachrichten, signal) {
  const c = lesen()
  const modell = c.ollamaModell || bestesModell((await ollamaDa())?.modelle || []) || 'llama3.2:3b'
  const antwort = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Ein Absatz ist kurz — mehr als 700 Token braucht die Antwort nie, und die
    // Grenze hindert kleine Modelle daran, ins Fabulieren zu geraten.
    body: JSON.stringify({
      model: modell,
      messages: nachrichten,
      stream: false,
      options: { temperature: 0.8, num_predict: 700 },
    }),
    signal,
  })
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status} ${(await antwort.text()).slice(0, 160)}`)
  return (await antwort.json()).message?.content || ''
}

// Die Oberfläche fragt den Stand alle 400 ms ab, solange getippt wird. Ohne
// dieses kurze Gedächtnis klopfte jeder dieser Abrufe bei Ollama an — zweieinhalb
// Netzanfragen pro Sekunde, nur um dieselbe Antwort zu bekommen.
let ollamaMerker = { bis: 0, wert: null }

/** Läuft daheim ein Ollama? Kurzer Anklopfer, damit die Oberfläche es weiß. */
export async function ollamaDa() {
  if (Date.now() < ollamaMerker.bis) return ollamaMerker.wert
  let wert = null
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1200) })
    if (r.ok) {
      const modelle = (await r.json()).models || []
      // Die Größe kommt mit — sie entscheidet, welches Modell auf diesem
      // Rechner überhaupt läuft.
      wert = { modelle: modelle.map((m) => ({ name: m.name, size: m.size || 0 })), url: OLLAMA }
    }
  } catch {
    wert = null
  }
  // Gefunden: fünf Sekunden glauben. Nicht gefunden: nur zwei, damit ein frisch
  // gestartetes Ollama nicht lange unsichtbar bleibt.
  ollamaMerker = { bis: Date.now() + (wert ? 5000 : 2000), wert }
  return wert
}

/** Wer gerade antworten könnte, in der Reihenfolge, in der gefragt wird. */
export async function anbieter() {
  const c = lesen()
  const liste = []
  const o = await ollamaDa()
  if (o?.modelle.length) liste.push({ name: `ollama (${c.ollamaModell || bestesModell(o.modelle)})`, fragen: ollama })
  if (c.geminiKey) liste.push({ name: 'gemini', fragen: gemini })
  for (const n of ['cerebras', 'groq', 'openrouter'])
    if (c[OPENAI_ART[n].schluessel]) liste.push({ name: n, fragen: (m, s) => openaiArt(n, m, s) })
  return liste
}

export const einerDa = async () => (await anbieter()).length > 0

// ────────────────────────────────────────────────────────────────────────────
// Bewerten
// ────────────────────────────────────────────────────────────────────────────

/**
 * Eine Zahl für "wie sehr klingt das nach Fließband" — klein ist gut.
 * Ohne sie ließe sich nicht entscheiden, ob eine Überarbeitung etwas gebracht
 * hat oder nur anders schlecht ist.
 */
export function bewertung(m) {
  if (!m.satz.anzahl) return 0
  const gleichmassStrafe = Math.max(0, 0.35 - m.satz.gleichmass) * 100
  const mittelbauStrafe = Math.max(0, m.mittelbauProzent - 60) * 0.4
  // Die Rate allein war angreifbar: dieselben fünf Floskeln auf 61 % mehr
  // Wörter verteilt ergaben 122 statt 75 je 1000 — die Punkte fielen von 231
  // auf 144, obwohl keine einzige Floskel verschwunden war. Ein kleines Modell
  // findet diesen Weg von selbst. Darum zählt die schiere Anzahl mit.
  const floskelStrafe = m.floskeln.anzahl * 4 + m.floskeln.proTausend * 0.8
  return +(m.auffaellig.length * 6 + floskelStrafe + gleichmassStrafe + mittelbauStrafe).toFixed(1)
}

// ────────────────────────────────────────────────────────────────────────────
// Antwort säubern
// ────────────────────────────────────────────────────────────────────────────

const VORREDE =
  /^(?:hier ist(?: der)?[^\n:]{0,60}:|überarbeitete[rn]? (?:fassung|text)[^\n:]{0,30}:|here(?:'s| is)[^\n:]{0,60}:|sure[,!][^\n]{0,60}:?)\s*/i

/**
 * Modelle liefern gern eine Vorrede oder packen alles in einen Code-Block,
 * obwohl im Auftrag steht, dass sie das nicht sollen. Das hier räumt auf,
 * statt die Antwort deswegen zu verwerfen.
 */
export function saeubern(roh) {
  let t = String(roh || '').trim()
  const block = t.match(/^```[\w-]*\n([\s\S]*?)\n```$/)
  if (block) t = block[1].trim()
  t = t.replace(VORREDE, '').trim()
  // Ein nachgeschobener Kommentar hinter einer Trennlinie gehört nicht zum Text.
  t = t.replace(/\n+(?:---+|___+)\n[\s\S]*$/, '').trim()
  // Manche Modelle legen den ganzen Text in Anführungszeichen, als würden sie
  // ihn zitieren.
  const zitat = t.match(/^["„»“](.*)["“«”]$/s)
  if (zitat && !/["„»]/.test(zitat[1])) t = zitat[1].trim()
  return t
}

/**
 * Stichpunkte gehören untereinander, nicht nebeneinander.
 *
 * Modelle geben Listen gern als eine einzige Zeile zurück
 * ("- Punkt eins - Punkt zwei - Punkt drei"). Gesplittet wird nur, wenn die
 * Zeile schon mit einem Aufzählungszeichen beginnt — dann sind die weiteren
 * Zeichen mit Sicherheit auch welche und kein Gedankenstrich im Fließtext.
 */
export function listenAufraeumen(text) {
  const zeilen = String(text).split('\n')
  const raus = []
  for (const zeile of zeilen) {
    if (/^\s*[-*+]\s+\S/.test(zeile)) {
      raus.push(...zeile.trimEnd().split(/\s+(?=[-*+]\s+\S)/))
    } else if (/^\s*\d+\.\s+\S/.test(zeile)) {
      raus.push(...zeile.trimEnd().split(/\s+(?=\d+\.\s+\S)/))
    } else {
      raus.push(zeile)
    }
  }

  // Überschrift und Listenblock brauchen Luft, sonst klebt in Markdown alles
  // aneinander und die Liste wird gar nicht als Liste erkannt.
  const fertig = []
  for (const [i, zeile] of raus.entries()) {
    const vorher = raus[i - 1]
    const istPunkt = /^\s*(?:[-*+]|\d+\.)\s+/.test(zeile)
    const istKopf = /^#{1,6}\s/.test(zeile)
    const vorherPunkt = vorher !== undefined && /^\s*(?:[-*+]|\d+\.)\s+/.test(vorher)
    const vorherLeer = vorher === undefined || !vorher.trim()
    if ((istKopf || (istPunkt && !vorherPunkt)) && !vorherLeer) fertig.push('')
    if (!istKopf && !istPunkt && vorherPunkt && zeile.trim()) fertig.push('')
    fertig.push(zeile)
    if (istKopf && raus[i + 1]?.trim()) fertig.push('')
  }
  return fertig.join('\n')
}

/**
 * Kleinkram glätten, der sonst sofort als "komisch" ins Auge fällt: Leerzeichen
 * am Zeilenende, drei Leerzeilen am Stück, Überschriften ohne Leerzeichen hinter
 * der Raute, nebeneinander geklebte Stichpunkte, und typografische
 * Anführungszeichen in einem Text, der vorher gerade hatte (oder umgekehrt).
 */
export function putzen(neu, original) {
  let t = String(neu || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    // "#Titel" ohne Leerzeichen ist keine Überschrift, sieht aber wie eine aus.
    .replace(/^(#{1,6})(\S)/gm, '$1 $2')

  t = listenAufraeumen(t)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const krumm = (s) => (s.match(/[„“”»«]/g) || []).length
  const gerade = (s) => (s.match(/"/g) || []).length
  if (krumm(original) === 0 && krumm(t) > 0) t = t.replace(/[„“”]/g, '"').replace(/[»«]/g, '"')
  else if (gerade(original) === 0 && krumm(original) > 0 && gerade(t) > 0) {
    // Zurück auf deutsche Anführungszeichen, paarweise von links nach rechts.
    let auf = true
    t = t.replace(/"/g, () => ((auf = !auf) ? '“' : '„'))
  }
  return t
}

// ────────────────────────────────────────────────────────────────────────────
// Sieht das noch aus wie der Text, den man reingegeben hat?
// ────────────────────────────────────────────────────────────────────────────

const geruest = (t) => ({
  absaetze: t.split(/\n\s*\n/).filter((a) => a.trim()).length,
  // Nicht nur zählen, sondern die Ebenen merken: eine H1, die als H3
  // zurückkommt, ist plötzlich klein — der Text sieht anders aus, obwohl die
  // Anzahl stimmt.
  ebenen: (t.match(/^#{1,6} /gm) || []).map((h) => h.trim().length).join(''),
  ueberschriften: (t.match(/^#{1,6} /gm) || []).length,
  listen: (t.match(/^\s*(?:[-*+]|\d+\.)\s+/gm) || []).length,
  code: (t.match(/^```/gm) || []).length,
})

// Grobe Sprachprobe über die häufigsten Funktionswörter. Reicht völlig, um
// zu merken, dass ein Modell auf Englisch geantwortet hat — ein Fehler, den
// kleine Modelle regelmäßig machen und der sofort auffällt.
const DE = /\b(?:der|die|das|und|ist|nicht|ein|eine|zu|von|mit|sich|auf|für|dass|den|dem|im|als|auch|wird|sind)\b/gi
const EN = /\b(?:the|and|is|not|a|an|to|of|with|for|that|in|as|are|this|it|on|be|by|from)\b/gi
const anteil = (t, muster) => (t.match(muster) || []).length / Math.max(1, (t.match(/\S+/g) || []).length)

/**
 * 'de', 'en' — oder null, wenn die Probe zu dünn ist. Das null ist wichtig:
 * "Anderer Absatz. Eins. Zwei." enthält kein einziges Funktionswort, und ein
 * erzwungenes Urteil darüber meldete früher einen Sprachwechsel, wo keiner war.
 */
export function sprache(t) {
  const woerter = (t.match(/\S+/g) || []).length
  const de = (t.match(DE) || []).length
  const en = (t.match(EN) || []).length
  if (woerter < 8 || de + en < 3 || de === en) return null
  return de > en ? 'de' : 'en'
}

export const istDeutsch = (t) => sprache(t) === 'de'

/**
 * Was am Ergebnis formal kaputt ist. Leere Liste heißt: sieht aus wie vorher,
 * nur besser geschrieben.
 */
export function strukturPruefen(original, neu) {
  const a = geruest(original)
  const b = geruest(neu)
  const klagen = []

  if (a.ueberschriften !== b.ueberschriften)
    klagen.push(`Überschriften: ${a.ueberschriften} vorher, ${b.ueberschriften} nachher`)
  else if (a.ebenen !== b.ebenen) klagen.push('Überschriften-Ebenen verschoben (aus groß wurde klein oder umgekehrt)')
  if (a.listen !== b.listen) klagen.push(`Listenpunkte: ${a.listen} vorher, ${b.listen} nachher`)
  if (a.code !== b.code) klagen.push(`Code-Zäune: ${a.code} vorher, ${b.code} nachher`)
  // Absätze dazu sind kein Schaden, verlorene schon: dann ist der Text zur
  // Wand zusammengelaufen.
  if (b.absaetze < a.absaetze) klagen.push(`Absätze verloren: ${a.absaetze} vorher, ${b.absaetze} nachher`)

  const a1 = sprache(original)
  const b1 = sprache(neu)
  if (a1 && b1 && a1 !== b1) klagen.push(`Sprache gewechselt: ${a1} → ${b1}`)

  // Abbruch mitten im Satz — beim Original zählt das letzte echte Zeichen.
  const endetSauber = (t) => /[.!?…:;"'“”»)\]\d]$/.test(t.trim())
  if (endetSauber(original) && !endetSauber(neu)) klagen.push('endet mitten im Satz')

  return klagen
}

// ────────────────────────────────────────────────────────────────────────────
// Was für ein Text ist das überhaupt?
// ────────────────────────────────────────────────────────────────────────────

/**
 * Ein Merkblatt aus Stichpunkten will anders lektoriert werden als ein Aufsatz.
 * Ohne diese Unterscheidung macht das Modell aus jeder Liste Fließtext — und
 * das ist die häufigste Art, wie eine Überarbeitung "komisch" wird.
 */
export function textArt(t) {
  const g = geruest(t)
  const zeilen = t.split('\n').filter((z) => z.trim()).length
  if (g.code > 0) return 'code'
  if (g.ueberschriften > 0 && g.listen > 0) return 'dokument'
  if (g.ueberschriften > 0) return 'gegliedert'
  if (g.listen >= Math.max(3, zeilen * 0.5)) return 'liste'
  return 'fliesstext'
}

const FORMHINWEIS = {
  fliesstext: 'Es ist Fließtext ohne Gliederung. Lass ihn Fließtext — bau keine Überschriften und keine Aufzählungen ein.',
  liste:
    'Es ist eine Aufzählung. Sie bleibt eine Aufzählung: jeder Stichpunkt steht in einer eigenen Zeile, mit demselben Zeichen davor. Mach daraus keinen Fließtext und häng die Punkte nicht aneinander.',
  gegliedert:
    'Der Text hat Überschriften. Behalte sie und ihre Ebene: aus einer großen Überschrift (#) darf keine kleine (###) werden und umgekehrt.',
  dokument:
    'Der Text hat Überschriften und Aufzählungen. Beides bleibt, mit denselben Ebenen und derselben Anzahl. Stichpunkte stehen untereinander, jeder in einer eigenen Zeile.',
  code: 'Im Text stehen Code-Blöcke. Der Code bleibt Zeichen für Zeichen, wie er ist — überarbeitet wird nur der Text drumherum.',
}

// ────────────────────────────────────────────────────────────────────────────
// Umschreiben
// ────────────────────────────────────────────────────────────────────────────

const AUFTRAG = `Du bist Lektor. Du überarbeitest einen Text, damit er nicht mehr nach Fließband klingt.

Feste Regeln:
- Der Inhalt bleibt. Keine neue Behauptung, keine neue Zahl, kein neues Beispiel, nichts weglassen.
- Sprache des Originals beibehalten.
- Länge um höchstens ein Zehntel verändern.
- Überschriften, Listen, Zitate, Code und Links bleiben, wie sie sind.
- Antworte ausschließlich mit dem überarbeiteten Text. Keine Vorrede, kein Kommentar, keine Code-Blöcke.

Woran du arbeitest:
- Satzlängen mischen. Auch mal ein Satz mit drei Wörtern. Auch mal ein langer.
- Floskeln und Übergangswörter streichen. Achtung im Deutschen: fällt ein
  vorangestelltes "Darüber hinaus" oder "Zudem" weg, muss der Satz zurück in
  die normale Stellung ("Zudem bietet die Technik X" wird "Die Technik bietet X").
- Wiederholte Satzanfänge auflösen.
- Nicht jeden Absatz gleich lang bauen.
- Aktiv statt Substantivketten. Konkretes Wort statt Allerweltswort.
- Die Stimme des Autors nicht gegen deine eigene tauschen.`

const anfrage = (text, funde, ton, extra, runde, nachtrag) => [
  { role: 'system', content: AUFTRAG },
  {
    role: 'user',
    content: [
      FORMHINWEIS[textArt(text)],
      '',
      nachtrag
        ? `Dein letzter Versuch war formal unbrauchbar: ${nachtrag}. Gib den Text diesmal in genau derselben Form zurück — gleiche Absätze, gleiche Überschriften, gleiche Listen, gleiche Sprache, vollständig bis zum letzten Satz.`
        : '',
      runde > 1 && !nachtrag
        ? 'Das war schon ein Versuch, aber diese Schwächen sind geblieben. Geh sie diesmal wirklich an:'
        : 'Gemessene Schwächen dieses Textes:',
      funde.length ? `- ${funde.join('\n- ')}` : '(keine — fass den Text nur an, wo es wirklich besser wird)',
      ton ? `\nGewünschter Ton: ${ton}` : '',
      extra ? `\n${extra}` : '',
      '',
      'Hier der Text:',
      '',
      text,
    ]
      .filter(Boolean)
      .join('\n'),
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Umschreiben — Absatz für Absatz
// ────────────────────────────────────────────────────────────────────────────

/**
 * Absatzweise statt am Stück. Der Grund ist ein kleines Modell daheim: an
 * einem ganzen Dokument scheitert es zuverlässig, an einem einzelnen Absatz
 * nicht. Nebenbei kann die Form gar nicht kaputtgehen — Überschriften, Listen
 * und Code werden nie verschickt, sondern unverändert wieder eingesetzt.
 *
 * Misslingt ein Absatz, bleibt genau dieser Absatz stehen. Vorher fiel in dem
 * Fall die ganze Überarbeitung durch.
 */
/**
 * Aus einem Netzfehler einen Satz machen, mit dem sich etwas anfangen lässt.
 *
 * Node nennt eine nicht zustande gekommene Verbindung "fetch failed". Wer daheim
 * Ollama beendet hat und dann auf Umschreiben drückt, las bisher:
 *
 *   Kein Gehirn hat geantwortet.
 *   ollama (llama3.2:3b): fetch failed
 *
 * Beides stimmt und beides hilft nicht. Die eigentliche Auskunft — starte
 * Ollama wieder — stand nur in der Meldung für den Fall, dass beim Start schon
 * keines da war.
 */
export function netzKlartext(name, err) {
  const roh = err?.message || String(err)
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(roh))
    return /ollama/i.test(name)
      ? `${name}: antwortet nicht mehr. Läuft "ollama serve" noch?`
      : `${name}: keine Verbindung — hängt das Netz?`
  if (/timeout|timed out|abort/i.test(roh)) return `${name}: hat zu lange gebraucht.`
  if (/\b401\b|unauthorized|invalid.*key/i.test(roh)) return `${name}: der Schlüssel wird nicht angenommen.`
  if (/\b429\b|rate.?limit/i.test(roh)) return `${name}: zu viele Anfragen — später noch einmal.`
  return `${name}: ${roh}`
}

export async function umschreiben(text, { ton, extra, signal, versucheJeBlock = 2, fragen } = {}) {
  const roh = String(text || '').trim()
  if (!roh) throw new Error('Kein Text da.')

  const stelle = fragen ? [{ name: 'prüfstand', fragen }] : await anbieter()
  if (!stelle.length)
    throw new Error(
      'Kein Gehirn erreichbar. Entweder Ollama daheim starten (ollama serve, kein Schlüssel nötig) ' +
        'oder einen Gratis-Schlüssel in den Einstellungen eintragen. Das Messen läuft auch ohne.',
    )

  const vorher = { ...messen(roh), art: textArt(roh) }
  const liste = bloecke(roh)
  const dran = liste.filter(lektorierbar)
  if (!dran.length)
    throw new Error('Nichts zu lektorieren: der Text besteht aus Überschriften, Listen, Code oder sehr kurzen Absätzen.')

  const netzfehler = []
  let anbieterName = null
  let lektoriert = 0
  const behalten = []

  for (const block of liste) {
    if (signal?.aborted) break
    if (!lektorierbar(block)) continue

    const vorBlock = messen(block.text)
    let genommen = null
    let grund = 'unverändert gelassen'

    for (let versuch = 1; versuch <= Math.max(1, versucheJeBlock) && !genommen; versuch++) {
      const nachrichten = blockAnfrage(block.text, vorBlock.auffaellig, ton, extra, grund, versuch)

      let antwort = null
      for (const a of stelle) {
        try {
          antwort = putzen(saeubern(await a.fragen(nachrichten, signal)), block.text)
          anbieterName = anbieterName || a.name
          break
        } catch (err) {
          if (err?.name === 'AbortError') throw err
          netzfehler.push(netzKlartext(a.name, err))
        }
      }
      if (antwort === null) break

      const klage = blockPruefen(block.text, antwort, vorBlock)
      if (klage) grund = klage
      else genommen = antwort
    }

    if (genommen) {
      block.text = genommen
      lektoriert++
    } else {
      behalten.push(grund)
    }
  }

  if (!anbieterName) throw new Error(`Kein Gehirn hat geantwortet.\n${[...new Set(netzfehler)].join('\n')}`)

  const neu = zusammensetzen(liste)

  // Sollte nach dem blockweisen Vorgehen nie zuschlagen — die Form kann gar
  // nicht mehr kaputtgehen. Bleibt als Wächter für den Fall, dass jemand
  // später wieder ganze Texte durchreicht.
  const formfehler = strukturPruefen(roh, neu)
  if (formfehler.length) throw new Error(`Die Form hat gelitten: ${formfehler.join(', ')}`)

  const nachher = { ...messen(neu), art: textArt(neu) }
  const punkte = { vorher: bewertung(vorher), nachher: bewertung(nachher) }

  if (!lektoriert) {
    // Statt "nimm ein größeres Modell" der Name eines, das hier hineinpasst.
    // Der Rat, der nicht sagt was, ist kein Rat.
    const rat = await ollamaDa()
      .then((o) => (o ? modellVorschlag(o.modelle) : null))
      .catch(() => null)
    throw new Error(
      `Kein Absatz wurde besser. Häufigster Grund: ${behalten[0] || 'unbekannt'}. ` +
        (rat
          ? `Das ist meist das Modell, nicht der Text — ${rat.name} ${rat.warum} und passt hier noch hinein: ollama pull ${rat.name}`
          : 'Ein größeres Modell hilft hier mehr als noch ein Versuch.'),
    )
  }

  return {
    text: neu,
    vorher,
    nachher,
    anbieter: anbieterName,
    punkte,
    absaetze: { gesamt: dran.length, lektoriert, behalten },
    // Für die Oberfläche, die bisher eine Runden-Liste erwartet hat.
    versuche: behalten.map((grund, i) => ({ runde: i + 1, verworfen: grund })),
  }
}

const BLOCK_AUFTRAG = `Du bist Lektor. Du bekommst EINEN Absatz und gibst ihn überarbeitet zurück.

- Nur diesen Absatz. Keine Überschrift, keine Aufzählung, keine Leerzeile.
- Inhalt bleibt: keine neue Behauptung, keine neue Zahl, nichts weglassen.
- Sprache des Originals beibehalten.
- Ungefähr gleich lang.
- Antworte nur mit dem Absatz. Keine Vorrede, keine Anführungszeichen drumherum.

Woran du arbeitest:
- Satzlängen mischen: ein kurzer Satz, ein langer, nicht alle gleich.
- Floskeln streichen. Im Deutschen dabei die Wortstellung richten: fällt
  "Zudem" vorne weg, wird aus "Zudem bietet die Technik X" nicht "Bietet die
  Technik X", sondern "Die Technik bietet X".
- Konkretes Wort statt Allerweltswort, aktiv statt Substantivkette.`

const blockAnfrage = (absatz, funde, ton, extra, grund, versuch) => [
  { role: 'system', content: BLOCK_AUFTRAG },
  {
    role: 'user',
    content: [
      versuch > 1 ? `Dein letzter Versuch war unbrauchbar: ${grund}. Diesmal genauer.` : '',
      funde.length ? `Schwächen dieses Absatzes:\n- ${funde.join('\n- ')}` : 'Der Absatz ist unauffällig — fass ihn nur an, wo es wirklich besser wird.',
      ton ? `Ton: ${ton}` : '',
      extra || '',
      '',
      'Absatz:',
      absatz,
    ]
      .filter(Boolean)
      .join('\n'),
  },
]

/** Was an einem einzelnen Absatz nicht stimmt. null heißt: brauchbar. */
function blockPruefen(original, neu, vorBlock) {
  if (!neu) return 'die Antwort war leer'
  if (/^#{1,6}\s/m.test(neu)) return 'eine Überschrift eingebaut'
  if (/^\s*(?:[-*+]|\d+\.)\s+/m.test(neu)) return 'eine Aufzählung eingebaut'
  if (/\n\s*\n/.test(neu)) return 'aus einem Absatz mehrere gemacht'

  const zaehl = (t) => (t.match(/\S+/g) || []).length
  const anteil = zaehl(neu) / Math.max(1, zaehl(original))
  // Gemessen an echten Beispielen kürzt ehrliches Entfloskeln auf 33–58 %:
  // "In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle
  // für Unternehmen jeder Größe" wird zu "Digitalisierung trifft jede Firma".
  // Eine Grenze bei 60 % hätte genau das verworfen, wofür es das Werkzeug gibt.
  if (anteil < 0.45) return `nur noch ${Math.round(anteil * 100)} % der Länge`
  // Nach oben eng: Lektorieren macht Text nicht länger. 170 % ließ eine Fassung
  // durch, die bei 161 % lag und nichts weiter tat, als die Floskeln zu
  // umschreiben und Füllsel dazwischen zu setzen.
  if (anteil > 1.25) return `auf ${Math.round(anteil * 100)} % aufgebläht`

  // Länge allein trennt Kürzen nicht von Zusammenfassen — Zahlen tun es. Wer
  // eine Jahreszahl oder eine Menge wegwirft, hat zusammengefasst.
  const zahlen = (t) => new Set((t.match(/\d[\d.,]*/g) || []).map((z) => z.replace(/[.,]$/, '')))
  const weg = [...zahlen(original)].filter((z) => !zahlen(neu).has(z))
  if (weg.length) return `Zahl verloren: ${weg.slice(0, 3).join(', ')}`

  const a = sprache(original)
  const b = sprache(neu)
  if (a && b && a !== b) return `Sprache gewechselt (${a} → ${b})`

  const endetSauber = (t) => /[.!?…:;"'“”»)\]\d]$/.test(t.trim())
  if (endetSauber(original) && !endetSauber(neu)) return 'endet mitten im Satz'

  if (neu.trim() === original.trim()) return 'unverändert zurückgegeben'

  const nachBlock = messen(neu)
  // Der eigentliche Auftrag lautet: Floskeln raus. Bleiben es gleich viele, ist
  // der Absatz umformuliert, nicht lektoriert — egal was die Punkte sagen.
  if (vorBlock.floskeln.anzahl > 0 && nachBlock.floskeln.anzahl >= vorBlock.floskeln.anzahl)
    return `Floskeln nicht weniger geworden (${vorBlock.floskeln.anzahl} → ${nachBlock.floskeln.anzahl})`

  // Und die genannten müssen weg sein, nicht bloß gezählt worden sein.
  //
  // Auf einem echten Rechner kam das hier zurück und wurde angenommen, weil die
  // Zahl von fünf auf vier gefallen war:
  //
  //   "In der heutigen Zeit spielt die Digitalisierung eine entscheidende
  //    Rolle … Darüber hinaus … Zudem ist es wichtig zu beachten, dass …"
  //
  // Jede beanstandete Wendung stand noch wörtlich da. Gezählt wurde eine
  // Verbesserung, gelesen hatte sich nichts geändert.
  const klein = neu.toLowerCase()
  const ueberlebt = (vorBlock.floskeln.stellen || []).filter((s) => klein.includes(s))
  if (ueberlebt.length)
    return `diese Floskeln stehen noch wörtlich da: ${ueberlebt.slice(0, 3).map((s) => `„${s}"`).join(', ')}`
  if (bewertung(nachBlock) > bewertung(vorBlock)) return 'wurde messbar schlechter'
  return null
}
