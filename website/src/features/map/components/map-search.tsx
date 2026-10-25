import { Search } from "lucide-react";

export default function MapSearch() {
    return (
        <div className="pointer-events-auto absolute top-2 left-2 z-10 flex w-fit gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
            <input placeholder="Tìm kiếm" aria-label="Tìm kiếm" />
            <Search />
        </div>
    );
}
