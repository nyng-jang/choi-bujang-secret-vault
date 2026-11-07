// 10단계: 검증한 사본과 다른 사본(기본은 시험용 사본)의 차이만 보여 줍니다. 아무것도 되돌리지 않습니다.
// 먼저 「복원할 버전」과 「변경 범위」를 보여 주고, 그다음 바뀐 줄을 보여 줍니다.
// 사본이 없거나 해시가 맞지 않으면 차이를 보여 주지 않고 멈춥니다.
//
// 실행: npm run policy:diff [-- --verified <폴더>] [--target <폴더>] [--expect <검증한 사본 전체 해시>]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICY_FILES, diffSnapshots, verifySnapshot } from '../src/policy-snapshot.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
}

export function comparePolicy({ verifiedDir, targetDir, expect }) {
  const verified = verifySnapshot(verifiedDir, { label: '검증한 사본', expectedSnapshotSha256: expect });
  if (verified.manifest.kind !== 'verified') throw new Error('기준으로 쓴 폴더가 검증한 사본이 아닙니다.');
  const target = verifySnapshot(targetDir, { label: '비교 대상 사본' });
  return { verified, target, files: diffSnapshots(verified.texts, target.texts) };
}

function main() {
  const verifiedDir = resolve(root, option('--verified', 'policy-backups/verified'));
  const targetDir = resolve(root, option('--target', 'policy-backups/test-copy'));
  let result;
  try {
    result = comparePolicy({ verifiedDir, targetDir, expect: option('--expect') });
  } catch (error) {
    console.error(`중단: ${error.message}`);
    console.error('차이를 보여 주지 않았고, 아무것도 되돌리지 않았습니다.');
    process.exit(1);
  }
  const { verified, target, files } = result;
  const v = verified.manifest;
  console.log('안전 정책 차이 보기 (읽기만, 되돌리지 않음)');
  console.log(`복원할 버전: 검증한 사본 ${verifiedDir.replace(`${root}/`, '').replace(`${root}\\`, '')}`);
  console.log(`  커밋 ${String(v.commit).slice(0, 7)}, 단계 ${v.step}, 만든 시각 ${v.createdAt}`);
  console.log(`  전체 해시 ${v.snapshotSha256} (해시 확인 통과)`);
  console.log(`비교 대상: ${target.manifest.kind === 'test' ? '시험용 사본' : '사본'} ${targetDir.replace(`${root}/`, '').replace(`${root}\\`, '')} (해시 확인 통과)`);
  const changedNames = files.map((f) => f.name);
  const same = POLICY_FILES.filter((name) => !changedNames.includes(name));
  console.log(`변경 범위: 파일 ${files.length}개${files.length ? ` — ${files.map((f) => {
    const minus = f.changes.filter((c) => c.type === '-').length;
    const plus = f.changes.filter((c) => c.type === '+').length;
    return `${f.name} (빠진 줄 ${minus}, 들어온 줄 ${plus})`;
  }).join(', ')}` : ''}`);
  console.log(`  바뀌지 않은 파일: ${same.length ? same.join(', ') : '없음'}`);
  if (!files.length) { console.log('차이가 없습니다.'); return; }
  console.log('--- 바뀐 줄 (- 검증한 사본, + 비교 대상) ---');
  for (const file of files) {
    console.log(file.name);
    for (const c of file.changes) console.log(`  ${c.type} ${c.line}: ${c.text}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
