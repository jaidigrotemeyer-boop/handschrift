#!/usr/bin/env node
// Den ganzen Aktualisierungs-Weg durchspielen: eigenes Repo bauen, eine neuere
// Fassung hineinlegen, den Server sie holen und sich selbst neu starten lassen.
//
//   node pruefe-update.mjs
//
// Das lässt sich nicht mit Attrappen prüfen. Entweder der Server ersetzt sich
// wirklich, oder er tut es nicht.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const pexec = promisify(execFile)
const warte = (ms) => new Promise((f) => setTimeout(f, ms))
const PORT = Number(process.env.PORT) || 3097
let gut = 0
let schlecht = 0
const ok = (was, b, info = '') => {
  b ? gut++ : schlecht++
  console.log(`   ${b ? '✓' : '✗'} ${was}${info ? '  ' + info : ''}`)
}
const hole = async (weg, daten) => {
  const a = await fetch(`http://localhost:${PORT}${weg}`, daten ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) } : {})
  return a.json()
}

const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'handschrift-update-'))
const bank = path.join(basis, 'bank')
const klon = path.join(basis, 'klon')
const arbeit = path.join(basis, 'arbeit')
let server = null

console.log('\n  Handschrift Update-Test\n')
try {
  await pexec('git', ['clone', '--quiet', '--bare', process.cwd(), bank])
  await pexec('git', ['clone', '--quiet', bank, klon])
  await pexec('git', ['clone', '--quiet', bank, arbeit])

  // Eine neuere Fassung ins ferne Repo legen.
  const pfad = path.join(arbeit, 'package.json')
  fs.writeFileSync(pfad, fs.readFileSync(pfad, 'utf8').replace(/"version": "[^"]*"/, '"version": "99.0.0"'))
  await pexec('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', 'commit', '-qam', 'neuere Fassung'], { cwd: arbeit })
  await pexec('git', ['push', '--quiet', 'origin', 'HEAD:main'], { cwd: arbeit })

  server = spawn(process.execPath, ['server/index.js'], { cwd: klon, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' })
  await warte(2500)

  const vorher = await hole('/api/stand')
  ok('läuft mit der alten Fassung', vorher.stand.fassung !== '99.0.0', vorher.stand.fassung)
  ok('sieht die neuere Fassung', vorher.neu.da === true, `${vorher.neu.commits} Änderung(en)`)

  const geholt = await hole('/api/aktualisieren', {})
  ok('holt sie', geholt.geaendert === true, `${geholt.vorher} → ${geholt.nachher}`)
  ok('kündigt den Neustart an', geholt.neustart === true)

  let nachher = null
  for (let i = 0; i < 40 && !nachher; i++) {
    await warte(500)
    nachher = await hole('/api/stand').catch(() => null)
  }
  ok('antwortet nach dem Neustart wieder', !!nachher)
  ok('und zwar mit der neuen Fassung', nachher?.stand.fassung === '99.0.0', nachher?.stand.fassung)
  ok('meldet nichts Neues mehr', nachher?.neu.da === false)

  // Der Neustart oben musste denselben Port zurückerobern — sonst hätte die
  // Abfrage ihn gar nicht wiedergefunden. Ein zweiter, von Hand gestarteter
  // Server muss sich dagegen einen freien suchen, statt aufzugeben: sonst
  // steht im Browser nur "Verbindung abgelehnt", ohne einen Grund dafür.
  // Aus dem Arbeitsordner gestartet, nicht aus dem Klon: der Klon kennt nur,
  // was schon eingecheckt ist, und geprüft werden soll der Stand von jetzt.
  const zweiter = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  })
  let ausweich = null
  for (let i = 0; i < 20 && !ausweich; i++) {
    await warte(400)
    ausweich = await fetch(`http://localhost:${PORT + 1}/api/stand`)
      .then((a) => (a.ok ? a.json() : null))
      .catch(() => null)
  }
  ok('ein zweiter Server weicht auf den nächsten Port aus', !!ausweich, `${PORT} belegt → ${PORT + 1}`)
  zweiter.kill()
  await warte(400)
  ok('der erste läuft dabei weiter', !!(await hole('/api/stand').catch(() => null)), `Port ${PORT}`)

  // Eigene Änderungen dürfen nicht überfahren werden.
  const p2 = path.join(arbeit, 'package.json')
  fs.writeFileSync(p2, fs.readFileSync(p2, 'utf8').replace(/"version": "[^"]*"/, '"version": "99.1.0"'))
  await pexec('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', 'commit', '-qam', 'noch eine'], { cwd: arbeit })
  await pexec('git', ['push', '--quiet', 'origin', 'HEAD:main'], { cwd: arbeit })
  const p3 = path.join(klon, 'package.json')
  fs.writeFileSync(p3, fs.readFileSync(p3, 'utf8').replace(/"version": "[^"]*"/, '"version": "0.0.0-meins"'))
  const abgelehnt = await hole('/api/aktualisieren', {})
  ok('überfährt eigene Änderungen nicht', /von Hand geändert/.test(abgelehnt.fehler || ''), abgelehnt.fehler?.slice(0, 50))
} finally {
  try {
    await fetch(`http://localhost:${PORT}/api/stopp`, { method: 'POST', body: '{}' }).catch(() => {})
  } catch {}
  server?.kill()
  await pexec('pkill', ['-f', `${klon}/server/index.js`]).catch(() => {})
  fs.rmSync(basis, { recursive: true, force: true })
}

console.log(`\n  ${gut} von ${gut + schlecht} in Ordnung${schlecht ? ` · ${schlecht} kaputt` : ''}\n`)
process.exit(schlecht ? 1 : 0)
