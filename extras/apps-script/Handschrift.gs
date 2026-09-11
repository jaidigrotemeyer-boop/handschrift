/**
 * Handschrift für Google Docs — ohne Mac, ohne Gerät, ohne Geld.
 *
 * Google Apps Script läuft auf Googles Rechnern, kostet nichts und wird im
 * Browser bedient. Auch auf einem iPad. Damit schreibt sich ein Dokument
 * nach und nach selbst voll, statt in einem Rutsch eingefügt zu werden.
 *
 * ── Was du tun musst ───────────────────────────────────────────────────
 *
 *   1. script.google.com öffnen, "Neues Projekt", diesen Code hineinkopieren.
 *      Auf dem iPad in Safari vorher "Desktop-Website anfordern" —
 *      der Editor ist für Mäuse gebaut und sonst kaum zu bedienen.
 *   2. Unten bei TEXT deinen fertigen Text einsetzen. (Vorher auf der
 *      Handschrift-Seite aufräumen, gliedern, umschreiben.)
 *   3. Die Funktion "starten" ausführen.
 *
 * Mehr nicht. Die Dokumente legt das Skript selbst an und schreibt dir die
 * Links ins Protokoll. Google fragt einmal nach der Erlaubnis, auf deine
 * Dokumente zuzugreifen; das ist dein eigenes Konto, und sie gilt nur diesem
 * Skript.
 *
 * Wer den Text lieber nicht in den Editor tippt, lässt TEXT leer und schreibt
 * ihn stattdessen in das Dokument "Handschrift Quelle", das beim ersten
 * Starten angelegt wird.
 *
 * ── Was es tut ───────────────────────────────────────────────────────────
 *
 * Jede Minute wacht es auf und schreibt das nächste Stück ins Ziel-Dokument —
 * innerhalb dieser Minute Zeichen für Zeichen, mit Pausen am Satzende. Ein
 * einzelner Lauf darf bei Google höchstens sechs Minuten dauern, darum die
 * Aufteilung in Minutenhäppchen.
 *
 * ── Wie lange ────────────────────────────────────────────────────────────
 *
 * DAUER_MINUTEN sagt, über welche Zeit der Text verteilt wird. Mehr als vier
 * Stunden lässt das Skript nicht zu, und zwar aus demselben Grund wie das
 * Programm auf dem Mac: was länger läuft, ist kein Schreibvorgang mehr,
 * sondern eine erfundene Entstehungsgeschichte. Wer ein Dokument über Tage
 * wachsen lässt, baut sich eine Versionsgeschichte, die so nie stattgefunden
 * hat — das ist eine Täuschung dessen, der später hineinschaut, und dabei
 * helfe ich nicht.
 */

// ── Einstellungen ─────────────────────────────────────────────────────────

// Der Text. Hier hineinsetzen — zwischen die Backticks, so lang er will.
// Bleibt das leer, wird stattdessen aus dem Dokument QUELLE gelesen.
var TEXT = ``

// Über wie viele Minuten der Text verteilt wird.
var DAUER_MINUTEN = 30

var QUELLE = 'Handschrift Quelle'
var ZIEL = 'Handschrift Ziel'
var MAX_MINUTEN = 4 * 60

// ── Anfangen und aufhören ────────────────────────────────────────────────

/** Einmal ausführen — danach läuft es von selbst. */
function starten() {
  if (DAUER_MINUTEN > MAX_MINUTEN) {
    throw new Error(
      'Mehr als vier Stunden macht dieses Skript nicht mit. Länger ist kein ' +
        'Schreibvorgang mehr, sondern eine erfundene Entstehungsgeschichte.',
    )
  }

  // Beide Dokumente anlegen, falls es sie noch nicht gibt. Ein Skript, das
  // mit "Kein Dokument gefunden" abbricht, wäre eine Hausaufgabe und keine
  // Hilfe — zumal das Anlegen auf einem iPad der lästigste Teil wäre.
  var quelleDoc = dokument(QUELLE, true)
  var zielDoc = dokument(ZIEL, true)

  // Steht der Text im Skript, gilt der. Sonst der aus dem Quelle-Dokument.
  var text = TEXT.trim() ? TEXT : quelleDoc.getBody().getText()
  if (!text.trim()) {
    throw new Error(
      'Kein Text da. Entweder oben bei TEXT einsetzen, oder in dieses ' +
        'Dokument schreiben: ' + quelleDoc.getUrl(),
    )
  }
  if (TEXT.trim() && quelleDoc.getBody().getText().trim() !== TEXT.trim()) {
    // Damit "stand" und das Weiterschreiben später dieselbe Quelle sehen wie
    // der Start — auch nachdem der Editor längst zu ist.
    quelleDoc.getBody().setText(TEXT)
    quelleDoc.saveAndClose()
  }

  stoppen()
  var lager = PropertiesService.getUserProperties()
  lager.setProperties({
    stelle: '0',
    gesamt: String(text.length),
    jeMinute: String(Math.max(1, Math.ceil(text.length / DAUER_MINUTEN))),
  })

  ScriptApp.newTrigger('weiterschreiben').timeBased().everyMinutes(1).create()

  Logger.log(
    text.length + ' Zeichen über ' + DAUER_MINUTEN + ' Minuten — etwa ' +
      Math.ceil(text.length / DAUER_MINUTEN) + ' Zeichen je Minute.',
  )
  Logger.log('Zusehen kannst du hier: ' + zielDoc.getUrl())

  weiterschreiben()
}

