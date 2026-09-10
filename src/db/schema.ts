import { pgTable, serial, varchar, text, timestamp, integer, doublePrecision } from "drizzle-orm/pg-core";

// ===== جدول المستخدمين =====
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("rider"),
  bankAccount: varchar("bank_account", { length: 50 }),
  avgRating: doublePrecision("avg_rating").default(0),
  totalRatings: integer("total_ratings").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== جدول الرحلات =====
export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  serviceType: varchar("service_type", { length: 20 }).notNull(),
  pickupLocation: text("pickup_location").notNull(),
  destination: text("destination").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("searching"),
  customerPhone: varchar("customer_phone", { length: 20 }),
  customerName: varchar("customer_name", { length: 50 }),
  driverId: varchar("driver_id", { length: 20 }),
  driverLat: doublePrecision("driver_lat"),
  driverLng: doublePrecision("driver_lng"),
  driverRating: integer("driver_rating"),
  riderRating: integer("rider_rating"),
  ratingComment: text("rating_comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== جدول التقييمات =====
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});
