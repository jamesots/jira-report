import { add, format, startOfWeek } from 'date-fns';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.ENDPOINT + '/rest/api/3';
const username = process.env.USERNAME;
const apiKey = process.env.API_KEY;
const projectId = process.env.PROJECT_ID;
const hoursPerDay = Number(process.env.HOURS_PER_DAY);
const daysPerWeek = Number(process.env.DAYS_PER_WEEK);
const sprintOverhead = Number(process.env.SPRINT_OVERHEAD);

const token = Buffer.from(`${username}:${apiKey}`).toString('base64');

type WorkLog = {
    author: any;
    started: any;
    timeSpent: any;
    timeSpentSeconds: any;
};

type Issue = { key: string };

function formatDuration(
    seconds: number,
    hoursPerDay: number,
    daysPerWeek: number
) {
    const weeks = Math.floor(seconds / 60 / 60 / hoursPerDay / daysPerWeek);
    seconds -= weeks * 60 * 60 * hoursPerDay * daysPerWeek;
    const days = Math.floor(seconds / 60 / 60 / hoursPerDay);
    seconds -= days * 60 * 60 * hoursPerDay;
    const hours = Math.floor(seconds / 60 / 60);
    seconds -= hours * 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return `${weeks}w ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function api(path: string) {
    return fetch(`${endpoint}${path}`, {
        headers: {
            Authorization: `Basic ${token}`,
        },
    });
}

async function go() {
    const myself = await (await api(`/myself`)).json();
    const accountId = myself.accountId;
    const startOfThisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    const endOfThisWeek = add(startOfThisWeek, { weeks: 1 });

    const issues: { issues: Issue[] } = await (
        await api(
            `/search?jql=${encodeURI(
                `project=${projectId}`
            )}&maxResults=5000&fields=id`
        )
    ).json();

    let totalTime = 0;

    console.log(chalk.underline('Tasks with work logged this week'));
    await Promise.all(
        issues.issues.map(async (issue) => {
            const worklogs: { worklogs: WorkLog[] } = await (
                await api(
                    `/issue/${
                        issue.key
                    }/worklog?startedAfter=${startOfThisWeek.getTime()}&startedBefore=${endOfThisWeek.getTime()}`
                )
            ).json();
            const myLogs = worklogs.worklogs.filter(
                (log) => log.author.accountId === accountId
            );
            if (myLogs.length > 0) {
                console.log(chalk.bold(issue.key));
            }
            myLogs.forEach((log) => {
                totalTime += log.timeSpentSeconds;
                console.log(
                    ' ',
                    chalk.red(format(new Date(log.started), 'yyyy-MM-dd')),
                    log.timeSpent
                );
            });
        })
    );
    console.log(
        chalk.bold('Working days:'),
        formatDuration(totalTime, hoursPerDay, daysPerWeek)
    );
    console.log(chalk.bold('Actual time:'), formatDuration(totalTime, 100, 7));
    console.log(
        chalk.bold('Time left:'),
        formatDuration(hoursPerDay * daysPerWeek * 60 * 60 - totalTime, 100, 7)
    );
    console.log(
        chalk.bold(
            `Time left (including sprint overhead of ${sprintOverhead}h):`
        ),
        formatDuration(
            (hoursPerDay * daysPerWeek - sprintOverhead) * 60 * 60 - totalTime,
            100,
            7
        )
    );
}

go();
