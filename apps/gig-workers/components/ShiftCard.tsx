import { Pressable, Text, View } from "react-native";

import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";

import type { ConflictInfo, WorkerShift } from "../lib/api";
import { Icon } from "./ui/icon";

interface ShiftCardProps {
    shift: WorkerShift;
    conflict?: ConflictInfo;
    orgColor?: string;
    onPress?: () => void;
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

const isInProgress = (shift: WorkerShift): boolean =>
    !!shift.timesheet.clockIn &&
    !shift.timesheet.clockOut &&
    new Date(shift.endTime) > new Date();

const isCancelled = (shift: WorkerShift): boolean => shift.status === "cancelled";

function renderStatusChip(shift: WorkerShift) {
    if (isInProgress(shift)) {
        return (
            <Chip size="sm" variant="soft" color="success">
                <Chip.Label>Live</Chip.Label>
            </Chip>
        );
    }

    if (isCancelled(shift)) {
        return (
            <Chip size="sm" variant="soft" color="danger">
                <Chip.Label>Cancelled</Chip.Label>
            </Chip>
        );
    }

    if (shift.assignmentStatus === "open") {
        return (
            <Chip size="sm" variant="soft" color="warning">
                <Chip.Label>Open</Chip.Label>
            </Chip>
        );
    }

    if (new Date(shift.endTime) <= new Date()) {
        return (
            <Chip size="sm" variant="soft" color="default">
                <Chip.Label>Completed</Chip.Label>
            </Chip>
        );
    }

    return (
        <Chip size="sm" variant="soft" color="success">
            <Chip.Label>Confirmed</Chip.Label>
        </Chip>
    );
}

export function ShiftCard({ shift, conflict, orgColor, onPress }: ShiftCardProps) {
    const venueLabel = shift.location.name || shift.organization.name;
    const addressLabel = shift.location.address || shift.organization.name;
    const needsAttention =
        shift.timesheetFlags.missingClockIn ||
        shift.timesheetFlags.missingClockOut ||
        shift.timesheetFlags.needsReview;

    const body = (
        <Card className="rounded-[28px]">
            <Card.Body className="gap-4 p-5">
                <View className="flex-row items-start justify-between gap-3">
                    <Text className="flex-1 text-lg font-semibold text-foreground">{shift.title}</Text>
                    {renderStatusChip(shift)}
                </View>

                <View className="gap-1">
                    <Text className="text-base font-medium text-foreground">
                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </Text>
                    <Text className="text-sm font-medium text-secondary">{venueLabel}</Text>
                    <Text className="text-sm text-muted">{addressLabel}</Text>
                </View>

                <View className="flex-row flex-wrap items-center gap-2">
                    {orgColor ? (
                        <View
                            className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
                            style={{ backgroundColor: `${orgColor}18` }}
                        >
                            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: orgColor }} />
                            <Text className="text-xs font-medium text-foreground">{shift.organization.name}</Text>
                        </View>
                    ) : null}

                    {needsAttention ? (
                        <Chip size="sm" variant="soft" color="warning">
                            <Chip.Label>Needs review</Chip.Label>
                        </Chip>
                    ) : null}
                </View>

                {conflict ? (
                    <View className="flex-row items-center gap-2 rounded-[18px] bg-danger-soft px-3 py-2">
                        <Icon name="alert-circle-outline" size={14} className="text-danger" />
                        <Text className="flex-1 text-xs leading-5 text-danger">
                            Overlaps with another shift at {conflict.overlapsWithOrg}
                        </Text>
                    </View>
                ) : null}
            </Card.Body>
        </Card>
    );

    if (!onPress) {
        return body;
    }

    return <Pressable onPress={onPress}>{body}</Pressable>;
}
