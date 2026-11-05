import { describe, expect, it } from "vitest";

import {
    MAP_VIEW_STORAGE_KEY,
    clearSavedMapView,
    parseSavedMapView,
    readSavedMapView,
    writeSavedMapView,
} from "@/features/map/map-view-memory";

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
    data: Map<string, string>;
} {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
        removeItem: (key) => void data.delete(key),
    };
}

function throwingStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
    const fail = (): never => {
        throw new Error("SecurityError");
    };
    return { getItem: fail, setItem: fail, removeItem: fail };
}

describe("parseSavedMapView", () => {
    it("nhận khung nhìn hợp lệ ở Việt Nam", () => {
        expect(parseSavedMapView('{"lat":21.0287,"lng":105.8524,"zoom":15}')).toEqual({ lat: 21.0287, lng: 105.8524, zoom: 15 });
    });

    it.each([
        ["rỗng", null],
        ["không phải JSON", "{lat:1"],
        ["thiếu zoom", '{"lat":21,"lng":105}'],
        ["chuỗi thay vì số", '{"lat":"21","lng":105,"zoom":15}'],
        ["ngoài Việt Nam", '{"lat":48.85,"lng":2.35,"zoom":12}'],
        ["đảo vĩ độ/kinh độ", '{"lat":105.85,"lng":21.02,"zoom":12}'],
        ["zoom quá lớn", '{"lat":21,"lng":105,"zoom":25}'],
        ["mảng", "[21,105,15]"],
    ])("bỏ dữ liệu hỏng: %s", (_label, raw) => {
        expect(parseSavedMapView(raw)).toBeNull();
    });
});

describe("đọc/ghi/xóa khung nhìn đã nhớ", () => {
    it("ghi rồi đọc lại đúng giá trị (làm tròn gọn)", () => {
        const storage = memoryStorage();
        writeSavedMapView({ lat: 16.0544123456, lng: 108.2021987654, zoom: 13.456 }, storage);
        expect(readSavedMapView(storage)).toEqual({ lat: 16.054412, lng: 108.202199, zoom: 13.46 });
    });

    it("không ghi khung nhìn không hợp lệ", () => {
        const storage = memoryStorage();
        writeSavedMapView({ lat: Number.NaN, lng: 105, zoom: 12 }, storage);
        expect(storage.data.has(MAP_VIEW_STORAGE_KEY)).toBe(false);
    });

    it("xóa khi đăng xuất", () => {
        const storage = memoryStorage({ [MAP_VIEW_STORAGE_KEY]: '{"lat":21,"lng":105,"zoom":12}' });
        clearSavedMapView(storage);
        expect(readSavedMapView(storage)).toBeNull();
    });

    it("storage ném lỗi hoặc không có thì không làm vỡ trang", () => {
        const storage = throwingStorage();
        expect(readSavedMapView(storage)).toBeNull();
        expect(() => writeSavedMapView({ lat: 21, lng: 105, zoom: 12 }, storage)).not.toThrow();
        expect(() => clearSavedMapView(storage)).not.toThrow();
        expect(readSavedMapView(null)).toBeNull();
    });
});
