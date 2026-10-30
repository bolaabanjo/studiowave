import { CopilotChat } from "@/components/copilot-chat";

/** Copilot's tab: its own circle beside the tabs on iOS 26, as the web's button is. */
export default function CopilotTab() {
    return <CopilotChat inTab />;
}
