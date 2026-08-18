// Selbsttest: alles einmal wirklich laufen lassen.
//   node pruefe.mjs
import { messen } from './server/messen.js'
import { zeichenPlan, aufDauer, dauerLesen, abspielen, zeitText, MAX_DAUER_MS } from './server/tippen.js'
import { bereit, cliclickBefehl, leerWeg, umbruchWeg, LEER_REIHE, LEER_WEGE, UMBRUCH_REIHE, UMBRUCH_WEGE, tippWege, tastenName, SYSTEM } from './server/schreiben.js'
import { umschreiben, bewertung, saeubern, putzen, strukturPruefen, istDeutsch, listenAufraeumen, textArt, bestesModell, speicherBudget, netzKlartext } from './server/gehirn.js'
import { bloecke, zusammensetzen, lektorierbar } from './server/bloecke.js'
import { istVerklebt, entwirren, gliedern } from './server/entwirren.js'

let gut = 0
let schlecht = 0

function pruefe(was, bedingung, info = '') {
  if (bedingung) {
    gut++
    console.log(`   ✓ ${was}${info ? '  ' + info : ''}`)
  } else {
    schlecht++
    console.log(`   ✗ ${was}${info ? '  ' + info : ''}`)
  }
}

// Absichtlich so lang, dass die Schwellen greifen: unter fünf Sätzen sagt die
// Messung bewusst nichts über Satzlängen, weil vier Zahlen keine Verteilung sind.
const FLACH =
  'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. ' +
  'Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst. ' +
  'Zudem bietet moderne Technologie eine breite Palette an neuen Möglichkeiten für Firmen.\n\n' +
  'Darüber hinaus ermöglicht die Automatisierung eine nahtlose Verzahnung von Prozessen und Systemen. ' +
  'Zudem lassen sich dadurch Kosten, Zeit und Ressourcen deutlich effizienter einsetzen. ' +
  'Es ist wichtig zu betonen, dass die Mitarbeiter dabei eine zentrale Rolle spielen.\n\n' +
  'Zusammenfassend lässt sich sagen, dass die Digitalisierung von entscheidender Bedeutung ist. ' +
  'Unternehmen sollten daher nicht nur in Technologie, sondern auch in ihre Menschen investieren.'

const LEBENDIG =
  'Der Bäcker steht um vier auf. Nicht aus Idealismus — der Teig richtet sich nicht nach ihm, sondern er sich nach dem Teig.\n\n' +
  'Um halb sechs kommt die erste Fuhre raus. Brötchen. Dann Brot, dann, wenn Zeit bleibt, das Süße.\n\n' +
  'Er hat mal gerechnet, was die Stunde bringt. Danach hat er nicht mehr gerechnet.'

console.log('\n  Handschrift Selbsttest\n')

console.log('  MESSEN')
const flach = messen(FLACH)
const lebendig = messen(LEBENDIG)
pruefe('flacher Text fällt auf', flach.auffaellig.length >= 3, `${flach.auffaellig.length} Auffälligkeiten`)
pruefe('flacher Text: Urteil maschinell', /maschinell/i.test(flach.urteil), flach.urteil)
pruefe('Floskeln gefunden', flach.floskeln.anzahl >= 5, `${flach.floskeln.anzahl} Stück`)
pruefe('lebendiger Text fällt nicht auf', lebendig.auffaellig.length === 0, lebendig.urteil)
pruefe(
  'Gleichmaß trennt beide',
  flach.satz.gleichmass < 0.3 && lebendig.satz.gleichmass > 0.5,
  `flach ${flach.satz.gleichmass} · lebendig ${lebendig.satz.gleichmass}`,
)
pruefe('Abkürzung zerteilt keinen Satz', messen('Wir nehmen z. B. Butter und Mehl.').satz.anzahl === 1)
pruefe('leerer Text stürzt nicht ab', messen('').satz.anzahl === 0)

console.log('\n  RHYTHMUS')
for (const [wert, ms] of [['45s', 45000], ['10m', 600000], ['1h30m', 5400000], [5, 300000], ['10 min', 600000], ['2std', 7200000], ['1,5h', 5400000]])
  pruefe(`Dauer "${wert}"`, dauerLesen(wert) === ms, zeitText(ms))
