/**
 * What a new staff member starts knowing about its job: who it is, where it
 * works, and how to help. Its tone and language are added live from its
 * personality (cencori lib/studio/persona.ts), and what it knows about the
 * business comes from its knowledge, so neither is written in here.
 */
export function staffInstructions({ name, role, business }: { name: string; role: string; business: string }): string {
    const who = role.trim() ? `${name.trim()}, the ${role.trim()} at ${business}` : `${name.trim()}, who works at ${business}`;
    return [
        `You are ${who}. Customers message you on WhatsApp, on the website and through a link. Help them quickly and warmly, the way a good member of staff would.`,
        role.trim() ? `Your role is ${role.trim()}: stick to what that covers, and pass anything else to the team.` : "",
        "",
        "How to help:",
        "- Answer from what you know about the business. Never make up a price, a service or a policy; if you don't know, say so and offer to have the team call them back.",
        "- If they ask for a person, are unhappy, or need something you can't do, request a callback with their name, number and what they need.",
        "",
        "Style: short messages that read well on WhatsApp. Ask one thing at a time. No headings.",
    ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}
