import {
    buildAuthTransferUrl,
    cleanAuthTransferUrl,
    extractAuthTransfer,
    removeAuthTransferFromUrl,
} from "../utils/auth-transfer";

describe("auth transfer", () => {
    const now = 1720000000000;

    test("builds and extracts a short-lived login transfer from the URL fragment", () => {
        const target = buildAuthTransferUrl("https://fsf.2kog.com/contract/index?tab=all", {
            token: "token.中文.value",
            user: { id: 7, nickname: "测试用户", token: "must-not-be-copied-twice" },
            now,
        });

        expect(target).not.toContain("?tab=all&_sso=");
        const result = extractAuthTransfer(target, { now: now + 1000 });
        expect(result.token).toBe("token.中文.value");
        expect(result.user).toEqual({ id: 7, nickname: "测试用户" });
        expect(result.cleanUrl).toBe("https://fsf.2kog.com/contract/index?tab=all");
    });

    test("removes an invalid transfer while preserving other fragment fields", () => {
        expect(removeAuthTransferFromUrl("https://fsf.2kog.com/#section=overview&_sso=invalid")).toBe(
            "https://fsf.2kog.com/#section=overview"
        );
    });

    test("rejects expired transfers", () => {
        const target = buildAuthTransferUrl("https://fsf.2kog.com", { token: "token", now });
        expect(() => extractAuthTransfer(target, { now: now + 5 * 60 * 1000 + 1 })).toThrow("已过期");
    });

    test("cleans sensitive transfer data without reloading", () => {
        const replaceState = jest.fn();
        cleanAuthTransferUrl("https://fsf.2kog.com/path?a=1#section=overview", {
            state: { key: "value" },
            replaceState,
        });
        expect(replaceState).toHaveBeenCalledWith({ key: "value" }, "", "/path?a=1#section=overview");
    });
});
