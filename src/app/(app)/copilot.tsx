import { Redirect, useLocalSearchParams } from "expo-router";

/** The old Copilot sheet's address: talking to your employee is the AI tab now, so links here go there (with ?ask=…). */
export default function CopilotRedirect() {
    const { ask } = useLocalSearchParams<{ ask?: string }>();
    return <Redirect href={{ pathname: "/assistant", params: ask ? { ask } : {} }} />;
}
