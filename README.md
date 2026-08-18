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

Dann `http://localhost:3018` öffnen. Nur dein Rechner kommt dran.

Alle drei Wege setzen voraus, dass das Repo auf **öffentlich** steht — bei
privat antwortet GitHub mit 404, als gäbe es das Repo nicht.

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
werden neun Blöcke:

```
Laboratory Report: Heart Dissection

1. Title Page / Cover Page
Title: Dissection of the Mammalian Heart
Student Name: Jaidi Grotemeyer
Course: Biology
Date: August 17, 2026

2. Introduction
The mammalian heart is a four-chambered pump …
```

Getrennt wird nur an deutlichen Klebestellen: fehlendes Leerzeichen nach dem
Satzende, eine Abschnittsnummer am Wort (`Dissection1.`, `anatomy.3.`), eine
Beschriftung mit Doppelpunkt (`GrotemeyerCourse:`, `ObservationsFigure 1:`),
ein Doppelpunkt direkt vor einem Großbuchstaben (`Procedure:Examine`). Geraten
wird nicht, und kein Buchstabe geht verloren.

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

## Ordner

```
server/
  index.js     kleiner HTTP-Server, nur node:http
  messen.js    die Messung — reine Rechnung, kein Netz
  tippen.js    der Tipp-Rhythmus — reine Rechnung, keine Tastatur
  schreiben.js schlägt die Tasten an (macOS, Windows, Linux)
  gehirn.js    Umschreiben mit Nachmessen (Ollama oder Gratis-Anbieter)
  bloecke.js   Text in Absätze, Listen, Code zerlegen und zurück
  entwirren.js verklebten Text erkennen und wieder auftrennen
  config.js    Einstellungen in data/
web/index.html Oberfläche, eine Datei, kein Bauschritt
data/          Schlüssel und Einstellungen — bleibt hier
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
node pruefe.mjs
```

Misst flachen gegen lebendigen Text, prüft den Rhythmus, die Dauer-Eingaben,
die Grenzen, den Stopp, die Absatz-Zerlegung, das Entwirren, alle Tore und die
Modellwahl nach Arbeitsspeicher — 89 Prüfungen, ohne dass eine Taste angeschlagen oder ein Modell angerufen wird.
