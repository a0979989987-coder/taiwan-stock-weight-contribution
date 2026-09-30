import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const dailyReports = sqliteTable('daily_reports', {
  date: text('date').primaryKey(),
  previousDate: text('previous_date').notNull(),
  payload: text('payload').notNull(),
  createdAt: text('created_at').notNull(),
});
export const updateAttempts = sqliteTable('update_attempts', {
  date: text('date').primaryKey(),
  attemptedAt: text('attempted_at').notNull(),
  status: text('status').notNull(),
  message: text('message').notNull(),
  leaseUntil: integer('lease_until').notNull(),
});
