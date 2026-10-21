const LANDING_PAGE_SEO = {
    ROUTES: {
        home: "/",
        traCuu: "/tra-cuu",
        tinDangChao: "/tin-dang-chao",
        bangGia: "/bang-gia",
        tuDiaChiToiMotKhoangGia: "/tu-dia-chi-toi-mot-khoang-gia",
        baiViet: "/bai-viet",
        hoiDap: "/hoi-dap",
        tinhNang: "/tinh-nang",
        phapLy: "/phap-ly",
        baoCaoMau: "/bao-cao-mau",
        keoGhimViDiaChiHayLech: "/bai-viet/keo-ghim-vi-dia-chi-hay-lech",
        soTienIchThap: "/bai-viet/so-tien-ich-thap-khong-co-nghia-khu-trong",
        khungGiaKhongPhaiGiaBan: "/bai-viet/khung-gia-khong-phai-gia-ban",
        baBanKinhDaChot: "/bai-viet/ba-ban-kinh-da-chot",
        khongKetLuanDeNgap: "/bai-viet/khong-ket-luan-de-ngap-tu-mot-con-so",
        banDoMo: "/bai-viet/ban-do-mo-khong-phai-quy-hoach",
        baoCaoMauKhongTinhLuot: "/bai-viet/bao-cao-mau-khong-tinh-luot",
        giaChaoKhongPhaiKetLuan: "/bai-viet/gia-chao-khong-phai-ket-luan-bao-cao",
        thieuMatTien: "/bai-viet/thieu-mat-tien-thi-khung-rong-ra",
        khaiVuongQuyHoach: "/bai-viet/khai-vuong-quy-hoach-thi-khong-ra-gia",
        baDiemDaDo: "/bai-viet/ba-diem-da-do",
        khongGanNhan: "/bai-viet/khong-gan-nhan-truong-tot-hay-an-ninh",
        dienTichLaSoTuKhai: "/bai-viet/dien-tich-la-so-tu-khai",
        muoiLuotSoSanh: "/bai-viet/muoi-luot-so-sanh-moi-ngay",
        diaDiemDaLuu: "/bai-viet/dia-diem-da-luu-tren-may-nay",
        tinRaoChuaDang: "/bai-viet/tin-rao-chua-dang-cong-khai",
        gaMetro: "/bai-viet/ga-metro-chi-tinh-ga-dang-chay",
        phamViHaNoi: "/bai-viet/pham-vi-dang-la-ha-noi",
    },
} as const;

export type LandingPagePath =
    (typeof LANDING_PAGE_SEO.ROUTES)[keyof typeof LANDING_PAGE_SEO.ROUTES];

export default LANDING_PAGE_SEO;
