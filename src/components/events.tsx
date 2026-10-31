import { Pressable, View } from "react-native";
import { useBusinessTimeZone } from "@/lib/time-zone";
import { Image } from "expo-image";
import { router } from "expo-router";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useEvents } from "@/lib/queries";
import { eventWhen } from "@/lib/format";
import type { StudioEventSummary } from "@/lib/types";
import { EmptyCard, LoadError, Skeleton, T } from "@/ui/kit";

const past = (summary: StudioEventSummary) => Date.parse(summary.event.ends_at ?? summary.event.starts_at) < Date.now() - 6 * 3_600_000;

/** Sales → Events: every event, the next ones first (cencori components/studio/views/EventsView.tsx). */
export function EventsList() {
    const events = useEvents();
    if (events.isLoading) return <View style={{ marginTop: 16, gap: 12 }}>{[0, 1].map((index) => <Skeleton key={index} height={80} radius={16} />)}</View>;
    if (!events.data) return <LoadError error={events.error} fallback="Couldn't load your events." onRetry={() => void events.refetch()} />;
    const list = [...events.data.events].sort((a, b) => Number(past(a)) - Number(past(b)) || (past(a) ? Date.parse(b.event.starts_at) - Date.parse(a.event.starts_at) : Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at)));
    if (!list.length) return <EmptyCard icon="calendar" title="No events yet" description="Sell tickets for a party, a show or a dinner. Guests pay, get a QR ticket, and you check them in at the door." />;
    return (
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {list.map((summary) => <EventPoster key={summary.event.id} summary={summary} />)}
        </View>
    );
}

/**
 * An event as a poster: the flyer is the card, cropped square from the top
 * (where a flyer's headline is), with the name and date under it. Dark in
 * both themes, like the flyers. Without a flyer, the name set large on a dark
 * gradient stands in.
 */
function EventPoster({ summary }: { summary: StudioEventSummary }) {
    const timeZone = useBusinessTimeZone();
    const { event } = summary;
    return (
        <Pressable onPress={() => router.push(`/event/${event.id}`)} style={({ pressed }) => ({ width: "48%", flexGrow: 1, maxWidth: "50%", overflow: "hidden", borderRadius: 16, backgroundColor: "#262626", opacity: past(summary) ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ aspectRatio: 1, width: "100%", overflow: "hidden", backgroundColor: "#1a1a1a" }}>
                {event.banner_url ? (
                    <Image source={{ uri: event.banner_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition="top" />
                ) : (
                    <View style={{ flex: 1, justifyContent: "flex-end", padding: 12 }}>
                        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
                            <Defs>
                                <LinearGradient id="base" x1="0.2" y1="0" x2="0.8" y2="1">
                                    <Stop offset="0" stopColor="#2b1d4a" />
                                    <Stop offset="0.7" stopColor="#121212" />
                                </LinearGradient>
                                <RadialGradient id="glow" cx="75%" cy="20%" r="45%">
                                    <Stop offset="0" stopColor="#4b2a7a" stopOpacity={1} />
                                    <Stop offset="1" stopColor="#4b2a7a" stopOpacity={0} />
                                </RadialGradient>
                            </Defs>
                            <Rect width="100%" height="100%" fill="url(#base)" />
                            <Rect width="100%" height="100%" fill="url(#glow)" />
                        </Svg>
                        <T size={20} weight="600" leading={19} lines={4} upper color="#ffffff" style={{ letterSpacing: -0.5 }}>{event.name}</T>
                    </View>
                )}
            </View>
            <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 10 }}>
                <T size={14} leading={17} lines={1} color="#ffffff">{event.name}</T>
                <T size={12} lines={1} color="rgba(255,255,255,0.55)" style={{ marginTop: 2 }}>{eventWhen(event.starts_at, timeZone)}</T>
            </View>
        </Pressable>
    );
}
