import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seed, type DatabaseShape } from './seed.js';

type CollectionName = keyof DatabaseShape;
type RecordWithId = { id: string };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class JsonDatabase {
  constructor(private readonly filePath: string, private readonly initialData: DatabaseShape) {}

  async init() {
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.write(clone(this.initialData));
    }
  }

  async read(): Promise<DatabaseShape> {
    await this.init();
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw) as DatabaseShape;
  }

  async write(data: DatabaseShape) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async list<T extends RecordWithId>(collection: CollectionName): Promise<T[]> {
    const data = await this.read();
    return clone((data[collection] as unknown) as T[]);
  }

  async create<T extends RecordWithId>(collection: CollectionName, item: T): Promise<T> {
    const data = await this.read();
    const items = (data[collection] as unknown) as T[];
    items.unshift(item);
    await this.write(data);
    return clone(item);
  }

  async update<T extends RecordWithId>(collection: CollectionName, id: string, patch: Record<string, unknown>): Promise<T> {
    const data = await this.read();
    const items = (data[collection] as unknown) as T[];
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      throw Object.assign(new Error('Record not found'), { status: 404 });
    }
    items[index] = { ...items[index], ...patch } as T;
    await this.write(data);
    return clone(items[index]);
  }

  async delete(collection: CollectionName, id: string): Promise<void> {
    const data = await this.read();
    const items = data[collection] as RecordWithId[];
    const nextItems = items.filter((item) => item.id !== id);
    if (nextItems.length === items.length) {
      throw Object.assign(new Error('Record not found'), { status: 404 });
    }
    (data as unknown as Record<string, RecordWithId[]>)[collection] = nextItems;
    await this.write(data);
  }
}

export function createDefaultDatabase() {
  const filePath = process.env.DB_FILE || path.resolve(process.cwd(), 'data', 'app-db.json');
  return new JsonDatabase(filePath, seed);
}

export function createTestDatabase() {
  const filePath = path.join(os.tmpdir(), 'upi-flowpilot-' + randomUUID() + '.json');
  return new JsonDatabase(filePath, seed);
}



