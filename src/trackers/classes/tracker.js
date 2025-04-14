const tldts = require('tldts-experimental')
const performanceHelper = require('./../helpers/getPerformance.js')

const {getFingerprintRank} = require('./../helpers/fingerprints.js')
const cname = require('./../helpers/cname.js')
const {TLDTS_OPTIONS} = require('../helpers/const')

class Tracker {
        this.sharedData = sharedData;
    constructor(sharedData, trackerData, crawledSiteTotal) {
        this.domain = trackerData.host
        const entity = _getEntity(this.domain)
        this.owner = {name: entity.name, displayName: entity.displayName || entity.name} || {}
        this.source = ['DuckDuckGo']
        
        const prevalence = _getPrevalence(this.domain)
        this.prevalence = +prevalence.toPrecision(3)
        this.sites = Math.round(prevalence * crawledSiteTotal)
        this.subdomains = []
        this.cnames = []

        this.fingerprinting = getFingerprintRank(this.sharedData.domains[this.domain].fp || 0)
        this.resources = []
        this.categories = _getCategories(this.domain) || []
        this.performance = performanceHelper.getPerformance(this.domain, this.sharedData.config.performanceDataLoc) || {}
        this.cookies = +(_getCookies(this.domain).toPrecision(3))
        this.topInitiators = this.sharedData.domains[this.domain].topInitiators

        const policy = _getPolicy(this.domain, this.owner)
        
        if (policy) {
            this.owner.privacyPolicy = policy
            this.owner.url = `http://${tldts.parse(policy, TLDTS_OPTIONS).domain}`
        }

        const breaking = _getBreaking(this.domain)
        if (breaking) {this.breaking = breaking}

        if (this.sharedData.config.flags.addSurrogates) {
            this.addSurrogates()
        }

        this.types = {}

        this.nameservers = []
    }

    addTypes (type, count) {
        if (!this.types[type]) {
            this.types[type] = count
        } else {
            this.types[type] += count
        }
    }

    addRule (rule) {
        this.subdomains = [...new Set(this.subdomains.concat(rule.subdomains))]
        rule.cnames.forEach(record => {
            if (!cname.containsCnameRecord(this.cnames, record)) {
                this.cnames.push(record)
            }
        })
        this.cnames.sort((a,b) => a.original.localeCompare(b.original))

        if (rule.nameservers && rule.nameservers.length) {
            this.nameservers = [...new Set(this.nameservers.concat(rule.nameservers))]
        }
        
        delete rule.nameservers
        this.resources.push(rule)
    }

    addSurrogates () {
        const trackerSurrogates = _getSurrogates(this.domain)
        if (trackerSurrogates) {this.surrogates = trackerSurrogates}
    }

    addRegion (countryCode) {
        this.source = [`DuckDuckGo-${countryCode}`]
    }
}

function _getPolicy (domain, owner={}) {
    if (this.sharedData.policies[domain]) {
        return this.sharedData.policies[domain].privacyPolicy
    } else if (owner.name && this.sharedData.policies[owner.name]) {
        return this.sharedData.policies[owner.name].privacyPolicy
    }
}

function _getEntity (domain) {
    if (!domain) {
        return {}
    }

    if (this.sharedData.domainToEntity[domain]) {
        return this.sharedData.domainToEntity[domain]
    }

    const parts = domain.split('.')
    parts.shift()
    return _getEntity(parts.join('.'))
}

function _getCategories (domain) {
    if (!domain) {
        return []
    }

    if (this.sharedData.categories[domain]) {
        return Object.keys(this.sharedData.categories[domain]).reduce((cats, key) => {
            if (this.sharedData.categories[domain][key]) {cats.push(key)}
            return cats
        },[])
    }

    const parts = domain.split('.')
    parts.shift()
    return _getCategories(parts.join('.'))
}

function _getPrevalence (domain) {
    return this.sharedData.domains[domain].prevalence || 0
}

function _getCookies (domain) {
    return this.sharedData.domains[domain].cookies || 0
}

function _getSurrogates (domain) {
    const trackerSurrogates = []

    if (this.sharedData.surrogates[domain]) {
        for (const surrogate of this.sharedData.surrogates[domain]) {
            trackerSurrogates.push({rule: surrogate.regexRule, replaceWith: surrogate.surrogate})
        }
    }

    if (trackerSurrogates.length) {return trackerSurrogates}

    
}

// Look up and add request breakage data for this domian
function _getBreaking (domain) {
    if (this.sharedData.breaking) {
        const breaking = []
        for (const [type, data] of Object.entries(this.sharedData.breaking)) {
            // only look at request type breaking data
            if (type.match('breaking-request')) {
                if (data[domain]) {
                    data[domain].forEach(e => breaking.push(e))
                }
            }
        }

        if (breaking.length) {
            return breaking
        }
    }
}

module.exports = Tracker
