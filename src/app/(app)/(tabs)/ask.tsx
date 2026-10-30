import { CopilotChat } from "@/components/copilot-chat";

/**
 * Copilot's tab: its own circle beside the tabs on iOS 26.1, as the web's button is.
 * Named "ask", not "copilot": /copilot is the Copilot sheet every other button opens.
 */
export default function CopilotTab() {
    return <CopilotChat inTab />;
}
