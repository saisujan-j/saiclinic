// --- 1. PRODUCTION ENVIRONMENT & FIREBASE INITIALIZATION ---
const IS_PRODUCTION = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
if (IS_PRODUCTION) {
  console.debug = () => {};
}

const firebaseConfig = {
  apiKey: "AIzaSyCIjKDb915_lA1WKybiL7sX9_9Kr6cFxJU",
  authDomain: "skin-5b77d.firebaseapp.com",
  projectId: "skin-5b77d",
  storageBucket: "skin-5b77d.firebasestorage.app",
  messagingSenderId: "62061409550",
  appId: "1:62061409550:web:51781436abc0501588535f"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. XSS SANITIZATION & INPUT VALIDATION UTILITIES ---
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeText(str, maxLength = 200) {
  if (!str) return "";
  return String(str)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeImageSrc(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  if (/^https:\/\/[a-zA-Z0-9.-]+/.test(trimmed)) {
    return trimmed;
  }
  return "";
}

function validateImageFile(file, maxKB = 750) {
  if (!file) return { valid: false, message: "No file selected." };
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, message: "Only JPEG, PNG, or WebP images are permitted." };
  }
  if (file.size > maxKB * 1024) {
    return { valid: false, message: `Image exceeds ${maxKB} KB limit. Please compress the photo.` };
  }
  return { valid: true };
}

// --- 3. CLIENT-SIDE RATE LIMITER ---
const RateLimiter = {
  check(actionKey, cooldownMs = 60000, maxPerHour = 4) {
    const now = Date.now();
    const raw = sessionStorage.getItem(`rl_${actionKey}`);
    let timestamps = raw ? JSON.parse(raw) : [];
    timestamps = timestamps.filter((t) => now - t < 3600000);

    if (timestamps.length > 0 && now - timestamps[timestamps.length - 1] < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - timestamps[timestamps.length - 1])) / 1000);
      return { allowed: false, message: `Please wait ${waitSec} seconds before submitting again.` };
    }
    if (timestamps.length >= maxPerHour) {
      return { allowed: false, message: "Hourly booking limit reached. Please call the clinic directly." };
    }
    return { allowed: true };
  },
  record(actionKey) {
    const now = Date.now();
    const raw = sessionStorage.getItem(`rl_${actionKey}`);
    let timestamps = raw ? JSON.parse(raw) : [];
    timestamps = timestamps.filter((t) => now - t < 3600000);
    timestamps.push(now);
    sessionStorage.setItem(`rl_${actionKey}`, JSON.stringify(timestamps));
  }
};

// Local Disease Presets Key
const DB_DISEASE_PRESETS_KEY = "sri_sai_disease_presets";

const defaultDiseasePresets = [
  {
    diseaseName: "Melasma & Facial Hyperpigmentation",
    notes: "Epidermal and dermal melasma patches. Recommended laser toning and sun protection.",
    medicines: [
      { name: "Kojic & Azelaic Acid 10% Cream", dosage: "Pea size", freq: "0-0-1", duration: "30 Days", inst: "Apply only at night" },
      { name: "Mineral Sunscreen Gel SPF 50+", dosage: "Generous", freq: "1-1-0", duration: "Daily", inst: "Reapply every 3-4 hours" }
    ]
  },
  {
    diseaseName: "Acne Vulgaris (Grade II/III)",
    notes: "Active inflammatory papules and comedones.",
    medicines: [
      { name: "Clindamycin 1% + Adapalene 0.1% Gel", dosage: "Thin layer", freq: "0-0-1", duration: "20 Days", inst: "Apply at night" },
      { name: "Tab. Doxycycline 100mg", dosage: "1 Cap", freq: "1-0-1", duration: "10 Days", inst: "Take with full meal" }
    ]
  }
];

// --- 4. CLINIC STORE (FIRESTORE + AUTH ENGINE) ---
class ClinicStore {

  static async loginStaff(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
  }

  static async logoutStaff() {
    return await auth.signOut();
  }

  static onAuthChange(callback) {
    return auth.onAuthStateChanged(callback);
  }

