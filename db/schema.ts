import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  weekdayWake: text("weekday_wake").notNull().default("07:00"),
  weekendWake: text("weekend_wake").notNull().default("09:00"),
  weekdayBed: text("weekday_bed").notNull().default("23:00"),
  reminderTime: text("reminder_time").notNull().default("20:00"),
  reminders: integer("reminders").notNull().default(0),
});

export const circles = sqliteTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  circleId: text("circle_id").notNull(),
  personId: text("person_id").notNull(),
  joinedAt: integer("joined_at").notNull(),
}, t => [uniqueIndex("members_circle_person").on(t.circleId, t.personId), index("members_person").on(t.personId)]);

export const checkins = sqliteTable("checkins", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  date: text("date").notNull(),
  kind: text("kind").notNull(),
  slot: integer("slot").notNull().default(0),
  value: text("value"),
  photoKey: text("photo_key"),
  photoType: text("photo_type"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [uniqueIndex("checkins_person_date_kind_slot").on(t.personId,t.date,t.kind,t.slot), index("checkins_person_date").on(t.personId,t.date)]);
