import { DatabaseKind } from "@eve-insights/adapter-types";
import { z } from "zod";

export const mysqlEnvSchema = z.compile(
  z.object({
    EVE_INSIGHTS_DATABASE: z.literal(DatabaseKind.MYSQL),
    MYSQL_HOST: z.string().trim().min(1),
    MYSQL_USER: z.string().trim().min(1),
    MYSQL_PASSWORD: z.string().min(1),
    MYSQL_DATABASE: z.string().trim().min(1),
    MYSQL_PORT: z.string().trim().min(1).optional(),
  }),
);

export type MysqlEnv = z.output<typeof mysqlEnvSchema>;
