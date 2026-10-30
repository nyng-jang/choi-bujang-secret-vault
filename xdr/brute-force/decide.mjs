// 무차별 로그인 경보 하나를 받아 block·alert·record 중 하나로 답합니다.
// 심판은 이 파일 하나만 인터넷 없이 불러오므로 import·파일 읽기·바깥 요청을 두지 않습니다.
// 아래 PATTERNS 는 xdr/brute-force/patterns.json 의 patterns 를 그대로 옮겨 적은 것입니다.
const PATTERNS = [
  {
    name: 'same-source-failure-burst',
    technique: 'T1110.001',
    condition: {
      mitreIncludes: 'T1110',
      strongMinFailures: 30,
      weakBelowFailures: 10,
      successWords: ['성공했'],
    },
    evidence: 'MITRE ATT&CK T1110.001 Password Guessing: 한 주소가 짧은 시간에 비밀번호를 계속 넣어 보며 로그인 실패가 쌓입니다. https://attack.mitre.org/techniques/T1110/001/',
  },
  {
    name: 'same-password-many-accounts',
    technique: 'T1110.003',
    condition: {
      mitreIncludes: 'T1110',
      strongMinAccounts: 5,
      descriptionAny: ['같은 비밀번호', '여러 계정', '계정 이름을 바꿔'],
      accountCountWords: ['계정 (\\d+)개'],
    },
    evidence: 'MITRE ATT&CK T1110.003 Password Spraying: 한 주소가 여러 계정에 같은 비밀번호를 넣어 잠금을 피하며 실패가 계정마다 흩어집니다. https://attack.mitre.org/techniques/T1110/003/',
  },
];

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;

function failuresOf(alert) {
  const n = Number(alert?.data?.count);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function accountsOf(alert, words) {
  const listed = String(alert?.data?.accounts ?? '').split(',').filter(Boolean).length;
  const description = String(alert?.rule?.description ?? '');
  let written = 0;
  for (const word of words) {
    const found = description.match(new RegExp(word));
    if (found) written = Math.max(written, Number(found[1]) || 0);
  }
  return Math.max(listed, written);
}

// 패턴과 얼마나 뚜렷하게 맞는지 0~1 로 셉니다. 기법 표시(T1110)가 맞으면 절반(0.5),
// 나머지 절반은 실패 수·계정 수가 강한 신호 기준에 얼마나 가까운지로 채웁니다.
function matchOf(pattern, alert) {
  const c = pattern.condition;
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  if (!mitre.some((id) => String(id).startsWith(c.mitreIncludes))) return 0;
  const description = String(alert?.rule?.description ?? '');
  let strength = 0;
  if (c.strongMinFailures) {
    const succeeded = (c.successWords ?? []).some((word) => description.includes(word));
    if (!succeeded) strength = Math.min(1, failuresOf(alert) / c.strongMinFailures);
  }
  if (c.strongMinAccounts) {
    strength = Math.min(1, accountsOf(alert, c.accountCountWords ?? []) / c.strongMinAccounts);
    if ((c.descriptionAny ?? []).some((word) => description.includes(word))) strength = 1;
  }
  return 0.5 + 0.5 * strength;
}

export function decide(alert) {
  let best = { name: 'no-pattern', score: 0 };
  for (const pattern of PATTERNS) {
    const score = matchOf(pattern, alert);
    if (score > best.score) best = { name: pattern.name, score };
  }
  const confidence = Math.round(best.score * 100) / 100;
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: best.name };
}
