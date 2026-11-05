import {
    Building2,
    Bus,
    Hammer,
    Hospital,
    Landmark,
    Leaf,
    Milestone,
    Mountain,
    Pill,
    School,
    ShoppingCart,
    Store,
    TrainFront,
    Trees,
    Users,
    UtensilsCrossed,
    Volume2,
    Waves,
    Wind,
    type LucideIcon,
} from "lucide-react";

/**
 * 19 tiêu chí cố định của đánh giá địa điểm (khớp `CRITERIA` trong backend place-evaluation.ts và
 * workspace/features/000-ideas/tieu-chi.md). Bộ tiêu chí không thêm, không bớt.
 */
export const CRITERION_IDS = [
    "cho",
    "hieu-thuoc",
    "sieu-thi",
    "ubnd",
    "vat-tu",
    "quan-an",
    "cong-vien",
    "truong-hoc",
    "duong-lon",
    "noi-do",
    "metro",
    "xe-buyt",
    "on-giao-thong",
    "benh-vien",
    "mat-do-dan-cu",
    "khong-khi",
    "do-cao",
    "ngap-song",
    "mang-xanh",
] as const;

export type CriterionId = (typeof CRITERION_IDS)[number];

/** Icon của từng tiêu chí. `Record` theo đủ 19 mã nên thiếu hay thừa một mã là lỗi biên dịch. */
export const CRITERION_ICON: Record<CriterionId, LucideIcon> = {
    cho: Store,
    "hieu-thuoc": Pill,
    "sieu-thi": ShoppingCart,
    ubnd: Landmark,
    "vat-tu": Hammer,
    "quan-an": UtensilsCrossed,
    "cong-vien": Trees,
    "truong-hoc": School,
    "duong-lon": Milestone,
    "noi-do": Building2,
    metro: TrainFront,
    "xe-buyt": Bus,
    "on-giao-thong": Volume2,
    "benh-vien": Hospital,
    "mat-do-dan-cu": Users,
    "khong-khi": Wind,
    "do-cao": Mountain,
    "ngap-song": Waves,
    "mang-xanh": Leaf,
};
