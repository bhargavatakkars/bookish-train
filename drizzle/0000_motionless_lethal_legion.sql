CREATE TYPE "public"."source_type" AS ENUM('import', 'derived', 'external', 'manual');--> statement-breakpoint
CREATE TYPE "public"."statement_frequency" AS ENUM('annual', 'quarterly');--> statement-breakpoint
CREATE TABLE "balance_sheet_items" (
	"company_id" uuid NOT NULL,
	"statement_date" text NOT NULL,
	"metric_key" text NOT NULL,
	"metric_label" text NOT NULL,
	"value" text,
	"source_type" "source_type" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_sheet_items_company_id_statement_date_metric_key_pk" PRIMARY KEY("company_id","statement_date","metric_key")
);
--> statement-breakpoint
CREATE TABLE "cash_flow_items" (
	"company_id" uuid NOT NULL,
	"statement_date" text NOT NULL,
	"metric_key" text NOT NULL,
	"metric_label" text NOT NULL,
	"value" text,
	"source_type" "source_type" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_flow_items_company_id_statement_date_metric_key_pk" PRIMARY KEY("company_id","statement_date","metric_key")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"exchange" text,
	"face_value" text,
	"shares" text,
	"shares_adj_cr" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_annual_prices" (
	"import_id" uuid NOT NULL,
	"year" text NOT NULL,
	"price" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_annual_prices_import_id_year_pk" PRIMARY KEY("import_id","year")
);
--> statement-breakpoint
CREATE TABLE "import_raw_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"workbook_meta" jsonb NOT NULL,
	"data_sheet_matrix" jsonb NOT NULL,
	"parsed_sections" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parser_version" text NOT NULL,
	"import_checksum" text NOT NULL,
	"original_file_name" text,
	"current_price" text,
	"market_cap" text
);
--> statement-breakpoint
CREATE TABLE "parser_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profit_loss_items" (
	"company_id" uuid NOT NULL,
	"statement_date" text NOT NULL,
	"frequency" "statement_frequency" NOT NULL,
	"metric_key" text NOT NULL,
	"metric_label" text NOT NULL,
	"value" text,
	"source_type" "source_type" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"imported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profit_loss_items_company_id_statement_date_frequency_metric_key_pk" PRIMARY KEY("company_id","statement_date","frequency","metric_key")
);
--> statement-breakpoint
ALTER TABLE "balance_sheet_items" ADD CONSTRAINT "balance_sheet_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_flow_items" ADD CONSTRAINT "cash_flow_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_annual_prices" ADD CONSTRAINT "import_annual_prices_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_raw_payloads" ADD CONSTRAINT "import_raw_payloads_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parser_logs" ADD CONSTRAINT "parser_logs_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profit_loss_items" ADD CONSTRAINT "profit_loss_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;