// "150ms" ist die gemeine Eingabe: früher las das Muster daraus 150 Minuten,
// weil "m" vor "min" stand und das übrige "s" niemandem auffiel.
for (const wert of ['drei Wochen', '150ms', '10x', '10m5', 'h'])
  pruefe(`Dauer "${wert}" abgelehnt`, (() => { try { dauerLesen(wert); return false } catch { return true } })())

const plan = zeichenPlan(LEBENDIG, { saat: 7 })
const gestreckt = aufDauer(plan, dauerLesen('10m'))
pruefe('Plan hat ein Zeichen je Schritt', plan.schritte.length === LEBENDIG.length)
pruefe('Streckung trifft die Dauer', Math.abs(gestreckt.gesamtMs - 600000) < 600000 * 0.02, zeitText(gestreckt.gesamtMs))

const s = plan.schritte
const imWort = s.filter((x, i) => /\p{L}/u.test(x.zeichen) && /\p{L}/u.test(s[i - 1]?.zeichen || '')).map((x) => x.pause)
const nachPunkt = s.filter((x, i) => /[.!?]/.test(s[i - 1]?.zeichen || '')).map((x) => x.pause)
const mittel = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
pruefe('Pause nach dem Punkt ist länger', mittel(nachPunkt) > mittel(imWort) * 2, `${mittel(imWort)} ms → ${mittel(nachPunkt)} ms`)
pruefe('kein Anschlag ohne Abstand', s.every((x) => x.pause >= 8))
pruefe(
  'Obergrenze greift',
  (() => { try { aufDauer(plan, MAX_DAUER_MS + 1); return false } catch { return true } })(),
  `${MAX_DAUER_MS / 3600000} Stunden`,
)
pruefe(
  'gleiche Saat, gleicher Rhythmus',
  zeichenPlan(LEBENDIG, { saat: 3 }).schritte.map((x) => x.pause).join() ===
    zeichenPlan(LEBENDIG, { saat: 3 }).schritte.map((x) => x.pause).join(),
)

console.log('\n  ABSPIELEN')
const ac = new AbortController()
let getippt = ''
const lauf = await abspielen(gestreckt, {
  tippe: async (z) => { getippt += z; if (getippt.length === 25) ac.abort() },
  warte: async () => {},
  signal: ac.signal,
})
pruefe('Stopp greift mitten im Text', lauf.getippt === 25, JSON.stringify(getippt))

const kurz = aufDauer(zeichenPlan('Ein kurzer Testsatz.', { saat: 1 }), 2000)
const t0 = Date.now()
await abspielen(kurz, { tippe: async () => {}, warte: (ms) => new Promise((f) => setTimeout(f, ms)) })
const gebraucht = Date.now() - t0
pruefe('echte Wartezeit stimmt', Math.abs(gebraucht - 2000) < 250, `${gebraucht} ms statt 2000`)

const lang = 'Ein Satz mit ein paar Wörtern drin. '.repeat(1500)
const t1 = Date.now()
const grosserPlan = zeichenPlan(lang, { saat: 1 })
const t2 = Date.now()
await abspielen(grosserPlan, { tippe: async () => {}, warte: async () => {} })
pruefe('langer Text bleibt schnell', Date.now() - t1 < 2000, `${grosserPlan.schritte.length} Zeichen, ${t2 - t1} ms geplant`)

console.log('\n  UMSCHREIBEN')
// Das Modell wird hier eingesetzt statt angerufen: so lässt sich prüfen, was
// die Schleife mit guten, faulen und schlechten Antworten macht.
// Ein einzelner brauchbarer Absatz — mehr bekommt das Modell jetzt nie zu tun.
const GUT_ABSATZ =
  'Digitalisierung trifft jede Firma. Große wie kleine. Was am Ende zählt, hängt an mehr Stellen als den offensichtlichen, und die wenigsten davon stehen in der Broschüre des Anbieters.'

