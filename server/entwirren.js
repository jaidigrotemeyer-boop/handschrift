// Verklebter Text — der häufigste Weg, wie ein Dokument hier ankommt.
//
// Kopiert man aus einem PDF, einer Web-Ansicht oder einem gerenderten Bericht,
// gehen die Zeilenumbrüche oft komplett verloren. Aus
//
//   Laboratory Report: Heart Dissection
//   1. Title Page
//   Title: Dissection of the Mammalian Heart
//
// wird ein einziger Klumpen:
//
//   Laboratory Report: Heart Dissection1. Title PageTitle: Dissection of ...
//
// Das ist nicht bloß hässlich. Ohne Absätze schickt Handschrift den ganzen
// Text als einen Block zum Modell, und genau daran scheitert ein kleines
// Modell daheim. Darum wird der Zustand erkannt und lässt sich reparieren —
// auf Knopfdruck, nicht heimlich: es ist der Text des Nutzers.

import { saetze } from './messen.js'

const GROSS = 'A-ZÄÖÜ'
const KLEIN = 'a-zäöüß'

// Nur Stellen, an denen zwei Dinge zusammengeklebt sind, die getrennt gehören.
// Jede Regel braucht ein deutliches Signal — geraten wird nicht.
const REGELN = [
  // "Heart.Materials" — fehlendes Leerzeichen nach dem Satzende.
  [new RegExp(`([.!?])([${GROSS}])`, 'g'), '$1 $2'],
  // "20262. Introduction" — Jahreszahl und Abschnittsnummer verklebt.
  [new RegExp(`(\\d{4})(\\d{1,2}\\.\\s*[${GROSS}])`, 'g'), '$1\n\n$2'],
  // "Dissection1. Title Page" und "anatomy.3. Methodology" — Wort oder
  // Satzende klebt an der Abschnittsnummer.
  [new RegExp(`([${KLEIN}.!?])(\\d{1,2}\\.\\s*[${GROSS}])`, 'g'), '$1\n\n$2'],
  // "GrotemeyerCourse:", "HeartStudent Name:", "ObservationsFigure 1:",
  // "AnalysisLeft vs. right wall thickness:" — eine Beschriftung mit
  // Doppelpunkt klebt am Wort davor. Ziffern, Punkte und kaufmännisches Und
  // gehören dazu: sonst zerbricht "Figure 1:" nicht, "vs." nicht und
  // "Chordae tendineae & papillary muscles:" auch nicht.
  [new RegExp(`([${KLEIN}\\d])([${GROSS}][A-Za-z${KLEIN}${GROSS}0-9 &/.-]{2,45}:)(?=\\s|$)`, 'g'), '$1\n$2'],
  // "Procedure:Examine" — nach dem Doppelpunkt fehlt jede Trennung.
  [new RegExp(`([${KLEIN}]:)([${GROSS}])`, 'g'), '$1\n$2'],
  // "ProcedureExamine" nach einem Doppelpunkt-Block: Wort klebt an einem neuen
  // Satz, der mit einem Großbuchstaben beginnt und mit Punkt endet.
  [new RegExp(`([${KLEIN}])([${GROSS}][${KLEIN}]+\\s[${KLEIN}]+[^.]{5,}?\\.)`, 'g'), '$1\n$2'],
]

// ────────────────────────────────────────────────────────────────────────────
// Formelreste
// ────────────────────────────────────────────────────────────────────────────
//
// Wer aus einem gesetzten Dokument kopiert, bekommt manchmal die Rohform der
// Formeln mit:
//
//   Right atrium $\rightarrow$ tricuspid $\rightarrow$ right ventricle
//
// Gemeint war ein Pfeil. Im Browser sieht man ihn, in der Zwischenablage steht
// die Anweisung, ihn zu setzen. Getippt landet dieser Satz genau so im
// Dokument — Dollarzeichen und Backslash inklusive.
const ZEICHEN = {
  rightarrow: '→', to: '→', longrightarrow: '→', Rightarrow: '⇒', implies: '⇒',
  leftarrow: '←', gets: '←', Leftarrow: '⇐', leftrightarrow: '↔', Leftrightarrow: '⇔',
  uparrow: '↑', downarrow: '↓',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡',
  infty: '∞', degree: '°', circ: '°', percent: '%',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', mu: 'µ', pi: 'π',
  sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω', lambda: 'λ', theta: 'θ',
}

