"use client";

import { init } from "@instantdb/react";
import schema from "@/instant.schema";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;

export const db = init({ appId: APP_ID, schema });

export type MySchema = typeof schema;

export default db;
