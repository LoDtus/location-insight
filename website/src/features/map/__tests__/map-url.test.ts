import { describe, expect, it } from "vitest";

import { buildMapUrl, canonicalQuery, emptyMapUrlState, parseMapUrl } from "@/features/map/map-url";

const parse = (query: string) => parseMapUrl(new URLSearchParams(query));
const params = (query: string) => parse(query).errors.map((e) => e.param);

describe("parseMapUrl — giá trị hợp lệ", () => {
    it("URL rỗng → không lỗi, mọi thứ null", () => {
        const { state, errors } = parse("");
        expect(errors).toEqual([]);
        expect(state).toEqual(emptyMapUrlState());
    });
    it("khung nhìn, lớp, tìm kiếm, chỉ đường", () => {
        const { state, errors } = parse(
            "c=21.0285,105.8542&z=16.5&b=30&p=45&s=lm&layers=traffic&q=hồ gươm&cats=3001,1002-1&scope=POI,STREET&city=11&dist=1291&ward=31755&r=500&from=21.03,105.85&to=21,105.84&v=car&alt=0&route=1&avoid=ferry&t=2026-11-03T01:00:00Z",
        );
        expect(errors).toEqual([]);
        expect(state).toMatchObject({
            c: { lat: 21.0285, lng: 105.8542 }, z: 16.5, b: 30, p: 45, s: "lm", traffic: true, q: "hồ gươm",
            filters: { cats: "3001,1002-1", scope: "POI,STREET", cityId: 11, distId: 1291, wardId: 31755, radius: 500 },
            from: { lat: 21.03, lng: 105.85 }, to: { lat: 21, lng: 105.84 },
            v: "car", alt: false, route: 1, avoid: "ferry", t: "2026-11-03T01:00:00Z",
        });
    });
    it("pin đứng một mình hợp lệ", () => {
        expect(parse("pin=21.0285,105.8542")).toMatchObject({ errors: [], state: { pin: { lat: 21.0285 } } });
    });
});

describe("parseMapUrl — báo lỗi", () => {
    it("tọa độ sai dạng, đảo lat/lng, ngoài Việt Nam", () => {
        expect(params("c=abc")).toEqual(["c"]);
        expect(params("pin=21.0285")).toEqual(["pin"]);
        expect(params("pin=105.8542,21.0285")).toEqual(["pin"]);
        expect(params("from=48.85,2.35&to=21,105")).toEqual(["from"]);
        expect(params("pin=21.0285,105.8542&x=1")).toEqual(["x"]);
        expect(parse("pin=105.85,21.02").errors[0].message).toContain("đảo");
    });
    it("số ngoài khoảng cho phép", () => {
        expect(params("z=3")).toEqual(["z"]);
        expect(params("z=21")).toEqual(["z"]);
        expect(params("z=abc")).toEqual(["z"]);
        expect(params("b=999")).toEqual(["b"]);
        expect(params("p=61")).toEqual(["p"]);
        expect(params("r=10")).toEqual(["r"]);
        expect(params("r=100000")).toEqual(["r"]);
        expect(params("city=0")).toEqual(["city"]);
        expect(params("dist=1.5")).toEqual(["dist"]);
        expect(params("ward=abc")).toEqual(["ward"]);
    });
    it("giá trị ngoài danh sách cho phép", () => {
        expect(params("s=xx")).toEqual(["s"]);
        expect(params("layers=traffic,satellite")).toEqual(["layers"]);
        expect(params("scope=POI,BAD")).toEqual(["scope"]);
        expect(params("scope=POI,POI")).toEqual(["scope"]);
        expect(params("cats=abc")).toEqual(["cats"]);
        expect(params("cats=1,2,3,4,5,6,7,8,9,10,11")).toEqual(["cats"]);
    });
    it("q quá ngắn/dài/rỗng", () => {
        expect(params("q=a")).toEqual(["q"]);
        expect(params(`q=${"a".repeat(121)}`)).toEqual(["q"]);
        expect(params("q=")).toEqual(["q"]);
        expect(params("q=%20%20")).toEqual(["q"]);
    });
    it("param của chỉ đường sai giá trị", () => {
        const base = "from=21.03,105.85&to=21,105.84";
        expect(params(`${base}&v=truck`)).toEqual(["v"]);
        expect(params(`${base}&alt=2`)).toEqual(["alt"]);
        expect(params(`${base}&route=9`)).toEqual(["route"]);
        expect(params(`${base}&avoid=toll`)).toEqual(["avoid"]);
        expect(params(`${base}&t=hôm nay`)).toEqual(["t"]);
        expect(params(`${base}&t=2026-13-45T01:00:00Z`)).toEqual(["t"]);
        expect(params(`${base}&t=2026-11-03T01:00:00+07:00`)).toEqual(["t"]);
    });
    it("param của chỉ đường mà thiếu from/to; pin chung với from/to", () => {
        expect(params("v=car&route=1")).toEqual(["v", "route"]);
        const mixed = parse("pin=21.0285,105.8542&from=21.03,105.85");
        expect(mixed.errors.map((e) => e.param)).toEqual(["pin"]);
        expect(mixed.state.pin).toBeNull();
    });
    it("lặp param và param lạ", () => {
        expect(params("z=10&z=11")).toEqual(["z"]);
        expect(params("zoom=10&foo=bar")).toEqual(["zoom", "foo"]);
    });
    it("giá trị lỗi không lọt vào state; tham số hợp lệ còn lại vẫn dùng được", () => {
        const { state, errors } = parse("z=99&s=lm");
        expect(errors).toHaveLength(1);
        expect(state.z).toBeNull();
        expect(state.s).toBe("lm");
    });
    it("chuỗi tấn công không qua được", () => {
        expect(params("q=<script>alert(1)</script>")).toEqual([]); // là văn bản thuần, chỉ gửi như tham số tìm kiếm đã mã hóa
        expect(params("pin=21.02,105.85%26apikey%3Dx")).toEqual(["pin"]);
        expect(params("s=tm%0d%0aX")).toEqual(["s"]);
    });
});

