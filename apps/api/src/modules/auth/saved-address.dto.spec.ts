/**
 * npx ts-node --transpile-only src/modules/auth/saved-address.dto.spec.ts
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SavedAddressDto } from './dto/otp.dto';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const dto = plainToInstance(SavedAddressDto, {
    recipient: 'علی رضایی',
    mobile: '09151234567',
    province: 'خراسان رضوی',
    city: 'مشهد',
    street: 'خیابان احمدآباد',
    plaque: '۱۲',
    alley: '۲۰',
    unit: '۳',
    isDefault: true,
  });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert(errors.length === 0, `plaque/alley/unit must be allowed: ${JSON.stringify(errors)}`);
  console.log('saved-address.dto.spec.ts: ok');
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
