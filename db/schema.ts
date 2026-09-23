import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const inquiries = sqliteTable("inquiries", {
 id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
 business: text("business").notNull().default(""), service: text("service").notNull(),
 message: text("message").notNull(), language: text("language").notNull(), createdAt: integer("created_at").notNull(),
}, table => [index("idx_inquiries_email_created").on(table.email, table.createdAt)]);
