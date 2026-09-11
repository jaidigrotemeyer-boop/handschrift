# Handschrift für Google Docs — ohne Mac, ohne Gerät, ohne Geld

Ein iPad kann nicht in eine andere App tippen; das lässt iPadOS nicht zu. Es
gibt aber einen Weg, der nichts kostet und keine Hardware braucht: das
Dokument schreibt sich selbst voll.

**Google Apps Script** läuft auf Googles Rechnern, gehört zu jedem
Google-Konto und wird im Browser bedient — auch auf einem iPad.

## In drei Schritten

1. **[script.google.com](https://script.google.com)** öffnen, „Neues Projekt".
   Auf dem iPad in Safari vorher **Desktop-Website anfordern** — der Editor
   ist für Mäuse gebaut und sonst kaum zu bedienen.
2. Den Inhalt von `Handschrift.gs` hineinkopieren. Oben bei `TEXT` deinen
   fertigen Text einsetzen, bei `DAUER_MINUTEN` die gewünschte Dauer.
3. Die Funktion **`starten`** ausführen.

Mehr nicht. Die beiden Dokumente legt das Skript selbst an und schreibt dir
die Links ins Protokoll — auf dem iPad ist das Anlegen von Hand der lästigste
Teil, und den soll niemand machen müssen. Google fragt einmal nach der
Erlaubnis; das ist dein eigenes Konto, und sie gilt nur diesem Skript.

Dann `Handschrift Ziel` offen lassen und zusehen.

Wer den Text lieber nicht in den Editor tippt, lässt `TEXT` leer und schreibt
ihn ins Dokument `Handschrift Quelle`, das beim ersten Starten entsteht.

## Was dabei passiert

Jede Minute wacht das Skript auf und schreibt das nächste Stück — innerhalb
dieser Minute Zeichen für Zeichen, mit längeren Pausen nach einem Punkt,
kurzen nach einem Komma und gelegentlichem Stocken. Alle zwei Sekunden
speichert es, damit der Text im offenen Dokument wirklich wächst und nicht
minutenweise aufpoppt.

Ein einzelner Lauf darf bei Google höchstens sechs Minuten dauern. Darum die
Aufteilung in Minutenhäppchen — das Skript merkt sich, wo es stehengeblieben
ist, und macht beim nächsten Mal dort weiter.

| Funktion | Wofür |
|---|---|
| `starten` | einmal drücken, dann läuft es |
| `stand` | wie weit ist es? |
| `stoppen` | aufhören, egal wo |

## Die Obergrenze

`DAUER_MINUTEN` geht bis vier Stunden, nicht weiter — dieselbe Grenze wie im
Programm auf dem Mac, aus demselben Grund. Was über Tage läuft, ist kein
Schreibvorgang mehr, sondern eine erfundene Entstehungsgeschichte: eine
Versionsgeschichte, die so nie stattgefunden hat, für jeden, der später
hineinschaut. Ein sichtbarer Schreibvorgang ist eine Darstellung. Ein
gefälschter Zeitverlauf ist eine Behauptung über die Vergangenheit.

## Ungetestet

Dieses Skript ist geschrieben, aber nicht auf einem echten Google-Konto
gelaufen — von hier aus gibt es keinen Zugang zu deinem Drive. Der Rest von
Handschrift ist durchgemessen; dieses Stück ist es nicht. Wenn etwas klemmt,
steht der Grund im Protokoll des Editors (Ausführungen → Protokoll), und die
Meldungen sind so geschrieben, dass sie sagen, was zu tun ist.
