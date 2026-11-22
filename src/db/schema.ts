import { doublePrecision, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import type { Caption, Settings } from "@/lib/reel";

export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  youtubeId: text("youtube_id").notNull(),
  sourceTitle: text("source_title").notNull().default(""),
  channel: text("channel").notNull().default(""),
  startSec: doublePrecision("start_sec").notNull(),
  endSec: doublePrecision("end_sec").notNull(),
  settings: jsonb("settings").$type<Settings>().notNull(),
  captions: jsonb("captions").$type<Caption[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ReelRow = typeof reels.$inferSelect;
