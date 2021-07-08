import { Client } from "https://deno.land/x/postgres@v0.11.3/mod.ts"
import { config } from 'https://deno.land/x/dotenv/mod.ts'
import getCurrentUser from "./helperFunctions/getCurrentUser.js"
import getUserFromCookies from "./helperFunctions/getUserFromCookies.js"

const DENO_ENV = Deno.env.get('DENO_ENV') ?? 'development'
config({ path: `./.env.${DENO_ENV}`, export: true })

const client = new Client(Deno.env.get("PG_URL"))
await client.connect()

async function aiTurnHandler(server) {
    const { lastLetter } = await server.body
    // console.log('AI turn triggered with ', lastLetter)

    // finds user, prioritising registered log in over temporary users
    const user = await getUserFromCookies(server)
    if (!user) throw new Error("You shouldn't be here!")

    // find all possible right answers for this letter
    const aiCountries = (await client.queryArray(`SELECT country_name
                                                  FROM countries 
                                                  WHERE LOWER(SUBSTRING(country_name, 1, 1)) = $1;`, lastLetter.toLowerCase())).rows

    //select random country from possible right answers
    const [aiCountryChoice] = aiCountries[Math.floor(Math.random() * aiCountries.length)]
    console.log('ai country choice: ', aiCountryChoice)

    // add it to the array of played countries
    let [[countryArray]] = (await client.queryArray(`SELECT played_countries FROM current_games WHERE username = $1;`, user)).rows
    countryArray = JSON.parse(countryArray)
    countryArray.push(aiCountryChoice)
    console.log('ai turn countryArray: ', countryArray)
    
    // re-stringify and update current_game table
    await client.queryObject(`UPDATE current_games
                              SET played_countries = $1
                              WHERE username = $2;`, JSON.stringify(countryArray), user)

    // return the AI's chosen country to the frontend
    await server.json({aiCountryChoice})
}

export default aiTurnHandler