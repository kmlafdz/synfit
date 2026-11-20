"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Settings, AlertTriangle, Save, X, TrendingUp, RefreshCw, ArrowUpRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, updateDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguageStore } from "@/store/useLanguageStore";
import { translations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { SuccessModal } from "@/components/ui/success-modal";

interface Equipment {
  id: string;
  name: string;
  category: string;
  condition: string;
}

interface Assessment {
  equipmentId: string;
  kerusakan: number;
  pemakaian: number;
  umur: number;
  biaya: number;
  risiko: number;
  deskripsi: string;
}

export default function MaintenancePage() {
  const { language } = useLanguageStore();
  const t = translations[language];
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isWeightsModalOpen, setIsWeightsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: "", message: "" });
  
  const [weights, setWeights] = useState({
    pemakaian: 0.2,
    kerusakan: 0.3,
    umur: 0.2,
    biaya: 0.1,
    risiko: 0.3
  });

  const [criteriaTypes, setCriteriaTypes] = useState<{ [key: string]: 'benefit' | 'cost' }>({
    pemakaian: 'benefit',
    kerusakan: 'benefit',
    umur: 'benefit',
    biaya: 'benefit',
    risiko: 'benefit'
  });

  const [tempWeights, setTempWeights] = useState<{ [key: string]: string }>({
    pemakaian: "0.2",
    kerusakan: "0.3",
    umur: "0.2",
    biaya: "0.1",
    risiko: "0.3"
  });

  const [tempCriteriaTypes, setTempCriteriaTypes] = useState<{ [key: string]: 'benefit' | 'cost' }>({
    pemakaian: 'benefit',
    kerusakan: 'benefit',
    umur: 'benefit',
    biaya: 'benefit',
    risiko: 'benefit'
  });

  const openWeightsModal = () => {
    setTempWeights({
      pemakaian: weights.pemakaian.toString(),
      kerusakan: weights.kerusakan.toString(),
      umur: weights.umur.toString(),
      biaya: weights.biaya.toString(),
      risiko: weights.risiko.toString()
    });
    setTempCriteriaTypes({ ...criteriaTypes });
    setIsWeightsModalOpen(true);
  };

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const tempTotalWeight = Object.values(tempWeights).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "equipment"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Equipment[];
      setEquipmentList(data);
      setAssessments(data.map(eq => ({
        equipmentId: eq.id,
        kerusakan: (eq as any).kerusakan || 0,
        pemakaian: (eq as any).pemakaian || 0,
        umur: (eq as any).umur || 0,
        biaya: (eq as any).biaya || 0,
        risiko: (eq as any).risiko || 0,
        deskripsi: (eq as any).deskripsi || ""
      })));
    }, (error) => {
      console.error("SPK page equipment onSnapshot error:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      const local = localStorage.getItem("spk-config");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.weights) setWeights(parsed.weights);
        if (parsed.criteriaTypes) setCriteriaTypes(parsed.criteriaTypes);
      }
      try {
        const snap = await getDoc(doc(db, "configs", "spk"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.weights) setWeights(data.weights);
          if (data.criteriaTypes) setCriteriaTypes(data.criteriaTypes);
          localStorage.setItem("spk-config", JSON.stringify({
            weights: data.weights,
            criteriaTypes: data.criteriaTypes
          }));
        }
      } catch (e) {
        console.error("Failed to load SPK config:", e);
      }
    };
    loadConfig();
  }, []);

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  const confirmReset = async () => {
    try {
      const batchPromises = equipmentList.map(eq => 
        updateDoc(doc(db, "equipment", eq.id), {
          kerusakan: 0,
          pemakaian: 0,
          umur: 0,
          biaya: 0,
          risiko: 0,
          deskripsi: ""
        })
      );
      await Promise.all(batchPromises);
      setIsResetModalOpen(false);
      setSuccessModal({
        isOpen: true,
        title: language === 'id' ? "Berhasil Reset" : "Reset Successful",
        message: language === 'id' ? "Semua data penilaian SPK telah di-reset ke nilai default." : "All SPK assessment data has been reset to defaults."
      });
    } catch (error) {
      console.error("Failed to reset SPK:", error);
    }
  };

  // Get minimum and maximum values for assessed items (only values > 0)
  const getMinMax = (field: keyof Assessment) => {
    const values = assessments.map(a => a[field] as number).filter(v => v > 0);
    return {
      min: values.length > 0 ? Math.min(...values) : 1,
      max: values.length > 0 ? Math.max(...values) : 1
    };
  };

  const limits = {
    pemakaian: getMinMax('pemakaian'),
    kerusakan: getMinMax('kerusakan'),
    umur: getMinMax('umur'),
    biaya: getMinMax('biaya'),
    risiko: getMinMax('risiko')
  };

  const normalize = (value: number, field: 'pemakaian' | 'kerusakan' | 'umur' | 'biaya' | 'risiko') => {
    if (value === 0) return 0;
    const type = criteriaTypes[field] || 'benefit';
    const { min, max } = limits[field];
    if (type === 'benefit') {
      return value / max;
    } else {
      return min / value;
    }
  };

  const results = assessments.map(a => {
    const eq = equipmentList.find(e => e.id === a.equipmentId);
    const nPemakaian = normalize(a.pemakaian, 'pemakaian');
    const nKerusakan = normalize(a.kerusakan, 'kerusakan');
    const nUmur = normalize(a.umur, 'umur');
    const nBiaya = normalize(a.biaya, 'biaya');
    const nRisiko = normalize(a.risiko, 'risiko');
    const score = (nPemakaian * weights.pemakaian) + (nKerusakan * weights.kerusakan) + (nUmur * weights.umur) + (nBiaya * weights.biaya) + (nRisiko * weights.risiko);
    return { id: a.equipmentId, name: eq?.name || "Unknown", type: eq?.category || "", status: eq?.condition || "", deskripsi: a.deskripsi, score };
  }).sort((a,b) => b.score - a.score);

  const highPriorityCount = results.filter(r => r.score >= 0.8).length;

  const [formLevel, setFormLevel] = useState(1);
  const [formDesc, setFormDesc] = useState("");
  const [formEqId, setFormEqId] = useState("");
  const [formCrit, setFormCrit] = useState("pemakaian");

  useEffect(() => {
    if (equipmentList.length > 0 && !formEqId) {
      setFormEqId(equipmentList[0].id);
    }
  }, [equipmentList, formEqId]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Header />
        <main className="p-4 lg:p-10 flex-1 overflow-x-hidden space-y-10">
          
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tighter heading-font uppercase">{t.spk}</h1>
              <p className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase leading-relaxed">{language === 'id' ? "SISTEM PENENTU PRIORITAS SERVIS ALAT GYM (METODE SAW)" : "EQUIPMENT MAINTENANCE DECISION SYSTEM (SAW)"}</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button onClick={handleReset} className="flex-1 sm:flex-none px-6 py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-500 hover:text-foreground font-black text-[10px] uppercase tracking-widest transition-all"><RefreshCw className="h-4 w-4 inline mr-2" /> RESET</button>
              <button onClick={openWeightsModal} className="flex-1 sm:flex-none px-6 py-4 rounded-2xl bg-gradient-to-br from-[#FF5A2C] to-red-600 hover:brightness-110 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 active:scale-95"><Settings className="h-4 w-4 inline mr-2" /> {t.criteriaWeights}</button>
            </div>
          </motion.div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6 border-2 border-[#FF5A2C]/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-[#FF5A2C]/10 rounded-xl text-[#FF5A2C]"><Save className="h-4 w-4" /></div>
                  <h2 className="text-sm font-black text-foreground heading-font uppercase tracking-wider">{language === 'id' ? 'INPUT KONDISI ALAT' : 'ASSESS EQUIPMENT'}</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">{language === 'id' ? 'PILIH ALAT GYM' : 'SELECT EQUIPMENT'}</label>
                    <select value={formEqId} onChange={(e) => setFormEqId(e.target.value)} className="w-full h-11 bg-black/20 border border-white/5 rounded-xl px-4 text-xs font-bold text-foreground appearance-none">
                      {equipmentList.map(eq => <option key={eq.id} value={eq.id} className="bg-background">{eq.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">{language === 'id' ? 'KRITERIA PENILAIAN' : 'CRITERIA'}</label>
                    <select value={formCrit} onChange={(e) => setFormCrit(e.target.value)} className="w-full h-11 bg-black/20 border border-white/5 rounded-xl px-4 text-xs font-bold text-foreground appearance-none">
                      <option value="pemakaian" className="bg-background">{language === 'id' ? 'FREKUENSI PENGGUNAAN ALAT (C1)' : 'USAGE FREQUENCY (C1)'}</option>
                      <option value="kerusakan" className="bg-background">{language === 'id' ? 'TINGKAT KERUSAKAN / KEAUSAN (C2)' : 'DAMAGE LEVEL (C2)'}</option>
                      <option value="umur" className="bg-background">{language === 'id' ? 'USIA PAKAI ALAT (C3)' : 'EQUIPMENT AGE (C3)'}</option>
                      <option value="biaya" className="bg-background">{language === 'id' ? 'ESTIMASI BIAYA SERVIS (C4)' : 'REPAIR COST (C4)'}</option>
                      <option value="risiko" className="bg-background">{language === 'id' ? 'RISIKO KESELAMATAN MEMBER (C5)' : 'SAFETY RISK (C5)'}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">{language === 'id' ? 'SKALA TINGKAT (1 - 5)' : 'SCALE LEVEL (1 - 5)'}</label>
                    <div className="flex justify-between gap-2">
                      {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setFormLevel(v)} className={`flex-1 h-10 rounded-xl text-[10px] font-black transition-all border ${formLevel === v ? 'bg-[#FF5A2C] text-white border-[#FF5A2C] shadow-lg shadow-orange-500/20' : 'bg-black/20 border-white/5 text-gray-500'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">{language === 'id' ? 'CATATAN KONDISI' : 'CONDITION NOTE'}</label>
                    <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder={language === 'id' ? "Catatan kelayakan atau kendala fisik alat..." : "Note on issues..."} className="w-full h-11 bg-black/20 border border-white/5 rounded-xl px-4 text-xs font-bold text-foreground focus:outline-none focus:border-[#FF5A2C]/50" />
                  </div>
                  <button onClick={async () => {
                    const current = assessments.find(a => a.equipmentId === formEqId);
                    const dataToSave = {
                      kerusakan: current?.kerusakan || 0,
                      pemakaian: current?.pemakaian || 0,
                      umur: current?.umur || 0,
                      biaya: current?.biaya || 0,
                      risiko: current?.risiko || 0,
                      deskripsi: formDesc || (current?.deskripsi || "")
                    };
                    (dataToSave as any)[formCrit] = formLevel;
 
                    try {
                      await updateDoc(doc(db, "equipment", formEqId), dataToSave);
                      setFormDesc("");
                      setSuccessModal({
                        isOpen: true,
                        title: language === 'id' ? "Penilaian Disimpan" : "Assessment Saved",
                        message: language === 'id' ? "Data kondisi alat gym telah berhasil diperbarui." : "Equipment condition assessment has been successfully updated."
                      });
                    } catch (error) {
                      console.error("Failed to update matrix:", error);
                    }
                  }} className="w-full h-12 bg-[#FF5A2C] text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl shadow-orange-500/20 active:scale-95 transition-all mt-4">{language === 'id' ? 'SIMPAN PENILAIAN' : 'SAVE ASSESSMENT'}</button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <StatCard label={t.highPriority} value={highPriorityCount} icon={AlertTriangle} color="orange" sub={language === 'id' ? "Perlu Servis" : "Needs Service"} />
                <StatCard label={t.assessed} value={results.length} icon={Wrench} color="blue" sub={language === 'id' ? "Sudah Dinilai" : "Assessed"} />
                <StatCard label={t.inventory} value={equipmentList.length} icon={TrendingUp} color="teal" sub={language === 'id' ? "Total Alat" : "Total Units"} />
              </div>

              <div className="glass-card flex flex-col shadow-2xl">
                <div className="p-6 lg:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{t.assessmentMatrix}</h2>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{language === 'id' ? "Daftar Penilaian Aset" : "Asset Assessment List"}</p>
                  </div>
                  <div className="text-[9px] font-black text-orange-500 bg-orange-500/10 px-4 py-2 rounded-xl border border-orange-500/20 uppercase tracking-widest">Live Updates</div>
                </div>
                
                <div className="p-4 lg:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assessments.filter(a => a.kerusakan > 0 || a.pemakaian > 0 || a.umur > 0 || a.biaya > 0 || a.risiko > 0).map(assess => {
                      const eq = equipmentList.find(e => e.id === assess.equipmentId);
                      if (!eq) return null;
                      return (
                        <motion.div layout key={assess.equipmentId} className="glass-dark border border-white/5 rounded-2xl p-5 group hover:border-[#FF5A2C]/30 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-sm font-black text-foreground uppercase tracking-wide heading-font">{eq.name}</h3>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{eq.category}</p>
                            </div>
                            <button onClick={async () => {
                              try {
                                await updateDoc(doc(db, "equipment", eq.id), {
                                  kerusakan: 0,
                                  pemakaian: 0,
                                  umur: 0,
                                  biaya: 0,
                                  risiko: 0,
                                  deskripsi: ""
                                });
                              } catch (error) {
                                console.error("Failed to clear assessment:", error);
                              }
                            }} className="p-2 text-gray-600 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                              { label: 'C1: PAKAI', val: assess.pemakaian },
                              { label: 'C2: RUSAK', val: assess.kerusakan },
                              { label: 'C3: USIA', val: assess.umur },
                              { label: 'C4: BIAYA', val: assess.biaya },
                              { label: 'C5: RESIKO', val: assess.risiko },
                            ].map(c => (
                              <div key={c.label} className="bg-black/20 rounded-xl p-2.5 text-center border border-white/5">
                                <p className="text-[8px] font-black text-gray-600 mb-1 tracking-tighter">{c.label}</p>
                                <p className={`text-xs font-black ${c.val >= 4 ? 'text-red-500' : c.val >= 3 ? 'text-orange-500' : 'text-foreground'}`}>Lvl {c.val}</p>
                              </div>
                            ))}
                          </div>
                          
                          {assess.deskripsi && (
                            <div className="bg-black/10 rounded-xl px-4 py-3 border-l-2 border-[#FF5A2C]">
                              <p className="text-[10px] font-bold text-gray-400 italic line-clamp-2">"{assess.deskripsi}"</p>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {assessments.filter(a => a.kerusakan > 0 || a.pemakaian > 0 || a.umur > 0 || a.biaya > 0 || a.risiko > 0).length === 0 && (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center gap-4 opacity-30">
                        <Wrench className="h-10 w-10 text-gray-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">{language === 'id' ? "BELUM ADA DATA" : "NO DATA YET"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
             <div className="glass-card p-8 flex flex-col gap-8">
                <div>
                  <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{t.priorityRanking}</h2>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{language === 'id' ? "Kalkulasi metode SAW" : "SAW Method calculation"}</p>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={results.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" stroke="#555" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '16px', fontSize: '10px', fontWeight: '900' }} />
                      <Bar dataKey="score" fill="#FF5A2C" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="glass-card p-8 flex flex-col gap-8">
                <div>
                   <h2 className="text-xl font-black text-foreground heading-font uppercase tracking-tight">{language === 'id' ? "Aset Berisiko Tinggi" : "High Risk Assets"}</h2>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{language === 'id' ? "Tindakan segera diperlukan" : "Immediate action required"}</p>
                </div>
                <div className="space-y-4">
                   {results.slice(0, 5).map((res, i) => (
                     <div key={res.id} className="flex items-center justify-between p-4 rounded-2xl glass border border-white/5 group">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${i < 2 ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white/5 text-gray-500'}`}>{i + 1}</div>
                          <div>
                            <h3 className="text-xs font-black text-foreground uppercase tracking-wide">{res.name}</h3>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{res.type} • Score: {res.score.toFixed(3)}</p>
                          </div>
                       </div>
                       <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${res.score >= 0.8 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                          {res.score >= 0.8 ? (language === 'id' ? 'KRITIS' : 'CRITICAL') : (language === 'id' ? 'PENTING' : 'URGENT')}
                       </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isWeightsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="w-full max-w-md glass-card max-h-[90vh] flex flex-col p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-2xl font-black text-foreground heading-font uppercase tracking-tight">{t.criteriaWeights}</h2>
                <button onClick={() => setIsWeightsModalOpen(false)} className="p-2 text-gray-500 hover:text-foreground"><X className="h-6 w-6" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-6 custom-scrollbar">
                {Object.entries(tempWeights).map(([key, value]) => {
                  const labelMap: any = {
                    pemakaian: language === 'id' ? 'C1: FREKUENSI PENGGUNAAN ALAT' : 'C1: EQUIPMENT USAGE FREQUENCY',
                    kerusakan: language === 'id' ? 'C2: TINGKAT KERUSAKAN' : 'C2: DAMAGE LEVEL',
                    umur: language === 'id' ? 'C3: USIA ALAT' : 'C3: EQUIPMENT AGE',
                    biaya: language === 'id' ? 'C4: BIAYA PERBAIKAN' : 'C4: REPAIR COST',
                    risiko: language === 'id' ? 'C5: RESIKO KESELAMATAN PENGGUNA' : 'C5: USER SAFETY RISK'
                  };
                  return (
                    <div key={key} className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                      <p className="text-[10px] font-black text-[#FF5A2C] uppercase tracking-widest text-left">{labelMap[key] || key}</p>
                      <div className="flex gap-4 items-center justify-between">
                        <div className="flex flex-col text-left space-y-1">
                          <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider">{language === 'id' ? 'JENIS' : 'TYPE'}</span>
                          <select 
                            value={tempCriteriaTypes[key] || 'benefit'} 
                            onChange={(e) => setTempCriteriaTypes(prev => ({ ...prev, [key]: e.target.value as 'benefit' | 'cost' }))}
                            className="bg-black/40 border border-white/5 rounded-lg text-[10px] font-black text-foreground uppercase px-2 py-1 select-none focus:outline-none"
                          >
                            <option value="benefit" className="bg-[#0c0d12]">Benefit</option>
                            <option value="cost" className="bg-[#0c0d12]">Cost</option>
                          </select>
                        </div>
                        <div className="flex flex-col text-right space-y-1">
                          <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider">{language === 'id' ? 'BOBOT' : 'WEIGHT'}</span>
                          <input 
                            type="text" 
                            inputMode="decimal"
                            className="w-16 bg-black/40 border border-white/5 rounded-lg text-right font-black text-foreground focus:outline-none text-[10px] px-2 py-1 shrink-0" 
                            value={value} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                setTempWeights(prev => ({ ...prev, [key]: val }));
                              }
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Weight:</span>
                  <span className={`text-sm font-black ${Math.abs(tempTotalWeight - 1) < 0.01 ? 'text-teal-500' : 'text-red-500'}`}>{tempTotalWeight.toFixed(2)} / 1.00</span>
                </div>
                <Button onClick={async () => {
                  const parsedWeights = {
                    pemakaian: parseFloat(tempWeights.pemakaian) || 0,
                    kerusakan: parseFloat(tempWeights.kerusakan) || 0,
                    umur: parseFloat(tempWeights.umur) || 0,
                    biaya: parseFloat(tempWeights.biaya) || 0,
                    risiko: parseFloat(tempWeights.risiko) || 0
                  };
                  
                  setWeights(parsedWeights);
                  setCriteriaTypes(tempCriteriaTypes);
                  
                  localStorage.setItem("spk-config", JSON.stringify({ 
                    weights: parsedWeights, 
                    criteriaTypes: tempCriteriaTypes 
                  }));
                  
                  try {
                    await setDoc(doc(db, "configs", "spk"), { 
                      weights: parsedWeights, 
                      criteriaTypes: tempCriteriaTypes 
                    }, { merge: true });
                  } catch (e) {
                    console.error("Failed to save SPK config:", e);
                  }
                  
                  setIsWeightsModalOpen(false);
                  setSuccessModal({
                    isOpen: true,
                    title: language === 'id' ? "Bobot Disimpan" : "Weights Saved",
                    message: language === 'id' ? "Konfigurasi kriteria SPK telah diperbarui." : "SPK criteria configuration has been updated."
                  });
                }} className="w-full h-14 bg-[#FF5A2C] text-white font-black uppercase rounded-2xl shadow-xl shadow-orange-500/20 active:scale-95">{language === 'id' ? "SIMPAN KONFIGURASI" : "SAVE CONFIGURATION"}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <DeleteConfirmModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmReset}
        title={language === 'id' ? "Konfirmasi Reset" : "Confirm Reset"}
        message={language === 'id' ? "Hapus semua data penilaian aset ini?" : "Clear all asset assessment data?"}
        confirmText={language === 'id' ? "Ya, Reset" : "Yes, Reset"}
      />

      <SuccessModal 
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  const colors: any = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    teal: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    orange: "bg-[#FF5A2C]/10 text-[#FF5A2C] border-[#FF5A2C]/20"
  };

  return (
    <motion.div whileHover={{ y: -5 }} className="glass-card p-8 relative group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xs font-black text-gray-500 tracking-[0.3em] uppercase mb-1.5">{label}</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest ${colors[color]}`}>
            {sub}
          </div>
        </div>
        <div className={`p-3 rounded-2xl border ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-4xl font-black text-foreground heading-font tracking-tighter">{value}</p>
        <ArrowUpRight className="h-5 w-5 text-gray-700 group-hover:text-foreground transition-colors" />
      </div>
    </motion.div>
  );
}
