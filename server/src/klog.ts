import { spawn } from 'child_process'
import { Guard } from 'runtypes'

type A = {
  valid: true;
  message: undefined;
}

type B = {
  valid: false;
  message: string;
}

type KlogVersionState = A | B

async function getKlogVersion(klogExecutable: string): Promise<string | undefined> {
  const child = spawn(`"${klogExecutable}" version --no-check`, { shell: true })
  child.stdin.end()
  const version = await new Promise<string>((resolve) => {
    const B = Guard(Buffer.isBuffer.bind(Buffer))
    let data = ''
    child.stdout.on('data', buffer => data += B.check(buffer).toString())
    child.stdout.on('end', () => resolve(data.trim()))
  })

  const parseVersionString = (s: string): string | undefined => {
    const a = s.match(/v(\d+\.\d+)/)?.[1] ?? undefined;

    return a
  }

  return parseVersionString(version)
}

function getKlogVersionState(version: string | undefined, os: 'windows' | 'posix'): KlogVersionState {

  if (version === undefined) {
    return { valid: false, message: 'Could not parse klog version.\n\nInvalid binary?' }
  }

  switch (os) {
    case 'windows':
      if (compareVersions(version, '2.3') === less) {
        return { valid: false, message: 'Requires at least version 2.3 (Windows)' }
      }

      if (compareVersions(version, '3.0') === equal) {
        return { valid: false, message: 'Not compatible with klog v3.0 (Windows)' }
      }

      break
    case 'posix':
      if (compareVersions(version, '1.6') === less) {
        return { valid: false, message: 'Requires at least version 1.6 (Linux / macOS)' }
      }

      break
  }

  return { valid: true, message: undefined }
}

const less = -1
const equal = 0
const greater = 1

/// very basic comparison of numerical versions, separated with dots (ie. '1.3', '2.4.2'). returns
function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const aa = a.split('.').map(x => Number(x))
  const bb = b.split('.').map(x => Number(x))
  const maxLength = Math.max(aa.length, bb.length)

  const aal = aa.length
  const bbl = bb.length

  aa.length = maxLength
  bb.length = maxLength

  aa.fill(0, aal)
  bb.fill(0, bbl)

  for (let i = 0; i < maxLength; ++i) {
    const aaa = aa[i]
    const bbb = bb[i]

    if (aaa < bbb) {
      return -1
    }

    if (aaa > bbb) {
      return 1
    }
  }

  return 0
}

export { getKlogVersion, getKlogVersionState }
