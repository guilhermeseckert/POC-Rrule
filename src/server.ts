import {
  addDays,
  endOfDay,
  isPast,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import express from "express";
import { RRule } from "rrule";
import { prismaClient } from "./database/prismaClient";
import { rrule } from "./rrule";
const app = express();
app.use(express.json());

app.post("/create", async (req, res) => {
  // first we will create the routine (shoould be done in a transaction, is just a POC)

  const routine = await prismaClient.routine.create({
    // just fake data for the POC
    // have to type better the  byweekday, and frequency. i just dint do it because sqllite  and not worth for the moment.

    data: {
      title: "Routine title test",
      routineFrequency: {
        create: {
          frequency: "WEEKLY",
          interval: 1,
          startDate: new Date(Date.UTC(2022, 9, 20, 18, 44, 0)),
          byweekday: "MO",
        },
      },
    },
    include: {
      routineFrequency: true,
    },
  });

  // then after create lest decide and generate the recurrences it happens, like 7 days ahead if we have any
  const recurrence = rrule({
    starDate: routine.routineFrequency.startDate,
    byweekday: [RRule.MO, RRule.TU, RRule.WE], // we should have in the database with the correct type. i cant because sqllite does not allowed.
    freq: RRule.WEEKLY, // same here
    interval: routine.routineFrequency.interval,
  });

  // then we will create the recurrences/ can be improved
  recurrence.forEach(async (recurrence) => {
    await prismaClient.routineRecurrence.create({
      data: {
        startDateTime: recurrence,
        status: "upcoming",
        routineId: routine.id,
      },
    });
  });

  // with that we can assume the first time we create a routine i will be always 7 days ahead
  //also we can improve it a bit i had more idea but want to do it quick
  // the cron will always run every day and generate the next 1 for example.
  //last recurrence startDateTime + 1 day so we going always to have 7 days ahead.
  // now probably we are saying ok how i gonna fetch this shit? if i want to see 30 days ahead? hold your horses dude.... kkkk
  return res.json(routine);
});

app.get("/", async (req, res) => {
  const {
    query: { date },
  } = req;

  // so right now we have a routine with 7 days ahead
  // we need to fetch then in good scenarios we will have 7 days ahead we always going to have in de database so easy enough
  // simple if check is between today and  7 days ahead? fetch de database called the day.
  // why im generating 7 days ahead? user most often will see 7 days ahead, not a month or year. anyway we can changed is just number.

  const queryDate = new Date(date.toString());

  const testDate = new Date(
    queryDate.getFullYear(),
    queryDate.getMonth() + 1,
    queryDate.getDate()
  );

  console.log("query date", testDate);

  const isBetweenTodayAndSevenDaysAhead = isWithinInterval(testDate, {
    start: startOfDay(new Date()),
    end: endOfDay(addDays(new Date(), 7)),
  });

  console.log("start", startOfDay(new Date())),
    console.log("end", endOfDay(addDays(new Date(), 7)));

  //   // For the date within the interval:
  // isWithinInterval(new Date(2014, 0, 3), {
  //   start: new Date(2014, 0, 1),
  //   end: new Date(2014, 0, 7)
  // })
  // //=> true

  console.log(
    "isBetweenTodayAndSevenDaysAhead",
    isBetweenTodayAndSevenDaysAhead
  );

  // best case scenario done.
  if (isPast(testDate) || isBetweenTodayAndSevenDaysAhead) {
    console.log("fetching from database");
    const response = await prismaClient.routine.findMany({
      where: {
        routineRecurrence: {
          some: {
            startDateTime: {
              gte: startOfDay(testDate),
              lte: endOfDay(testDate),
            },
          },
        },
      },
      select: {
        title: true,
        isDeleted: true,
        updatedAt: true,
        createdAt: true,
        id: true,
        routineRecurrence: {
          where: {
            startDateTime: {
              gte: startOfDay(testDate),
              lte: endOfDay(testDate),
            },
          },
        },
      },
    });

    return res.json(response);
  }

  // now we have to deal with the worst case scenario, where is not between today and 7 days ahead and is
  //  not past is the feature and we don't have it generated yet.
  if (!isBetweenTodayAndSevenDaysAhead) {
    // first thing we have to fetch the user routine with? where the start day is greater than today
    console.log("fetching from rrule");
    const routines = await prismaClient.routine.findMany({
      where: {
        routineFrequency: {
          startDate: {
            gte: startOfDay(queryDate),
          },
        },
      },
      include: {
        routineRecurrence: true,
        routineFrequency: true,
      },
    });

    // right now we have to see if the routine occurs in the day we are looking for
    // if if a routine occurs in the day we are looking for we have to return it to the user
    const routinesThatOccursInDay = routines.map((routine) => {
      const rule = new RRule({
        freq: RRule.WEEKLY,
        dtstart: routine.routineFrequency.startDate,
        count: 10,
        interval: 1,
        byweekday: [RRule.MO, RRule.TU, RRule.WE],
      });

      const date = new Date(
        queryDate.getFullYear(),
        queryDate.getMonth() + 1,
        queryDate.getDate()
      );

      const recurrence = rule.between(startOfDay(date), endOfDay(date), true);

      if (recurrence.length > 0) {
        return {
          ...routine,
          routineRecurrence: {
            startOfDay: recurrence[0],
            status: "upcoming",
          },
        };
      }
    });

    return res.json(routinesThatOccursInDay);
  }
});

app.listen(3333, () => {
  console.log("Server is running on port 3333  🚀 ");
});
