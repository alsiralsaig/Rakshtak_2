import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";

// ===== جدول السائقين (منفصل عن الركاب — دخول عبر OTP) =====
export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 50 }).default(""),
  bankAccount: varchar("bank_account", { length: 50 }),
  vehicleType: varchar("vehicle_type", { length: 30 }),
  isOnline: boolean("is_online").notNull().default(true),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  avgRating: doublePrecision("avg_rating").default(0),
  totalRatings: integer("total_ratings").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== رموز التحقق (OTP) لدخول السائقين =====
export const driverOtps = pgTable("driver_otps", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumed: boolean("consumed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===== جدول الرحلات =====
export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),

  // بيانات الراكب (بدون تسجيل حساب — نص حر)
  passengerName: varchar("passenger_name", { length: 50 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),

  serviceType: varchar("service_type", { length: 30 }).notNull(),
  pickupLocation: text("pickup_location").notNull(),
  destination: text("destination").notNull(),
  pickupLat: doublePrecision("pickup_lat"),
  pickupLng: doublePrecision("pickup_lng"),

  offeredPrice: integer("offered_price"),

  // pending | accepted | completed | cancelled
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  // رمز الراكب السري لمتابعة/إلغاء/رفع سعر رحلته فقط (بدون تسجيل دخول)
  riderToken: varchar("rider_token", { length: 64 }),

  driverId: integer("driver_id").references(() => drivers.id),
  driverPhone: varchar("driver_phone", { length: 20 }),

  driverRating: integer("driver_rating"),
  riderRating: integer("rider_rating"),
  ratingComment: text("rating_comment"),

  createdAt: timestamp("created_at").defaultNow(),
});

// ===== جدول التقييمات =====
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id),
  fromDriverId: integer("from_driver_id").references(() => drivers.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});
