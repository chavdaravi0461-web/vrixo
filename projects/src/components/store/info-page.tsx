import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from "@/lib/constants";

export function InfoPage({ title, body }: { title: string; body: string }) {
  const bodyParts = body.split(SUPPORT_EMAIL);

  return (
    <section className="container mt-10">
      <div className="max-w-3xl rounded-[2rem] bg-white p-8 card-shadow">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Vrixo</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-slate-950">{title}</h1>
        <div className="mt-5 whitespace-pre-line text-base leading-8 text-slate-600">
          {bodyParts.map((part, index) => (
            <span key={`${title}-${index}`}>
              {part}
              {index < bodyParts.length - 1 ? (
                <a href={SUPPORT_EMAIL_HREF} className="font-semibold text-teal-700 underline-offset-4 hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
