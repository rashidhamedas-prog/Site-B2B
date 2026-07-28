import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseEntity } from './entities/warehouse.entity';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseEntity)
    private readonly repo: Repository<WarehouseEntity>,
  ) {}

  async ensureDefault(): Promise<WarehouseEntity> {
    let def = await this.repo.findOne({ where: { isDefault: true } });
    if (def) return def;
    def = await this.repo.findOne({ where: { code: 'MAIN' } });
    if (def) {
      def.isDefault = true;
      return this.repo.save(def);
    }
    return this.repo.save(
      this.repo.create({
        code: 'MAIN',
        name: 'انبار اصلی',
        isActive: true,
        isDefault: true,
      }),
    );
  }

  async findAll() {
    await this.ensureDefault();
    return this.repo.find({ order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const wh = await this.repo.findOne({ where: { id } });
    if (!wh) throw new NotFoundException('انبار یافت نشد');
    return wh;
  }

  async create(data: { code: string; name: string; address?: string; isActive?: boolean; isDefault?: boolean }) {
    const code = String(data.code || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    if (!code || !name) throw new BadRequestException('کد و نام انبار الزامی است');
    const exists = await this.repo.findOne({ where: { code } });
    if (exists) throw new BadRequestException('کد انبار تکراری است');
    if (data.isDefault) {
      await this.repo.update({ isDefault: true }, { isDefault: false });
    }
    return this.repo.save(
      this.repo.create({
        code,
        name,
        address: data.address?.trim() || undefined,
        isActive: data.isActive !== false,
        isDefault: !!data.isDefault,
      }),
    );
  }

  async update(
    id: string,
    data: Partial<{ code: string; name: string; address: string; isActive: boolean; isDefault: boolean }>,
  ) {
    const wh = await this.findOne(id);
    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      if (!code) throw new BadRequestException('کد انبار نامعتبر است');
      const clash = await this.repo.findOne({ where: { code } });
      if (clash && clash.id !== id) throw new BadRequestException('کد انبار تکراری است');
      wh.code = code;
    }
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new BadRequestException('نام انبار الزامی است');
      wh.name = name;
    }
    if (data.address !== undefined) wh.address = data.address;
    if (data.isActive !== undefined) wh.isActive = data.isActive;
    if (data.isDefault === true) {
      await this.repo.update({ isDefault: true }, { isDefault: false });
      wh.isDefault = true;
    } else if (data.isDefault === false && wh.isDefault) {
      throw new BadRequestException('حداقل یک انبار باید پیش‌فرض باشد');
    }
    return this.repo.save(wh);
  }
}
