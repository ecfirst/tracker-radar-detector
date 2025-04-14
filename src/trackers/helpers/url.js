const { URL } = require('@cliqz/url-parser')
const fs = require('fs')
const { parse } = require('tldts-experimental')
const { TLDTS_OPTIONS } = require('./const')

// Export a function that takes config and returns a customized ParsedURL class
module.exports = function createParsedURLClass(config) {
    const pslExtras = config.pslExtras && fs.existsSync(config.pslExtras)
        ? JSON.parse(fs.readFileSync(config.pslExtras, 'utf8'))
        : {}

    class ParsedURL extends URL {
        constructor(url) {
            if (url.startsWith('blob:')) {
                url = url.replace(/^blob:/, '')
            }
            super(url)
        }

        get domainInfo() {
            if (!this._domainInfo) {
                this._domainInfo = parse(this.hostname, {
                    extractHostname: false,
                    ...TLDTS_OPTIONS
                })

                if (!this._domainInfo.isPrivate && pslExtras && pslExtras.privatePSL) {
                    const suffixMatches = pslExtras.privatePSL.filter(suffix => {
                        const escapedSuffix = suffix.replace('.', '\\.')
                        const regex = new RegExp(`(^|\\.)${escapedSuffix}$`)
                        return regex.test(this._domainInfo.hostname)
                    })

                    if (suffixMatches && suffixMatches.length) {
                        const suffix = suffixMatches.reduce((l, s) => l.length >= s.length ? l : s)
                        const splitSubdomain = this._domainInfo.hostname.replace(new RegExp(`\\.?${suffix}$`), '').split('.')
                        const domainWithoutSuffix = splitSubdomain.pop()

                        this._domainInfo.publicSuffix = suffix
                        this._domainInfo.domain = domainWithoutSuffix ? `${domainWithoutSuffix}.${suffix}` : suffix
                        this._domainInfo.domainWithoutSuffix = domainWithoutSuffix
                        this._domainInfo.subdomain = splitSubdomain.join('.')
                        this._domainInfo.isPrivate = true
                    }
                }
            }
            return this._domainInfo
        }

        get domain() {
            return this.domainInfo.isIp ? this.hostname : this.domainInfo.domain
        }

        get subdomain() {
            return this.domainInfo.subdomain
        }

        get path() {
            return this.pathname.split(';')[0]
        }
    }

    return ParsedURL
}
