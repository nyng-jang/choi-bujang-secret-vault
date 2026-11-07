// 10단계: 안전 정책 사본(스냅샷)과 확인용 해시, 사본끼리의 차이를 다룹니다.
// 안전 정책 = 1~9단계에서 만든 접근 규칙 세 가지입니다.
//   decider.mjs         : src/decider.mjs 의 판정 규칙 (파일 그대로)
//   allowed-routes.json : aleph.config.json 의 allowedRoutes
//   db-policy.json      : Supabase public 스키마의 RLS·정책·권한 (읽기 전용으로 내보낸 것)
// 이 모듈은 사본 폴더만 읽고 씁니다. 실제 운영 정책(src/, aleph.config.json, DB)은 바꾸지 않습니다.
// 메모 본문, 토큰, 키는 사본에 넣지 않습니다.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MANIFEST = 'manifest.json';
export const POLICY_FILES = Object.freeze(['decider.mjs', 'allowed-routes.json', 'db-policy.json']);

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// 줄바꿈을 LF로 맞춥니다. Windows(CRLF)에서 받은 같은 파일이 다른 해시가 되지 않게 합니다.
export function normalize(text) {
  return String(text).replace(/\r\n?/g, '\n');
}

// 파일 목록 전체를 대표하는 해시 하나. 파일 이름과 각 해시를 정해진 순서로 이어 붙여 계산합니다.
export function snapshotHash(files) {
  const lines = [...files].sort((a, b) => a.name.localeCompare(b.name)).map((f) => `${f.name} ${f.sha256}`);
  return sha256(lines.join('\n'));
}

// 사본 폴더 하나를 씁니다. contents = { 파일이름: 내용 }, meta = 목록표에 함께 적을 값.
export function writeSnapshot(dir, contents, meta) {
  mkdirSync(dir, { recursive: true });
  const files = POLICY_FILES.map((name) => {
    if (typeof contents[name] !== 'string') throw new Error(`사본에 넣을 ${name} 내용이 없습니다.`);
    const text = normalize(contents[name]);
    writeFileSync(join(dir, name), text);
    return { name, sha256: sha256(text), bytes: Buffer.byteLength(text) };
  });
  const manifest = { ...meta, files, snapshotSha256: snapshotHash(files) };
  writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

// 사본을 검증합니다. 폴더·목록표·파일이 없거나 해시가 하나라도 다르면 이유를 담아 멈춥니다(throw).
// expectedSnapshotSha256을 주면 목록표 자체가 바뀌었는지도 대조합니다.
export function verifySnapshot(dir, { label = '사본', expectedSnapshotSha256 } = {}) {
  if (!existsSync(dir)) throw new Error(`${label} 폴더가 없습니다: ${dir}`);
  const manifestPath = join(dir, MANIFEST);
  if (!existsSync(manifestPath)) throw new Error(`${label}의 목록표(${MANIFEST})가 없습니다.`);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error(`${label}의 목록표를 읽을 수 없습니다.`);
  }
  if (!Array.isArray(manifest.files)) throw new Error(`${label}의 목록표에 파일 목록이 없습니다.`);
  const names = manifest.files.map((f) => f.name).sort();
  if (names.join(',') !== [...POLICY_FILES].sort().join(',')) {
    throw new Error(`${label}의 목록표 파일이 안전 정책 세 가지와 다릅니다: ${names.join(', ')}`);
  }
  const texts = {};
  for (const file of manifest.files) {
    const path = join(dir, file.name);
    if (!existsSync(path)) throw new Error(`${label}에 ${file.name}이 없습니다.`);
    const text = normalize(readFileSync(path, 'utf8'));
    if (sha256(text) !== file.sha256) throw new Error(`${label}의 ${file.name} 해시가 목록표와 맞지 않습니다.`);
    texts[file.name] = text;
  }
  const total = snapshotHash(manifest.files);
  if (total !== manifest.snapshotSha256) throw new Error(`${label}의 전체 해시가 목록표와 맞지 않습니다.`);
  if (expectedSnapshotSha256 && total !== expectedSnapshotSha256) {
    throw new Error(`${label}의 전체 해시가 기대한 값과 다릅니다.`);
  }
  return { manifest, texts };
}

// 두 글을 줄 단위로 비교해 바뀐 줄만 돌려줍니다(최장 공통 부분열).
// 결과: [{ type: '-', line, text } | { type: '+', line, text }] — line은 각 사본에서의 줄 번호(1부터).
export function diffLines(beforeText, afterText) {
  const a = normalize(beforeText).split('\n');
  const b = normalize(afterText).split('\n');
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const changes = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i += 1; j += 1; }
    else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) { changes.push({ type: '-', line: i + 1, text: a[i] }); i += 1; }
    else { changes.push({ type: '+', line: j + 1, text: b[j] }); j += 1; }
  }
  return changes;
}

// 검증한 사본과 비교 대상 사본의 파일별 차이. 같은 파일은 빠집니다.
export function diffSnapshots(verifiedTexts, otherTexts) {
  return POLICY_FILES.map((name) => ({ name, changes: diffLines(verifiedTexts[name], otherTexts[name]) }))
    .filter((file) => file.changes.length > 0);
}

// 복원 계획: 검증한 사본과 다른 줄만 모읍니다. 같은 파일은 계획에 들어가지 않아 쓰지도 않습니다.
// code는 「두 사본의 전체 해시 + 바뀔 줄」로 만든 8글자 확인 코드입니다. 미리 본 뒤 사본이 또 바뀌면 코드가 달라집니다.
export function restorePlan(verified, target) {
  const files = diffSnapshots(verified.texts, target.texts);
  const code = sha256(JSON.stringify({
    from: verified.manifest.snapshotSha256, to: target.manifest.snapshotSha256, files,
  })).slice(0, 8);
  return { files, code, untouched: POLICY_FILES.filter((name) => !files.some((f) => f.name === name)) };
}

// 바뀐 줄만 되돌린 글: 비교 대상에만 있는 줄(+)은 빼고, 검증한 사본에만 있던 줄(-)은 제자리에 다시 넣습니다.
// 바뀌지 않은 줄은 비교 대상의 줄을 그대로 씁니다.
export function revertLines(verifiedText, targetText) {
  const a = normalize(verifiedText).split('\n');
  const b = normalize(targetText).split('\n');
  const changes = diffLines(verifiedText, targetText);
  const removed = new Set(changes.filter((c) => c.type === '+').map((c) => c.line));
  const restored = new Map();
  for (const c of changes.filter((x) => x.type === '-')) restored.set(c.line, c.text);
  const out = [];
  let i = 0; // 검증한 사본 줄 위치
  for (let j = 0; j <= b.length; j += 1) {
    while (restored.has(i + 1)) { out.push(restored.get(i + 1)); i += 1; }
    if (j === b.length) break;
    if (removed.has(j + 1)) continue;
    out.push(b[j]); i += 1;
  }
  const text = out.join('\n');
  if (text !== a.join('\n')) throw new Error('바뀐 줄만 되돌린 결과가 검증한 사본과 다릅니다.');
  return text;
}
