import { router } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useWorkspace } from "@/lib/workspace";
import { BusinessOnboarding } from "@/components/business-onboarding";

/** Another business, from Profile: the same onboarding, then its first staff member. */
export default function NewBusiness() {
    const { choose } = useWorkspace();
    return (
        <BusinessOnboarding
            onClose={() => goBack()}
            onCreated={async (organizationId) => {
                await choose(organizationId);
                router.dismissAll();
                router.push("/setup");
            }}
        />
    );
}
