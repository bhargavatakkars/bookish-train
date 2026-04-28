import {
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "import",
  "derived",
  "external",
  "manual",
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name"),
  exchange: text("exchange"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const imports = pgTable("imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  parserVersion: text("parser_version").notNull(),
  importChecksum: text("import_checksum").notNull(),
  originalFileName: text("original_file_name"),
});

export const importRawPayloads = pgTable("import_raw_payloads", {
  importId: uuid("import_id")
    .notNull()
    .references(() => imports.id, { onDelete: "cascade" }),
  workbookMeta: jsonb("workbook_meta").notNull(),
  dataSheetMatrix: jsonb("data_sheet_matrix").notNull(),
  parsedSections: jsonb("parsed_sections").notNull(),
  warnings: jsonb("warnings").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const statementFrequencyEnum = pgEnum("statement_frequency", [
  "annual",
  "quarterly",
]);

export const profitLossItems = pgTable(
  "profit_loss_items",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    statementDate: text("statement_date").notNull(),
    frequency: statementFrequencyEnum("frequency").notNull(),
    metricKey: text("metric_key").notNull(),
    metricLabel: text("metric_label").notNull(),
    value: text("value"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.companyId, t.statementDate, t.frequency, t.metricKey],
    }),
  }),
);

export const balanceSheetItems = pgTable(
  "balance_sheet_items",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    statementDate: text("statement_date").notNull(),
    metricKey: text("metric_key").notNull(),
    metricLabel: text("metric_label").notNull(),
    value: text("value"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.statementDate, t.metricKey] }),
  }),
);

export const cashFlowItems = pgTable(
  "cash_flow_items",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    statementDate: text("statement_date").notNull(),
    metricKey: text("metric_key").notNull(),
    metricLabel: text("metric_label").notNull(),
    value: text("value"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.statementDate, t.metricKey] }),
  }),
);

export const parserLogs = pgTable("parser_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  importId: uuid("import_id")
    .notNull()
    .references(() => imports.id, { onDelete: "cascade" }),
  level: text("level").notNull(),
  message: text("message").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

