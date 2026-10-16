import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const clubContent = sqliteTable('club_content', {
  id: text('id').primaryKey(),
  body: text('body').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
  updatedBy: text('updated_by').notNull(),
});

export const contentHistory = sqliteTable('content_history', {
  id: text('id').primaryKey(),
  body: text('body').notNull(),
  revision: integer('revision').notNull(),
  savedAt: text('saved_at').notNull(),
  savedBy: text('saved_by').notNull(),
});
