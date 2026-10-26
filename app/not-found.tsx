import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">This page took a wrong turn.</h1>
      <p className="text-muted">The link might be old or mistyped. Your next city is only a search away.</p>
      <Link href="/" className="w-fit rounded-xl bg-accent px-4 py-3 font-semibold text-white">
        Find my cities
      </Link>
    </main>
  );
}
