import { ArrowLeft, Scale } from "lucide-react";
import { useRouter } from "@/lib/navigation";

export default function TermsOfUsePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#FF5A2C] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>

        <div className="glass-card p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-500/15 flex items-center justify-center">
              <Scale className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight heading-font">
                Ketentuan Layanan
              </h1>
              <p className="text-xs text-muted-foreground">SynFit / Areta Sport Fitness</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">1. Keanggotaan & Akses</h2>
              <p>
                Kartu member digital SynFit bersifat pribadi dan tidak dapat dipindahtangankan. Masa aktif
                dihitung sejak tanggal aktivasi atau konfirmasi pembayaran yang sah.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">2. Tata Tertib Gym</h2>
              <p>
                Anggota wajib menggunakan pakaian dan sepatu olahraga yang bersih, membawa handuk pribadi,
                mengembalikan beban (dumbbell/plate) ke rak setelah digunakan, serta menjaga kebersihan dan
                keamanan peralatan gym.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">3. Fitur AI Form Coach & Kesehatan</h2>
              <p>
                Rekomendasi latihan, analisis postur AI, dan panduan nutrisi bersifat edukatif dan bukan
                pengganti nasihat medis profesional. Hentikan latihan apabila mengalami nyeri atau pusing.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">4. Pembayaran & Perpanjangan</h2>
              <p>
                Transaksi pembayaran yang telah terkonfirmasi tidak dapat dibatalkan kecuali terdapat kendala
                teknis ganda yang diverifikasi oleh admin SynFit.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
