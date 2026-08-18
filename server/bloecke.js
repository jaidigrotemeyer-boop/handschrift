// Text in Blöcke zerlegen — und wieder zusammensetzen.
//
// Der Grund ist ein praktischer: ein kleines Modell daheim (llama3.2:3b und
// Verwandtschaft) scheitert zuverlässig an "schreib mir diesen ganzen Text
// neu". Es kürzt, wechselt mitten im Absatz die Sprache, bricht ab oder gibt
// eine Zusammenfassung zurück. Ein einzelner Absatz dagegen gelingt ihm.
//
// Nebenbei löst das die Form-Frage von selbst: Überschriften, Listen und Code
// gehen gar nicht erst zum Modell, sondern werden unverändert wieder
// eingesetzt. Was nicht verschickt wird, kann auch nicht kaputtgehen.

/** Zeilenart bestimmen — reicht für Markdown und für rohen Fließtext. */
function art(zeile) {
  if (!zeile.trim()) return 'leer'
  if (/^#{1,6}\s/.test(zeile)) return 'ueberschrift'
  if (/^\s*(?:[-*+]|\d+\.)\s+/.test(zeile)) return 'liste'
  if (/^\s*>/.test(zeile)) return 'zitat'
  if (/^\s*(?:\||[-=]{3,})\s*$/.test(zeile) || /^\s*\|/.test(zeile)) return 'tabelle'
  return 'absatz'
}

/**
 * Blöcke: zusammenhängende Zeilen gleicher Art. Ein Code-Zaun schluckt alles
 * bis zum schließenden Zaun, egal wie es darin aussieht.
 */
export function bloecke(text) {
  const zeilen = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const raus = []
  let imCode = false
  let jetzt = null

  const schliessen = () => {
    if (jetzt) raus.push({ ...jetzt, text: jetzt.zeilen.join('\n') })
    jetzt = null
  }

  for (const zeile of zeilen) {
    if (/^\s*```/.test(zeile)) {
      if (!imCode) {
        schliessen()
        imCode = true
        jetzt = { art: 'code', zeilen: [zeile] }
      } else {
        jetzt.zeilen.push(zeile)
        imCode = false
        schliessen()
      }
      continue
    }
    if (imCode) {
      jetzt.zeilen.push(zeile)
      continue
    }

    const a = art(zeile)
    // Überschriften stehen immer für sich, sonst wüchsen sie mit dem
    // Folgeabsatz zusammen und gingen mit ihm zum Modell.
    if (!jetzt || jetzt.art !== a || a === 'ueberschrift') {
      schliessen()
      jetzt = { art: a, zeilen: [zeile] }
    } else {
      jetzt.zeilen.push(zeile)
    }
  }
  schliessen()
  return raus
}

/** Aus den Blöcken wieder einen Text machen. */
export const zusammensetzen = (liste) => liste.map((b) => b.text).join('\n')

/**
 * Welche Blöcke überhaupt zum Modell gehen. Alles andere bleibt, wie es ist.
 * Sehr kurze Absätze auch: an "Brötchen." gibt es nichts zu lektorieren, und
 * ein kleines Modell macht daraus gern einen ganzen Satz.
 */
export const lektorierbar = (b) => b.art === 'absatz' && (b.text.match(/\S+/g) || []).length >= 8
