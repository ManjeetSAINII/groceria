import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { parseProduct } from '../route';
type Ctx = { params: Promise<{ id: string }> };
async function getId(ctx: Ctx) { const id = Number((await ctx.params).id); return Number.isSafeInteger(id) && id > 0 ? id : null; }
export async function PUT(req: Request, ctx: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await getId(ctx); if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const body = await req.json().catch(() => null);
  const data = body && typeof body === 'object' ? parseProduct(body) : null;
  if (!data) return NextResponse.json({ error: 'Invalid product data' }, { status: 400 });
  const result = await prisma.product.updateMany({ where: { id }, data });
  if (!result.count) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await getId(ctx); if (!id) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const result = await prisma.product.deleteMany({ where: { id } });
  if (!result.count) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
