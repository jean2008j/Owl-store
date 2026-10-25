import type { PageContent } from "@/lib/store/pages";

export function InfoPage({ page }: { page: PageContent }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-20">
      <p className="font-display text-xs tracking-brand text-muted uppercase">{page.kicker}</p>
      <h1 className="mt-3 font-display text-4xl leading-none uppercase md:text-6xl">{page.title}</h1>
      <div className="mt-10 flex flex-col gap-6">
        {page.blocks.map((block, index) => {
          if (block.type === "h") {
            return (
              <h2 key={index} className="mt-4 font-display text-2xl font-bold uppercase md:text-3xl">
                {block.text}
              </h2>
            );
          }
          if (block.type === "p") {
            return (
              <p key={index} className="leading-relaxed text-muted md:text-lg">
                {block.text}
              </p>
            );
          }
          if (block.type === "list") {
            return (
              <ul key={index} className="flex flex-col divide-y divide-line border-y border-line">
                {block.items.map((item) => (
                  <li key={item.title} className="py-5">
                    <h3 className="font-display text-lg uppercase">{item.title}</h3>
                    <p className="mt-1 text-muted">{item.text}</p>
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="mt-6 border-t border-line pt-8 font-display text-xl uppercase md:text-2xl">
              {block.text}
            </p>
          );
        })}
      </div>
    </article>
  );
}
