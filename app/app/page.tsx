import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Link href="/trade" className="text-sm font-medium">
        Apex Protocol
      </Link>
    </main>
  );
}