  // Treatments Collection
  static subscribeTreatments(callback) {
    return db.collection("treatments").onSnapshot(
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        callback(list);
      },
      () => {}
    );
  }

  static async saveTreatment(data) {
    return await db.collection("treatments").add({
      category: sanitizeText(data.category, 60),
      title: sanitizeText(data.title, 100),
      desc: sanitizeText(data.desc, 500),
      benefits: (data.benefits || []).map((b) => sanitizeText(b, 150)).slice(0, 10),
      beforeImg: sanitizeImageSrc(data.beforeImg),
      afterImg: sanitizeImageSrc(data.afterImg),
      createdAt: Date.now()
    });
  }

  static async deleteTreatment(id) {
    await db.collection("treatments").doc(id).delete();
    showToast("Treatment removed.");
  }

  // Doctors Collection
  static subscribeDoctors(callback) {
    return db.collection("doctors").onSnapshot(
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        callback(list);
      },
      () => {}
    );
  }

  static async addDoctor(docData) {
    return await db.collection("doctors").add({
      name: sanitizeText(docData.name, 100),
      qualifications: sanitizeText(docData.qualifications, 120),
      timings: sanitizeText(docData.timings, 120),
      role: sanitizeText(docData.role, 120),
      img: sanitizeImageSrc(docData.img),
      createdAt: Date.now()
    });
  }

  static async deleteDoctor(id) {
    await db.collection("doctors").doc(id).delete();
  }

  // Premises Collection
  static subscribePremises(callback) {
    return db.collection("premises").onSnapshot(
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        callback(list);
      },
      () => {}
    );
  }

  static async addPremise(facData) {
    return await db.collection("premises").add({
      tag: sanitizeText(facData.tag, 60),
      title: sanitizeText(facData.title, 100),
      desc: sanitizeText(facData.desc, 400),
      checklist: sanitizeText(facData.checklist, 500),
      img: sanitizeImageSrc(facData.img),
      createdAt: Date.now()
    });
  }

  static async deletePremise(id) {
    await db.collection("premises").doc(id).delete();
  }

  // Settings & Logo
  static subscribeSettings(callback) {
    return db.collection("settings").doc("general").onSnapshot(
      (doc) => callback(doc.exists ? doc.data() : {}),
      () => {}
    );
  }

  static async updateSettings(updates) {
    const cleanUpdates = {};
    if (typeof updates.isBookingOpen === "boolean") {
      cleanUpdates.isBookingOpen = updates.isBookingOpen;
    }
    if (updates.logoUrl) {
      cleanUpdates.logoUrl = sanitizeImageSrc(updates.logoUrl);
    }
    await db.collection("settings").doc("general").set(cleanUpdates, { merge: true });
  }

  // Appointments
  static subscribeAppointments(callback) {
    return db.collection("appointments").orderBy("timestamp", "asc").onSnapshot(
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
        callback(list);
      },
      () => {}
    );
  }

  static async saveAppointment(data) {
    const payload = {
      name: sanitizeText(data.name, 80),
      phone: sanitizeText(data.phone, 10).replace(/\D/g, ""),
      age: sanitizeText(data.age, 3).replace(/\D/g, ""),
      gender: sanitizeText(data.gender, 20),
      weight: sanitizeText(data.weight, 10),
      place: sanitizeText(data.place, 100),
      bookingTime: sanitizeText(data.bookingTime, 20),
      slot: sanitizeText(data.slot || "Awaiting Reception Slot", 50),
      diagnosis: sanitizeText(data.diagnosis, 1000),
      medicines: Array.isArray(data.medicines) ? data.medicines : [],
      date: sanitizeText(data.date || new Date().toISOString().split("T")[0], 15),
      status: data.status === "Confirmed" ? "Confirmed" : "Pending",
      timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now()
    };
    return await db.collection("appointments").add(payload);
  }

  static async updateAppointment(id, updates) {
    const clean = {};
    if (updates.status !== undefined) clean.status = sanitizeText(updates.status, 30);
    if (updates.slot !== undefined) clean.slot = sanitizeText(updates.slot, 50);
    if (updates.gender !== undefined) clean.gender = sanitizeText(updates.gender, 20);
    if (updates.weight !== undefined) clean.weight = sanitizeText(updates.weight, 10);
    if (updates.diagnosis !== undefined) clean.diagnosis = sanitizeText(updates.diagnosis, 1000);
    if (Array.isArray(updates.medicines)) {
      clean.medicines = updates.medicines.map((m) => ({
        name: sanitizeText(m.name, 100),
        dosage: sanitizeText(m.dosage, 50),
        freq: sanitizeText(m.freq, 30),
        duration: sanitizeText(m.duration, 40),
        inst: sanitizeText(m.inst, 100)
      }));
    }
    return await db.collection("appointments").doc(id).update(clean);
  }

  // Disease Protocols
  static getDiseasePresets() {
    const raw = localStorage.getItem(DB_DISEASE_PRESETS_KEY);
    return raw ? JSON.parse(raw) : defaultDiseasePresets;
  }

  static saveDiseasePreset(preset) {
    const list = this.getDiseasePresets();
    list.push({
      diseaseName: sanitizeText(preset.diseaseName, 100),
      notes: sanitizeText(preset.notes, 500),
      medicines: (preset.medicines || []).map((m) => ({
        name: sanitizeText(m.name, 100),
        dosage: sanitizeText(m.dosage, 50),
        freq: sanitizeText(m.freq, 30),
        duration: sanitizeText(m.duration, 40),
        inst: sanitizeText(m.inst, 100)
      }))
    });
    localStorage.setItem(DB_DISEASE_PRESETS_KEY, JSON.stringify(list));
  }

  static deleteDiseasePreset(name) {
    const list = this.getDiseasePresets().filter((p) => p.diseaseName !== name);
    localStorage.setItem(DB_DISEASE_PRESETS_KEY, JSON.stringify(list));
  }

  static bulkImportPresets(newPresetsList) {
    const current = this.getDiseasePresets();
    newPresetsList.forEach((np) => {
      current.push({
        diseaseName: sanitizeText(np.diseaseName, 100),
        notes: sanitizeText(np.notes, 500),
        medicines: np.medicines || []
      });
    });
    localStorage.setItem(DB_DISEASE_PRESETS_KEY, JSON.stringify(current));
  }
}

function showToast(msg, type = "success") {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    document.body.appendChild(c);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}