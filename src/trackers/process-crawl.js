#!/usr/bin/env node
const chalk = require('chalk')
const Progress = require('progress')

const sharedData = require('./helpers/sharedData.js')
const crawl = require('./classes/crawl.js')
const Site = require('./classes/site.js')

const args = process.argv.slice(2)
const showme = args.includes('showme')

const {JSONFileDataReader, PostgresDataReader} = require('./helpers/readers')

console.log(`Reading crawl from: ${sharedData.config.crawlerDataLoc}`)
let bar
let processedSites = 0
let totalSites = 0

// Process a single site crawler file. This will look through each request in the file
// and update the corresponding entry in the global commonRequests object with new data
// it finds for each request. subdomains, cookies, fingerprint apis used, etc...
// @param {string, crawler file name}
async function processSite(siteData) {
    // check that the crawl for this site finished and has data to process
    if (!siteData.initialUrl || !(siteData.data.requests)) { // && siteData.data.requests.length)) {
        crawl.stats.requestsSkipped += 1
        if (showme) {
            console.log(`Skipped site ${crawl.stats.sites + 1}/${totalSites} — no data`)
        } else {
            bar.tick()
        }
        return
    }

    const site = new Site(siteData)
    let reqCount = 0
    const requestTotal = siteData.data.requests.length
    tempCounter = processedSites + 1

    for (const request of siteData.data.requests) {
        await site.processRequest(request)
        if (showme) {
            reqCount++
            console.log(`Processed request: ${reqCount}/${requestTotal} for site #: ${tempCounter}/${totalSites}`)
        }
        crawl.stats.requests++
    }

    // update crawl level domain prevalence, entity prevalence, and fingerprinting
    console.log(`Processing site: ${tempCounter}/${totalSites}`)
    await crawl.processSite(site)
    crawl.stats.sites++
    if (showme) {
        processedSites++
        console.log(`Processed site ${processedSites}/${totalSites}`)
    } else {
        bar.tick()
    }
}

async function processCrawl() {
    const reader = sharedData.config.crawlerDataLoc === 'postgres'
        ? new PostgresDataReader(sharedData.config.crawlId, sharedData.config.regionCode)
        : new JSONFileDataReader(sharedData.config.crawlerDataLoc)
    console.time("runtime")
    try {
        totalSites = await reader.length()
        if (!showme) {
            bar = new Progress('Process crawl [:bar] :percent', {width: 40, total: totalSites})
        }

        const sitesQueue = []
        for await (const siteData of reader.iterator()) {
            if (sitesQueue.length >= sharedData.config.parallelism) {
                // wait for one of the sites to finish processing before reading next site
                const finishedPromise = await Promise.race(sitesQueue)
                sitesQueue.splice(sitesQueue.indexOf(finishedPromise), 1)
            }

            sitesQueue.push(processSite(siteData))
        }
        await Promise.allSettled(sitesQueue)
        console.log("Exporting Entities")
        crawl.exportEntities()
        console.log("Finalizing Requests")
        crawl.finalizeRequests()
        console.log("Writting Summaries")
        crawl.writeSummaries()
        console.log(`${chalk.blue(crawl.stats.sites)} sites processed\n${chalk.blue(crawl.stats.requests)} requests processed\n${chalk.blue(crawl.stats.requestsSkipped)} requests skipped`)
    } finally {
        console.timeEnd("runtime")
        reader.close()
    }
}

/// process the sites and write summary files
processCrawl()
