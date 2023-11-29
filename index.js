const axios = require("axios")
const puppeteer = require("puppeteer")
const inquirer = require("inquirer");

const ALL_TAGS = [
    "*special",
    "2-sat",
    "binary search",
    "bitmasks",
    "brute force",
    "chinese remainder theorem",
    // ... (other tags)
    "two pointers",
];

const RATINGS = Array.from({ length: 28 }, (_, i) => 800 + i * 100);

const QUESTIONS = [
    {
        type: 'input',
        name: 'id',
        message: 'Your Codeforse ID:',
    },
    {
        type: 'password',
        name: 'password',
        message: 'Your Codeforces Password:',
    },
    {
        type: 'list',
        name: 'rating_min',
        message: 'Minimum rating of the suggested problems',
        choices: RATINGS
    },
    {
        type: 'list',
        name: 'rating_max',
        message: 'Maximum rating of the suggested problems',
        choices: RATINGS,
        when: (answers) => answers.rating_min,
    },
    {
        type: 'input',
        name: 'prob_count',
        message: 'Number of problems to suggest',
        validate: input => /^\d+$/.test(input) ? true : 'Please enter a valid number'
    },
    {
        type: 'checkbox',
        name: 'tags',
        message: 'Select tags',
        choices: ALL_TAGS
    },
];

const sleep = async (timeout) => await new Promise(res => setTimeout(res, timeout))


async function addProblems(page, problems) {
    // let problems = ["1832B", "1741C", "1582C", "1399C", "1364A", "1359B", "1251A", "842A", "430B", "387B"]
    for (let i = 0; i < problems.length; i++) {
        let problem = problems[i]
        await page.type('._MashupContestEditFrame_addProblem .ac_input', problem)
        await page.click('._MashupContestEditFrame_addProblemLink')
        await page.waitForSelector('._MashupContestEditFrame_addProblem .ac_input')
        await sleep(1000)
    }
}

async function submitAfterAdding(page) {
    await page.click('._MashupContestEditFrame_saveMashup input[type="submit"]')
    await sleep(2000)
    return page.url()
}

async function fetchProblemsFromCodeforces(tags, rating_min, rating_max, prob_count) {
    const tagString = tags.join(';');
    const url = `https://codeforces.com/api/problemset.problems?tags=${tagString}`;
    const response = await axios.get(url);
    let problems = response.data.result.problems.filter(e => e.rating >= rating_min && e.rating <= rating_max)
    // console.log(problems)
    return problems.map((problem) => `${problem.contestId}${problem.index}`).slice(0, prob_count)
}

const main = async function () {
    let browser = null;
    try {
        const { id, password, prob_count, rating_min, rating_max, tags} = await inquirer.prompt(QUESTIONS);
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: false,
            // slowMo: 250
        })
        console.log({ id, password, prob_count, rating_min, rating_max, })

        const page = await browser.newPage()

        fetchProblemsFromCodeforces(tags, rating_min, rating_max, prob_count)
            .then(async (problems) => {
                await page.goto('https://codeforces.com/enter/',
                    { waitUntil: "networkidle2" }
                )

                await page.waitForSelector("#handleOrEmail")
                await page.type("#handleOrEmail", id)
                await page.type("#password", password)
                await page.click(".submit")

                await sleep(2000)
                await page.goto('https://codeforces.com/mashup/new',
                    { waitUntil: "networkidle2" }
                )
                await page.type("#contestName", "Just a practice contest")
                await page.type("#contestDuration", "300")
                return problems
            })
            .then(async (problems) => {
                await addProblems(page, problems)
            })
            .then(async () => {
                let url = await submitAfterAdding(page); // Execute the third promise after the first and 2nd one finishes
                return url
            })
            .then((url) => {
                console.log(`${url}`); // Handle completion of all promises
            })
            .then(async () => {
                await browser.close();
            })
    } catch (err) {
        console.log("Error : ", err.message)
    } finally {
    }

}

main()