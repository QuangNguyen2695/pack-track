import { registerPlugin } from "@capacitor/core";
import type { CameraBarcodePlugin } from "./definitions";

export const CameraBarcode =
  registerPlugin<CameraBarcodePlugin>("CameraBarcode"); // 👈 tên này
export * from "./definitions";
