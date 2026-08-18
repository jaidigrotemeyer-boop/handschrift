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
ollama pull llama3.2:3b     # klein und schnell, reicht absatzweise
ollama pull qwen2.5:7b      # merklich besseres Deutsch, wenn der Rechner mag
```

Sind mehrere Modelle da, nimmt Handschrift das größte — beim Lektorieren ist
größer spürbar besser. Einbettungs- und Bildmodelle werden übersprungen, die
können keinen Text schreiben. In den Einstellungen lässt sich ein bestimmtes
Modell festlegen.

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
  config.js    Einstellungen in data/
web/index.html Oberfläche, eine Datei, kein Bauschritt
data/          Schlüssel und Einstellungen — bleibt hier
```

## Prüfen

```bash
node pruefe.mjs
```

Misst flachen gegen lebendigen Text, prüft den Rhythmus, die Dauer-Eingaben,
die Grenzen, den Stopp, die Absatz-Zerlegung, alle Tore und die Modellwahl —
70 Prüfungen, ohne dass eine Taste angeschlagen oder ein Modell angerufen wird.
