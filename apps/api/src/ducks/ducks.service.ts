import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Color, Duck, Size } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDuckDto } from './dto/create-duck.dto';
import { UpdateDuckDto } from './dto/update-duck.dto';

/** Result of an add or edit. `merged` tells the UI the change landed on another record. */
export interface DuckWriteResult {
  duck: Duck;
  merged: boolean;
}

function notFound(id: number): NotFoundException {
  return new NotFoundException(`Duck ${id} not found`);
}

@Injectable()
export class DucksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-deleted ducks, most stock first, id as tiebreak so the order is stable. */
  findAll(): Promise<Duck[]> {
    return this.prisma.duck.findMany({
      where: { deleted: false },
      orderBy: [{ quantity: 'desc' }, { id: 'asc' }],
    });
  }

  /**
   * Merge-on-add: a non-deleted duck with the same color, size and price absorbs the
   * quantity. Deleted ducks never match. Two concurrent adds of a brand new combination
   * can both miss and create twins; that race is accepted (see CLAUDE.md), and the next
   * edit of either twin merges them.
   */
  create(dto: CreateDuckDto): Promise<DuckWriteResult> {
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.duck.findFirst({
        where: { color: dto.color, size: dto.size, price: dto.price, deleted: false },
        orderBy: { id: 'asc' },
      });
      if (match) {
        const duck = await tx.duck.update({
          where: { id: match.id },
          data: { quantity: { increment: dto.quantity } },
        });
        return { duck, merged: true };
      }

      const duck = await tx.duck.create({
        data: { color: dto.color, size: dto.size, price: dto.price, quantity: dto.quantity },
      });
      return { duck, merged: false };
    });
  }

  /**
   * Edits price and/or quantity. If the edit makes duck A identical (color, size, price)
   * to another non-deleted duck B, A's edited quantity is added to B and A is
   * soft-deleted with its pre-edit values, so history shows what A was before the merge.
   */
  update(id: number, dto: UpdateDuckDto): Promise<DuckWriteResult> {
    return this.prisma.$transaction(async (tx) => {
      // Lock A's row first. A concurrent decrementStock then waits on the lock and
      // re-evaluates its WHERE once we commit, so it either applies to fresh data or
      // returns 409 if A was merged away. Without the lock, a decrement landing between
      // our read and write would be overwritten and the ordered units would reappear.
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM ducks WHERE id = ${id} AND deleted = false FOR UPDATE`;
      if (locked.length === 0) throw notFound(id);
      // Read after locking, so the quantity is current.
      const current = await tx.duck.findUniqueOrThrow({ where: { id } });

      const price = dto.price ?? current.price;
      const quantity = dto.quantity ?? current.quantity;

      const twin = await tx.duck.findFirst({
        where: {
          id: { not: id },
          color: current.color,
          size: current.size,
          price,
          deleted: false,
        },
        orderBy: { id: 'asc' },
      });
      if (twin) {
        await tx.duck.update({ where: { id }, data: { deleted: true } });
        const duck = await tx.duck.update({
          where: { id: twin.id },
          data: { quantity: { increment: quantity } },
        });
        return { duck, merged: true };
      }

      // Only the fields in the DTO; Prisma skips undefined ones.
      const duck = await tx.duck.update({
        where: { id },
        data: { price: dto.price, quantity: dto.quantity },
      });
      return { duck, merged: false };
    });
  }

  /** Soft delete. A duck that is missing or already deleted is a 404. */
  async remove(id: number): Promise<void> {
    const { count } = await this.prisma.duck.updateMany({
      where: { id, deleted: false },
      data: { deleted: true },
    });
    if (count === 0) throw notFound(id);
  }

  /**
   * The duck an order for this color and size draws from: the lowest price among
   * non-deleted ducks with enough stock, id as tiebreak.
   * 404 if no non-deleted duck has this color and size, 409 if none has enough stock.
   */
  async findCheapestMatch(color: Color, size: Size, quantity: number): Promise<Duck> {
    // A color + size only has a handful of price variants, so picking in memory is cheap
    // and lets one query answer both the 404 and the 409 case.
    const candidates = await this.prisma.duck.findMany({
      where: { color, size, deleted: false },
    });
    if (candidates.length === 0) {
      throw new NotFoundException(`No ${color} ${size} ducks found`);
    }

    const [cheapest] = candidates
      .filter((duck) => duck.quantity >= quantity)
      .sort((a, b) => a.price - b.price || a.id - b.id);
    if (!cheapest) {
      throw new ConflictException(`Not enough ${color} ${size} ducks in stock for ${quantity}`);
    }
    return cheapest;
  }

  /**
   * Atomically takes `quantity` units from a duck. The conditional update only succeeds
   * if the duck is still non-deleted with enough stock, so concurrent orders can't
   * oversell. Zero rows updated means another order (or a delete) got there first: 409.
   * The caller must not retry with a different duck, since its price was already chosen.
   */
  async decrementStock(id: number, quantity: number): Promise<void> {
    const { count } = await this.prisma.duck.updateMany({
      where: { id, deleted: false, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (count === 0) {
      throw new ConflictException(`Duck ${id} no longer has ${quantity} in stock`);
    }
  }
}
