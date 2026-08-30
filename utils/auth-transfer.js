const DEFAULT_PARAM = "_sso";
const DEFAULT_MAX_AGE = 5 * 60 * 1000;

function encodeBase64Url(value) {
    const bytes = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
    return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(normalized + padding);
    const encoded = Array.from(decoded, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    return decodeURIComponent(encoded);
}

function assertToken(token) {
    if (typeof token !== "string" || !token || /[\s\x00-\x1f\x7f]/.test(token)) {
        throw new Error("登录交接 token 无效");
    }
}

export function buildAuthTransferUrl(target, { token, user = null, param = DEFAULT_PARAM, now = Date.now() } = {}) {
    assertToken(token);

    const url = new URL(target, typeof window === "undefined" ? undefined : window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const safeUser = user && typeof user === "object" ? { ...user } : null;
    if (safeUser) delete safeUser.token;
    hashParams.set(
        param,
        encodeBase64Url(
            JSON.stringify({
                version: 1,
                token,
                user: safeUser,
                issuedAt: now,
            })
        )
    );
    url.hash = hashParams.toString();
    return url.toString();
}

export function removeAuthTransferFromUrl(
    source = typeof window === "undefined" ? "" : window.location.href,
    { param = DEFAULT_PARAM } = {}
) {
    const url = new URL(source, typeof window === "undefined" ? undefined : window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    hashParams.delete(param);
    url.hash = hashParams.toString();
    return url.toString();
}

export function extractAuthTransfer(
    source = typeof window === "undefined" ? "" : window.location.href,
    { param = DEFAULT_PARAM, maxAge = DEFAULT_MAX_AGE, now = Date.now() } = {}
) {
    const url = new URL(source, typeof window === "undefined" ? undefined : window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const encodedPayload = hashParams.get(param);
    if (!encodedPayload) return null;

    hashParams.delete(param);
    url.hash = hashParams.toString();

    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    assertToken(payload?.token);
    if (payload.version !== 1 || !Number.isFinite(payload.issuedAt)) {
        throw new Error("登录交接数据格式无效");
    }
    if (maxAge > 0 && (payload.issuedAt > now + 30 * 1000 || now - payload.issuedAt > maxAge)) {
        throw new Error("登录交接信息已过期");
    }

    return {
        token: payload.token,
        user: payload.user && typeof payload.user === "object" ? payload.user : null,
        issuedAt: payload.issuedAt,
        cleanUrl: url.toString(),
    };
}

export function cleanAuthTransferUrl(cleanUrl, historyObject = typeof window === "undefined" ? null : window.history) {
    if (!cleanUrl || !historyObject?.replaceState) return;
    const url = new URL(cleanUrl, typeof window === "undefined" ? undefined : window.location.href);
    historyObject.replaceState(historyObject.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export { DEFAULT_MAX_AGE as AUTH_TRANSFER_MAX_AGE, DEFAULT_PARAM as AUTH_TRANSFER_PARAM };
