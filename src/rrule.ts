import { Routine, RoutineFrequency } from "@prisma/client";
import { startOfDay, addDays, endOfDay } from "date-fns";
import { ByWeekday, Frequency, RRule, WeekdayStr } from "rrule";

type rruleProps = {
  starDate: Date;
  frequency?: string;
  interval?: number;
  byweekday?: ByWeekday | ByWeekday[];
  count?: number;
  freq?: Frequency;
};

// generate one week a heed of the start date just to already have it created
const daysAhead = 7;

export const rrule = ({
  freq,
  count,
  starDate,
  interval,
  byweekday,
}: rruleProps) => {
  const rule = new RRule({
    freq,
    dtstart: starDate,
    count,
    interval,
    byweekday,
  });

  return rule.between(
    startOfDay(starDate),
    endOfDay(addDays(starDate, daysAhead)),
    true
  );
};
