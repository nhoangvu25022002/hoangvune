CREATE TABLE "attempts" (
	"id" serial PRIMARY KEY,
	"mid" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"part" text NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"pct" integer NOT NULL,
	"wrong" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attempts_created_at_idx" ON "attempts" ("created_at");