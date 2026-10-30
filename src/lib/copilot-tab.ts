import { Platform } from "react-native";

/**
 * Whether Copilot gets its own tab. Phones' tab bars hold five tabs (Android
 * refuses a sixth; older iOS folds the rest into "More"), but iOS 26.1 shows
 * a "search" tab in its own circle beside them: Copilot's place, as on the web.
 * Elsewhere Copilot is a button on Home.
 */
export const COPILOT_TAB = Platform.OS === "ios" && Number.parseFloat(String(Platform.Version)) >= 26.1;
