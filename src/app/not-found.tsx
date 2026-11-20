import Link from "@/lib/navigation";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-[#090B10] text-white">
      <h1 className="text-4xl font-black text-cyan-400 mb-2">404</h1>
      <h2 className="text-xl font-bold mb-4">Halaman Tidak Ditemukan</h2>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link
        href="/member/dashboard"
        className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