pruefe('Bewertung trennt flach von lebendig', bewertung(messen(FLACH)) > bewertung(messen(LEBENDIG)) * 3,
  `flach ${bewertung(messen(FLACH))} · lebendig ${bewertung(messen(LEBENDIG))}`)

pruefe('Vorrede wird abgeschnitten', saeubern('Hier ist der überarbeitete Text:\n\nDer Bäcker steht auf.') === 'Der Bäcker steht auf.')
pruefe('Code-Block wird ausgepackt', saeubern('```markdown\nDer Bäcker steht auf.\n```') === 'Der Bäcker steht auf.')

// Ein Dokument mit allem drin: Überschrift, Absätze, Liste, Code.
const GEMISCHT =
  '# Bericht\n\n' +
  'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe. Darüber hinaus ist es wichtig zu beachten, dass eine Vielzahl von Faktoren den Erfolg beeinflusst.\n\n' +
  '- Punkt eins\n- Punkt zwei\n\n' +
  'Zudem ermöglicht die Automatisierung eine nahtlose Verzahnung von Prozessen und Systemen. Zudem lassen sich dadurch Kosten deutlich effizienter einsetzen.\n\n' +
  '```js\nconst x = 1\n```'

const einmal = await umschreiben(FLACH, { fragen: async () => GUT_ABSATZ })
pruefe('Absätze werden lektoriert', einmal.absaetze.lektoriert === einmal.absaetze.gesamt,
  `${einmal.absaetze.lektoriert}/${einmal.absaetze.gesamt} · ${einmal.punkte.vorher} → ${einmal.punkte.nachher} Punkte`)
pruefe('es wurde messbar besser', einmal.punkte.nachher < einmal.punkte.vorher)

// Überschrift, Liste und Code gehen gar nicht erst zum Modell.
let gefragt = 0
const gemischt = await umschreiben(GEMISCHT, { fragen: async () => { gefragt++; return GUT_ABSATZ } })
pruefe('nur Absätze gehen zum Modell', gemischt.absaetze.gesamt === 2, `${gemischt.absaetze.gesamt} Absätze, ${gefragt} Anfragen`)
pruefe('Überschrift bleibt unberührt', gemischt.text.startsWith('# Bericht'))
pruefe('Liste bleibt unberührt', gemischt.text.includes('- Punkt eins\n- Punkt zwei'))
pruefe('Code bleibt unberührt', gemischt.text.includes('```js\nconst x = 1\n```'))

// Kleines Modell: erst Englisch, dann brauchbar. Der zweite Anlauf muss zählen.
let k = 0
const zweiter = await umschreiben(FLACH, {
  fragen: async () => (++k % 2 === 1 ? 'Automation seamlessly connects all the processes and systems together nicely.' : GUT_ABSATZ),
})
pruefe('englische Antwort wird abgelehnt, zweiter Anlauf zählt', zweiter.absaetze.lektoriert > 0,
  `${zweiter.absaetze.lektoriert}/${zweiter.absaetze.gesamt}`)

// Modell liefert durchweg Murks: der Absatz bleibt stehen, statt alles zu kippen.
let murks = null
try {
  await umschreiben(FLACH, { fragen: async () => 'Kurz.' })
} catch (err) {
  murks = err.message
}
pruefe('durchweg unbrauchbar wird gemeldet', /Kein Absatz wurde besser/.test(murks || ''), murks?.slice(0, 60))

// Teils gut, teils Murks: was geht, wird genommen.
let z = 0
const teils = await umschreiben(GEMISCHT, { fragen: async () => (++z === 1 ? GUT_ABSATZ : 'Kurz.') })
pruefe('teilweiser Erfolg zählt', teils.absaetze.lektoriert === 1 && teils.absaetze.behalten.length === 1,
  `${teils.absaetze.lektoriert} lektoriert, ${teils.absaetze.behalten.length} behalten (${teils.absaetze.behalten[0]})`)

pruefe('Ausfall wird durchgereicht',
  await umschreiben(FLACH, { fragen: async () => { throw new Error('kein Netz') } }).then(() => false, (e) => /kein Netz/.test(e.message)))

