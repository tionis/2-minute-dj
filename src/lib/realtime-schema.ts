import { defineTypes, Schema } from "@colyseus/schema";

export class GameRoomState extends Schema {
  snapshot = "";
  revision = 0;
}

defineTypes(GameRoomState, { snapshot: "string", revision: "number" });
