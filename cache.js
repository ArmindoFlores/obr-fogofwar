import objectHash from "object-hash";

export class ObjectCache {
    constructor(useHash) {
        this.cache = {};
        this.useHash = useHash;
    }

    cacheValue(key, value) {
        this.cache[this.useHash ? objectHash(key) : key] = value;
    }

    deleteValue(key) {
        delete this.cache[this.useHash ? objectHash(key) : key];
    }

    getValue(key) {
        return this.cache[this.useHash ? objectHash(key) : key];
    }

    isCached(key) {
        return (this.useHash ? objectHash(key) : key) in this.cache;
    }

    invalidate(cleanupFunction) {
        if (cleanupFunction)
            Object.entries(this.cache).forEach((args) => cleanupFunction(...args));
        this.cache = {};
    }
};