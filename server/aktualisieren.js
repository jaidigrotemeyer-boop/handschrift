// Selbst aktuell bleiben.
//
// Die häufigste Ursache für "geht immer noch nicht" war nie ein Fehler im
// Code, sondern ein alter Stand: eine Fassung lief, eine neuere lag bereit,
// und niemand konnte es sehen. Darum schaut Handschrift von selbst nach und
// kann sich auf Knopfdruck holen, was da ist.
//
// Geholt wird nur auf Anforderung. Ungefragt Code nachladen und ausführen wäre
// bequem und falsch — es ist der Rechner des Nutzers.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const pexec = promisify(execFile)
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (...args) => pexec('git', args, { cwd: WURZEL })

export const istGitOrdner = () => fs.existsSync(path.join(WURZEL, '.git'))

// Nicht bei jedem Abruf ins Netz: die Oberfläche fragt den Stand alle paar
// hundert Millisekunden ab, ein git fetch dauert dagegen Sekunden.
let merker = { bis: 0, wert: { da: false, commits: 0 } }

/**
 * Liegt eine neuere Fassung bereit? Fragt höchstens alle zehn Minuten wirklich
 * nach; dazwischen kommt die gemerkte Antwort.
 */
export async function nachsehen({ jetzt = false } = {}) {
  if (!istGitOrdner()) return { da: false, commits: 0, grund: 'kein git-Ordner' }
  if (!jetzt && Date.now() < merker.bis) return merker.wert
  try {
    await git('fetch', '--quiet', 'origin')
    const { stdout } = await git('rev-list', '--count', 'HEAD..@{u}')
    const commits = Number(stdout.trim()) || 0
    const wert = { da: commits > 0, commits }
    merker = { bis: Date.now() + 10 * 60 * 1000, wert }
    return wert
  } catch (err) {
    const wert = { da: false, commits: 0, grund: err.message.split('\n')[0] }
    // Kein Netz? In zwei Minuten wieder probieren, nicht in zehn.
    merker = { bis: Date.now() + 2 * 60 * 1000, wert }
    return wert
  }
}

/**
 * Den neuen Stand holen. Eigene Änderungen am Quelltext werden nicht
 * überfahren — dann bricht git ab, und die Meldung sagt warum.
 */
export async function holen() {
  if (!istGitOrdner()) throw new Error('Kein git-Ordner — hier lässt sich nichts nachladen.')
  const vorher = (await git('rev-parse', '--short', 'HEAD')).stdout.trim()
  try {
    await git('pull', '--ff-only', '--quiet')
  } catch (err) {
    const text = String(err.stderr || err.message)
    if (/local changes|would be overwritten|nicht-fast-vorspulbar|not possible to fast-forward/i.test(text))
      throw new Error(
        'Der Quelltext wurde hier von Hand geändert — Handschrift überschreibt das nicht. ' +
          'Entweder die Änderungen sichern (git stash) oder verwerfen (git reset --hard origin/main).',
      )
    throw new Error(text.split('\n')[0])
  }
  const nachher = (await git('rev-parse', '--short', 'HEAD')).stdout.trim()
  merker = { bis: 0, wert: { da: false, commits: 0 } }
  return { vorher, nachher, geaendert: vorher !== nachher }
}
