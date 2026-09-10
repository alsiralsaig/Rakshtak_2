import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * اتصال كسول (Lazy) بقاعدة بيانات Neon:
 * لا يُنشأ الاتصال عند استيراد الملف، بل فقط عند أول استعلام فعلي.
 * هذا يضمن أن مسارات /api تبقى قادرة على الرد بـ 403/503 (الحماية أولاً)
 * حتى لو كانت DATABASE_URL غير مضبوطة على الخادم.
 */
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL غير مضبوط — قاعدة بيانات Neon غير متصلة.");
  }
  return drizzle(neon(connectionString), { schema });
}

let cachedDb: ReturnType<typeof createDb> | null = null;

function getDb(): ReturnType<typeof createDb> {
  if (!cachedDb) cachedDb = createDb();
  return cachedDb;
}

/**
 * db تُستخدم كما كانت (db.select()...)، لكن أول لمسة حقيقية لها
 * تمر عبر getDb() — أي أن الاستيراد وحده لا يكسر الطلب أبداً.
 */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
