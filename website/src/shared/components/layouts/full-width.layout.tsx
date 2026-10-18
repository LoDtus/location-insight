import { ReactNode } from "react"

export default function FullWidthLayout({
    children
}: {
    children: ReactNode
}) {
    return (
        <div>
            { children }
        </div>
    )
}