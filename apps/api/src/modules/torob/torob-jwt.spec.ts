import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { verifyTorobJwt } from './torob-jwt';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA');
  const pem = await exportSPKI(publicKey);
  process.env.APP_ENV = 'test';
  process.env.TOROB_JWT_PUBLIC_KEY = pem;
  process.env.TOROB_API_AUDIENCE = 'www.poshaktaranom.ir';

  const now = Math.floor(Date.now() / 1000);

  async function token(claims: Record<string, unknown>) {
    return new SignJWT(claims).setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', v: 1 }).sign(privateKey);
  }

  const valid = await token({ aud: 'www.poshaktaranom.ir', exp: now + 120, nbf: now - 10 });
  await verifyTorobJwt({ token: valid, version: '1' });

  let missing = false;
  try {
    await verifyTorobJwt({ token: '', version: '1' });
  } catch {
    missing = true;
  }
  assert(missing, 'missing token');

  let version = false;
  try {
    await verifyTorobJwt({ token: valid, version: '2' });
  } catch {
    version = true;
  }
  assert(version, 'bad version');

  let expired = false;
  try {
    await verifyTorobJwt({
      token: await token({ aud: 'www.poshaktaranom.ir', exp: now - 30, nbf: now - 60 }),
      version: '1',
    });
  } catch {
    expired = true;
  }
  assert(expired, 'expired');

  let nbf = false;
  try {
    await verifyTorobJwt({
      token: await token({ aud: 'www.poshaktaranom.ir', exp: now + 120, nbf: now + 60 }),
      version: '1',
    });
  } catch {
    nbf = true;
  }
  assert(nbf, 'future nbf');

  let aud = false;
  try {
    await verifyTorobJwt({
      token: await token({ aud: 'api.poshaktaranom.com', exp: now + 120, nbf: now - 10 }),
      version: '1',
    });
  } catch {
    aud = true;
  }
  assert(aud, 'wrong audience');

  let hs256 = false;
  try {
    const badAlg = await new SignJWT({
      aud: 'www.poshaktaranom.ir',
      exp: now + 120,
      nbf: now - 10,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(new TextEncoder().encode('not-torob'));
    await verifyTorobJwt({ token: badAlg, version: '1' });
  } catch {
    hs256 = true;
  }
  assert(hs256, 'reject HS256');

  let noneAlg = false;
  try {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ aud: 'www.poshaktaranom.ir', exp: now + 120, nbf: now - 10 }),
    ).toString('base64url');
    await verifyTorobJwt({ token: `${header}.${payload}.`, version: '1' });
  } catch {
    noneAlg = true;
  }
  assert(noneAlg, 'reject none');

  console.log('torob-jwt.spec ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
