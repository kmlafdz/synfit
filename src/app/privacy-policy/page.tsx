import { ArrowLeft, Shield } from "lucide-react";
import { useRouter } from "@/lib/navigation";

export default function PrivacyPolicyPage() {
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
            <div className="h-11 w-11 rounded-2xl bg-orange-500/15 flex items-center justify-center">
              <Shield className="h-6 w-6 text-[#FF5A2C]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight heading-font">
                Kebijakan Privasi
              </h1>
              <p className="text-xs text-muted-foreground">SynFit / Areta Sport Fitness</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">1. Data yang Kami Kumpulkan</h2>
              <p>
                SynFit mengumpulkan data identitas dasar (nama, email, nomor WhatsApp), status keanggotaan,
                riwayat check-in gym, dan data latihan yang Anda simpan secara sukarela (program latihan,
                skor AI Form Coach, serta telemetri detak jantung smartwatch).
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">2. Penggunaan Kamera & Lokasi</h2>
              <p>
                Akses kamera digunakan khusus untuk pemindaian QR check-in dan analisis postur AI Form Coach
                secara lokal di perangkat Anda. Video kamera tidak pernah direkam atau dikirim ke server kami.
                Akses lokasi GPS hanya digunakan saat Anda melakukan verifikasi check-in di area gym.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">3. Keamanan & Penyimpanan Data</h2>
              <p>
                Data keanggotaan disimpan secara terenkripsi pada layanan cloud Firebase & server resmi SynFit.
                Pembayaran digital diproses melalui penyedia gerbang pembayaran tersertifikasi (Midtrans).
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">4. Hak Pengguna & Kontak</h2>
              <p>
                Anda berhak meminta pembaruan atau penghapusan data pribadi Anda kapan saja dengan menghubungi
                admin SynFit melalui WhatsApp resmi gym atau menu bantuan di aplikasi.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
