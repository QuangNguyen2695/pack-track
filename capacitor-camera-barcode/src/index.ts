import { registerPlugin } from "@capacitor/core";
import type { CameraBarcodePlugin } from "./definitions";

export const CameraBarcode = registerPlugin<CameraBarcodePlugin>("CameraBarcode");
export * from "./definitions";
