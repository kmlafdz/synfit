export interface EquipmentTutorial {
  id: string;
  name: string;
  category: "Free Weights" | "Mesin Tubuh Atas" | "Mesin Tubuh Bawah" | "Kabel & Rak" | "Kardio" | "Core & Punggung";
  difficulty: "Pemula" | "Menengah" | "Lanjutan";
  primaryMuscles: string[];
  summary: string;
  preparation: string[];
  steps: string[];
  commonMistakes: string[];
  safetyTips: string[];
  iconType: string;
}

export const EQUIPMENT_CATEGORIES = [
  "Semua",
  "Free Weights",
  "Mesin Tubuh Atas",
  "Mesin Tubuh Bawah",
  "Kabel & Rak",
  "Kardio",
  "Core & Punggung",
] as const;

export const EQUIPMENT_TUTORIALS: EquipmentTutorial[] = [
  {
    id: "dumbbell",
    name: "Dumbbell",
    category: "Free Weights",
    difficulty: "Pemula",
    primaryMuscles: ["Dada", "Bahu", "Punggung", "Lengan", "Kaki"],
    summary: "Beban bebas serbaguna untuk melatih kekuatan dan simetri berbagai kelompok otot.",
    preparation: [
      "Pilih dumbbell yang dapat dikendalikan tanpa mengayun atau kehilangan postur tubuh.",
      "Periksa pegangan dumbbell dan pastikan area sekitar tidak licin atau terhalang benda lain.",
      "Tentukan gerakan latihan yang akan dilakukan dan pelajari teknik dasarnya terlebih dahulu."
    ],
    steps: [
      "Pegang dumbbell dengan genggaman mantap dan seimbang.",
      "Atur posisi tubuh sesuai gerakan dengan kaki dan inti tubuh (core) stabil.",
      "Gerakkan beban secara terkendali; hindari mengandalkan momentum ayunan.",
      "Turunkan beban secara perlahan ke posisi awal dengan kendali penuh otot.",
      "Letakkan dumbbell kembali di lantai atau rak alat dengan aman setelah set selesai."
    ],
    commonMistakes: [
      "Memilih beban terlalu berat yang merusak postur.",
      "Mengayunkan tubuh untuk mengangkat beban (momentum).",
      "Menjatuhkan dumbbell sembarangan ke lantai."
    ],
    safetyTips: [
      "Mulai selalu dari beban ringan untuk pemanasan.",
      "Jangan mencoba gerakan rumit tanpa memahami jalurnya terlebih dahulu."
    ],
    iconType: "dumbbell"
  },
  {
    id: "barbell",
    name: "Barbell",
    category: "Free Weights",
    difficulty: "Menengah",
    primaryMuscles: ["Kaki (Squat)", "Punggung (Deadlift)", "Dada (Bench Press)", "Pundak"],
    summary: "Batang beban panjang untuk gerakan majemuk utama seperti squat, deadlift, bench press, dan barbell row.",
    preparation: [
      "Periksa kelurusan batang barbell, kebersihan piringan beban, dan ketersediaan sepasang collar/pengunci.",
      "Pastikan piringan beban terpasang rata di kedua sisi dan terkunci rapat.",
      "Untuk latihan dari rack, atur ketinggian penyangga (J-hooks) dan safety arms sesuai postur tubuh."
    ],
    steps: [
      "Pelajari teknik dan posisi tumpuan sebelum mengangkat beban.",
      "Pegang batang barbell dengan jarak tangan yang presisi dan seimbang.",
      "Stabilkan pijakan kaki dan kencangkan otot perut sebelum mengeluarkan bar dari rack.",
      "Lakukan repetisi gerakan dengan rentang gerak penuh (full ROM) yang aman.",
      "Kembalikan barbell ke rack atau lantai secara terkendali hingga kedua kait terpasang sempurna."
    ],
    commonMistakes: [
      "Tidak memasang klip pengunci (collar) piringan beban.",
      "Menambah beban berat sebelum teknik dan postur konsisten.",
      "Meletakkan barbell kembali ke rack secara tergesa-gesa."
    ],
    safetyTips: [
      "Gunakan spotter pendamping saat melakukan bench press dengan beban berat.",
      "Selalu pastikan palang pengaman (safety bars) terpasang di posisi yang tepat."
    ],
    iconType: "barbell"
  },
  {
    id: "bench",
    name: "Bench / Bangku Latihan",
    category: "Kabel & Rak",
    difficulty: "Pemula",
    primaryMuscles: ["Penyangga Tubuh (Dada, Bahu, Lengan)"],
    summary: "Bangku stabil penyangga tubuh untuk variasi latihan dumbbell, barbell, dan latihan beban tubuh.",
    preparation: [
      "Pastikan rangka bangku tidak bergoyang dan bantalan permukaannya bersih tidak licin.",
      "Jika bangku tipe adjustable, pastikan pin pengunci sudut terkunci dengan kokoh.",
      "Tempatkan bangku pada lantai rata dengan ruang gerak yang cukup luas di sekelilingnya."
    ],
    steps: [
      "Atur sudut sandaran bangku sesuai target latihan: flat (datar), incline (naik), atau decline (turun).",
      "Posisikan tubuh dengan punggung dan kepala bersandar stabil.",
      "Jaga telapak kaki menapak kokoh di lantai sebagai tumpuan keseimbangan.",
      "Selesaikan set latihan tanpa membenturkan dumbbell atau bar ke rangka bangku.",
      "Duduk dan turun dari bangku secara hati-hati setelah selesai."
    ],
    commonMistakes: [
      "Pin pengatur sudut sandaran belum terkunci sempurna saat digunakan.",
      "Menaruh dumbbell berbeban berat langsung di tepi bantalan busa.",
      "Memaksakan sudut kemiringan yang menekan sendi bahu."
    ],
    safetyTips: [
      "Selalu uji kestabilan bangku dengan tangan sebelum berbaring menahan beban."
    ],
    iconType: "bench"
  },
  {
    id: "squat-rack",
    name: "Squat Rack / Power Rack",
    category: "Kabel & Rak",
    difficulty: "Pemula",
    primaryMuscles: ["Alat Bantu Penyangga Barbell Beban Bebas"],
    summary: "Rangka besi kokoh dengan tiang penyangga dan palang pengaman untuk latihan squat dan overhead press.",
    preparation: [
      "Periksa kestabilan rack dan kondisi fisik pin pengait (J-hooks).",
      "Atur J-hooks setinggi dada bagian atas agar mudah melepas dan meletakkan barbell.",
      "Atur safety bars sedikit di bawah titik terendah jongkok squat Anda.",
      "Pastikan area pijakan kaki di dalam cage bersih dari piringan beban tercecer."
    ],
    steps: [
      "Tempatkan barbell pada J-hooks dengan rata di tengah-tengah.",
      "Posisikan tubuh di bawah bar, ambil napas dalam, kencangkan punggung, lalu angkat bar dari kait.",
      "Mundur 1-2 langkah terkendali, lakukan gerakan squat secara konsisten.",
      "Setelah set selesai, maju perlahan hingga bar menyentuh kedua tiang vertikal rack.",
      "Turunkan bar ke dalam J-hooks hingga bertengger aman sebelum melepas genggaman."
    ],
    commonMistakes: [
      "Lupa memasang atau menyetel safety bars.",
      "Meletakkan J-hooks terlalu tinggi sehingga harus berjinjit saat melepas bar.",
      "Mencoba melangkah terlalu jauh ke belakang dari tiang pengaman."
    ],
    safetyTips: [
      "Jangan pernah berlatih squat beban maksimal tanpa palang pengaman terpasang.",
      "Minta bantuan instruktur gym jika baru pertama kali menyetel power rack."
    ],
    iconType: "rack"
  },
  {
    id: "smith-machine",
    name: "Smith Machine",
    category: "Kabel & Rak",
    difficulty: "Pemula",
    primaryMuscles: ["Dada", "Kaki", "Bahu", "Punggung"],
    summary: "Mesin barbell dengan batang pada jalur rel pemandu vertikal/diagonal tetap dan kait pengunci otomatis.",
    preparation: [
      "Periksa kelancaran luncuran rel, kebersihan batang, dan mekanisme pengait putar.",
      "Atur safety stop pins (penahan bawah) pada rel sesuai batas terendah gerakan latihan Anda.",
      "Coba gerakkan batang kosong terlebih dahulu untuk memahami sudut luncuran dan cara memutar kait."
    ],
    steps: [
      "Posisikan tubuh tepat sejajar dengan jalur batang rel sesuai jenis latihan.",
      "Pegang batang dengan mantap dan putar pergelangan tangan untuk membuka kaitan dari gerigi rel.",
      "Gerakkan beban secara perlahan mengikuti jalur tetap; jangan paksakan posisi sendi yang janggal.",
      "Kunci kembali batang ke salah satu gerigi rel dengan memutar pergelangan tangan sebelum melepas pegangan."
    ],
    commonMistakes: [
      "Menganggap jalur rel selalu alami bagi semua postur tubuh tanpa penyesuaian posisi kaki.",
      "Tidak mengetahui arah putaran pergelangan tangan untuk mengaitkan pengaman darurat.",
      "Menyetel safety stops terlalu rendah atau tidak menyetelnya sama sekali."
    ],
    safetyTips: [
      "Minta demonstrasi staf gym untuk mekanisme rotasi pengait model mesin yang ada.",
      "Pastikan kedua sisi pengait telah mengunci gerigi rel sebelum Anda melepas bar."
    ],
    iconType: "smith"
  },
  {
    id: "cable-machine",
    name: "Cable Machine / Cable Crossover",
    category: "Kabel & Rak",
    difficulty: "Pemula",
    primaryMuscles: ["Dada", "Punggung", "Bahu", "Lengan (Biceps/Triceps)"],
    summary: "Stasiun katrol kabel ganda dengan ketinggian pulley yang dapat diatur untuk arah tarikan serbaguna.",
    preparation: [
      "Periksa kondisi kabel baja pelapis, roda pulley, pin tumpukan beban, dan carabiner pengait.",
      "Tarik pin pegas untuk mengatur ketinggian katrol pulley sesuai variasi gerakan.",
      "Pasang attachment handle yang tepat (D-handle, rope, straight bar, atau ankle strap).",
      "Pilih beban awal yang ringan dengan memasukkan pin beban secara penuh."
    ],
    steps: [
      "Posisikan tubuh tegak dan stabil dengan satu kaki di depan sebagai tumpuan kokoh.",
      "Genggam handle dan posisikan tubuh pada titik awal tarikan dengan kabel tegang.",
      "Tarik atau dorong handle secara terkendali mengikuti lintasan gerakan yang diinginkan.",
      "Kembalikan handle ke posisi semula secara perlahan; jangan biarkan tumpukan lempeng beban membanting.",
      "Lepaskan pegangan hanya saat lempeng beban telah bertumpu tenang di tumpukannya."
    ],
    commonMistakes: [
      "Melakukan gerakan dengan sentakan atau mengayunkan pinggang.",
      "Membiarkan lempengan beban membentur keras antar repetisi.",
      "Tetap menggunakan mesin meskipun kabel terlihat terkelupas atau pulley berderit."
    ],
    safetyTips: [
      "Segera laporkan ke pengelola gym jika menemukan kabel kawat berjumbai atau pulley yang macet.",
      "Pastikan pengait carabiner tertutup rapat sebelum menarik beban."
    ],
    iconType: "cable"
  },
  {
    id: "lat-pulldown",
    name: "Lat Pulldown Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Latissimus Dorsi (Sayap Punggung)", "Biceps", "Punggung Atas"],
    summary: "Mesin tarikan vertikal dari atas untuk membangun otot punggung lebar berbentuk V-taper yang proporsional.",
    preparation: [
      "Atur ketinggian bantalan penahan paha agar paha terjepit pas dan lutut tidak terangkat saat menarik beban.",
      "Pilih beban latihan yang dapat dikendalikan dengan pin tertancap rapi.",
      "Pegang wide-grip bar sedikit lebih lebar dari bahu dengan telapak tangan menghadap ke depan."
    ],
    steps: [
      "Duduk tegak, masukkan paha ke bawah bantalan penahan, dada dibuka sedikit membusung ke atas.",
      "Mulai dengan lengan terentang lurus ke atas dan bahu terkontrol.",
      "Tarik bar ke bawah menuju dada bagian atas sambil mengarahkan siku ke bawah dan belakang.",
      "Tahan kontraksi punggung sejenak di dada atas tanpa membanting badan ke belakang.",
      "Kembalikan bar ke atas secara perlahan hingga otot sayap terasa terenggang nyaman."
    ],
    commonMistakes: [
      "Mengayunkan badan jauh ke belakang untuk menggunakan momentum.",
      "Menarik bar ke belakang leher (berisiko cedera leher dan sendi bahu).",
      "Membiarkan beban kembali dengan hentakan liar."
    ],
    safetyTips: [
      "Selalu tarik bar ke arah dada depan (sternum), hindari menarik ke belakang kepala.",
      "Kurangi beban jika Anda harus memiringkan tubuh lebih dari 30 derajat ke belakang."
    ],
    iconType: "lat"
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Punggung Tengah (Rhomboids)", "Latissimus Dorsi", "Trapezius", "Biceps"],
    summary: "Mesin tarikan horizontal duduk untuk menebalkan otot punggung tengah dan memperbaiki postur tubuh tegap.",
    preparation: [
      "Pasang V-grip handle atau close-grip bar pada pengait kabel bawah.",
      "Duduk pada bangku dan letakkan kedua telapak kaki pada pijakan dengan lutut sedikit ditekuk.",
      "Pilih beban ringan untuk penguasaan kontraksi otot punggung."
    ],
    steps: [
      "Duduk tegak dengan tulang belakang lurus netral, bahu rileks ke bawah.",
      "Tarik pegangan ke arah pusar / perut bagian bawah sambil membusungkan dada.",
      "Rapatkan kedua belikat punggung saat pegangan mendekati tubuh.",
      "Kembalikan pegangan ke depan secara perlahan tanpa membiarkan punggung membungkuk berlebihan.",
      "Jaga kestabilan tubuh dan bernapas teratur pada setiap repetisi."
    ],
    commonMistakes: [
      "Membulatkan punggung bawah (slouching) saat menjangkau ke depan.",
      "Mengayunkan tubuh ke depan-belakang secara berlebihan seperti mendayung perahu santai.",
      "Mengangkat bahu ke arah telinga (shrugging) saat menarik."
    ],
    safetyTips: [
      "Jaga lutut tetap sedikit ditekuk, jangan pernah mengunci lutut lurus saat menahan tumpuan kaki.",
      "Pertahankan punggung netral sepanjang set latihan."
    ],
    iconType: "row"
  },
  {
    id: "chest-press",
    name: "Chest Press Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Pectoralis Major (Dada)", "Triceps", "Bahu Depan (Anterior Deltoid)"],
    summary: "Mesin dorong duduk untuk membangun massa dan kekuatan otot dada dengan jalur gerakan yang stabil dan aman.",
    preparation: [
      "Atur ketinggian kursi sehingga handle pegangan berada sejajar dengan bagian tengah dada.",
      "Atur sandaran punggung sehingga jangkauan pegangan nyaman tanpa menarik bahu terlalu ke belakang.",
      "Pilih beban yang sesuai dengan kemampuan pada weight stack."
    ],
    steps: [
      "Duduk dengan punggung dan kepala menempel rapat pada sandaran, kaki menapak di lantai.",
      "Genggam handle dengan pergelangan tangan lurus dan siku ditekuk sekitar 90 derajat.",
      "Dorong handle ke depan menggunakan kontraksi otot dada secara terkendali.",
      "Hindari mengunci sendi siku secara kaku di ujung dorongan depan.",
      "Kembalikan handle perlahan ke posisi awal sampai dada terasa meregang nyaman."
    ],
    commonMistakes: [
      "Posisi kursi terlalu tinggi atau terlalu rendah sehingga membebani sendi bahu.",
      "Mendorong dengan mengangkat punggung menjauh dari sandaran (arching leher).",
      "Memantulkan lempeng beban di titik akhir gerakan."
    ],
    safetyTips: [
      "Pertahankan bahu tetap menempel pada sandaran, jangan biarkan bahu terlempar maju ke depan."
    ],
    iconType: "chest"
  },
  {
    id: "pec-deck",
    name: "Pec Deck / Chest Fly Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Pectoralis Major (Isolasi Dada Bagian Tengah)"],
    summary: "Mesin isolasi dada dengan gerakan aduksi horizontal merapatkan kedua lengan ke depan dada.",
    preparation: [
      "Atur ketinggian kursi agar pegangan lengan sejajar dengan tinggi bahu atau dada atas.",
      "Sesuaikan tuas posisi awal lengan agar sendi bahu tidak tertarik terlalu jauh ke belakang.",
      "Pilih beban ringan untuk memfokuskan kontraksi 'squeeze' dada."
    ],
    steps: [
      "Duduk tegak dengan punggung menempel pada sandaran, kepala tegak rileks.",
      "Genggam pegangan atau tempatkan lengan bawah pada bantalan sesuai tipe mesin.",
      "Satukan kedua lengan ke depan dada secara perlahan layaknya memeluk pohon besar.",
      "Tahan kontraksi puncak dada selama 1 detik di posisi depan.",
      "Buka kembali lengan secara perlahan ke posisi awal dengan kendali penuh otot."
    ],
    commonMistakes: [
      "Membuka lengan terlalu lebar ke belakang hingga menyiksa kapsul sendi bahu.",
      "Menggunakan beban berlebih yang memaksa leher atau tubuh bergoyang.",
      "Menekuk pergelangan tangan saat merapatkan handle."
    ],
    safetyTips: [
      "Jika timbul rasa ngilu di sendi bahu depan, perpendek jangkauan buka lengan ke belakang."
    ],
    iconType: "fly"
  },
  {
    id: "shoulder-press",
    name: "Shoulder Press Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Deltoid (Bahu Tengah & Depan)", "Triceps", "Trapezius Atas"],
    summary: "Mesin pendorong vertikal duduk untuk membentuk kekuatan dan volume otot bahu secara aman dan seimbang.",
    preparation: [
      "Atur ketinggian kursi sehingga handle berada kira-kira sejajar dengan bagian atas bahu.",
      "Punggung dan pinggul menempel rapat pada sandaran kursi yang tegak.",
      "Pilih beban ringan untuk pengenalan jalur dorongan atas."
    ],
    steps: [
      "Duduk kokoh dengan telapak kaki menapak di lantai, genggam handle dengan telapak tangan menghadap depan atau netral.",
      "Dorong handle ke atas kepala secara terkendali menggunakan otot bahu.",
      "Hindari mengunci siku secara keras di puncak gerakan.",
      "Turunkan handle kembali ke bawah perlahan hingga setinggi telinga.",
      "Pertahankan badan agar tulang belakang tidak melengkung berlebihan."
    ],
    commonMistakes: [
      "Melengkungkan pinggang bawah secara ekstrem ke depan saat beban terasa berat.",
      "Mengangkat kedua bahu mendekati daun telinga (kebiasaan shrugging).",
      "Menjatuhkan beban secara cepat tanpa tahanan eksentrik."
    ],
    safetyTips: [
      "Gunakan rentang gerak yang bebas dari rasa nyeri sendi bahu.",
      "Bila bahu kaku, pilih grip netral (telapak tangan saling berhadapan) jika tersedia di mesin."
    ],
    iconType: "shoulder"
  },
  {
    id: "leg-press",
    name: "Leg Press Machine",
    category: "Mesin Tubuh Bawah",
    difficulty: "Pemula",
    primaryMuscles: ["Quadriceps (Paha Depan)", "Gluteus (Bokong)", "Hamstring"],
    summary: "Mesin pendorong platform 45 derajat untuk melatih kekuatan otot kaki bagian bawah tanpa membebani tulang belakang.",
    preparation: [
      "Pelajari tuas pembuka dan pengunci pengaman (safety locks) di samping tempat duduk.",
      "Atur sudut kemiringan sandaran kursi agar pinggul dan punggung bawah menempel rapat tanpa terangkat.",
      "Tempatkan kedua telapak kaki selebar bahu di tengah platform dorong.",
      "Mulai dengan beban piringan ringan untuk pemanasan sendi lutut."
    ],
    steps: [
      "Dorong platform sedikit ke depan untuk melepaskan tuas pengaman ke arah luar samping.",
      "Turunkan platform perlahan ke arah dada dengan menekuk lutut hingga sudut sekitar 90 derajat.",
      "Pastikan pantat dan pinggul bawah tidak terangkat dari bantalan duduk.",
      "Dorong platform kembali ke atas menggunakan tumpuan tumit dan telapak kaki.",
      "JANGAN PERNAH mengunci lutut (hyper-extend) di puncak dorongan; pertahankan sedikit tekukan lembut.",
      "Tarik kembali tuas pengaman ke posisi mengunci sebelum menurunkan kaki."
    ],
    commonMistakes: [
      "Mengunci lutut lurus kaku di ujung dorongan (sangat berbahaya bagi sendi lutut).",
      "Menurunkan platform terlalu dalam hingga pantat terangkat membulat (buttwink ekstrem).",
      "Meletakkan tangan di atas lutut saat mendorong."
    ],
    safetyTips: [
      "PERHATIAN KRUSIAL: Jaga lutut selalu sedikit ditekuk di puncak dorongan, jangan pernah mengunci sendi lutut!",
      "Pastikan tuas pengaman terkunci erat sebelum Anda berdiri dari kursi."
    ],
    iconType: "legpress"
  },
  {
    id: "leg-extension",
    name: "Leg Extension Machine",
    category: "Mesin Tubuh Bawah",
    difficulty: "Pemula",
    primaryMuscles: ["Quadriceps (Isolasi Paha Depan)"],
    summary: "Mesin isolasi lutut untuk mempertegas dan memperkuat keempat kepala otot paha depan (quads).",
    preparation: [
      "Atur sandaran punggung agar lipatan belakang lutut berada pas di tepi depan bantalan kursi.",
      "Atur posisi sumbu putar poros mesin sejajar dengan sendi lutut Anda.",
      "Atur bantalan busa silinder agar bertumpu nyaman di tulang kering bagian depan tepat di atas pergelangan kaki."
    ],
    steps: [
      "Duduk rapat, pegang handle samping kursi untuk menjaga panggul tetap menempel di dudukan.",
      "Luruskan kedua lutut ke atas secara terkendali hingga otot paha depan berkontraksi penuh.",
      "Tahan kontraksi selama 1 detik di posisi atas.",
      "Turunkan beban kembali ke bawah secara perlahan dan halus.",
      "Hindari mengayunkan kaki atau membenturkan lempengan beban."
    ],
    commonMistakes: [
      "Sumbu putar mesin tidak sejajar dengan sendi lutut sehingga membebani tempurung lutut (patella).",
      "Mengayunkan kaki dengan cepat menggunakan momentum dari bawah.",
      "Mengangkat pantat dari kursi saat mendorong beban berat."
    ],
    safetyTips: [
      "Jika Anda memiliki riwayat cedera ligamen lutut (ACL/patella), gunakan beban sedang dan hindari hentakan kaku."
    ],
    iconType: "extension"
  },
  {
    id: "leg-curl",
    name: "Seated / Lying Leg Curl Machine",
    category: "Mesin Tubuh Bawah",
    difficulty: "Pemula",
    primaryMuscles: ["Hamstring (Paha Belakang)", "Betis"],
    summary: "Mesin penekuk lutut untuk mengisolasi dan membangun ketahanan otot paha belakang (hamstring).",
    preparation: [
      "Atur sumbu putar poros mesin tepat sejajar dengan sendi lutut Anda.",
      "Posisikan bantalan busa silinder di bagian belakang tumit/urat Achilles tepat di bawah betis.",
      "Pada mesin duduk, kunci bantalan paha atas dengan rapat agar paha tidak terangkat."
    ],
    steps: [
      "Posisikan tubuh sesuai tipe mesin (duduk tegak atau tengkurap rata).",
      "Genggam erat handle samping untuk menstabilkan panggul dan pinggul.",
      "Tekuk lutut sekuat tenaga ke arah belakang bawah untuk menarik bantalan busa.",
      "Rasakan kontraksi kuat pada otot paha belakang di titik puncak tekukan.",
      "Kembalikan bantalan kaki ke posisi lurus awal secara perlahan dan terkontrol."
    ],
    commonMistakes: [
      "Bantalan busa diletakkan terlalu tinggi di betis atau terlalu rendah mengenai sepatu.",
      "Mengangkat pinggul dari bantalan saat melakukan gerakan tekukan.",
      "Menurunkan beban secara jatuh bebas tanpa menahan resistansi."
    ],
    safetyTips: [
      "Pastikan semua pin pengatur terkunci kokoh sebelum memulai repetisi pertama."
    ],
    iconType: "curl"
  },
  {
    id: "calf-raise",
    name: "Calf Raise Machine",
    category: "Mesin Tubuh Bawah",
    difficulty: "Pemula",
    primaryMuscles: ["Gastrocnemius & Soleus (Otot Betis)"],
    summary: "Mesin pengangkat tumit untuk melatih kekuatan tendon Achilles dan membentuk otot betis yang padat.",
    preparation: [
      "Pilih tipe mesin berdiri (standing) atau duduk (seated).",
      "Tempatkan bantalan penahan beban dengan pas di atas bahu (berdiri) atau paha depan (duduk).",
      "Posisikan bantalan bola kaki (ujung depan kaki) di tepi pijakan dengan tumit menggantung bebas."
    ],
    steps: [
      "Mulai dengan tumit diturunkan perlahan ke bawah hingga otot betis terasa terenggang nyaman.",
      "Dorong kuat ujung depan kaki untuk mengangkat tumit setinggi mungkin (plantarflexion).",
      "Tahan kontraksi betis di titik tertinggi selama 1 detik tanpa memantul.",
      "Turunkan kembali tumit ke bawah secara perlahan dan stabil.",
      "Pertahankan tekanan seimbang antara jempol kaki dan jari lainnya."
    ],
    commonMistakes: [
      "Memantulkan tumit secara cepat seperti pegas tanpa kontrol otot.",
      "Mengunci sendi lutut secara kaku atau mengayunkan pinggul.",
      "Hanya melakukan setengah rentang gerak (half reps)."
    ],
    safetyTips: [
      "Mulai dari beban ringan untuk membiasakan peregangan tendon Achilles yang aman."
    ],
    iconType: "calf"
  },
  {
    id: "assisted-pullup",
    name: "Assisted Pull-Up / Dip Machine",
    category: "Kabel & Rak",
    difficulty: "Pemula",
    primaryMuscles: ["Punggung & Biceps (Pull-up)", "Dada, Bahu & Triceps (Dip)"],
    summary: "Mesin bantuan bantalan beban penyeimbang berat badan untuk mempelajari pull-up dan dip yang sempurna.",
    preparation: [
      "CATATAN PENTING: Pada mesin ini, semakin BESAR beban pin yang dipilih, semakin RINGAN gerakan tubuh Anda.",
      "Pilih pin bantuan beban yang memungkinkan Anda melakukan repetisi dengan teknik rapi.",
      "Periksa kondisi bantalan lutut atau platform berdiri dan pijakan kaki tangga."
    ],
    steps: [
      "Naik ke tangga samping, pegang handle pull-up atau bars dip dengan kuat.",
      "Letakkan satu lutut perlahan di atas bantalan bantuan penopang, lalu susul dengan lutut kedua.",
      "Turunkan tubuh secara terkendali hingga lengan meregang lurus.",
      "Tarik tubuh ke atas (pull-up) atau dorong tubuh ke atas (dip) dengan rentang gerak nyaman.",
      "Saat selesai, injak tangga samping terlebih dahulu sebelum melepaskan lutut dari bantalan."
    ],
    commonMistakes: [
      "Salah kaprah mengira pin kecil membuat lebih ringan (kebalikan dari weight stack biasa).",
      "Mengayunkan tubuh atau menendang bantalan penopang.",
      "Turun mendadak dan melompat dari mesin sebelum mekanisme bantuan aman."
    ],
    safetyTips: [
      "Selalu turunkan satu per satu kaki ke pijakan tetap sebelum melepaskan pegangan tangan."
    ],
    iconType: "assisted"
  },
  {
    id: "treadmill",
    name: "Treadmill",
    category: "Kardio",
    difficulty: "Pemula",
    primaryMuscles: ["Sistem Kardiovaskular", "Kaki", "Gluteus", "Ketahanan Tubuh"],
    summary: "Mesin lari dan jalan di tempat dengan pengaturan kecepatan dinamis dan sudut kemiringan incline.",
    preparation: [
      "Periksa karpet sabuk lari (belt) bersih dari air atau benda asing tercecer.",
      "Kenakan sepatu lari yang bertali kencang dan nyaman.",
      "Kenali letak tombol STOP darurat besar dan pasang penjepit klip keselamatan (safety key) ke baju Anda.",
      "Berdirilah di atas rel pijakan samping mesin terlebih dahulu sebelum menyalakan motor."
    ],
    steps: [
      "Tekan tombol START / QUICK START untuk memutar sabuk pada kecepatan terendah (0.8 - 1.5 km/jam).",
      "Langkahkan kaki ke atas belt yang mulai berputar santai, berpegangan pada handrail jika perlu.",
      "Tingkatkan kecepatan (speed) atau sudut tanjakan (incline) secara bertahap sesuai target latihan.",
      "Jaga pandangan lurus ke depan, jangan melihat layar ponsel sambil berlari kencang.",
      "Kurangi kecepatan bertahap (cool down) selama 2-3 menit sebelum menekan tombol STOP."
    ],
    commonMistakes: [
      "Melompat langsung ke atas karpet yang sudah berputar kencang.",
      "Menoleh ke samping atau bermain ponsel saat kecepatan tinggi.",
      "Mengabaikan klip pengaman darurat."
    ],
    safetyTips: [
      "Jangan pernah melompat turun dari treadmill saat karpet sabuk masih berputar cepat.",
      "Bila merasa limbung atau pusing, segera tarik klip pengaman darurat untuk mematikan mesin instan."
    ],
    iconType: "treadmill"
  },
  {
    id: "stationary-bike",
    name: "Stationary Bike / Sepeda Statis",
    category: "Kardio",
    difficulty: "Pemula",
    primaryMuscles: ["Quadriceps", "Hamstring", "Betis", "Kardiovaskular Low-Impact"],
    summary: "Sepeda kayuh statis latihan kardio berdampak rendah (low impact) yang sangat ramah terhadap persendian lutut.",
    preparation: [
      "Atur tinggi jok sadel agar sejajar dengan tulang pinggul saat berdiri di samping sepeda.",
      "Saat duduk dan pedal di titik terendah, lutut Anda harus memiliki sudut tekukan lembut sekitar 10-15 derajat.",
      "Kencangkan tali pengikat pedal (pedal strap) pada kedua sepatu Anda."
    ],
    steps: [
      "Duduk nyaman di sadel dengan punggung tegak atau sedikit condong alami.",
      "Mulai kayuhan santai dengan tingkat resistansi (hambatan) rendah.",
      "Tingkatkan level resistansi secara bertahap sesuai zona detak jantung target.",
      "Pertahankan irama kayuhan (cadence) yang stabil dan halus, tidak terputus-putus.",
      "Kurangi resistansi untuk pendinginan sebelum berhenti mengayuh dan turun."
    ],
    commonMistakes: [
      "Tinggi sadel terlalu rendah sehingga lutut tertekuk tajam saat mengayuh (membebani lutut).",
      "Tinggi sadel terlalu tinggi sehingga pinggul bergoyang ke kiri dan kanan.",
      "Membungkukkan punggung berlebihan saat memegang stang."
    ],
    safetyTips: [
      "Pastikan kenop pengunci tiang sadel telah terkunci rapat sebelum menduduki sepeda."
    ],
    iconType: "bike"
  },
  {
    id: "elliptical",
    name: "Elliptical Trainer",
    category: "Kardio",
    difficulty: "Pemula",
    primaryMuscles: ["Kaki", "Gluteus", "Lengan & Bahu", "Kardio Full-Body"],
    summary: "Mesin kardio tanpa benturan sendi (zero impact) dengan pola langkah meluncur halus menyeluruh.",
    preparation: [
      "Periksa pijakan pedal dan tuas pegangan bergerak dalam keadaan kokoh.",
      "Naik ke mesin sambil memegang handle statis terlebih dahulu untuk keseimbangan.",
      "Mulai dengan pengaturan hambatan resistansi rendah."
    ],
    steps: [
      "Tempatkan kedua telapak kaki rata di tengah pedal pijakan.",
      "Pegang tuas handle bergerak untuk menyelaraskan kayuhan tangan dan ayunan kaki.",
      "Mulai melangkah maju secara terkendali dengan gerakan meluncur ritmis elips.",
      "Tingkatkan kecepatan dan resistansi secara bertahap.",
      "Perlambat gerakan hingga pedal berhenti sepenuhnya sebelum melangkah turun dari mesin."
    ],
    commonMistakes: [
      "Berjinjit di atas pedal sehingga membebani jari kaki dan betis.",
      "Hanya mengandalkan ayunan lengan tanpa mengayuh kaki dengan aktif.",
      "Mencoba melangkah turun saat pedal masih berputar kencang."
    ],
    safetyTips: [
      "Selalu pegang erat handle statis saat hendak naik maupun turun dari mesin."
    ],
    iconType: "elliptical"
  },
  {
    id: "rowing-machine",
    name: "Rowing Machine / Mesin Dayung",
    category: "Kardio",
    difficulty: "Pemula",
    primaryMuscles: ["Kaki (60%)", "Core/Punggung (20%)", "Lengan (20%)"],
    summary: "Mesin dayung ergometer kardio total-body yang memadukan daya dorong kaki, stabilitas core, dan tarikan punggung.",
    preparation: [
      "Atur strap tali pengikat kaki melintang pas di bagian tengah tali sepatu Anda.",
      "Duduk di atas bantalan geser dengan bokong berada di tengah.",
      "Pilih pengaturan damper udara resistansi sedang (level 3 - 5 disarankan untuk pemula)."
    ],
    steps: [
      "Mulai dari posisi CATCH: lutut ditekuk, lengan lurus ke depan memegang handle, punggung tegak condong sedikit ke depan.",
      "Dorong kuat dengan tumit dan kaki (DRIVE) meluruskan lutut terlebih dahulu.",
      "Condongkan badan sedikit ke belakang (sekitar 100 derajat), lalu tarik handle ke arah ulu hati.",
      "Urutan KEMBALI (RECOVERY): luruskan lengan ke depan, condongkan badan ke depan, baru tekuk lutut kembali ke depan.",
      "Ingat formula ritme dayung: KAKI - BADAN - TANGAN, lalu TANGAN - BADAN - KAKI."
    ],
    commonMistakes: [
      "Menarik dengan lengan terlebih dahulu sebelum kaki mendorong (membuang tenaga kaki).",
      "Membungkukkan punggung atas saat menjangkau ke depan.",
      "Menekuk lutut terlalu cepat saat handle belum melewati lutut."
    ],
    safetyTips: [
      "Kuasai urutan ritme dayung perlahan sebelum mencoba mendayung dengan kecepatan tinggi."
    ],
    iconType: "rowing"
  },
  {
    id: "kettlebell",
    name: "Kettlebell",
    category: "Free Weights",
    difficulty: "Menengah",
    primaryMuscles: ["Posterior Chain (Gluteus, Hamstring, Punggung Bawah)", "Core", "Bahu"],
    summary: "Beban besi berbentuk bola cor bertanduk pegangan untuk latihan ledakan tenaga, swing, dan stabilitas fungsional.",
    preparation: [
      "Pilih berat kettlebell yang dapat dikendalikan dengan aman.",
      "Pastikan area sekitar radius ayunan kosong minimal 2 meter tanpa orang atau rintangan.",
      "Pahami pola engsel pinggul (hip hinge) sebelum melakukan gerakan dinamis seperti swing."
    ],
    steps: [
      "Berdiri dengan kaki dibuka sedikit lebih lebar dari bahu, letakkan kettlebell di lantai.",
      "Pegang handle kettlebell dengan kedua tangan, kunci bahu ke belakang dan kencangkan core.",
      "Lakukan gerakan engsel pinggul (dorong pinggul ke belakang dengan lutut sedikit ditekuk).",
      "Untuk kettlebell swing: dorong pinggul eksplosif ke depan untuk mengayunkan beban hingga setinggi dada.",
      "Biarkan beban mengayun kembali di antara kedua paha sambil pinggul menyerap momentum.",
      "Turunkan dan letakkan kettlebell di lantai dengan posisi punggung tetap lurus."
    ],
    commonMistakes: [
      "Melakukan squat bukan hip hinge saat melakukan kettlebell swing.",
      "Mengangkat kettlebell dengan kekuatan bahu dan lengan, bukan dari dorongan pinggul.",
      "Membungkukkan punggung bawah saat mengambil atau meletakkan beban."
    ],
    safetyTips: [
      "Jangan pernah melepaskan genggaman saat kettlebell sedang berayun di udara.",
      "Pelajari teknik hip hinge dari instruktur sebelum mencoba beban berat."
    ],
    iconType: "kettlebell"
  },
  {
    id: "resistance-band",
    name: "Resistance Band",
    category: "Free Weights",
    difficulty: "Pemula",
    primaryMuscles: ["Semua Kelompok Otot (Pemanasan, Mobilitas & Penguatan)"],
    summary: "Pita karet elastis lateks untuk latihan ketahanan progresif, pemanasan sendi, dan rehabilitasi otot.",
    preparation: [
      "Periksa seluruh permukaan karet dari sobekan kecil, retakan, atau bagian yang mulai menipis.",
      "Bila dikaitkan pada tiang atau pintu, pastikan titik jangkar (anchor point) kokoh dan tidak bergerak.",
      "Pilih tingkat elastisitas ketahanan (light, medium, heavy) sesuai gerakan."
    ],
    steps: [
      "Pegang pegangan atau lingkar karet dengan posisi tangan yang mantap.",
      "Atur jarak tubuh untuk menciptakan tegangan awal karet sebelum gerakan dimulai.",
      "Tarik atau regangkan karet secara perlahan dan rasakan ketahanan yang meningkat progresif.",
      "Kembalikan karet ke panjang semula secara perlahan; jangan biarkan karet menyentak kembali.",
      "Lepaskan ketegangan karet sebelum melepaskan pegangan tangan."
    ],
    commonMistakes: [
      "Menggunakan karet yang sudah memiliki sobekan kecil (berisiko putus mendadak).",
      "Melepaskan pegangan saat karet sedang dalam kondisi tegang maksimal.",
      "Mengarahkan lintasan karet ke arah wajah atau mata tanpa pelindung."
    ],
    safetyTips: [
      "Ganti karet segera bila ada retakan mikro untuk menghindari risiko putus mengenai wajah."
    ],
    iconType: "band"
  },
  {
    id: "dip-station",
    name: "Dip Station / Parallel Bars",
    category: "Kabel & Rak",
    difficulty: "Menengah",
    primaryMuscles: ["Triceps", "Dada Bawah (Pectoralis)", "Bahu Depan", "Core"],
    summary: "Palang sejajar ganda untuk latihan menopang dan mendorong berat tubuh sendiri (bodyweight dip).",
    preparation: [
      "Periksa kekokohan tiang palang sejajar dan pastikan pegangan tidak licin dari keringat.",
      "Pastikan lantai di bawah stasiun bebas dari rintangan dumbbell atau matras.",
      "Lakukan pemanasan sendi bahu dan pergelangan tangan terlebih dahulu."
    ],
    steps: [
      "Lompat atau injak pijakan untuk menopang tubuh di atas palang dengan lengan lurus tegak.",
      "Kunci core, tekuk lutut ke belakang jika palang rendah.",
      "Condongkan badan sedikit ke depan (fokus dada) atau tegak lurus (fokus triceps).",
      "Tekuk siku perlahan untuk menurunkan tubuh hingga siku membentuk sudut 90 derajat.",
      "Dorong kembali ke atas menggunakan kekuatan dada dan triceps hingga lengan lurus terkendali.",
      "Turunkan kaki ke lantai secara hati-hati setelah set selesai."
    ],
    commonMistakes: [
      "Turun terlalu dalam melebihi 90 derajat sehingga merusak kapsul sendi bahu.",
      "Mengayunkan kaki atau menendang tubuh ke atas untuk menyelesaikan repetisi.",
      "Membuka siku terlalu lebar ke samping (flare out)."
    ],
    safetyTips: [
      "Gunakan resistance band penopang atau mesin assisted dip bila belum mampu mengangkat berat badan sendiri."
    ],
    iconType: "dip"
  },
  {
    id: "ab-crunch-machine",
    name: "Abdominal Crunch Machine",
    category: "Core & Punggung",
    difficulty: "Pemula",
    primaryMuscles: ["Rectus Abdominis (Otot Perut Sixpack)", "Obliques"],
    summary: "Mesin tekukan torso duduk untuk melatih dan mempertegas otot perut dengan beban terukur.",
    preparation: [
      "Atur ketinggian dudukan agar sumbu rotasi mesin sejajar dengan pusar/pinggang Anda.",
      "Atur bantalan dada atau pegangan tangan agar nyaman menempel pada tubuh.",
      "Pilih beban ringan untuk menghindari tarikan leher."
    ],
    steps: [
      "Duduk dengan punggung bersandar, kunci kedua kaki pada rol penahan kaki bawah.",
      "Pegang handle di samping kepala atau tempelkan dada pada bantalan rol.",
      "Tarik napas, hembuskan sambil menekuk batang tubuh ke depan menggunakan kekuatan otot perut.",
      "Tahan kontraksi perut di titik maksimal tekukan selama 1 detik.",
      "Kembalikan badan ke posisi tegak secara perlahan melawan tahanan beban.",
      "Hindari menarik pegangan menggunakan kekuatan otot lengan."
    ],
    commonMistakes: [
      "Menarik dengan lengan atau membengkokkan leher secara agresif ke bawah.",
      "Menggunakan beban terlalu berat yang memicu kram atau membebani tulang ekor.",
      "Melakukan gerakan dengan mengayun cepat."
    ],
    safetyTips: [
      "Fokuskan pikiran Anda pada kontraksi otot perut, bukan seberapa jauh kepala Anda tertekuk."
    ],
    iconType: "ab"
  },
  {
    id: "back-extension",
    name: "Back Extension Bench / Roman Chair",
    category: "Core & Punggung",
    difficulty: "Pemula",
    primaryMuscles: ["Erector Spinae (Punggung Bawah)", "Gluteus", "Hamstring"],
    summary: "Bangku sudut 45 derajat untuk melatih ekstensi pinggul dan memperkokoh otot punggung bawah.",
    preparation: [
      "Atur ketinggian bantalan paha agar berada tepat di bawah tulang panggul/pinggul Anda.",
      "Pastikan kedua tumit terselip kokoh di bawah bantalan penahan kaki belakang.",
      "Mulailah selalu dengan beban tubuh sendiri tanpa memegang piringan beban."
    ],
    steps: [
      "Posisikan tubuh menghadap ke bawah, silangkan kedua lengan di depan dada.",
      "Turunkan badan ke bawah secara perlahan dari sendi pinggul dengan punggung tetap lurus.",
      "Angkat tubuh kembali ke atas menggunakan kontraksi pantat dan otot paha belakang.",
      "Berhentilah tepat saat tubuh membentuk garis lurus diagonal dari kepala hingga tumit.",
      "JANGAN PERNAH melengkungkan punggung ke belakang melebihi garis lurus (hiperekstensi)."
    ],
    commonMistakes: [
      "Melengkungkan punggung ke atas secara berlebihan (hyper-extending spine).",
      "Mengayunkan badan ke atas dengan kecepatan tinggi.",
      "Langsung memeluk piringan beban berat sebelum menguasai teknik dasar."
    ],
    safetyTips: [
      "Cukup angkat tubuh hingga lurus sejajar dengan kaki, jangan mendongak ke belakang."
    ],
    iconType: "back"
  },
  {
    id: "battle-ropes",
    name: "Battle Ropes",
    category: "Kardio",
    difficulty: "Pemula",
    primaryMuscles: ["Bahu", "Lengan", "Core", "Kardiovaskular Anaerobik"],
    summary: "Sepasang tali tambang berat tambat untuk latihan gelombang interval intensitas tinggi (HIIT).",
    preparation: [
      "Pastikan titik jangkar tali terikat kokoh di tiang atau anchor khusus.",
      "Rentangkan tali dan sisakan sedikit kelonggaran agar gelombang dapat merambat bebas.",
      "Tentukan target durasi interval (misalnya 20 detik aktif, 40 detik istirahat)."
    ],
    steps: [
      "Berdiri dalam posisi atletik: kaki selebar bahu, lutut sedikit ditekuk, dada tegap, core kencang.",
      "Genggam ujung kedua tali dengan mantap.",
      "Gerakkan kedua lengan naik-turun secara bergantian (alternating waves) atau bersamaan (slam).",
      "Pertahankan gelombang tali merambat konsisten hingga menyentuh tiang jangkar.",
      "Bernapaslah secara teratur dan stabil sepanjang interval waktu latihan."
    ],
    commonMistakes: [
      "Menegangkan leher dan bahu hingga mengangkat bahu ke telinga.",
      "Berdiri dengan kaki lurus kaku tanpa tumpuan kuda-kuda atletik.",
      "Menahan napas saat mengayunkan tali kencang."
    ],
    safetyTips: [
      "Mulai dengan durasi 15-20 detik per ronde dan tingkatkan bertahap sesuai stamina."
    ],
    iconType: "rope"
  },
  {
    id: "reverse-fly",
    name: "Reverse Fly / Rear Delt Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Posterior Deltoid (Bahu Belakang)", "Rhomboids", "Trapezius Tengah"],
    summary: "Mesin pembuka lengan belakang untuk menyeimbangkan postur bahu dan mencegah bahu membungkuk.",
    preparation: [
      "Bila menggunakan mesin dua fungsi (Pec Deck & Rear Delt), tarik pin atas untuk mengatur handle ke posisi paling belakang.",
      "Atur ketinggian kursi agar handle berada sejajar dengan tinggi bahu saat duduk menghadap sandaran.",
      "Pilih beban ringan karena otot bahu belakang relatif lebih kecil."
    ],
    steps: [
      "Duduk menghadap ke arah sandaran kursi dengan dada menempel stabil.",
      "Genggam pegangan dengan siku sedikit ditekuk lembut.",
      "Buka kedua lengan ke arah samping belakang secara terkendali menggunakan otot bahu belakang.",
      "Tahan kontraksi sejenak saat lengan sejajar dengan torso samping.",
      "Kembalikan handle ke depan secara perlahan tanpa membiarkan beban saling membentur."
    ],
    commonMistakes: [
      "Mengayunkan punggung atau menjauhkan dada dari sandaran saat menarik beban.",
      "Mengunci siku lurus kaku sepanjang gerakan.",
      "Menggunakan beban terlalu berat sehingga leher tegang."
    ],
    safetyTips: [
      "Fokus pada gerakan busur melebar ke samping, bukan sekadar menarik siku ke belakang."
    ],
    iconType: "reardelt"
  },
  {
    id: "hip-abductor",
    name: "Hip Abductor / Adductor Machine",
    category: "Mesin Tubuh Bawah",
    difficulty: "Pemula",
    primaryMuscles: ["Gluteus Medius (Abductor - Buka Paha)", "Paha Dalam (Adductor - Tutup Paha)"],
    summary: "Mesin pembuka dan penutup paha untuk memperkuat stabilitas panggul dan membentuk kontur pinggul.",
    preparation: [
      "Tentukan mode latihan: bantalan di sisi luar paha (Abductor) atau sisi dalam paha (Adductor).",
      "Tarik pin tuas rentang kaki untuk menyetel lebar bukaan awal yang nyaman bagi sendi panggul.",
      "Pilih beban ringan untuk menjaga kesehatan ligamen panggul."
    ],
    steps: [
      "Duduk tegak dengan punggung menempel pada sandaran, letakkan telapak kaki di pijakan.",
      "Pegang erat handle di samping kursi untuk menjaga postur tubuh stabil.",
      "Untuk ABDUCTOR: buka kedua paha ke arah luar secara perlahan melawan tahanan beban.",
      "Untuk ADDUCTOR: rapatkan kedua paha ke arah dalam secara terkendali.",
      "Tahan kontraksi 1 detik, lalu kembalikan paha perlahan ke posisi awal."
    ],
    commonMistakes: [
      "Menyetel rentang bukaan terlalu lebar hingga sendi selangkangan terasa tertarik nyeri.",
      "Menggunakan momentum menghentak untuk membuka atau menutup paha.",
      "Mengangkat panggul dari kursi saat repetisi berat."
    ],
    safetyTips: [
      "Jangan memaksakan sudut bukaan paha melebihi fleksibilitas alami panggul Anda."
    ],
    iconType: "hip"
  },
  {
    id: "triceps-pushdown",
    name: "Cable Triceps Pushdown",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Triceps Brachii (Ketiga Kepala Otot Triceps)"],
    summary: "Latihan kabel dorongan ke bawah untuk mengisolasi dan membentuk kekuatan lengan bagian belakang.",
    preparation: [
      "Atur katrol kabel pada posisi paling atas.",
      "Pasang aksesori rope (tali) atau straight/V-bar pada pengait kabel.",
      "Pilih beban sedang yang memungkinkan siku tetap terkunci di tempatnya."
    ],
    steps: [
      "Berdiri tegak dengan sedikit condong ke depan, tekuk siku hingga sudut 90 derajat di samping pinggang.",
      "Jepit kedua siku rapat di samping tulang rusuk; jangan biarkan siku maju-mundur.",
      "Dorong handle/tali ke bawah hingga kedua siku lurus sempurna.",
      "Bila menggunakan tali, buka kedua ujung tali ke arah luar di ujung gerakan untuk kontraksi maksimal.",
      "Kembalikan tangan ke atas hingga sudut 90 derajat secara perlahan dan terkontrol."
    ],
    commonMistakes: [
      "Membiarkan kedua siku bergerak maju-mundur mengikuti beban.",
      "Menggunakan beban berlebih sehingga harus menekan beban dengan bahu dan dada.",
      "Melengkungkan pergelangan tangan secara ekstrem."
    ],
    safetyTips: [
      "Pertahankan posisi siku seperti terpaku pada sisi torso Anda sepanjang latihan."
    ],
    iconType: "triceps"
  },
  {
    id: "preacher-curl",
    name: "Preacher Curl Bench / Machine",
    category: "Mesin Tubuh Atas",
    difficulty: "Pemula",
    primaryMuscles: ["Biceps Brachii (Puncak Bisep & Brachialis)"],
    summary: "Bangku penopang miring untuk mengisolasi otot bisep tanpa bantuan momentum ayunan tubuh.",
    preparation: [
      "Atur ketinggian kursi agar ketiak bersandar pas di bagian atas bantalan miring.",
      "Letakkan bagian belakang lengan atas rata di atas permukaan bantalan empuk.",
      "Gunakan EZ-bar atau handle mesin dengan beban ringan terlebih dahulu."
    ],
    steps: [
      "Duduk kokoh dan pegang bar dengan telapak tangan menghadap ke atas.",
      "Tarik beban ke atas menggunakan kekuatan bisep hingga lengan depan tertekuk rapat.",
      "Tahan kontraksi puncak bisep selama 1 detik di posisi atas.",
      "Turunkan beban perlahan ke bawah secara terkontrol.",
      "Berhentilah sesaat sebelum siku terkunci lurus kaku untuk melindungi tendon bisep dari regangan berlebih."
    ],
    commonMistakes: [
      "Mengangkat siku atau ketiak dari bantalan miring saat beban terasa berat.",
      "Meluruskan siku secara kaku dan membentur sendi di posisi bawah (sangat berisiko cedera tendon).",
      "Menjatuhkan beban dengan cepat tanpa tahanan eksentrik."
    ],
    safetyTips: [
      "JANGAN PERNAH meluruskan siku secara penuh hingga hiperekstensi saat menahan beban di bangku preacher."
    ],
    iconType: "preacher"
  }
];