// Ehrliches Entfloskeln kürzt kräftig — das darf nicht als Zusammenfassen gelten.
{
  const lang = 'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe.'
  const knapp = await umschreiben(lang, { fragen: async () => 'Digitalisierung trifft jede Firma, große wie kleine.' })
  pruefe('starkes Kürzen ist erlaubt', knapp.absaetze.lektoriert === 1, `${knapp.punkte.vorher} → ${knapp.punkte.nachher} Punkte`)
}
// Aber eine verlorene Zahl heißt: zusammengefasst, nicht lektoriert.
{
  const mitZahl = 'Im Jahr 2026 stiegen die Kosten der Abteilung um 17 Prozent, was viele Beteiligte damals ehrlich überraschte.'
  let raus = null
  try {
    await umschreiben(mitZahl, { fragen: async () => 'Die Kosten der Abteilung stiegen damals kräftig und überraschten viele Beteiligte.' })
  } catch (err) {
    raus = err.message
  }
  pruefe('verlorene Zahl fliegt auf', /Zahl verloren/.test(raus || ''), raus?.slice(0, 60))
}
{
  const mitZahl = 'Im Jahr 2026 stiegen die Kosten um 17 Prozent, was damals viele Beteiligte im Haus ehrlich überraschte.'
  const gut = await umschreiben(mitZahl, { fragen: async () => '2026 stiegen die Kosten um 17 Prozent. Das überraschte viele im Haus.' })
  pruefe('erhaltene Zahlen sind in Ordnung', gut.absaetze.lektoriert === 1)
}

console.log('\n  BLÖCKE')
{
  const b = bloecke(GEMISCHT)
  pruefe('verlustfrei zerlegt und zusammengesetzt', zusammensetzen(b) === GEMISCHT)
  pruefe('Arten erkannt', b.filter((x) => x.art === 'ueberschrift').length === 1 && b.filter((x) => x.art === 'code').length === 1)
  pruefe('nur Absätze sind lektorierbar', b.filter(lektorierbar).every((x) => x.art === 'absatz'))
  pruefe('kurzer Absatz bleibt verschont', !bloecke('Brötchen.').some(lektorierbar))
  const code = bloecke('Text davor.\n\n```\n- kein Listenpunkt\n# keine Überschrift\n```\n\nText danach.')
  pruefe('Code schluckt sein Inneres', code.filter((x) => x.art === 'code').length === 1)
}

console.log('\n  OLLAMA-MODELLWAHL')
// Größe zählt, aber nur bis zum Speicher. Auf einem 8-GB-Mac ist das größte
// Modell die falsche Wahl: es lädt nicht, sondern tauscht — Minuten je Absatz.
const GB = 1e9
const DA = [
  { name: 'llama3.2:3b', size: 2019393189 },
  { name: 'qwen2.5:7b', size: 4683087519 },
  { name: 'qwen2.5:14b', size: 8988112040 },
  { name: 'nomic-embed-text', size: 274302450 },
]
for (const [ram, soll] of [[8, 'llama3.2:3b'], [16, 'qwen2.5:7b'], [32, 'qwen2.5:14b']])
  pruefe(`${ram} GB RAM → ${soll}`, bestesModell(DA, speicherBudget(ram * GB)) === soll, bestesModell(DA, speicherBudget(ram * GB)))

pruefe('Budget lässt Luft fürs System', speicherBudget(8 * GB) < 5 * GB && speicherBudget(8 * GB) > 3 * GB,
  `${(speicherBudget(8 * GB) / GB).toFixed(1)} GB von 8`)
pruefe('ohne Größenangabe wird geschätzt', bestesModell(['llama3.2:3b', 'qwen2.5:14b'], speicherBudget(8 * GB)) === 'llama3.2:3b')
pruefe('Einbettungsmodell taugt nicht zum Schreiben', bestesModell([{ name: 'nomic-embed-text', size: 2e8 }]) === null)
pruefe('Bildmodell ebenso wenig', bestesModell(['llava:7b', 'mistral:7b'], speicherBudget(16 * GB)) === 'mistral:7b')
pruefe('passt nichts, kommt das kleinste', bestesModell([{ name: 'riesig:70b', size: 40e9 }, { name: 'gross:33b', size: 20e9 }], speicherBudget(8 * GB)) === 'gross:33b')
pruefe('leere Liste ergibt nichts', bestesModell([]) === null)

