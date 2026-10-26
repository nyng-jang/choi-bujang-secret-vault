import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');

// 3단계부터 화면이 Supabase Auth로 로그인합니다. 브라우저에 주는 값은
// 프로젝트 주소와 공개용(publishable) 키뿐이며, 서버 전용 키는 절대 넣지 않습니다.
function loginConfig(env, config) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  let origin;
  try { origin = new URL(url).origin; } catch { origin = null; }
  if (!origin || origin !== url.replace(/\/$/u, '')
      || origin !== new URL(config.identityProvider?.issuer ?? 'https://invalid.invalid').origin) {
    throw new Error('SUPABASE_URL이 aleph.config.json의 identityProvider.issuer와 같은 프로젝트인지 확인하세요.');
  }
  if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{10,}$/u.test(key)) {
    throw new Error('Vercel 환경변수 SUPABASE_PUBLISHABLE_KEY에 sb_publishable_로 시작하는 공개용 키를 넣으세요.');
  }
  return { supabaseUrl: origin, publishableKey: key };
}
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (!Number.isInteger(config.step) || config.step < 1 || config.step > 12) {
  throw new Error('aleph.config.json의 step을 확인하세요.');
}
await mkdir(resolve(root, 'public'), { recursive: true });
// 2단계부터 메모는 Supabase에 있고 화면은 /api/notes로 읽습니다.
// 예전 빌드가 남긴 공개 data.json이 배포에 섞이지 않게 지웁니다.
await rm(resolve(root, 'public', 'data.json'), { force: true });
if (config.step >= 3) {
  // 로그인 화면이 쓰는 Supabase 브라우저 라이브러리는 package-lock.json에 고정된 판을
  // 그대로 복사해 같은 주소에서 내보냅니다(외부 CDN에 기대지 않음).
  await mkdir(resolve(root, 'public', 'vendor'), { recursive: true });
  await copyFile(resolve(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'),
    resolve(root, 'public', 'vendor', 'supabase.js'));
}
console.log('공개 data.json은 만들지 않습니다. 메모는 /api/notes 서버 함수가 읽습니다.');
if (!process.argv.includes('--local')) {
  if (config.step >= 3) {
    await writeFile(resolve(root, 'public', 'login-config.json'),
      `${JSON.stringify(loginConfig(process.env, config), null, 2)}\n`, 'utf8');
    console.log('브라우저 로그인용 공개 설정을 public/login-config.json에 기록했습니다.');
  }
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
