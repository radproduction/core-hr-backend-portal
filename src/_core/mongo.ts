import mongoose from "mongoose";
import { ENV } from "./env";

let hasConnected = false;

export async function connectMongo() {
  if (hasConnected || !ENV.mongoUrl) {
    return;
  }

  await mongoose.connect(ENV.mongoUrl);
  hasConnected = true;
  console.log("[MongoDB] Connected");
}