console.log('\n  STICHPUNKTE UND GRÖSSEN')
pruefe(
  'nebeneinander geklebte Punkte kommen untereinander',
  listenAufraeumen('- Punkt eins - Punkt zwei - Punkt drei') === '- Punkt eins\n- Punkt zwei\n- Punkt drei',
)
pruefe(
  'nummerierte Punkte ebenso',
  listenAufraeumen('1. eins 2. zwei 3. drei') === '1. eins\n2. zwei\n3. drei',
)
pruefe(
  'Gedankenstrich im Fließtext bleibt in Ruhe',
  listenAufraeumen('Er kam - und ging wieder - ohne Gruß.') === 'Er kam - und ging wieder - ohne Gruß.',
)
pruefe('Liste bekommt Luft davor', putzen('Text davor\n- eins\n- zwei', 'x') === 'Text davor\n\n- eins\n- zwei')
pruefe('Raute ohne Leerzeichen wird Überschrift', putzen('#Titel\n\nText.', 'x').startsWith('# Titel'))
pruefe('Überschrift bekommt Luft danach', putzen('# Titel\nText.', 'x') === '# Titel\n\nText.')

for (const [t, soll] of [
  ['Ein Absatz ohne alles. Noch ein Satz.', 'fliesstext'],
  ['- eins\n- zwei\n- drei', 'liste'],
  ['# Titel\n\nText dazu.', 'gegliedert'],
  ['# Titel\n\nText.\n\n- eins\n- zwei', 'dokument'],
  ['Text\n\n```js\ncode()\n```', 'code'],
])
  pruefe(`Textart "${soll}" erkannt`, textArt(t) === soll, textArt(t))

pruefe(
  'aus großer Überschrift darf keine kleine werden',
  /Ebenen/.test(strukturPruefen('# Groß\n\nEin Satz hier.', '### Groß\n\nEin Satz hier.').join()),
)

// Was ein Modell einem einzelnen Absatz antun kann, und ob es auffliegt.
for (const [was, antwort] of [
  ['Überschrift eingebaut', '# Titel\n\nDigitalisierung trifft jede Firma, große wie kleine, und das seit Jahren.'],
  ['Aufzählung eingebaut', '- Digitalisierung trifft jede Firma\n- Große wie kleine, und das seit Jahren schon'],
  ['zwei Absätze draus gemacht', 'Digitalisierung trifft jede Firma.\n\nGroße wie kleine, und das seit vielen Jahren schon.'],
  ['abgeschnitten', 'Digitalisierung trifft jede Firma, große wie kleine, und das schon seit vielen'],
  ['unverändert zurückgegeben', null],
]) {
  const eingabe = 'In der heutigen Zeit spielt die Digitalisierung eine entscheidende Rolle für Unternehmen jeder Größe.'
  let raus = null
  try {
    await umschreiben(eingabe, { fragen: async () => antwort ?? eingabe })
  } catch (err) {
    raus = err.message
  }
  pruefe(`Absatz-Pfusch fällt auf: ${was}`, /Kein Absatz wurde besser/.test(raus || ''))
}

console.log('\n  VERKLEBTER TEXT')
// Genau so kommt ein aus dem PDF kopierter Bericht hier an.
const KLUMPEN =
  'Laboratory Report: Heart Dissection1. Title Page / Cover PageTitle: Dissection of the Mammalian Heart' +
  'Student Name: Jaidi GrotemeyerCourse: BiologyDate: August 17, 20262. IntroductionThe mammalian heart ' +
  'is a four-chambered pump managing pulmonary and systemic circuits. The left ventricle wall is thicker ' +
  'due to higher systemic resistance. Animal hearts are used in school labs because they closely mirror ' +
  'human anatomy.3. MethodologyMaterials: Sheep/pig heart, dissection kit, tray, gloves, camera.' +
  'Procedure:Examine external anatomy. Cut open a ventricle to expose chambers.4. ObservationsFigure 1: ' +
  'Exterior view showing atria and ventricles.'

