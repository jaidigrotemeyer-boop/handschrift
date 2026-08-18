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
  // "GrotemeyerCourse:", "HeartStudent Name:", "ObservationsFigure 1:" — eine
  // Beschriftung mit Doppelpunkt klebt am Wort davor. Ziffern gehören dazu,
  // sonst wird aus "Figure 1:" nichts.
  [new RegExp(`([${KLEIN}\\d])([${GROSS}][${KLEIN}]+(?:\\s[${GROSS}${KLEIN}\\d]+){0,2}:)`, 'g'), '$1\n$2'],
  // "Procedure:Examine" — nach dem Doppelpunkt fehlt jede Trennung.
  [new RegExp(`([${KLEIN}]:)([${GROSS}])`, 'g'), '$1\n$2'],
  // "ProcedureExamine" nach einem Doppelpunkt-Block: Wort klebt an einem neuen
  // Satz, der mit einem Großbuchstaben beginnt und mit Punkt endet.
  [new RegExp(`([${KLEIN}])([${GROSS}][${KLEIN}]+\\s[${KLEIN}]+[^.]{5,}?\\.)`, 'g'), '$1\n$2'],
]

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
  let t = String(text || '').replace(/\r\n?/g, '\n')
  const vorher = t.length
  for (const [muster, ersatz] of REGELN) t = t.replace(muster, ersatz)
  t = t
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  // Jeder eingefügte Umbruch verlängert den Text um genau ein Zeichen; die
  // Leerzeichen nach Satzzeichen zählen genauso. Das ist die Zahl der Schnitte.
  return { text: t, schnitte: Math.max(0, t.length - vorher) }
}
