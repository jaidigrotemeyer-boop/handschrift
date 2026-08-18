# Handschrift

Text messen, lektorieren — und Zeichen für Zeichen tippen, im Rhythmus einer Hand.

Läuft auf deinem Rechner. Kein Konto, keine Anmeldung, keine Abhängigkeiten:
`npm install` lädt nichts, weil es nichts zu laden gibt.

## Einrichten

Ein Befehl. Er holt den Quelltext, prüft alles Nötige, startet Handschrift und
sagt am Ende, was noch von Hand fehlt. Braucht [Node 20 oder neuer](https://nodejs.org):

```bash
curl -fsSL https://raw.githubusercontent.com/jaidigrotemeyer-boop/handschrift/main/scripts/einrichten.sh | bash
```

```
  ✓ Node v22.22.2
  ✓ Quelltext da (keine Pakete nötig)
  ✓ 67 von 67 in Ordnung
  – kein Ollama gefunden
  ✓ cliclick da — tippt flott

  Fertig. Handschrift startet auf http://localhost:3018

  Das fehlt noch:
    • Fürs Umschreiben eins von beidem: Ollama installieren (ollama.com)
      oder einen Gratis-Schlüssel in den Einstellungen eintragen
```

Nochmal ausführen frischt eine bestehende Installation auf, statt sie doppelt
anzulegen. Läuft auf macOS und Linux.

### Als richtige Mac-App

```bash
curl -fsSL https://raw.githubusercontent.com/jaidigrotemeyer-boop/handschrift/main/scripts/install.sh | bash
```

Danach liegt **Handschrift.app** im Programme-Ordner und startet per Doppelklick.

### Von Hand

```bash
git clone https://github.com/jaidigrotemeyer-boop/handschrift.git ~/handschrift
cd ~/handschrift && npm start
```

Der Browser geht von selbst auf, `http://localhost:3018`. Nur dein Rechner
kommt dran. Ist der Port schon belegt, nimmt Handschrift den nächsten freien
und sagt im Terminal, welchen.

Alle drei Wege setzen voraus, dass das Repo auf **öffentlich** steht — bei
privat antwortet GitHub mit 404, als gäbe es das Repo nicht.

### „Die Website ist nicht erreichbar"

`ERR_CONNECTION_REFUSED` heißt immer dasselbe: da läuft gerade kein Server.
Handschrift ist kein Dienst im Hintergrund — sie läuft, solange das Terminal
offen ist, und ist weg, wenn es zugeht. Also einmal `npm start`, und das
Fenster stehen lassen.

Wer nachsehen will, was los ist:

```bash
node hilfe.mjs
```

Ganz oben steht dann, ob überhaupt etwas antwortet, auf welchem Port, und ob
der laufende Server dieselbe Fassung hat wie der Ordner.

## Messen

KI-Prosa liest sich flach. Alle Sätze etwa gleich lang, immer dieselben
Übergänge, immer dieselben Floskeln. **Messen** zeigt jede Stelle mit Zahl und
Beispiel — lokal gerechnet, ohne Netz, ohne Schlüssel.

```bash
node messen.mjs aufsatz.md
```

```
  100 Wörter · 8 Sätze
  Satzlänge ∅ 12.5 (11–15), Streuung 1.3, Gleichmaß 0.10
  Mittelbau 75 % · Floskeln 11 (110 je 1000 Wörter)

    Zeitgeist-Einstieg: „In der heutigen Zeit"
    Überleitung: „Darüber hinaus"
    Mengen-Floskel: „eine Vielzahl von"

  Auffällig:
    – Satzlängen zu gleichmäßig: ∅ 12.5 Wörter, Streuung nur 1.3 (11–15).
    – 75 % aller Sätze liegen zwischen 12 und 25 Wörtern — es fehlen kurze und lange.

  Klingt maschinell: 3 Auffälligkeiten, vor allem gleichförmige Sätze und Floskeln.
```

Worauf geschaut wird:

| Maß | Was es bedeutet |
|---|---|
| **Gleichmaß** | Streuung der Satzlängen im Verhältnis zur Länge. Klein heißt gleichförmig. |
| **Mittelbau** | Anteil der Sätze zwischen 12 und 25 Wörtern. Hoch heißt: es fehlen kurze und lange. |
| **Floskeln** | Nach Art sortiert — Überleitung, Fazit-Floskel, Werbe-Wort, Zeitgeist-Einstieg … |
| **Satzanfänge** | Dasselbe Wort dreimal am Satzanfang erzeugt den Leiern-Ton. |
| **Wortwiederholung** | Inhaltswörter, die zu oft kommen. |
| **Gedankenstriche** | Als Satzzeichen auffällig oft. |
| **Absatz-Gleichmaß** | Ab vier Absätzen: sind alle gleich lang? |

Unter fünf Sätzen sagt die Messung bewusst nichts über Satzlängen. Vier Zahlen
sind keine Verteilung.

## Wenn der Text seine Absätze verloren hat

Kopiert man aus einem PDF, einer Web-Ansicht oder einem fertig gesetzten
Bericht, gehen die Zeilenumbrüche oft komplett verloren:

```
Laboratory Report: Heart Dissection1. Title Page / Cover PageTitle: Dissection
of the Mammalian HeartStudent Name: Jaidi GrotemeyerCourse: BiologyDate: …
```

Das ist nicht bloß hässlich. Ohne Absätze gilt der ganze Text als **ein**
Absatz — und den schickt Handschrift dann am Stück zum Modell, also genau das,
woran ein kleines Modell scheitert.

**Messen** erkennt den Zustand und bietet einen Knopf an. Aus dem Klumpen oben
wird wieder ein Dokument:

```
Laboratory Report: Heart Dissection

1. Title Page / Cover Page

* Title: Dissection of the Mammalian Heart
* Student Name: Jaidi Grotemeyer
* Course: Biology
* Date: August 17, 2026

2. Introduction
The mammalian heart is a four-chambered pump managing pulmonary and systemic
circuits. …

3. Methodology

* Materials: Sheep/pig heart, dissection kit, tray, gloves, camera.
* Procedure:
   1. Examine external anatomy (atria, ventricles, vessels).
   2. Cut open a ventricle to expose chambers.
   3. Locate valves, chordae tendineae, and papillary muscles.
```

Das geschieht in zwei Schritten. Erst **auftrennen**, und zwar nur an
deutlichen Klebestellen: fehlendes Leerzeichen nach dem Satzende, eine
Abschnittsnummer am Wort (`Dissection1.`, `anatomy.3.`), eine Beschriftung mit
Doppelpunkt (`GrotemeyerCourse:`, `ObservationsFigure 1:`), ein Doppelpunkt
direkt vor einem Großbuchstaben (`Procedure:Examine`).

Dann **gliedern**, denn die Umbrüche allein sind noch keine Form. Eine Reihe
von Beschriftungen (`Titel:`, `Name:`, `Kurs:`) ist eine Aufzählung und steht
untereinander statt nebeneinander; was hinter einem alleinstehenden
`Procedure:` folgt, sind nummerierte Schritte; vor jeder Abschnittsnummer steht
eine Leerzeile.

Geraten wird an keiner der beiden Stellen. Ein Aufzählungspunkt wird nur, was
wie eine Beschriftung aussieht **und** Nachbarn derselben Art hat — sonst würde
die Titelzeile `Laboratory Report: Heart Dissection` zum ersten Punkt einer
Liste, die es nicht gibt. Nummeriert wird nur, was hinter einem Doppelpunkt
ohne eigenen Inhalt steht. Kein Buchstabe geht verloren, und ein zweiter Klick
ändert nichts mehr.

Der Knopf erscheint nur, wenn es wirklich danach aussieht — und er drückt sich
nicht von selbst. Es ist dein Text.

## Lektorieren

**Umschreiben** arbeitet **Absatz für Absatz**, nicht am Stück. Das hat einen
praktischen Grund: ein kleines Modell daheim scheitert zuverlässig an „schreib
mir dieses Dokument neu" — es kürzt, wechselt mitten drin die Sprache, bricht ab
oder gibt eine Zusammenfassung zurück. Ein einzelner Absatz gelingt ihm.

Nebenbei löst das die Form-Frage von selbst:

```
# Bericht              ← geht nie zum Modell
                       
Ein Absatz Text …      ← geht zum Modell
                       
- Punkt eins           ← geht nie zum Modell
- Punkt zwei           
                       
```js                  ← geht nie zum Modell
const x = 1            
```                    
```

Überschriften, Listen, Zitate, Tabellen und Code werden gar nicht erst
verschickt, sondern unverändert wieder eingesetzt. Was nicht verschickt wird,
kann auch nicht kaputtgehen. Sehr kurze Absätze bleiben ebenfalls verschont —
an „Brötchen." gibt es nichts zu lektorieren.

### Jeder Absatz wird nachgemessen

Ein Modell, das „weniger Fließband" hört, liefert oft dieselben Floskeln in
neuer Reihenfolge. Darum zählt nicht die Absicht, sondern das Ergebnis. Jede
Antwort muss durch diese Tore, sonst wird sie verworfen und der Absatz ein
zweites Mal gefragt — mit der Beanstandung als Auftrag:

| Tor | Was auffliegt |
|---|---|
| **Überschrift** | Eine Raute eingebaut, wo keine war. |
| **Aufzählung** | Aus Fließtext eine Liste gemacht. |
| **Absatz** | Aus einem Absatz mehrere gemacht. |
| **Länge** | Unter 60 % oder über 170 % — gekürzt statt lektoriert. |
| **Sprache** | Deutsch rein, Englisch raus. Der Klassiker kleiner Modelle. |
| **Ende** | Endet das Original sauber und die Antwort mitten im Satz. |
| **Messung** | Der Absatz wurde messbar schlechter. |

Klappt es auch beim zweiten Mal nicht, **bleibt genau dieser Absatz stehen** —
und die anderen werden trotzdem besser. Vorher fiel in dem Fall die ganze
Überarbeitung durch, und man bekam gar nichts.

Hinterher steht da, was passiert ist:

```
Überarbeitet mit ollama (qwen2.5:14b) · 2 von 3 Absätzen
nachgemessen: 181.8 → 57.8 Punkte (klein ist gut)
Ein Absatz unverändert gelassen: nur noch 13 % der Länge
```

### Woher das Modell kommt

Läuft **Ollama** auf deinem Rechner, wird es zuerst gefragt — kein Schlüssel,
kein Netz, keine Kosten:

```bash
ollama serve
ollama pull llama3.2:3b
```

Welches Modell passt, hängt am Arbeitsspeicher — und zwar hart. Ein zu großes
Modell lädt nicht, sondern beginnt zu tauschen, und dann dauert ein einzelner
Absatz Minuten:

| Arbeitsspeicher | Modell | Belegt |
|---|---|---|
| **8 GB** | `llama3.2:3b` | ~2,0 GB |
| 16 GB | `qwen2.5:7b` | ~4,7 GB |
| 32 GB und mehr | `qwen2.5:14b` | ~9,0 GB |

Handschrift nimmt von selbst das größte Modell, das **noch in den Speicher
passt** — nicht das größte überhaupt. Gerechnet wird mit 55 % des
Arbeitsspeichers; der Rest gehört dem System, dem Browser und Handschrift
selbst. Auf einem 8-GB-Mac bleiben so gut vier Gigabyte.

Einbettungs- und Bildmodelle werden übersprungen, die können keinen Text
schreiben. In den Einstellungen lässt sich ein bestimmtes Modell festlegen,
wenn die Automatik danebenliegt.

Auf 8 GB ist `llama3.2:3b` klein — genau dafür geht das Umschreiben absatzweise.
Ein einzelner Absatz überfordert es nicht, und misslingt einer, bleibt er
stehen, während die übrigen besser werden.

Sonst genügt ein Gratis-Schlüssel, einer reicht. Er liegt in
`data/einstellungen.json` auf deinem Rechner:

| Anbieter | Schlüssel holen |
|---|---|
| Gemini | aistudio.google.com/apikey |
| Cerebras | cloud.cerebras.ai |
| Groq | console.groq.com/keys |
| OpenRouter | openrouter.ai |

Messen und Tippen laufen auch ohne beides.

### Warum es keinen Umschreiber ohne Modell gibt

Naheliegend wäre, die Floskeln einfach per Regel zu streichen. Im Deutschen
geht das nicht: „In der heutigen Zeit **spielt** KI eine Rolle." wird dabei zu
„**Spielt** KI eine Rolle." Ein vorangestelltes Adverbial dreht Verb und Subjekt
um, und wer es entfernt, muss zurückdrehen — das braucht Satzbau-Analyse, keine
Ersetzung. Ausprobiert, die Messwerte wurden besser, der Text kaputt. Darum
wieder ausgebaut.

Das ist ein Lektorat-Werkzeug. Es macht Text besser lesbar. Es sagt nichts
darüber, was irgendein Erkennungsdienst hinterher meldet, und verspricht das
auch nicht.

## Tippen

Der Regler stellt die Dauer ein, von zehn Sekunden bis vier Stunden. Dann läuft
ein Vorlauf — Zeit, ins Zielfenster zu klicken — und Handschrift tippt Zeichen
für Zeichen hinein: in ein Google-Dokument, einen Editor, ein Textfeld.

Eine Maschine tippt mit gleichem Abstand, und das sieht sofort falsch aus. Hier
ist der Rhythmus im Wort schnell, stockt vor dem Komma, hält nach dem Punkt an,
macht ab und zu eine Denkpause und wird über den Text schneller oder müder.

```
∅ im Wort 282 ms · nach Punkt 1338 ms · am Umbruch 1584 ms
```

**Stopp** hält jederzeit an.

Zwei Grenzen sind eingebaut. Nach unten: unter ~45 ms je Anschlag verweigert
Handschrift, weil ein einzelner Tastendruck das Betriebssystem selbst schon so
viel kostet. Nach oben: vier Stunden. Was länger läuft, ist kein sichtbarer
Tipp-Effekt mehr; dann ist die Schreibgeschichte des Dokuments das eigentliche
Ergebnis, und die wäre erfunden. Dafür ist Handschrift nicht gebaut.

**macOS** fragt beim ersten Tippen nach *Bedienungshilfen* — ohne die Erlaubnis
kommt kein Zeichen an. Schneller tippt es mit `brew install cliclick`.
**Windows** tippt über PowerShell, **Linux** über `xdotool`.

### Leerzeichen und Umbruch auf dem Mac

Der wunde Punkt, zweimal falsch geraten und dann nachgemessen.

`cliclick t: ` übergibt ein Leerzeichen am Rand, und Rand wird abgeschnitten —
im Dokument stand `Erstezeilehier`. Der naheliegende Ersatz `kp:space` tat auf
einem echten Rechner gar nichts: **0 von 3 Leerzeichen kamen an.**

Der Zeilenumbruch hängt am selben Faden, und sein Ausfall wiegt schwerer. Ein
verschlucktes Leerzeichen klebt zwei Wörter zusammen. Ein verschluckter Umbruch
klebt das ganze Dokument zusammen: der Text, den Handschrift gerade in
Überschriften, Stichpunkte und Schritte zerlegt hat, kommt drüben wieder als
ein Klumpen an — aufgetrennt losgeschickt, verklebt angekommen, und niemand
meldet einen Fehler, denn getippt wurde ja.

Darum wird beides gesucht statt geraten:

```bash
node hilfe.mjs --tippen
```

TextEdit geht kurz auf, jeder Weg wird einzeln versucht — vier fürs
Leerzeichen, drei für den Umbruch —, und der erste funktionierende landet in
den Einstellungen. Ab dann tippt Handschrift damit. Beim allerersten Tipp-Lauf
macht Handschrift das von selbst, bevor der Vorlauf beginnt.

Tabulator geht weiter über `kp:tab`.

Hat der Text gar keine Absätze, sagt Handschrift das vor dem Tippen — sonst
landet er auch ohne Absätze im Dokument, und das merkt man erst hinterher. Ein
zweiter Druck auf **Tippen starten** heißt: doch so.

## Ordner

```
server/
  index.js     kleiner HTTP-Server, nur node:http
  messen.js    die Messung — reine Rechnung, kein Netz
  tippen.js    der Tipp-Rhythmus — reine Rechnung, keine Tastatur
  schreiben.js schlägt die Tasten an (macOS, Windows, Linux)
  gehirn.js    Umschreiben mit Nachmessen (Ollama oder Gratis-Anbieter)
  bloecke.js   Text in Absätze, Listen, Code zerlegen und zurück
  entwirren.js verklebten Text auftrennen und wieder gliedern
  config.js    Einstellungen in data/
web/index.html Oberfläche, eine Datei, kein Bauschritt
data/          Schlüssel und Einstellungen — bleibt hier
```

## Aktuell bleiben

Handschrift schaut selbst nach. Beim Start und danach alle zehn Minuten fragt
sie beim Repo an, ob etwas Neueres bereitliegt. Liegt es, steht im Terminal:

```
  ⟳ Neuere Fassung bereit (2 Änderungen) — in der Oberfläche holen.
```

und oben auf der Seite ein Kasten mit dem Knopf **Jetzt holen**. Ein Druck
darauf holt den neuen Stand, startet Handschrift neu und lädt die Seite frisch
— ohne Terminal, ohne `git pull`.

Geholt wird nur auf Anforderung. Ungefragt Code nachladen und ausführen wäre
bequem und falsch; es ist dein Rechner.

Hast du am Quelltext selbst etwas geändert, bricht Handschrift ab und sagt es,
statt deine Arbeit zu überschreiben. Dann entscheidest du: sichern mit
`git stash` oder verwerfen mit `git reset --hard origin/main`.

Von Hand geht es weiter wie bisher:

```bash
cd ~/handschrift && git pull && npm start
```

## Wenn etwas nicht geht

```bash
node hilfe.mjs
```

Handschrift geht dann jeden Schritt selbst durch: Fassung, Node, Speicher, ob
der Quelltext hinterherhinkt, welches Modell erreichbar ist, ob getippt werden
kann, ob das Messen rechnet — und versucht schließlich eine echte Überarbeitung
mit dem eigenen Modell, samt der Gründe, warum ein Absatz stehen blieb.

Das Ergebnis ist ein Stück Text, das man weitergeben kann. Es beantwortet die
Fragen, die man sonst einzeln stellen müsste.

## Prüfen

```bash
npm run pruefe
```

Ein Befehl, ein Urteil. Er ruft alle fünf Proben nacheinander auf und fasst sie
zusammen; was auf diesem Rechner nicht geht, wird übersprungen und gesagt.

```
  ✓ Rechnen        137 von 137 in Ordnung
  ✓ Modell         12 von 12 in Ordnung
  ✓ Oberfläche     17 von 17 in Ordnung
  ✓ Tippen         16 von 16 in Ordnung
  ✓ Aktualisieren  10 von 10 in Ordnung
```

Die fünf lassen sich auch einzeln aufrufen. Sie prüfen mit Absicht
unterschiedliche Dinge — jede von ihnen deckt Fehler auf, die die anderen nicht
sehen können.

**`node pruefe.mjs`** — das Rechnen. Misst flachen gegen lebendigen Text, prüft
den Rhythmus, die Dauer-Eingaben, die Grenzen, den Stopp, die
Absatz-Zerlegung, das Auftrennen und Gliedern, alle Tore und die Modellwahl
nach Arbeitsspeicher. Ohne Netz, ohne Tastendruck.

**`node pruefe-ollama.mjs`** — der Weg zum Modell. Eine Attrappe spricht das
echte Ollama-Protokoll: Handschrift muss sie finden, das passende Modell
wählen, absatzweise fragen und mit der Antwort etwas anfangen. Prüft auch, was
in der Meldung steht, wenn Ollama mitten im Betrieb wegfällt.

**`node pruefe-browser.mjs`** — die Oberfläche, wirklich angeklickt. Der
Unterschied ist nicht akademisch: der Knopf „Absätze wiederherstellen“ war
einmal da, sichtbar, ohne Fehler in der Konsole, und tat nichts, weil sein
Klick-Ohr nie angehängt wurde. Über die Schnittstelle allein ist das
unsichtbar. Braucht Playwright.

**`node pruefe-tippen.mjs`** — das Tippen, und danach nachgelesen. Öffnet ein
Fenster, lässt Handschrift hineintippen und vergleicht Zeichen für Zeichen, was
angekommen ist. Genau hier fielen die Fehler auf, die sonst niemand sieht: das
verschluckte Leerzeichen auf dem Mac und die verschwundenen Umlaute unter
Linux. Braucht Linux mit `xdotool` und `xterm`; auf dem Mac übernimmt das
`node hilfe.mjs --tippen`.

**`node pruefe-update.mjs`** — das Selbst-Aktualisieren. Baut ein eigenes Repo,
setzt einen echten Commit hinein und lässt Handschrift sich daraus holen und
neu starten — inklusive der Probe, dass eigene Änderungen am Quelltext nicht
überfahren werden.