/** Aufhören, egal wo es gerade steht. */
function stoppen() {
  var alle = ScriptApp.getProjectTriggers()
  for (var i = 0; i < alle.length; i++) {
    if (alle[i].getHandlerFunction() === 'weiterschreiben') ScriptApp.deleteTrigger(alle[i])
  }
}

/** Wie weit ist es? */
function stand() {
  var lager = PropertiesService.getUserProperties()
  var stelle = Number(lager.getProperty('stelle') || 0)
  var gesamt = Number(lager.getProperty('gesamt') || 0)
  if (!gesamt) {
    Logger.log('Noch nicht gestartet.')
    return
  }
  Logger.log(
    stelle + ' von ' + gesamt + ' Zeichen (' + Math.round((stelle / gesamt) * 100) + ' %)',
  )
  Logger.log('Dokument: ' + dokument(ZIEL, true).getUrl())
}

// ── Die eigentliche Arbeit ───────────────────────────────────────────────

/**
 * Läuft jede Minute. Schreibt das nächste Stück und hört auf, bevor Google
 * den Lauf abbricht — sechs Minuten sind die Grenze, und wer sie reißt,
 * verliert das angefangene Stück.
 */
function weiterschreiben() {
  var lager = PropertiesService.getUserProperties()
  var stelle = Number(lager.getProperty('stelle') || 0)
  var jeMinute = Number(lager.getProperty('jeMinute') || 200)

  var quelle = dokument(QUELLE, true).getBody().getText()
  if (stelle >= quelle.length) {
    stoppen()
    Logger.log('Fertig.')
    return
  }

  var stueck = quelle.substring(stelle, Math.min(quelle.length, stelle + jeMinute))

  // Fünfzig Sekunden schreiben, dann Schluss für diese Runde. Der Rest der
  // Minute ist Luft: Google zählt auch das Öffnen des Dokuments mit, und wer
  // die sechs Minuten reißt, verliert das angefangene Stück.
  var ende = Date.now() + 50 * 1000
  var abstand = Math.max(20, Math.floor(45000 / Math.max(1, stueck.length)))
  var geschrieben = 0

  // In Schüben von zwei Sekunden, dann speichern und neu öffnen.
  //
  // Das ist der Kniff, auf den es ankommt. Apps Script sammelt Änderungen und
  // schreibt sie erst beim Schließen wirklich ins Dokument — ohne die Schübe
  // stünde nach jeder Minute ein ganzer Absatz auf einmal da statt zu wachsen.
  // saveAndClose() erzwingt das Schreiben; danach muss das Dokument neu
  // geöffnet werden, denn das geschlossene ist nicht mehr zu gebrauchen.
  var ziel = dokument(ZIEL, true)
  var koerper = ziel.getBody()
  var absaetze = koerper.getParagraphs()
  var letzter = absaetze[absaetze.length - 1]
  var schubEnde = Date.now() + 2000

  for (var i = 0; i < stueck.length; i++) {
    if (Date.now() > ende) break
    var z = stueck.charAt(i)

    if (z === '\n') {
      letzter = koerper.appendParagraph('')
    } else {
      letzter.appendText(z)
    }
    geschrieben++

    // Der Rhythmus einer Hand: nach dem Satzende wird nachgedacht, nach einem
    // Komma kurz abgesetzt, und ab und zu stockt es einfach.
    var pause = abstand
    var vorher = i > 0 ? stueck.charAt(i - 1) : ''
    if (vorher === '.' || vorher === '!' || vorher === '?') pause += 600
    else if (vorher === ',' || vorher === ';' || vorher === ':') pause += 200
    if (Math.random() < 0.02) pause += 400
    // Nicht im Gleichtakt: die Streuung ist das, was eine Hand ausmacht.
    pause = Math.round(pause * (0.6 + Math.random() * 0.8))
    Utilities.sleep(Math.min(pause, 3000))

    if (Date.now() > schubEnde) {
      ziel.saveAndClose()
      ziel = dokument(ZIEL, true)
      koerper = ziel.getBody()
      absaetze = koerper.getParagraphs()
      letzter = absaetze[absaetze.length - 1]
      schubEnde = Date.now() + 2000
    }
  }

  ziel.saveAndClose()
  lager.setProperty('stelle', String(stelle + geschrieben))

  if (stelle + geschrieben >= quelle.length) {
    stoppen()
    Logger.log('Fertig — ' + quelle.length + ' Zeichen geschrieben.')
  }
}

// ── Kleinkram ────────────────────────────────────────────────────────────

/**
 * Dokument über seinen Namen finden — und anlegen, wenn es fehlt.
 *
 * Zwei gleichnamige sind dagegen ein Fehler, den niemand raten soll: dann
 * wüsste das Skript nicht, in welches der beiden es schreibt.
 */
function dokument(name, anlegenWennFehlt) {
  var dateien = DriveApp.getFilesByName(name)
  if (!dateien.hasNext()) {
    if (!anlegenWennFehlt) throw new Error('Kein Dokument mit dem Namen "' + name + '" gefunden.')
    var neu = DocumentApp.create(name)
    Logger.log('Angelegt: "' + name + '" — ' + neu.getUrl())
    return neu
  }
  var datei = dateien.next()
  if (dateien.hasNext()) {
    throw new Error('Es gibt mehrere Dokumente namens "' + name + '". Benenn eines um.')
  }
  return DocumentApp.openById(datei.getId())
}