describe("buildMapUrl", () => {
    it("bỏ giá trị mặc định, thứ tự ổn định, giữ dấu phẩy", () => {
        const state = {
            ...emptyMapUrlState(),
            c: { lat: 21.028512345, lng: 105.8542 }, z: 16.456, b: 0, p: 0, s: "tm" as const,
            from: { lat: 21.03, lng: 105.85 }, to: { lat: 21, lng: 105.84 },
            v: "motorcycle" as const, alt: true, route: 0,
        };
        expect(buildMapUrl(state)).toBe("c=21.02851,105.8542&z=16.46&from=21.03,105.85&to=21,105.84");
    });
    it("ghi giá trị khác mặc định; pin bị bỏ khi đang chỉ đường", () => {
        const state = {
            ...emptyMapUrlState(), s: "dm" as const, traffic: true, q: "hồ gươm", pin: { lat: 21, lng: 105 },
            filters: { scope: "POI", radius: 300 }, from: { lat: 21.03, lng: 105.85 },
            v: "car" as const, alt: false, route: 1, avoid: "ferry" as const, t: "2026-11-03T01:00:00Z",
        };
        const url = buildMapUrl(state);
        expect(url).toContain("s=dm&layers=traffic&q=h%E1%BB%93%20g%C6%B0%C6%A1m&scope=POI&r=300");
        expect(url).not.toContain("pin=");
        expect(url).toContain("v=car&alt=0&route=1&avoid=ferry&t=2026-11-03T01:00:00Z");
    });
    it("round-trip: build → parse ra đúng trạng thái", () => {
        const state = {
            ...emptyMapUrlState(), c: { lat: 21.0285, lng: 105.8542 }, z: 15, b: 20, p: 30, s: "hm" as const,
            q: "cafe", filters: { cats: "3001", distId: 1291, radius: 200 }, pin: { lat: 21.03, lng: 105.85 },
        };
        const parsed = parse(buildMapUrl(state));
        expect(parsed.errors).toEqual([]);
        expect(parsed.state).toEqual(state);
    });
    it("canonicalQuery bỏ qua khác biệt mã hóa dấu phẩy", () => {
        expect(canonicalQuery("c=21,105")).toBe(canonicalQuery("c=21%2C105"));
    });
});
