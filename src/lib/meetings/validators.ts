import { z } from "zod";
import { isLocalDateTime, isValidTimeZone } from "./time";
import { MAX_COUNT, MAX_INTERVAL, validateRule, type RecurrenceRule } from "./recurrence";

export const MAX_ATTENDEES = 200;

const weekday = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address");

export const recurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(MAX_INTERVAL),
  byWeekday: z.array(weekday).max(7),
  monthlyMode: z.enum(["DAY_OF_MONTH", "NTH_WEEKDAY"]).nullable().optional(),
  endType: z.enum(["NEVER", "ON_DATE", "AFTER_COUNT"]),
  untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  count: z.number().int().min(1).max(MAX_COUNT).nullable().optional(),
});

export const attendeeSchema = z.object({
  userId: z.string().cuid().nullable().optional(),
  email,
  displayName: z.string().trim().max(120).nullable().optional(),
  optional: z.boolean().default(false),
});

export const meetingInputSchema = z
  .object({
    title: z.string().trim().min(1, "Give the meeting a title").max(200),
    description: z.string().trim().max(4000).nullable().optional(),
    kind: z.enum(["ONE_TIME", "RECURRING"]),
    startLocal: z.string().refine(isLocalDateTime, "Pick a valid date and time"),
    timezone: z.string().refine(isValidTimeZone, "Pick a valid time zone"),
    durationMin: z.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours"),
    recurrence: recurrenceSchema.nullable().optional(),
    attendees: z.array(attendeeSchema).max(MAX_ATTENDEES, `At most ${MAX_ATTENDEES} attendees`),
    addMeet: z.boolean().default(true),
    sendInvites: z.boolean().default(true),
    guestsCanModify: z.boolean().default(false),
    guestsCanInvite: z.boolean().default(false),
    guestsCanSeeOthers: z.boolean().default(true),
    /** null = calendar default reminders. */
    reminderMinutes: z.number().int().min(0).max(40320).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.attendees.forEach((a, i) => {
      if (seen.has(a.email)) ctx.addIssue({ code: "custom", message: `Duplicate attendee: ${a.email}`, path: ["attendees", i] });
      seen.add(a.email);
    });
    if (v.kind === "RECURRING") {
      if (!v.recurrence) {
        ctx.addIssue({ code: "custom", message: "Set how often this meeting repeats", path: ["recurrence"] });
      } else {
        for (const msg of validateRule(v.recurrence as RecurrenceRule, v.startLocal)) {
          ctx.addIssue({ code: "custom", message: msg, path: ["recurrence"] });
        }
      }
    }
  });

export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const occurrenceSchema = z.object({
  meetingId: z.string().cuid(),
  /** The occurrence being changed, "YYYY-MM-DDTHH:mm" in the meeting's zone. */
  originalStartLocal: z.string().refine(isLocalDateTime),
});

export const rescheduleOccurrenceSchema = occurrenceSchema.extend({
  newStartLocal: z.string().refine(isLocalDateTime, "Pick a valid date and time"),
  newDurationMin: z.number().int().min(5).max(1440),
});