pruefe('verklebter Text wird erkannt', istVerklebt(KLUMPEN))
pruefe('sauberer Text gilt nicht als verklebt', !istVerklebt(FLACH))
pruefe('kurzer Text gilt nicht als verklebt', !istVerklebt('Kurz. Und Ende.'))

const entwirrt = entwirren(KLUMPEN)
pruefe('Klebestellen aufgetrennt', entwirrt.schnitte > 10, `${entwirrt.schnitte} Schnitte`)
pruefe('danach nicht mehr verklebt', !istVerklebt(entwirrt.text))
for (const zeile of [
  'Laboratory Report: Heart Dissection',
  '1. Title Page / Cover Page',
  '* Student Name: Jaidi Grotemeyer',
  '* Course: Biology',
  '2. Introduction',
  '3. Methodology',
  '4. Observations',
])
  pruefe(`eigene Zeile: "${zeile.slice(0, 28)}"`, entwirrt.text.split('\n').some((z) => z.trim() === zeile))

pruefe('kein Wort verloren', (entwirrt.text.match(/[A-Za-z]/g) || []).length === (KLUMPEN.match(/[A-Za-z]/g) || []).length)

console.log('\n  GLIEDERN')
// Auftrennen holt die Zeilen zurück, gliedern die Form. Beides zusammen ist
// erst das, was der Nutzer sehen wollte: Überschriften, Punkte untereinander,
// nummerierte Schritte — nicht ein Klumpen mit Umbrüchen darin.
{
  const g = entwirrt.text
  const zeilen = g.split('\n')
  const hat = (z) => zeilen.some((x) => x === z)

  pruefe('die Titelzeile bleibt schmucklos', hat('Laboratory Report: Heart Dissection'))
  pruefe(
    'eine Reihe Beschriftungen wird zur Aufzählung',
    ['* Title: Dissection of the Mammalian Heart', '* Student Name: Jaidi Grotemeyer', '* Course: Biology', '* Date: August 17, 2026'].every(hat),
  )
  pruefe('die Punkte stehen untereinander, nicht nebeneinander', zeilen.filter((z) => z.startsWith('* ')).length >= 6)
  pruefe('vor jeder Abschnittsnummer steht eine Leerzeile', ['1.', '2.', '3.', '4.'].every((n) => {
    const i = zeilen.findIndex((z) => z.startsWith(n + ' '))
    return i > 0 && zeilen[i - 1] === ''
  }))
  pruefe('ein Doppelpunkt ohne Inhalt bekommt nummerierte Schritte', hat('   1. Examine external anatomy.') && hat('   2. Cut open a ventricle to expose chambers.'))
  pruefe('die Schritte hängen unter ihrer Beschriftung', zeilen[zeilen.indexOf('   1. Examine external anatomy.') - 1] === '* Procedure:')
  pruefe('ein einzelnes Label wird kein Aufzählungspunkt', hat('Figure 1: Exterior view showing atria and ventricles.'))
  pruefe('Fließtext bleibt Fließtext', hat(zeilen.find((z) => z.startsWith('The mammalian heart')) || ''))
  pruefe(
    'beim Gliedern geht kein Buchstabe verloren',
    (g.match(/[A-Za-z]/g) || []).length === (KLUMPEN.match(/[A-Za-z]/g) || []).length,
    `${(KLUMPEN.match(/[A-Za-z]/g) || []).length} → ${(g.match(/[A-Za-z]/g) || []).length}`,
  )
  // Zweimal gliedern darf nichts weiter verändern — sonst wächst der Text bei
  // jedem Klick auf den Knopf.
  pruefe('nochmal drüber ändert nichts mehr', gliedern(g) === g)
}
pruefe(
  'aus einem Block werden viele Absätze',
  bloecke(entwirrt.text).filter((b) => b.art !== 'leer').length > bloecke(KLUMPEN).filter((b) => b.art !== 'leer').length,
  `${bloecke(KLUMPEN).filter((b) => b.art !== 'leer').length} → ${bloecke(entwirrt.text).filter((b) => b.art !== 'leer').length}`,
)

