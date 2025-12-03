const DEFAULT_NAMESPACE = 'default';
function normalizeNamespace(namespace) {
    return namespace?.trim() ? namespace.trim() : DEFAULT_NAMESPACE;
}
export class SimpleCacheDO {
    constructor(state) {
        this.state = state;
    }
    buildStorageKey(namespace, key) {
        return `${namespace}::${key}`;
    }
    buildNamespacePrefix(namespace) {
        return `${namespace}::`;
    }
    async safeJson(request) {
        try {
            return await request.json();
        }
        catch {
            return {};
        }
    }
    async fetch(request) {
        const url = new URL(request.url);
        const key = url.searchParams.get('key');
        const namespace = normalizeNamespace(url.searchParams.get('namespace') || undefined);
        if (request.method === 'GET' && key) {
            const storageKey = this.buildStorageKey(namespace, key);
            const value = await this.state.storage.get(storageKey);
            return new Response(JSON.stringify(value ?? null), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (request.method === 'POST' && key) {
            const payload = await this.safeJson(request);
            const ttl = typeof payload.ttl === 'number' && payload.ttl > 0 ? payload.ttl : undefined;
            const value = payload.value ?? payload;
            const storageKey = this.buildStorageKey(namespace, key);
            const putOptions = ttl ? { expirationTtl: ttl } : undefined;
            await this.state.storage.put(storageKey, value, putOptions);
            return new Response('OK', { status: 200 });
        }
        if (request.method === 'DELETE' && key) {
            const storageKey = this.buildStorageKey(namespace, key);
            await this.state.storage.delete(storageKey);
            return new Response('OK', { status: 200 });
        }
        if (request.method === 'POST' && url.pathname === '/clear') {
            const payload = await this.safeJson(request);
            const scopedNamespace = payload.namespace ? normalizeNamespace(payload.namespace) : null;
            if (scopedNamespace) {
                const entries = await this.state.storage.list({ prefix: this.buildNamespacePrefix(scopedNamespace) });
                for (const entryKey of entries.keys()) {
                    await this.state.storage.delete(entryKey);
                }
            }
            else {
                await this.state.storage.deleteAll();
            }
            return new Response('OK', { status: 200 });
        }
        if (request.method === 'GET' && url.pathname === '/metadata') {
            const entries = await this.state.storage.list({ prefix: this.buildNamespacePrefix(namespace) });
            const metadata = {};
            for (const entryKey of entries.keys()) {
                const [, scopedKey] = entryKey.split('::', 2);
                if (scopedKey) {
                    metadata[scopedKey] = true;
                }
            }
            return new Response(JSON.stringify(metadata), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return new Response('Not Found', { status: 404 });
    }
}
export class SimpleCache {
    constructor(doNamespace) {
        this.doNamespace = doNamespace;
    }
    getStub() {
        return this.doNamespace.get(this.doNamespace.idFromName('cache'));
    }
    buildUrl(path, params) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                search.set(key, value);
            }
        }
        const suffix = search.toString();
        return `https://cache${path}${suffix ? `?${suffix}` : ''}`;
    }
    async get(key, options) {
        try {
            const stub = this.getStub();
            const url = this.buildUrl('/', {
                key,
                namespace: options?.namespace
            });
            const response = await stub.fetch(url);
            return response.ok ? await response.json() : null;
        }
        catch (error) {
            console.error('SimpleCache#get failed', { key, error });
            return null;
        }
    }
    async set(key, value, options) {
        try {
            const stub = this.getStub();
            const url = this.buildUrl('/', {
                key,
                namespace: options?.namespace
            });
            await stub.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    value,
                    ttl: options?.ttl
                })
            });
        }
        catch (error) {
            console.error('SimpleCache#set failed', { key, error });
        }
    }
    async clear(options) {
        try {
            const stub = this.getStub();
            const url = this.buildUrl('/clear', {});
            await stub.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    namespace: options?.namespace
                })
            });
        }
        catch (error) {
            console.error('SimpleCache#clear failed', { error });
        }
    }
    async getMetadata(options) {
        try {
            const stub = this.getStub();
            const url = this.buildUrl('/metadata', {
                namespace: options?.namespace
            });
            const response = await stub.fetch(url);
            if (!response.ok) {
                return {};
            }
            return await response.json();
        }
        catch (error) {
            console.error('SimpleCache#getMetadata failed', { error });
            return {};
        }
    }
}
//# sourceMappingURL=simple-cache-do.js.map