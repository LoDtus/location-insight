import BangGiaSection from "@/features/landing-page/components/pricing-section";
import CachHoatDongSection from "@/features/landing-page/components/how-it-works-section";
import CauHoiSection from "@/features/landing-page/components/faq-section";
import HeroSection from "@/features/landing-page/components/hero-section";
import BanDoSection from "@/features/landing-page/components/lookup-section";
import MuaBanNhaDatSection from "@/features/landing-page/components/property-listings-section";

export default function LandingPage() {
    return (
        <>
            <HeroSection />
            <BanDoSection />
            <MuaBanNhaDatSection />
            <BangGiaSection />
            <CachHoatDongSection />
            <CauHoiSection />
        </>
    );
}