console.log('\n  AUSDAUER')
// Der Abbruch-Horcher hing früher bei jedem Zeichen neu am selben Signal und
// wurde nie abgenommen — bei langem Text zehntausende Horcher plus Warnung.
{
  const ac2 = new AbortController()
  const warte = (ms) =>
    new Promise((fertig, schief) => {
      if (ac2.signal.aborted) return schief(Object.assign(new Error('Gestoppt.'), { name: 'AbortError' }))
      const abbrechen = () => { clearTimeout(t); schief(Object.assign(new Error('Gestoppt.'), { name: 'AbortError' })) }
      const t = setTimeout(() => { ac2.signal.removeEventListener('abort', abbrechen); fertig() }, ms)
      ac2.signal.addEventListener('abort', abbrechen, { once: true })
    })
  let warnung = null
  const horcher = (w) => (warnung = w.name)
  process.on('warning', horcher)
  for (let i = 0; i < 3000; i++) await warte(0)
  await new Promise((f) => setImmediate(f))
  process.off('warning', horcher)
  pruefe('3000 Wartevorgänge ohne Horcher-Stau', !warnung, warnung || 'keine Warnung')
}

{
  let rufe = 0
  const echt = globalThis.fetch
  globalThis.fetch = (...a) => { rufe++; return echt(...a) }
  const { ollamaDa } = await import('./server/gehirn.js')
  await ollamaDa(); await ollamaDa(); await ollamaDa()
  globalThis.fetch = echt
  pruefe('Ollama wird gemerkt statt dreimal gefragt', rufe <= 1, `${rufe} Netzanfrage(n) bei 3 Abfragen`)
}

console.log('\n  TASTEN AUF DEM MAC')
// Auf einem echten Rechner gemessen: "t: " verliert das Leerzeichen (Rand wird
// abgeschnitten), und "kp:space" schrieb gar nichts — 0 von 3 kamen an. Darum
// geht das Leerzeichen einen eigenen Weg und nie über cliclickBefehl.
pruefe('Leerzeichen läuft nicht über cliclick t:', leerWeg() !== 'cliclick-t')
pruefe('für das Leerzeichen gibt es mehrere Wege', LEER_REIHE.length >= 3, LEER_REIHE.join(', '))
pruefe('jeder Weg ist auch hinterlegt', LEER_REIHE.every((n) => typeof LEER_WEGE[n] === 'function'))
pruefe('AppleScript steht vorn', LEER_REIHE[0].startsWith('applescript'), LEER_REIHE[0])
// Der Umbruch kann genauso ausfallen wie das Leerzeichen — und richtet mehr
// Schaden an: ohne ihn kommt ein gegliedertes Dokument drüben wieder als ein
// Klumpen an, verklebt, obwohl es entklebt losgeschickt wurde.
pruefe('für den Umbruch gibt es mehrere Wege', UMBRUCH_REIHE.length >= 3, UMBRUCH_REIHE.join(', '))
pruefe('jeder Umbruch-Weg ist hinterlegt', UMBRUCH_REIHE.every((n) => typeof UMBRUCH_WEGE[n] === 'function'))
pruefe('AppleScript steht auch hier vorn', UMBRUCH_REIHE[0].startsWith('applescript'), UMBRUCH_REIHE[0])
pruefe('der gewählte Weg ist einer aus der Reihe', UMBRUCH_REIHE.includes(umbruchWeg()), umbruchWeg())
pruefe('Leerzeichen und Umbruch werden getrennt gemerkt', UMBRUCH_REIHE.join() !== LEER_REIHE.join())
pruefe('Zeilenumbruch über kp:return', cliclickBefehl('\n') === 'kp:return')
pruefe('Wagenrücklauf ebenso', cliclickBefehl('\r') === 'kp:return')
pruefe('Tabulator über kp:tab', cliclickBefehl('\t') === 'kp:tab')
for (const z of ['H', 'a', '.', 'ä', '-', ':', '/'])
  pruefe(`"${z}" wird normal getippt`, cliclickBefehl(z) === 't:' + z)

