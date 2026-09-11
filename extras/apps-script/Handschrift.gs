/**
 * Handschrift für Google Docs — ohne Mac, ohne Gerät, ohne Geld.
 *
 * Google Apps Script läuft auf Googles Rechnern, kostet nichts und wird im
 * Browser bedient. Auch auf einem iPad. Damit schreibt sich ein Dokument
 * nach und nach selbst voll, statt in einem Rutsch eingefügt zu werden.
 *
 * ── Was du brauchst ──────────────────────────────────────────────────────
 *
 *   1. Ein Google-Dokument mit dem fertigen Text. Nenn es "Handschrift Quelle".
 *      (Text vorher auf der Handschrift-Seite aufräumen und umschreiben.)
 *   2. Ein leeres Google-Dokument, in das geschrieben werden soll.
 *      Nenn es "Handschrift Ziel".
 *   3. script.google.com öffnen, neues Projekt, diesen Code hineinkopieren.
 *      Auf dem iPad in Safari vorher "Desktop-Website anfordern" —
 *      der Editor ist für Mäuse gebaut und sonst kaum zu bedienen.
 *
 * Dann die Funktion "starten" ausführen. Google fragt einmal nach der
 * Erlaubnis, auf deine Dokumente zuzugreifen; das ist deine eigene, und die
 * Erlaubnis gilt nur diesem Skript.
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

var QUELLE = 'Handschrift Quelle'
var ZIEL = 'Handschrift Ziel'
var DAUER_MINUTEN = 30

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

  var text = dokument(QUELLE).getBody().getText()
  if (!text.trim()) throw new Error('Das Dokument "' + QUELLE + '" ist leer.')

  stoppen()
  var lager = PropertiesService.getUserProperties()
  lager.setProperties({
    stelle: '0',
    gesamt: String(text.length),
    jeMinute: String(Math.max(1, Math.ceil(text.length / DAUER_MINUTEN))),
  })

  ScriptApp.newTrigger('weiterschreiben').timeBased().everyMinutes(1).create()
  weiterschreiben()

  Logger.log(
    text.length + ' Zeichen über ' + DAUER_MINUTEN + ' Minuten — etwa ' +
      Math.ceil(text.length / DAUER_MINUTEN) + ' Zeichen je Minute.',
  )
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
  Logger.log(
    gesamt
      ? stelle + ' von ' + gesamt + ' Zeichen (' + Math.round((stelle / gesamt) * 100) + ' %)'
      : 'Noch nicht gestartet.',
  )
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

  var quelle = dokument(QUELLE).getBody().getText()
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
  var ziel = dokument(ZIEL)
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
      ziel = dokument(ZIEL)
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

/** Dokument über seinen Namen finden. Zwei gleichnamige sind ein Fehler. */
function dokument(name) {
  var dateien = DriveApp.getFilesByName(name)
  if (!dateien.hasNext()) {
    throw new Error(
      'Kein Dokument mit dem Namen "' + name + '" gefunden. ' +
        'Namen müssen genau stimmen, Groß- und Kleinschreibung inklusive.',
    )
  }
  var datei = dateien.next()
  if (dateien.hasNext()) {
    throw new Error('Es gibt mehrere Dokumente namens "' + name + '". Benenn eines um.')
  }
  return DocumentApp.openById(datei.getId())
}
