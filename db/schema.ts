import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const attempts = pgTable(
  "attempts",
  {
    id: serial().primaryKey(),
    mid: text().notNull(),
    name: text().notNull(),
    phone: text().notNull(),
    part: text().notNull(),
    score: integer().notNull(),
    total: integer().notNull(),
    pct: integer().notNull(),
    wrong: text().notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attempts_created_at_idx").on(t.createdAt)],
);