// Nur wenn zwischen den Dollarzeichen ausschließlich solche Befehle stehen.
// "$50 Millionen" ist Geld und bleibt, wie es ist — das wäre der teuerste Weg,
// hilfsbereit zu sein.
const FORMEL = /\$\s*((?:\\[a-zA-Z]+\s*)+)\$/g
const einBefehl = /\\([a-zA-Z]+)/g

/**
 * Steht in diesem Text so ein Formelrest — einer, den Handschrift auch auflösen
 * kann? Gefragt wird, ob sich etwas ändern würde. Ein "$\foobar$", das ohnehin
 * stehen bliebe, ist kein Grund, einen Knopf anzubieten.
 */
export const hatFormelreste = (text) => latexEntschaerfen(text) !== String(text || '')

/**
 * Die Formelreste durch das Zeichen ersetzen, das gemeint war. Was nicht in
 * der Liste steht, bleibt unangetastet — ein falsch geratenes Sonderzeichen
 * wäre schlimmer als ein stehengebliebenes Dollarzeichen.
 */
export function latexEntschaerfen(text) {
  return String(text || '').replace(FORMEL, (ganz, inhalt) => {
    const teile = [...inhalt.matchAll(einBefehl)].map((m) => m[1])
    if (!teile.every((name) => ZEICHEN[name])) return ganz
    return teile.map((name) => ZEICHEN[name]).join(' ')
  })
}

const zaehle = (t, muster) => (t.match(muster) || []).length

/**
 * Sieht der Text so aus, als hätte er seine Umbrüche verloren?
 * Zwei Bedingungen: kaum Zeilenumbrüche, aber deutliche Klebestellen.
 */
export function istVerklebt(text) {
  const t = String(text || '')
  if (t.length < 300) return false
  const zeilen = zaehle(t, /\n/g)
  const proZeichen = zeilen / t.length
  // Ein normaler Text hat grob alle 60–90 Zeichen einen Umbruch.
  if (proZeichen > 1 / 200) return false
  const klebstellen =
    zaehle(t, new RegExp(`[${KLEIN}\\d][${GROSS}]`, 'g')) + zaehle(t, new RegExp(`[.!?][${GROSS}]`, 'g'))
  return klebstellen >= 4
}

/** Die Klebestellen auftrennen. Gibt den Text und die Zahl der Schnitte zurück. */
export function entwirren(text) {
  const roh = String(text || '').replace(/\r\n?/g, '\n')
  let t = latexEntschaerfen(roh)
  const formeln = zaehle(roh, FORMEL) - zaehle(t, FORMEL)
  const vorher = t.length
  for (const [muster, ersatz] of REGELN) t = t.replace(muster, ersatz)
  t = t
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const schnitte = Math.max(0, t.length - vorher)
  // Trennen holt die Zeilen zurück, gliedern die Form: Überschriften,
  // Aufzählungen, nummerierte Schritte.
  return { text: gliedern(t), schnitte, formeln: Math.max(0, formeln) }
}

// ────────────────────────────────────────────────────────────────────────────
// Gliedern
// ────────────────────────────────────────────────────────────────────────────

const IST_KOPF = /^\d{1,2}\.\s+\S/
// Schon gegliedert: ein Punkt, den gliedern selbst gesetzt hat, und ein
// eingerückter Schritt darunter. Beide müssen wiedererkannt werden, sonst
// verschiebt ein zweiter Durchgang die Form — der eingerückte "1. Examine …"
// sähe sonst aus wie die Überschrift eines neuen Abschnitts.
const IST_PUNKT = /^\*\s+\S/
const IST_SCHRITT = /^\s+\d{1,2}\.\s+\S/
// Auch eine kurze Frage am Zeilenanfang ist eine Beschriftung: "Why animal
// hearts? Identical structural layout …" — Frage, dann Antwort.
const IST_LABEL = /^[A-Z](?:[^:\n]{0,40}:|[^.!?\n]{2,45}\?)(?:\s|$)/
const IST_NUR_LABEL = /^[A-Z][^:\n]{0,40}:\s*$/