console.log('\n  TASTEN AUF LINUX')
// "xdotool type" verlor die Umlaute stillschweigend: "Lücken" kam als "Lcken"
// an, "(äöü)" als "()" — ohne Fehler, ohne Meldung. Über den Tastennamen
// kommen sie an. Nachgemessen in pruefe-tippen.mjs.
pruefe('"ü" bekommt einen Tastennamen', tastenName('ü') === 'U00FC', tastenName('ü'))
pruefe('"ä" ebenso', tastenName('ä') === 'U00E4')
pruefe('"ß" ebenso', tastenName('ß') === 'U00DF')
pruefe('auch ein Gedankenstrich', tastenName('—') === 'U2014')
pruefe('der Name ist immer vier Stellen lang', ['ü', 'é', '„'].every((z) => /^U[0-9A-F]{4,}$/.test(tastenName(z))))

// Die Selbstauskunft gab auf einem Linux-Rechner "Leerzeichen über
// applescript-keystroke" aus — den Mac-Weg, auf einem System ohne AppleScript.
// Wer bei "geht nicht" die Auskunft liest, sucht dann am falschen Ort.
{
  const w = tippWege()
  pruefe('die Auskunft nennt ein Werkzeug', !!w.werkzeug && !!w.leerzeichen && !!w.umbruch, Object.values(w).join(' · '))
  const macSache = /cliclick|applescript|keystroke|kp:/i
  pruefe(
    'und auf diesem System nur, was es hier gibt',
    SYSTEM === 'darwin' || !macSache.test(Object.values(w).join(' ')),
    SYSTEM,
  )
}

console.log('\n  MELDUNGEN, WENN ES KLEMMT')
// "fetch failed" ist Nodes Wort für "keine Verbindung" und für den Nutzer
// nichts. Wer Ollama beendet hat, soll lesen, dass Ollama fehlt.
pruefe(
  'ein toter Ollama sagt, was zu tun ist',
  /ollama serve/.test(netzKlartext('ollama (llama3.2:3b)', new Error('fetch failed'))),
  netzKlartext('ollama (llama3.2:3b)', new Error('fetch failed')),
)
pruefe('abgewiesene Verbindung ebenso', /ollama serve/.test(netzKlartext('ollama (x)', new Error('connect ECONNREFUSED 127.0.0.1:11434'))))
pruefe('ein anderer Anbieter fragt nach dem Netz', /Netz/.test(netzKlartext('groq', new Error('fetch failed'))), netzKlartext('groq', new Error('fetch failed')))
pruefe('ein falscher Schlüssel wird benannt', /Schlüssel/.test(netzKlartext('groq', new Error('401 Unauthorized'))))
pruefe('zu viele Anfragen werden benannt', /später/.test(netzKlartext('groq', new Error('429 rate limit exceeded'))))
pruefe('Unbekanntes wird durchgereicht', netzKlartext('groq', new Error('Modell kaputt')) === 'groq: Modell kaputt')

console.log('\n  SELBST AKTUALISIEREN')
// Der ganze Weg — eigenes Repo, echter Commit, echter Neustart — steckt in
// pruefe-update.mjs. Hier nur, was ohne Netz und ohne Neustart prüfbar ist.
{
  const { nachsehen, istGitOrdner } = await import('./server/aktualisieren.js')
  pruefe('merkt, ob es ein git-Ordner ist', typeof istGitOrdner() === 'boolean')
  const n = await nachsehen()
  pruefe('Nachsehen liefert eine Antwort', typeof n.da === 'boolean' && typeof n.commits === 'number', JSON.stringify(n))
  const t0 = Date.now()
  await nachsehen()
  pruefe('zweites Nachsehen kommt aus dem Gedächtnis', Date.now() - t0 < 150, `${Date.now() - t0} ms`)
}

console.log('\n  SYSTEM')
const b = await bereit()
pruefe('Tipp-Weg geprüft', typeof b.ok === 'boolean', b.hinweis)

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
