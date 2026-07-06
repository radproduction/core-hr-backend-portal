/**
 * mongoStore.ts — thin MongoDB helpers for the feature data layers that were
 * migrated off Drizzle/MySQL. Loose (strict:false) collections keyed by an
 * auto-incremented numeric `id`, sharing the same Counter/connection as
 * src/mongoDb.ts.
 */
import mongoose, { Schema } from "mongoose";
import { ensureMongoReady, nextId, toPlain } from "../mongoDb";

export { ensureMongoReady, nextId, toPlain };

const schemaOptions: mongoose.SchemaOptions = {
  versionKey: false,
  strict: false,
  timestamps: true,
};

/** Get (or lazily define) a loose Mongoose model for a collection. */
export function store(modelName: string): mongoose.Model<any> {
  return (
    mongoose.models[modelName] ||
    mongoose.model(modelName, new Schema({ id: { type: Number, index: true } }, schemaOptions))
  );
}

/** Insert one doc with an auto-incremented numeric id. Returns { id }. */
export async function insertDoc(
  modelName: string,
  counterKey: string,
  data: Record<string, unknown>
): Promise<{ id: number }> {
  await ensureMongoReady();
  const id = await nextId(counterKey);
  await store(modelName).create({ id, ...data });
  return { id };
}

export async function insertMany(
  modelName: string,
  counterKey: string,
  rows: Record<string, unknown>[]
): Promise<number[]> {
  await ensureMongoReady();
  const ids: number[] = [];
  for (const row of rows) {
    const id = await nextId(counterKey);
    ids.push(id);
    await store(modelName).create({ id, ...row });
  }
  return ids;
}

export async function updateDoc(
  modelName: string,
  filter: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<void> {
  await ensureMongoReady();
  await store(modelName).updateOne(filter, { $set: data });
}

export async function findMany(
  modelName: string,
  filter: Record<string, unknown> = {},
  sort?: Record<string, 1 | -1>,
  limit?: number
): Promise<any[]> {
  await ensureMongoReady();
  let q = store(modelName).find(filter);
  if (sort) q = q.sort(sort);
  if (limit) q = q.limit(limit);
  return q.lean();
}

export async function findOneDoc(
  modelName: string,
  filter: Record<string, unknown>
): Promise<any | undefined> {
  await ensureMongoReady();
  return (await store(modelName).findOne(filter).lean()) ?? undefined;
}

export async function countDocs(
  modelName: string,
  filter: Record<string, unknown> = {}
): Promise<number> {
  await ensureMongoReady();
  return store(modelName).countDocuments(filter);
}

export async function deleteOneDoc(
  modelName: string,
  filter: Record<string, unknown>
): Promise<void> {
  await ensureMongoReady();
  await store(modelName).deleteOne(filter);
}

export async function deleteManyDocs(
  modelName: string,
  filter: Record<string, unknown>
): Promise<void> {
  await ensureMongoReady();
  await store(modelName).deleteMany(filter);
}
