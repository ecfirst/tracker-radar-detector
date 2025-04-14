function getOwnerFactory(sharedData) {
    function getOwner(domain) {
        if (!domain) return

        const owner = sharedData.entityMap.get(domain)

        if (owner) {
            return owner
        }

        const parts = domain.split('.')
        parts.shift()
        return getOwner(parts.join('.'))
    }

    return getOwner
}

module.exports = getOwnerFactory