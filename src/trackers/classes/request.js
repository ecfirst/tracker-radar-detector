
const {isFirstPartyCookie,isCookieValueInUrl} = require('./../helpers/cookies')
const tldts = require('tldts-experimental')
const {TLDTS_OPTIONS} = require('../helpers/const')

const COOKIE_LENGTH_CUTOFF = 5

class Request {
    constructor (reqData, site, sharedData) {
        this.sharedData = sharedData
        this.site = site
        this.extractURLData(reqData.url)
        this.type = reqData.type
        this.headers = reqData.responseHeaders || {}
        this.setsCookies = _setsCookies(this)
        this.isTracking = false
        this.fingerprintScore = _getFPScore(Object.keys(this.apis), sharedData)
        this.wasCNAME = false
        this.originalSubdomain = undefined
        this.responseHash = reqData.responseBodyHash
        this.nameservers = []
        this.firstPartyCookies = site.thirdPartyJSCookies
            .filter(cookie => cookie.source === reqData.url &&
                cookie.value &&
                isFirstPartyCookie(cookie.domain, site.domain))
        this.firstPartyCookiesSent = site.thirdPartyJSCookies
            .filter(cookie => {
                return cookie.value &&
                    cookie.value.length > COOKIE_LENGTH_CUTOFF &&
                    isCookieValueInUrl(cookie, new this.sharedData.URL(reqData.url))
            })
        this.initiator = _getInitiator(site.domain, reqData.url, reqData.initiators)
    }

    extractURLData(url) {
        this.url = url
        try {
            this.data = new this.sharedData.URL(url)
            this.domain = this.data.domain
            this.host = this.data.hostname
            this.path = this.path || this.data.path
            this.owner = this.sharedData.getOwner(this.data.domain)
            this.apis = this.site.siteData.data.apis.callStats[url] || {}
        } catch (e) {
            if (e.message.includes('Invalid URL protocol')) {
                console.warn(`Invalid URL protocol encountered: ${this.url}. SKIPPING`)
                this.data = null
                this.domain = null
                this.host = null
                this.path = null
                this.owner = null
                this.apis = {}
            } else {
                throw e
            }
        }
    }
}

function _getFPScore (apis, sharedData) {
    if (!apis.length) {return 0}

    return apis.reduce((totalFP, api) => {
        totalFP += sharedData.abuseScores[api] || 1
        return totalFP
    }, 0)
}

function _setsCookies (req) {
    return !!(req.apis['Document.cookie setter'] || req.apis['CookieStore.prototype.set'] || req.headers['set-cookie'])
}

function _getInitiator (siteUrl, reqUrl, initiators) {
    const siteUrlData = tldts.parse(siteUrl, TLDTS_OPTIONS)
    const reqUrlData = tldts.parse(reqUrl, TLDTS_OPTIONS)

    let finalInit = siteUrlData.isIp ? siteUrlData.host : siteUrlData.domain

    if (initiators.length) {
        for (const init of initiators) {
            const initUrlData = tldts.parse(init, TLDTS_OPTIONS)
            if (reqUrlData.isIp ? reqUrlData.host !== initUrlData.host : reqUrlData.domain !== initUrlData.domain) {
                finalInit = initUrlData
                break
            }
        }
    }

    if (finalInit && (finalInit.isIp ? finalInit.host !== siteUrlData.host : finalInit.domain !== siteUrlData.domain)) {
        return finalInit.domain
    }

    return 'first party'
}

module.exports = Request
