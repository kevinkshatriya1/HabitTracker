import { integer, real, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  weekdayWake: text("weekday_wake").notNull().default("07:00"),
  weekendWake: text("weekend_wake").notNull().default("09:00"),
  weekdayBed: text("weekday_bed").notNull().default("23:00"),
  weekendBed: text("weekend_bed").notNull().default(""),
  reminderTime: text("reminder_time").notNull().default("20:00"),
  reminders: integer("reminders").notNull().default(0),
  avatarKey: text("avatar_key"),
  avatarType: text("avatar_type"),
});

export const circles = sqliteTable("circles", {
  id: text("id").primaryKey(), name: text("name").notNull(), inviteCode: text("invite_code").notNull().unique(),
  ownerId: text("owner_id").notNull(), color: text("color").notNull().default("#5B5FC7"), createdAt: integer("created_at").notNull(),
});
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }), circleId: text("circle_id").notNull(), personId: text("person_id").notNull(), joinedAt: integer("joined_at").notNull(),
}, t => [uniqueIndex("members_circle_person").on(t.circleId,t.personId),index("members_person").on(t.personId)]);
export const checkins = sqliteTable("checkins", {
  id:text("id").primaryKey(),personId:text("person_id").notNull(),date:text("date").notNull(),kind:text("kind").notNull(),slot:integer("slot").notNull().default(0),
  value:text("value"),loggedTime:text("logged_time"),details:text("details"),status:text("status").notNull().default("completed"),photoKey:text("photo_key"),photoType:text("photo_type"),
  createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),
}, t=>[uniqueIndex("checkins_person_date_kind_slot").on(t.personId,t.date,t.kind,t.slot),index("checkins_person_date").on(t.personId,t.date)]);
export const pushSubscriptions=sqliteTable("push_subscriptions",{id:text("id").primaryKey(),personId:text("person_id").notNull(),endpoint:text("endpoint").notNull().unique(),p256dh:text("p256dh").notNull(),auth:text("auth").notNull(),createdAt:integer("created_at").notNull()},t=>[index("push_subscriptions_person").on(t.personId)]);
export const groupGoals=sqliteTable("group_goals",{id:text("id").primaryKey(),circleId:text("circle_id").notNull(),kind:text("kind").notNull(),slot:integer("slot").notNull().default(0),title:text("title").notNull(),cadence:text("cadence").notNull(),target:text("target"),preferredMinutes:integer("preferred_minutes").notNull().default(720),weeklyDay:integer("weekly_day").notNull().default(0),sortRank:integer("sort_rank"),active:integer("active").notNull().default(1),createdAt:integer("created_at").notNull()},t=>[uniqueIndex("group_goals_circle_kind_slot").on(t.circleId,t.kind,t.slot),index("group_goals_circle").on(t.circleId)]);
export const goalChoices=sqliteTable("goal_choices",{id:integer("id").primaryKey({autoIncrement:true}),goalId:text("goal_id").notNull(),personId:text("person_id").notNull(),enabled:integer("enabled").notNull().default(1)},t=>[uniqueIndex("goal_choices_goal_person").on(t.goalId,t.personId),index("goal_choices_person").on(t.personId)]);
export const friendships=sqliteTable("friendships",{id:text("id").primaryKey(),requesterId:text("requester_id").notNull(),recipientId:text("recipient_id").notNull(),status:text("status").notNull().default("pending"),createdAt:integer("created_at").notNull()},t=>[uniqueIndex("friendships_pair").on(t.requesterId,t.recipientId),index("friendships_recipient").on(t.recipientId)]);
export const habitVisibility=sqliteTable("habit_visibility",{id:integer("id").primaryKey({autoIncrement:true}),personId:text("person_id").notNull(),kind:text("kind").notNull(),slot:integer("slot").notNull().default(0),visibility:text("visibility").notNull().default("group")},t=>[uniqueIndex("habit_visibility_person_kind_slot").on(t.personId,t.kind,t.slot)]);
export const feedLikes=sqliteTable("feed_likes",{id:integer("id").primaryKey({autoIncrement:true}),checkinId:text("checkin_id").notNull(),personId:text("person_id").notNull(),createdAt:integer("created_at").notNull()},t=>[uniqueIndex("feed_likes_checkin_person").on(t.checkinId,t.personId)]);
export const feedComments=sqliteTable("feed_comments",{id:text("id").primaryKey(),checkinId:text("checkin_id").notNull(),personId:text("person_id").notNull(),body:text("body").notNull(),createdAt:integer("created_at").notNull()},t=>[index("feed_comments_checkin").on(t.checkinId)]);
export const personalGoals=sqliteTable("personal_goals",{id:text("id").primaryKey(),personId:text("person_id").notNull(),kind:text("kind").notNull(),slot:integer("slot").notNull().default(0),title:text("title").notNull(),cadence:text("cadence").notNull(),preferredMinutes:integer("preferred_minutes").notNull().default(720),weeklyDay:integer("weekly_day").notNull().default(0),iconKey:text("icon_key"),active:integer("active").notNull().default(1),createdAt:integer("created_at").notNull()},t=>[index("personal_goals_person").on(t.personId)]);
export const personalGoalEdits=sqliteTable("personal_goal_edits",{goalId:text("goal_id").notNull(),personId:text("person_id").notNull(),title:text("title").notNull(),cadence:text("cadence").notNull(),weeklyDay:integer("weekly_day"),preferredMinutes:integer("preferred_minutes"),iconKey:text("icon_key")},t=>[uniqueIndex("personal_goal_edits_pair").on(t.goalId,t.personId)]);
export const friendNotificationPreferences=sqliteTable("friend_notification_preferences",{personId:text("person_id").notNull(),friendId:text("friend_id").notNull(),enabled:integer("enabled").notNull().default(1)},t=>[uniqueIndex("friend_notification_preferences_pair").on(t.personId,t.friendId)]);
export const goalOrder=sqliteTable("goal_order",{id:integer("id").primaryKey({autoIncrement:true}),personId:text("person_id").notNull(),kind:text("kind").notNull(),slot:integer("slot").notNull().default(0),rank:real("rank").notNull()},t=>[uniqueIndex("goal_order_person_kind_slot").on(t.personId,t.kind,t.slot)]);
