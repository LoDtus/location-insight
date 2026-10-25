import ReactMarkdown from "react-markdown";

export default function LegalDocument({
    title,
    markdown,
}: {
    title: string;
    markdown: string;
}) {
    const body = markdown.trim();

    return (
        <article className="box-border px-4 py-12 sm:px-8 xl:px-50">
            <h1 className="m-0 max-w-[20ch] text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
                {title}
            </h1>
            {body ? (
                <div className="mt-8 max-w-prose text-base leading-relaxed">
                    <ReactMarkdown
                        components={{
                            h2: ({ children }) => (
                                <h2 className="mt-8 mb-3 text-2xl leading-snug font-semibold">
                                    {children}
                                </h2>
                            ),
                            h3: ({ children }) => (
                                <h3 className="mt-6 mb-2 text-xl leading-snug font-semibold">
                                    {children}
                                </h3>
                            ),
                            p: ({ children }) => (
                                <p className="mt-4 mb-0">{children}</p>
                            ),
                            ul: ({ children }) => (
                                <ul className="mt-4 mb-0 list-disc pl-5">{children}</ul>
                            ),
                            ol: ({ children }) => (
                                <ol className="mt-4 mb-0 list-decimal pl-5">{children}</ol>
                            ),
                            li: ({ children }) => <li className="mt-1">{children}</li>,
                            a: ({ href, children }) => (
                                <a
                                    href={href}
                                    className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                >
                                    {children}
                                </a>
                            ),
                        }}
                    >
                        {body}
                    </ReactMarkdown>
                </div>
            ) : null}
        </article>
    );
}