/**
 * Aus getrennten Zeilen wieder ein Dokument machen.
 *
 * Das Auftrennen holt die Zeilen zurück, aber nicht die Form: eine Reihe von
 * "Titel: …", "Name: …", "Kurs: …" ist eine Aufzählung und sieht auch so aus,
 * und was hinter einem alleinstehenden "Procedure:" folgt, sind nummerierte
 * Schritte. Beides geht beim Kopieren als Erstes verloren.
 *
 * Geraten wird auch hier nicht: Aufzählungspunkt wird nur, was wie eine
 * Beschriftung aussieht, und nummeriert nur, was hinter einem Doppelpunkt ohne
 * eigenen Inhalt steht.
 */
export function gliedern(text) {
  // "Materials: … camera. Procedure:" sind zwei Beschriftungen in einer Zeile.
  const zeilen = String(text)
    // Auch nach einem Satzende kann die nächste Beschriftung anschließen:
    // "… higher pressure. Chordae tendineae & papillary muscles: …"
    .replace(/([.!?]) ([A-ZÄÖÜ][^:\n]{2,45}:)(?=\s)/g, '$1\n$2')
    // Manche Beschriftungen fragen statt zu benennen: "Why animal hearts?"
    .replace(/([.!?]) ([A-ZÄÖÜ][^.!?\n]{2,45}\?)(?=\s)/g, '$1\n$2')
    .split('\n')

  // Die Einrückung eines Schritts muss erhalten bleiben; sonst wird der Text
  // getrimmt, damit Klebereste nicht als Leerzeichen stehen bleiben.
  const art = zeilen.map((roh) => {
    const z = roh.trim()
    if (!z) return 'leer'
    if (IST_SCHRITT.test(roh)) return 'schritt'
    if (IST_PUNKT.test(z)) return 'punkt'
    if (IST_KOPF.test(z)) return 'kopf'
    if (IST_NUR_LABEL.test(z)) return 'nurLabel'
    if (IST_LABEL.test(z)) return 'label'
    return 'text'
  })
  // Erst einordnen, dann entscheiden: ein Aufzählungspunkt braucht Nachbarn.
  // Sonst würde die Titelzeile "Laboratory Report: Heart Dissection" — eine
  // Beschriftung wie jede andere — zum ersten Punkt einer Liste, die es nicht
  // gibt.
  const inReihe = art.map((a, i) => {
    if (a === 'punkt') return true
    if (a !== 'label' && a !== 'nurLabel') return false
    const nachbar = (j) => art[j] === 'label' || art[j] === 'nurLabel' || art[j] === 'punkt'
    return nachbar(i - 1) || nachbar(i + 1) || a === 'nurLabel'
  })

  const raus = []
  const leerzeileDavor = () => {
    if (raus.length && raus[raus.length - 1].trim()) raus.push('')
  }

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i].trim()
    if (!zeile) {
      leerzeileDavor()
      continue
    }

    // Schon nummerierte Schritte bleiben, wie sie sind.
    if (art[i] === 'schritt') {
      raus.push(zeilen[i].replace(/\s+$/, ''))
      continue
    }

    if (art[i] === 'kopf') {
      leerzeileDavor()
      raus.push(zeile)
      continue
    }

    if (inReihe[i]) {
      if (!raus.length || !raus[raus.length - 1].startsWith('*')) leerzeileDavor()
      raus.push(art[i] === 'punkt' ? zeile : '* ' + zeile)
      // Ein Doppelpunkt ohne eigenen Inhalt: was folgt, sind die Schritte dazu.
      // Sind sie schon nummeriert, ist nichts mehr zu tun.
      if (art[i] === 'nurLabel' && art[i + 1] !== 'schritt') {
        const schritte = saetze(zeilen[i + 1] || '')
        if (schritte.length >= 2) {
          schritte.forEach((s, n) => raus.push(`   ${n + 1}. ${s}`))
          i++
        }
      }
      continue
    }

    // Fließtext direkt unter seiner Überschrift, ohne Leerzeile dazwischen.
    raus.push(zeile)
  }

  return raus
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
