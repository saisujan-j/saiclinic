document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================
  // 0. CONCEPT 1 MOTION: SCROLL REVEAL & SUBTLE 3D CARD TILT
  // ==========================================================
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal-on-scroll").forEach((el) => {
    revealObserver.observe(el);
  });

  // Subtle 3D perspective tilt on desktop pointer hover
  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".tilt-3d").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(1000px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-4px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  const readFileAsDataURL = (file) => {
    return new Promise((resolve) => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  // ==========================================================
  // STAFF AUTHENTICATION GATE (Protects Receptionist, Doctor, Admin)
  // ==========================================================
  const staffGate = document.getElementById("staffAuthGate");
  const protectedWorkspace = document.getElementById("protectedStaffWorkspace");

  if (staffGate && protectedWorkspace) {
    ClinicStore.onAuthChange((user) => {
      if (user) {
        staffGate.classList.add("hidden");
        protectedWorkspace.classList.remove("hidden");
        const emailBadge = document.getElementById("loggedInStaffEmail");
        if (emailBadge) emailBadge.textContent = user.email;
        initializeStaffPortals();
      } else {
        staffGate.classList.remove("hidden");
        protectedWorkspace.classList.add("hidden");
      }
    });

    const loginForm = document.getElementById("staffLoginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("staffLoginBtn");
        const errBox = document.getElementById("staffLoginError");
        btn.disabled = true;
        btn.textContent = "Verifying...";
        errBox.classList.add("hidden");

        try {
          const email = document.getElementById("staffEmailInput").value.trim();
          const pass = document.getElementById("staffPasswordInput").value;
          await ClinicStore.loginStaff(email, pass);
        } catch (err) {
          errBox.textContent = "Invalid staff credentials or unauthorized account.";
          errBox.classList.remove("hidden");
        } finally {
          btn.disabled = false;
          btn.textContent = "Sign In to Clinic Portal";
        }
      });
    }

    document.getElementById("staffLogoutBtn")?.addEventListener("click", async () => {
      await ClinicStore.logoutStaff();
      showToast("Signed out securely.");
    });
  }

  // ==========================================================
  // GLOBAL SETTINGS LISTENER (Logo & Bookings Pause)
  // ==========================================================
  ClinicStore.subscribeSettings((settings) => {
    const logoEl = document.getElementById("globalClinicLogo");
    if (logoEl && settings.logoUrl) {
      const safeLogo = sanitizeImageSrc(settings.logoUrl);
      if (safeLogo) logoEl.src = safeLogo;
    }

    const isBookingOpen = settings.isBookingOpen !== false;
    const bookingNotice = document.getElementById("bookingClosedNotice");
    const bookingForm = document.getElementById("publicBookingForm");
    if (bookingNotice && bookingForm) {
      bookingNotice.classList.toggle("hidden", isBookingOpen);
      bookingForm.style.display = isBookingOpen ? "grid" : "none";
    }

    const availBadge = document.getElementById("availabilityBadge");
    const toggleBtn = document.getElementById("toggleAvailabilityBtn");
    if (availBadge && toggleBtn) {
      availBadge.textContent = isBookingOpen ? "Intake Open" : "Bookings Paused";
      availBadge.className = isBookingOpen ? "badge badge-confirmed" : "badge badge-cancelled";
      toggleBtn.textContent = isBookingOpen ? "Pause Bookings" : "Resume Bookings";
      toggleBtn.style.background = isBookingOpen ? "#dc2626" : "#284d43";
      toggleBtn.dataset.isOpen = isBookingOpen;
    }
  });

  // ==========================================================
  // 1. PATIENT SITE: TWO-STEP CATEGORIZED TREATMENTS & INTAKE
  // ==========================================================
  const treatmentsContainer = document.getElementById("treatmentsContainer");
  const categoriesOverviewGrid = document.getElementById("categoriesOverviewGrid");
  const categoryPillNav = document.getElementById("categoryPillNav");
  const categoryActiveHeader = document.getElementById("categoryActiveHeader");
  const categoryActiveTitle = document.getElementById("categoryActiveTitle");
  const categoryActiveCount = document.getElementById("categoryActiveCount");

  if (treatmentsContainer) {
    let catalogTreatments = [];
    let selectedCategory = null;

    window.showCategoriesOverview = () => {
      selectedCategory = null;
      categoriesOverviewGrid?.classList.remove("hidden");
      categoryPillNav?.classList.add("hidden");
      categoryActiveHeader?.classList.add("hidden");
      treatmentsContainer?.classList.add("hidden");
    };

    window.selectCategory = (categoryName) => {
      selectedCategory = categoryName;
      categoriesOverviewGrid?.classList.add("hidden");
      categoryPillNav?.classList.remove("hidden");
      categoryActiveHeader?.classList.remove("hidden");
      treatmentsContainer?.classList.remove("hidden");

      document.querySelectorAll(".category-tab-btn").forEach((btn) => {
        const cleanKey = categoryName.replace(" Treatments", "").replace(" Care", "");
        const isActive = btn.textContent.includes(cleanKey);
        btn.className = isActive
          ? "category-tab-btn active px-4 py-2 rounded-full text-xs sm:text-sm font-bold border border-[#284d43] bg-[#284d43] text-white transition"
          : "category-tab-btn px-4 py-2 rounded-full text-xs sm:text-sm font-bold border border-[#d8ded5] bg-white text-[#456057] transition";
      });

      renderCategoryConcerns();
    };

    function renderCategoryConcerns() {
      if (!selectedCategory) return;

      const filtered = catalogTreatments.filter((t) => t.category === selectedCategory);
      if (categoryActiveTitle) categoryActiveTitle.textContent = `${selectedCategory} - Clinical Procedures`;
      if (categoryActiveCount) categoryActiveCount.textContent = `${filtered.length} Procedures Available`;

      if (filtered.length === 0) {
        treatmentsContainer.innerHTML = `
          <div class="col-span-full py-12 text-center text-[#587067] bg-white rounded-xl border border-dashed border-[#d8ded5]">
            No procedures listed under ${escapeHTML(selectedCategory)} yet. Please contact the clinic for consultation details.
          </div>`;
        return;
      }

      treatmentsContainer.innerHTML = filtered.map((t) => `
        <div class="soft-card p-6 bg-white/90 flex flex-col justify-between transition">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-widest text-[#b08d57] bg-[#f7f1e6] px-3 py-1 rounded-full inline-block mb-3">${escapeHTML(t.category)}</span>
            <h4 class="font-serif text-lg text-[#222825] font-semibold mb-2">${escapeHTML(t.title)}</h4>
            <p class="text-xs text-[#616b66] leading-relaxed line-clamp-2">${escapeHTML(t.desc)}</p>
          </div>
          <button onclick="openTreatmentModal('${escapeHTML(t.id)}')" class="secondary-pill w-full text-xs py-2.5 mt-5">
            View Clinical Details
          </button>
        </div>
      `).join("");
    }

    ClinicStore.subscribeTreatments((treatments) => {
      catalogTreatments = treatments;
      if (selectedCategory) renderCategoryConcerns();
    });

    window.openTreatmentModal = (id) => {
      const trt = catalogTreatments.find((t) => t.id === id);
      if (!trt) return;

      document.getElementById("modalTrtBadge").textContent = trt.category;
      document.getElementById("modalTrtTitle").textContent = trt.title;
      document.getElementById("modalTrtDesc").textContent = trt.desc;

      const benefitsList = document.getElementById("modalTrtBenefits");
      benefitsList.innerHTML = (trt.benefits || [])
        .map((b) => `<li class="flex items-center gap-2"><span class="text-[#284d43] font-bold">+</span> ${escapeHTML(b)}</li>`)
        .join("");

      const beforeImgEl = document.getElementById("modalTrtBeforeImg");
      const afterImgEl = document.getElementById("modalTrtAfterImg");
      const safeBefore = sanitizeImageSrc(trt.beforeImg);
      const safeAfter = sanitizeImageSrc(trt.afterImg);

      beforeImgEl.src = safeBefore || "";
      afterImgEl.src = safeAfter || "";
      document.getElementById("treatmentDetailModal").classList.add("active");
    };

    window.closeTreatmentModal = () => document.getElementById("treatmentDetailModal").classList.remove("active");
    window.bookTreatmentFromModal = () => {
      closeTreatmentModal();
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
    };

    // Render Doctors on Patient Website (Uses uploaded photo or clinical monogram)
    const doctorsContainer = document.getElementById("doctorsContainer");
    if (doctorsContainer) {
      ClinicStore.subscribeDoctors((doctors) => {
        if (doctors.length === 0) {
          doctorsContainer.innerHTML = `
            <div class="soft-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 items-center bg-white">
              <div class="w-32 h-32 rounded-xl bg-[#edf3ee] text-[#284d43] flex items-center justify-center font-serif text-3xl font-bold border border-[#d8ded5] shrink-0">SA</div>
              <div class="flex-1 text-center md:text-left">
                <h3 class="font-serif text-2xl font-bold text-[#284d43] mb-1">Dr. S. Sanjana Anand</h3>
                <h5 class="text-xs sm:text-sm text-[#9a650c] font-bold uppercase tracking-wider mb-3">M.B.B.S, M.D. (Dermatology) - Consultant Dermatologist</h5>
                <span class="inline-block bg-[#fdf5e6] text-[#875c12] border border-[#f0d5a3] px-3.5 py-1.5 rounded-lg text-xs font-bold">
                  Consultation Timings: 10:00 AM - 1:00 PM & 5:00 PM - 8:00 PM
                </span>
              </div>
            </div>`;
          return;
        }

        doctorsContainer.innerHTML = doctors.map((d) => {
          const safePhoto = sanitizeImageSrc(d.img);
          const initials = escapeHTML((d.name || "DR").replace(/^Dr\.?\s*/i, "").slice(0, 2).toUpperCase());
          const avatarHtml = safePhoto
            ? `<img src="${safePhoto}" alt="${escapeHTML(d.name)}" class="w-40 h-48 sm:w-48 sm:h-56 object-cover rounded-xl shadow-sm border border-[#d8ded5]" />`
            : `<div class="w-36 h-40 rounded-xl bg-[#edf3ee] text-[#284d43] flex items-center justify-center font-serif text-3xl font-bold border border-[#d8ded5] shrink-0">${initials}</div>`;

          return `
            <div class="soft-card p-6 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center bg-white">
              ${avatarHtml}
              <div class="flex-1 text-center md:text-left">
                <h3 class="font-serif text-2xl font-bold text-[#284d43] mb-1">${escapeHTML(d.name)}</h3>
                <h5 class="text-xs sm:text-sm text-[#9a650c] font-bold uppercase tracking-wider mb-3">${escapeHTML(d.qualifications)} - ${escapeHTML(d.role)}</h5>
                <span class="inline-block bg-[#fdf5e6] text-[#875c12] border border-[#f0d5a3] px-3.5 py-1.5 rounded-lg text-xs font-bold">
                  Consultation Timings: ${escapeHTML(d.timings)}
                </span>
              </div>
            </div>
          `;
        }).join("");
      });
    }

    // Render Premises on Patient Website
    const premisesContainer = document.getElementById("premisesContainer");
    if (premisesContainer) {
      ClinicStore.subscribePremises((premises) => {
        if (premises.length === 0) {
          premisesContainer.innerHTML = `<div class="col-span-full text-center text-sm text-[#587067] py-6">Clinical infrastructure details are updated by clinic administration.</div>`;
          return;
        }

        premisesContainer.innerHTML = premises.map((p) => {
          const safePhoto = sanitizeImageSrc(p.img);
          const headerMedia = safePhoto
            ? `<div class="relative h-52">
                 <span class="absolute top-3 left-3 bg-[#24342f]/90 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider z-10">${escapeHTML(p.tag)}</span>
                 <img src="${safePhoto}" alt="${escapeHTML(p.title)}" class="w-full h-full object-cover" />
               </div>`
            : `<div class="px-6 pt-6">
                 <span class="bg-[#edf3ee] text-[#284d43] border border-[#d8ded5] px-3 py-1 rounded text-xs font-bold uppercase tracking-wider inline-block">${escapeHTML(p.tag)}</span>
               </div>`;

          return `
            <div class="soft-card overflow-hidden bg-white">
              ${headerMedia}
              <div class="p-6">
                <h4 class="font-serif text-lg font-bold text-[#284d43] mb-2">${escapeHTML(p.title)}</h4>
                <p class="text-sm text-[#587067] mb-4">${escapeHTML(p.desc)}</p>
                <ul class="space-y-2">
                  ${(p.checklist || "").split("\n").filter((line) => line.trim()).map((line) => `<li class="text-sm flex gap-2 items-center text-[#444]"><span class="text-[#9a650c] font-bold">+</span> ${escapeHTML(line.trim())}</li>`).join("")}
                </ul>
              </div>
            </div>
          `;
        }).join("");
      });
    }

    // Sanitized & Rate-Limited Patient Intake Form
    const publicBookingForm = document.getElementById("publicBookingForm");
    if (publicBookingForm) {
      publicBookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const rateCheck = RateLimiter.check("public_booking", 60000, 4);
        if (!rateCheck.allowed) {
          showToast(rateCheck.message, "error");
          return;
        }

        const name = sanitizeText(document.getElementById("pName").value, 80);
        const phone = document.getElementById("pPhone").value.replace(/\D/g, "");
        const ageNum = parseInt(document.getElementById("pAge").value, 10);
        const place = sanitizeText(document.getElementById("pPlace").value, 100);

        if (name.length < 2) {
          showToast("Please enter a valid full name.", "error");
          return;
        }
        if (!/^[6-9][0-9]{9}$/.test(phone)) {
          showToast("Please enter a valid 10-digit Indian mobile number.", "error");
          return;
        }
        if (isNaN(ageNum) || ageNum < 1 || ageNum > 115) {
          showToast("Please enter a valid age between 1 and 115.", "error");
          return;
        }
        if (place.length < 2) {
          showToast("Please enter your city or locality.", "error");
          return;
        }

        const submitBtn = publicBookingForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
        try {
          const now = new Date();
          await ClinicStore.saveAppointment({
            name,
            phone,
            age: String(ageNum),
            place,
            bookingTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timestamp: now.getTime(),
            date: now.toISOString().split("T")[0],
            status: "Pending"
          });
          RateLimiter.record("public_booking");
          publicBookingForm.reset();
          showToast("Appointment request submitted to reception.");
        } catch (err) {
          showToast("Unable to submit request. Please call the clinic.", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Consultation Request";
        }
      });
    }
  }

  // ==========================================================
  // STAFF PORTALS INITIALIZER (Runs ONLY after Auth verified)
  // ==========================================================
  let staffPortalsInitialized = false;
  function initializeStaffPortals() {
    if (staffPortalsInitialized) return;
    staffPortalsInitialized = true;

    // --------------------------------------------------------
    // 2. DOCTOR CONSULTATION DESK
    // --------------------------------------------------------
    const docTableBody = document.getElementById("doctorTableBody");
    if (docTableBody) {
      let currentAppointments = [];

      ClinicStore.subscribeAppointments((appointments) => {
        currentAppointments = appointments;

        const todayStr = new Date().toISOString().split("T")[0];
        const todayApts = appointments.filter((a) => a.date === todayStr);
        const waitingList = appointments.filter((a) => a.status === "Confirmed");
        const completedList = appointments.filter((a) => a.status === "Completed");

        if (document.getElementById("docStatTotal")) document.getElementById("docStatTotal").textContent = todayApts.length;
        if (document.getElementById("docStatWaiting")) document.getElementById("docStatWaiting").textContent = waitingList.length;
        if (document.getElementById("docStatDone")) document.getElementById("docStatDone").textContent = completedList.length;

        const presets = ClinicStore.getDiseasePresets();
        docTableBody.innerHTML = "";

        if (waitingList.length === 0) {
          docTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-[#587067] py-8">No patients currently waiting in consultation queue.</td></tr>`;
        } else {
          waitingList.forEach((apt) => {
            const safeId = escapeHTML(apt.id);
            const vitalsDisplay = `${escapeHTML(apt.gender || "N/A")} | ${apt.weight ? escapeHTML(apt.weight) + " kg" : "Wt: N/A"}`;
            docTableBody.innerHTML += `
              <tr>
                <td>
                  <strong>${escapeHTML(apt.name)}</strong> <span class="text-xs text-[#587067]">(${escapeHTML(apt.age)} yrs)</span><br>
                  <span class="inline-block bg-[#eef5f0] text-[#284d43] px-2 py-0.5 rounded text-[11px] font-bold mt-1">${vitalsDisplay}</span><br>
                  <small class="text-[#587067]">Ph: ${escapeHTML(apt.phone || "N/A")}</small><br>
                  <small class="text-gray-400">Ref: ${safeId.substring(0, 8)}</small>
                </td>
                <td>
                  <span class="text-xs font-bold text-[#9a650c]">Booked: ${escapeHTML(apt.bookingTime || "N/A")}</span><br>
                  <strong class="text-[#284d43] text-sm">${escapeHTML(apt.slot)}</strong><br>
                  <small class="text-[#587067]">${escapeHTML(apt.place)}</small>
                </td>
                <td>
                  <div class="bg-[#eef5f0] border border-[#bfcfc5] rounded-lg p-2 mb-2 flex items-center gap-2">
                    <label class="text-xs font-bold text-[#284d43] whitespace-nowrap">Protocol:</label>
                    <select class="w-full p-1 text-xs rounded border border-[#bfcfc5]" onchange="applyDiseasePreset('${safeId}', this.value)">
                      <option value="">-- Choose Disease to Auto-Load Prescription --</option>
                      ${presets.map((p) => `<option value="${escapeHTML(p.diseaseName)}">${escapeHTML(p.diseaseName)}</option>`).join("")}
                    </select>
                  </div>
                  <textarea id="diag-${safeId}" class="form-control text-xs py-2 mb-2" rows="2" placeholder="Clinical notes...">${escapeHTML(apt.diagnosis || "")}</textarea>
                  <div class="rx-builder">
                    <div class="flex justify-between items-center mb-1">
                      <strong class="text-xs">Medications</strong>
                      <button type="button" class="primary-button py-0.5 px-2 text-xs" onclick="addMedicineRow('${safeId}')">+ Drug</button>
                    </div>
                    <table class="rx-table">
                      <thead>
                        <tr><th>Drug</th><th>Dose</th><th>Freq</th><th>Days</th><th>Instructions</th><th></th></tr>
                      </thead>
                      <tbody id="rx-rows-${safeId}">
                        <tr>
                          <td><input type="text" class="rx-input rx-name" placeholder="Drug name" /></td>
                          <td><input type="text" class="rx-input rx-dose" placeholder="1 Tab" /></td>
                          <td><input type="text" class="rx-input rx-freq" placeholder="1-0-1" /></td>
                          <td><input type="text" class="rx-input rx-dur" placeholder="10 Days" /></td>
                          <td><input type="text" class="rx-input rx-inst" placeholder="After food" /></td>
                          <td><button type="button" class="btn-del-row" onclick="this.closest('tr').remove()">x</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
                <td>
                  <button class="primary-button py-2 px-3 text-xs w-full" onclick="saveAndPrintPrescription('${safeId}')">Finalize & Print</button>
                </td>
              </tr>
            `;
          });
        }

        const historyTable = document.getElementById("doctorHistoryTableBody");
        if (historyTable) {
          historyTable.innerHTML = "";
          if (completedList.length === 0) {
            historyTable.innerHTML = `<tr><td colspan="5" class="text-center text-[#587067] py-6">No consultations completed yet today.</td></tr>`;
          } else {
            completedList.forEach((apt) => {
              const safeId = escapeHTML(apt.id);
              const meds = (apt.medicines || []).map((m) => `${escapeHTML(m.name)} (${escapeHTML(m.freq)})`).join(", ") || "No oral/topical medicines";
              historyTable.innerHTML += `
                <tr>
                  <td><strong>${escapeHTML(apt.name)}</strong> <span class="text-xs text-[#587067]">(${escapeHTML(apt.age)} yrs | ${escapeHTML(apt.gender || "")})</span><br><small class="text-gray-400">Ref: ${safeId.substring(0, 8)}</small></td>
                  <td><strong class="text-[#284d43]">${escapeHTML(apt.slot)}</strong></td>
                  <td><span class="text-xs">${escapeHTML(apt.diagnosis || "Completed")}</span></td>
                  <td><span class="text-xs text-[#587067]">${meds}</span></td>
                  <td><button class="btn-outline py-1 px-3 text-xs" onclick="reprintPrescription('${safeId}')">Reprint</button></td>
                </tr>
              `;
            });
          }
        }
      });

      window.applyDiseasePreset = (aptId, selectedDisease) => {
        const presets = ClinicStore.getDiseasePresets();
        const preset = presets.find((p) => p.diseaseName === selectedDisease);
        if (!preset) return;
        const diagEl = document.getElementById(`diag-${aptId}`);
        if (diagEl) diagEl.value = preset.notes;
        const tbody = document.getElementById(`rx-rows-${aptId}`);
        if (tbody) {
          tbody.innerHTML = preset.medicines.map((m) => `
            <tr>
              <td><input type="text" class="rx-input rx-name" value="${escapeHTML(m.name)}" /></td>
              <td><input type="text" class="rx-input rx-dose" value="${escapeHTML(m.dosage)}" /></td>
              <td><input type="text" class="rx-input rx-freq" value="${escapeHTML(m.freq)}" /></td>
              <td><input type="text" class="rx-input rx-dur" value="${escapeHTML(m.duration)}" /></td>
              <td><input type="text" class="rx-input rx-inst" value="${escapeHTML(m.inst)}" /></td>
              <td><button type="button" class="btn-del-row" onclick="this.closest('tr').remove()">x</button></td>
            </tr>
          `).join("");
        }
      };

      window.addMedicineRow = (aptId) => {
        const tbody = document.getElementById(`rx-rows-${aptId}`);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="text" class="rx-input rx-name" placeholder="Drug name" /></td>
          <td><input type="text" class="rx-input rx-dose" placeholder="1 Tab" /></td>
          <td><input type="text" class="rx-input rx-freq" placeholder="1-0-1" /></td>
          <td><input type="text" class="rx-input rx-dur" placeholder="10 Days" /></td>
          <td><input type="text" class="rx-input rx-inst" placeholder="After food" /></td>
          <td><button type="button" class="btn-del-row" onclick="this.closest('tr').remove()">x</button></td>
        `;
        tbody.appendChild(tr);
      };

      window.saveAndPrintPrescription = async (aptId) => {
        const diag = sanitizeText(document.getElementById(`diag-${aptId}`).value, 1000);
        const rows = document.querySelectorAll(`#rx-rows-${aptId} tr`);
        const meds = [];
        rows.forEach((r) => {
          const name = sanitizeText(r.querySelector(".rx-name")?.value, 100);
          if (name) {
            meds.push({
              name,
              dosage: sanitizeText(r.querySelector(".rx-dose")?.value, 50) || "-",
              freq: sanitizeText(r.querySelector(".rx-freq")?.value, 30) || "-",
              duration: sanitizeText(r.querySelector(".rx-dur")?.value, 40) || "-",
              inst: sanitizeText(r.querySelector(".rx-inst")?.value, 100) || "-"
            });
          }
        });
        await ClinicStore.updateAppointment(aptId, { diagnosis: diag, medicines: meds, status: "Completed" });
        const apt = currentAppointments.find((a) => a.id === aptId);
        if (apt) {
          document.getElementById("printName").textContent = apt.name;
          document.getElementById("printAge").textContent = `${apt.age} yrs | ${apt.gender || ""} ${apt.weight ? "(" + apt.weight + " kg)" : ""}`;
          document.getElementById("printDate").textContent = apt.date;
          document.getElementById("printId").textContent = apt.id.substring(0, 8);
          document.getElementById("printDiagnosis").textContent = diag || "Consultation complete.";
          document.getElementById("printMedicinesBody").innerHTML = meds.map((m) => `
            <tr><td><strong>${escapeHTML(m.name)}</strong></td><td>${escapeHTML(m.dosage)}</td><td>${escapeHTML(m.freq)}</td><td>${escapeHTML(m.duration)}</td><td>${escapeHTML(m.inst)}</td></tr>
          `).join("") || `<tr><td colspan="5" style="text-align:center;">No medications prescribed.</td></tr>`;
          setTimeout(() => window.print(), 250);
        }
      };

      window.reprintPrescription = (aptId) => {
        const apt = currentAppointments.find((a) => a.id === aptId);
        if (!apt) return;
        document.getElementById("printName").textContent = apt.name;
        document.getElementById("printAge").textContent = `${apt.age} yrs | ${apt.gender || ""} ${apt.weight ? "(" + apt.weight + " kg)" : ""}`;
        document.getElementById("printDate").textContent = apt.date;
        document.getElementById("printId").textContent = apt.id.substring(0, 8);
        document.getElementById("printDiagnosis").textContent = apt.diagnosis || "Consultation complete.";
        document.getElementById("printMedicinesBody").innerHTML = (apt.medicines || []).map((m) => `
          <tr><td><strong>${escapeHTML(m.name)}</strong></td><td>${escapeHTML(m.dosage)}</td><td>${escapeHTML(m.freq)}</td><td>${escapeHTML(m.duration)}</td><td>${escapeHTML(m.inst)}</td></tr>
        `).join("") || `<tr><td colspan="5" style="text-align:center;">No medications prescribed.</td></tr>`;
        setTimeout(() => window.print(), 250);
      };
    }

    // --------------------------------------------------------
    // 3. ADMIN CMS: TABS, BAR GRAPH & CONTENT MANAGEMENT
    // --------------------------------------------------------
    const adminNav = document.getElementById("adminTabsNav");
    if (adminNav) {
      let allAppointmentsCache = [];
      let currentChartRange = "daily";
      let chartInstance = null;

      window.switchAdminTab = (tabName) => {
        document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
          btn.className = "admin-tab-btn px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#456057] border border-[#d8ded5] hover:bg-[#edf3ee] transition";
        });
        const activeBtn = document.getElementById(`tabBtn-${tabName}`);
        if (activeBtn) {
          activeBtn.className = "admin-tab-btn active px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#284d43] text-white shadow-sm transition";
        }
        document.querySelectorAll(".admin-tab-pane").forEach((pane) => pane.classList.add("hidden"));
        document.getElementById(`tabPane-${tabName}`)?.classList.remove("hidden");
      };

      window.setChartRange = (range) => {
        currentChartRange = range;
        ["daily", "weekly", "monthly"].forEach((r) => {
          const btn = document.getElementById(`rangeBtn-${r}`);
          if (btn) {
            btn.className = r === range
              ? "px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#284d43] text-white shadow-xs transition"
              : "px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#456057] hover:bg-white transition";
          }
        });
        renderAnalyticsChart();
      };

      function renderAnalyticsChart() {
        const canvas = document.getElementById("appointmentChart");
        if (!canvas || typeof Chart === "undefined") return;
        const ctx = canvas.getContext("2d");

        let labels = [];
        let totalData = [];
        let completedData = [];
        const now = new Date();

        if (currentChartRange === "daily") {
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const isoDate = d.toISOString().split("T")[0];
            labels.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
            const dayApts = allAppointmentsCache.filter((a) => a.date === isoDate);
            totalData.push(dayApts.length);
            completedData.push(dayApts.filter((a) => a.status === "Completed").length);
          }
        } else if (currentChartRange === "weekly") {
          for (let w = 3; w >= 0; w--) {
            const start = new Date(now);
            start.setDate(now.getDate() - (w * 7 + 6));
            const end = new Date(now);
            end.setDate(now.getDate() - (w * 7));
            const label = `${start.getDate()} ${start.toLocaleDateString("en-US", { month: "short" })} - ${end.getDate()} ${end.toLocaleDateString("en-US", { month: "short" })}`;
            labels.push(w === 0 ? "This Week" : label);
            const weekApts = allAppointmentsCache.filter((a) => {
              if (!a.timestamp) return false;
              return a.timestamp >= start.setHours(0, 0, 0, 0) && a.timestamp <= end.setHours(23, 59, 59, 999);
            });
            totalData.push(weekApts.length);
            completedData.push(weekApts.filter((a) => a.status === "Completed").length);
          }
        } else if (currentChartRange === "monthly") {
          const currentYear = now.getFullYear();
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          labels = monthNames;
          monthNames.forEach((_, idx) => {
            const prefix = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
            const monthApts = allAppointmentsCache.filter((a) => (a.date || "").startsWith(prefix));
            totalData.push(monthApts.length);
            completedData.push(monthApts.filter((a) => a.status === "Completed").length);
          });
        }

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Total Bookings",
                data: totalData,
                backgroundColor: "rgba(40, 77, 67, 0.85)",
                borderColor: "#17342c",
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.65
              },
              {
                label: "Completed Consultations",
                data: completedData,
                backgroundColor: "rgba(217, 154, 33, 0.85)",
                borderColor: "#a67313",
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.65
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "top",
                labels: { font: { family: "DM Sans", weight: "bold", size: 12 }, color: "#24342f" }
              }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, color: "#587067" }, grid: { color: "#edf3ee" } },
              x: { ticks: { color: "#24342f", font: { weight: "600" } }, grid: { display: false } }
            }
          }
        });
      }

      ClinicStore.subscribeAppointments((appointments) => {
        allAppointmentsCache = appointments;
        const total = appointments.length;
        const completed = appointments.filter((a) => a.status === "Completed").length;
        const walkins = appointments.filter((a) => (a.slot || "").toLowerCase().includes("walk-in")).length;
        const cancelled = appointments.filter((a) => a.status === "Cancelled" || a.status === "Not Visited").length;

        if (document.getElementById("statTotalAll")) document.getElementById("statTotalAll").textContent = total;
        if (document.getElementById("statCompletedAll")) document.getElementById("statCompletedAll").textContent = completed;
        if (document.getElementById("statWalkinAll")) document.getElementById("statWalkinAll").textContent = walkins;
        if (document.getElementById("statCancelledAll")) document.getElementById("statCancelledAll").textContent = cancelled;

        renderAnalyticsChart();
      });

      // Render Treatments in Admin
      const adminTreatmentsBody = document.getElementById("adminTreatmentsListBody");
      if (adminTreatmentsBody) {
        ClinicStore.subscribeTreatments((treatments) => {
          adminTreatmentsBody.innerHTML = treatments.map((t) => {
            const safeId = escapeHTML(t.id);
            const bImg = sanitizeImageSrc(t.beforeImg);
            const aImg = sanitizeImageSrc(t.afterImg);
            return `
              <tr>
                <td><span class="badge badge-confirmed">${escapeHTML(t.category)}</span></td>
                <td><strong>${escapeHTML(t.title)}</strong></td>
                <td>
                  <p class="text-xs text-gray-700">${escapeHTML(t.desc)}</p>
                  <ul class="text-[11px] text-[#284d43] mt-1 list-disc list-inside">
                    ${(t.benefits || []).map((b) => `<li>${escapeHTML(b)}</li>`).join("")}
                  </ul>
                </td>
                <td>
                  <div class="flex gap-2">
                    ${bImg ? `<img src="${bImg}" alt="Before" class="w-12 h-12 object-cover rounded border" />` : `<span class="text-xs text-gray-400">No photo</span>`}
                    ${aImg ? `<img src="${aImg}" alt="After" class="w-12 h-12 object-cover rounded border" />` : ""}
                  </div>
                </td>
                <td><button class="btn-danger text-xs py-1 px-3" onclick="deleteTreatment('${safeId}')">Delete</button></td>
              </tr>
            `;
          }).join("");
        });

        window.openAddTreatmentModal = () => document.getElementById("addTrtModal").classList.add("active");
        window.closeAddTreatmentModal = () => document.getElementById("addTrtModal").classList.remove("active");

        document.getElementById("addTreatmentFullForm")?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const beforeFile = document.getElementById("newTrtBeforeFile").files[0];
          const afterFile = document.getElementById("newTrtAfterFile").files[0];

          const valBefore = validateImageFile(beforeFile, 750);
          if (!valBefore.valid) return showToast(`Before Photo: ${valBefore.message}`, "error");

          const valAfter = validateImageFile(afterFile, 750);
          if (!valAfter.valid) return showToast(`After Photo: ${valAfter.message}`, "error");

          const saveBtn = document.getElementById("saveTreatmentBtn");
          saveBtn.disabled = true;
          saveBtn.textContent = "Publishing...";

          try {
            const beforeDataUrl = await readFileAsDataURL(beforeFile);
            const afterDataUrl = await readFileAsDataURL(afterFile);
            const rawBenefits = document.getElementById("newTrtBenefits").value;
            const benefitsArray = rawBenefits.split("\n").map((b) => b.trim()).filter((b) => b.length > 0);

            await ClinicStore.saveTreatment({
              category: document.getElementById("newTrtCategory").value,
              title: document.getElementById("newTrtTitle").value,
              desc: document.getElementById("newTrtDesc").value,
              benefits: benefitsArray,
              beforeImg: beforeDataUrl,
              afterImg: afterDataUrl
            });

            document.getElementById("addTreatmentFullForm").reset();
            closeAddTreatmentModal();
            showToast("Treatment published live to the patient site.");
          } catch (err) {
            showToast("Failed to publish treatment.", "error");
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Publish Treatment to Website";
          }
        });

        window.deleteTreatment = async (id) => {
          if (confirm("Delete this treatment from the clinic portfolio?")) {
            await ClinicStore.deleteTreatment(id);
          }
        };
      }

      // Render Doctors & Premises from Firestore
      ClinicStore.subscribeDoctors((docs) => {
        const docsBody = document.getElementById("adminDoctorsBody");
        if (!docsBody) return;
        docsBody.innerHTML = docs.map((d) => {
          const safePhoto = sanitizeImageSrc(d.img);
          const avatar = safePhoto
            ? `<img src="${safePhoto}" alt="${escapeHTML(d.name)}" class="w-10 h-10 object-cover rounded-full border border-[#bfcfc5]" />`
            : `<div class="w-10 h-10 rounded-full bg-[#edf3ee] text-[#284d43] flex items-center justify-center font-bold text-xs border border-[#bfcfc5]">DR</div>`;
          return `
            <tr>
              <td>${avatar}</td>
              <td><strong>${escapeHTML(d.name)}</strong><br><small class="text-xs text-gray-500">${escapeHTML(d.qualifications || "")}</small></td>
              <td class="text-xs">${escapeHTML(d.role)}</td>
              <td><button class="btn-danger text-xs py-1 px-2.5" onclick="deleteDoctor('${escapeHTML(d.id)}')">Delete</button></td>
            </tr>
          `;
        }).join("");
      });

      ClinicStore.subscribePremises((premises) => {
        const premisesBody = document.getElementById("adminPremisesBody");
        if (!premisesBody) return;
        premisesBody.innerHTML = premises.map((p) => {
          const safePhoto = sanitizeImageSrc(p.img);
          const thumb = safePhoto
            ? `<img src="${safePhoto}" alt="${escapeHTML(p.title)}" class="w-12 h-9 object-cover rounded border border-[#bfcfc5]" />`
            : `<div class="w-12 h-9 rounded bg-[#edf3ee] text-[#284d43] flex items-center justify-center text-[10px] font-bold border border-[#bfcfc5]">ROOM</div>`;
          return `
            <tr>
              <td>${thumb}</td>
              <td><span class="badge badge-confirmed">${escapeHTML(p.tag)}</span></td>
              <td><strong class="text-xs">${escapeHTML(p.title)}</strong></td>
              <td><button class="btn-danger text-xs py-1 px-2.5" onclick="deletePremise('${escapeHTML(p.id)}')">Delete</button></td>
            </tr>
          `;
        }).join("");
      });

      function renderPresetsTable() {
        const presets = ClinicStore.getDiseasePresets();
        const body = document.getElementById("adminPresetsBody");
        if (!body) return;
        body.innerHTML = presets.map((p) => `
          <tr>
            <td><strong>${escapeHTML(p.diseaseName)}</strong></td>
            <td><span class="text-xs text-gray-600">${escapeHTML(p.notes)}</span></td>
            <td><span class="text-xs">${(p.medicines || []).map((m) => escapeHTML(m.name)).join(", ") || "No tablets"}</span></td>
            <td><button class="btn-danger text-xs py-1 px-3" onclick="deletePreset('${escapeHTML(p.diseaseName)}')">Delete</button></td>
          </tr>
        `).join("");
      }

      window.deletePreset = (name) => { ClinicStore.deleteDiseasePreset(name); renderPresetsTable(); };
      window.deleteDoctor = async (id) => { await ClinicStore.deleteDoctor(id); showToast("Doctor removed."); };
      window.deletePremise = async (id) => { await ClinicStore.deletePremise(id); showToast("Room removed."); };

      window.openAddPresetModal = () => document.getElementById("addPresetModal").classList.add("active");
      window.closeAddPresetModal = () => document.getElementById("addPresetModal").classList.remove("active");
      window.addPresetMedicineRow = () => {
        const tbody = document.getElementById("newPresetMedRows");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="text" class="rx-input p-name" placeholder="Drug name" required /></td>
          <td><input type="text" class="rx-input p-dose" placeholder="1 Tab" /></td>
          <td><input type="text" class="rx-input p-freq" placeholder="1-0-1" /></td>
          <td><input type="text" class="rx-input p-dur" placeholder="15 Days" /></td>
          <td><input type="text" class="rx-input p-inst" placeholder="After food" /></td>
          <td><button type="button" class="btn-del-row" onclick="this.closest('tr').remove()">x</button></td>
        `;
        tbody.appendChild(tr);
      };

      document.getElementById("addPresetForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const meds = [];
        document.querySelectorAll("#newPresetMedRows tr").forEach((r) => {
          const name = r.querySelector(".p-name")?.value.trim();
          if (name) {
            meds.push({
              name,
              dosage: r.querySelector(".p-dose")?.value.trim() || "-",
              freq: r.querySelector(".p-freq")?.value.trim() || "-",
              duration: r.querySelector(".p-dur")?.value.trim() || "-",
              inst: r.querySelector(".p-inst")?.value.trim() || "-"
            });
          }
        });
        ClinicStore.saveDiseasePreset({
          diseaseName: document.getElementById("newPresetDisease").value,
          notes: document.getElementById("newPresetNotes").value,
          medicines: meds
        });
        document.getElementById("addPresetForm").reset();
        closeAddPresetModal();
        showToast("Protocol saved.");
        renderPresetsTable();
      });

      document.getElementById("excelFileInput")?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(firstSheet);
            const parsed = json.map((row) => ({
              diseaseName: row["Disease"] || row["Disease Name"] || "Condition",
              notes: row["Notes"] || row["Diagnosis"] || "",
              medicines: String(row["Medicines"] || "").split(";").map((m) => {
                const parts = m.split("-").map((p) => p.trim());
                return { name: parts[0] || m, dosage: parts[1] || "1 Tab", freq: parts[2] || "1-0-1", duration: parts[3] || "10 Days", inst: parts[4] || "After food" };
              })
            }));
            ClinicStore.bulkImportPresets(parsed);
            showToast(`Imported ${parsed.length} disease protocols.`);
            renderPresetsTable();
          } catch (err) {
            showToast("Failed to parse spreadsheet.", "error");
          }
        };
        reader.readAsArrayBuffer(file);
      });

      // Add Doctor Handler
      window.openAddDoctorModal = () => document.getElementById("addDocModal").classList.add("active");
      window.closeAddDoctorModal = () => document.getElementById("addDocModal").classList.remove("active");
      document.getElementById("addDocForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const photoFile = document.getElementById("newDocPhotoFile")?.files[0];
        let photoUrl = "";
        if (photoFile) {
          const check = validateImageFile(photoFile, 750);
          if (!check.valid) return showToast(check.message, "error");
          photoUrl = await readFileAsDataURL(photoFile);
        }

        const saveBtn = document.getElementById("saveDoctorBtn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        try {
          await ClinicStore.addDoctor({
            name: document.getElementById("newDocName").value,
            qualifications: document.getElementById("newDocQual").value,
            timings: document.getElementById("newDocTimings").value,
            role: document.getElementById("newDocRole").value,
            img: photoUrl
          });
          document.getElementById("addDocForm").reset();
          closeAddDoctorModal();
          showToast("Doctor profile added.");
        } catch (err) {
          showToast("Error adding doctor.", "error");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Doctor";
        }
      });

      // Add Premise Handler
      window.openAddPremiseModal = () => document.getElementById("addPremiseModal").classList.add("active");
      window.closeAddPremiseModal = () => document.getElementById("addPremiseModal").classList.remove("active");
      document.getElementById("addPremiseForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const photoFile = document.getElementById("newPremisePhotoFile")?.files[0];
        let photoUrl = "";
        if (photoFile) {
          const check = validateImageFile(photoFile, 750);
          if (!check.valid) return showToast(check.message, "error");
          photoUrl = await readFileAsDataURL(photoFile);
        }

        const saveBtn = document.getElementById("savePremiseBtn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        try {
          await ClinicStore.addPremise({
            tag: document.getElementById("newPremiseTag").value,
            title: document.getElementById("newPremiseTitle").value,
            desc: document.getElementById("newPremiseDesc").value,
            checklist: document.getElementById("newPremiseChecklist").value,
            img: photoUrl
          });
          document.getElementById("addPremiseForm").reset();
          closeAddPremiseModal();
          showToast("Hospital room added.");
        } catch (err) {
          showToast("Error adding room.", "error");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Room";
        }
      });

      // Logo Upload Handler
      document.getElementById("updateLogoForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const file = document.getElementById("newLogoFile").files[0];
        const check = validateImageFile(file, 500);
        if (!check.valid) return showToast(check.message, "error");

        const b64 = await readFileAsDataURL(file);
        await ClinicStore.updateSettings({ logoUrl: b64 });
        document.getElementById("updateLogoForm").reset();
        showToast("Clinic logo updated globally.");
      });

      renderPresetsTable();
    }

    // --------------------------------------------------------
    // 4. RECEPTIONIST DESK
    // --------------------------------------------------------
    const recTableBody = document.getElementById("receptionistTableBody");
    if (recTableBody) {
      let latestAppointments = [];

      const toggleBtn = document.getElementById("toggleAvailabilityBtn");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", async () => {
          const currentlyOpen = toggleBtn.dataset.isOpen === "true";
          await ClinicStore.updateSettings({ isBookingOpen: !currentlyOpen });
        });
      }

      window.openVitalsModal = (id) => {
        const apt = latestAppointments.find((a) => a.id === id);
        if (!apt) return;
        document.getElementById("vitalsAptId").value = id;
        document.getElementById("vitalsPatientNameDisplay").textContent = `Patient: ${apt.name} (${apt.age} yrs) | Phone: ${apt.phone || "N/A"}`;
        document.getElementById("vitalsGender").value = apt.gender || "Female";
        document.getElementById("vitalsWeight").value = apt.weight || "";
        document.getElementById("vitalsModal").classList.add("active");
      };

      window.closeVitalsModal = () => document.getElementById("vitalsModal").classList.remove("active");

      window.savePatientVitals = async () => {
        const id = document.getElementById("vitalsAptId").value;
        const gender = document.getElementById("vitalsGender").value;
        const weight = document.getElementById("vitalsWeight").value.trim();
        await ClinicStore.updateAppointment(id, { gender, weight });
        closeVitalsModal();
        showToast("Weight and Gender updated.");
      };

      window.openAssignModal = (id) => {
        const apt = latestAppointments.find((a) => a.id === id);
        if (!apt) return;
        document.getElementById("assignAptId").value = id;
        document.getElementById("assignPatientNameDisplay").textContent = `Patient: ${apt.name} (${apt.age} yrs)`;
        document.getElementById("assignDoctorModal").classList.add("active");
      };

      window.closeAssignModal = () => document.getElementById("assignDoctorModal").classList.remove("active");

      window.confirmSendToDoctor = async () => {
        const id = document.getElementById("assignAptId").value;
        const slot = document.getElementById("assignedTimeSlot").value;
        await ClinicStore.updateAppointment(id, { status: "Confirmed", slot });
        closeAssignModal();
        showToast("Patient assigned to Doctor's queue.");
      };

      window.markNotVisited = async (id) => {
        if (confirm("Mark this patient as Not Visited? They will not appear on the doctor's screen.")) {
          await ClinicStore.updateAppointment(id, { status: "Not Visited", slot: "Did Not Visit" });
          showToast("Marked as Not Visited.", "error");
        }
      };

      window.openWalkinModal = () => {
        document.getElementById("wTime").value = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
        document.getElementById("walkinModal").classList.add("active");
      };
      window.closeWalkinModal = () => document.getElementById("walkinModal").classList.remove("active");
      document.getElementById("openWalkinModalBtn")?.addEventListener("click", openWalkinModal);

      document.getElementById("walkinForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const timeInput = document.getElementById("wTime").value;
        const [h, m] = timeInput.split(":");
        const wDate = new Date();
        wDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

        await ClinicStore.saveAppointment({
          name: document.getElementById("wName").value,
          phone: document.getElementById("wPhone")?.value || "",
          age: document.getElementById("wAge").value,
          gender: document.getElementById("wGender").value,
          weight: document.getElementById("wWeight").value,
          place: document.getElementById("wPlace").value,
          bookingTime: wDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: wDate.getTime(),
          slot: "Direct Walk-In",
          date: wDate.toISOString().split("T")[0],
          status: "Pending"
        });

        document.getElementById("walkinForm").reset();
        closeWalkinModal();
        showToast("Walk-in patient registered.");
      });

      ClinicStore.subscribeAppointments((appointments) => {
        latestAppointments = appointments;
        const sortedAppointments = [...appointments].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        if (sortedAppointments.length === 0) {
          recTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-[#587067] py-8">No appointments found for today.</td></tr>`;
          return;
        }

        recTableBody.innerHTML = sortedAppointments.map((apt, index) => {
          const serialNo = index + 1;
          const safeId = escapeHTML(apt.id);
          const vitalsRecorded = apt.weight || apt.gender;
          const vitalsDisplay = vitalsRecorded
            ? `<span class="font-bold text-[#284d43]">${escapeHTML(apt.gender || "-")} | ${apt.weight ? escapeHTML(apt.weight) + " kg" : "No Weight"}</span>`
            : `<span class="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">Vitals Pending</span>`;

          let actionHtml = "";
          if (apt.status === "Pending") {
            actionHtml = `
              <button class="primary-button text-xs py-1.5 px-3 mr-1 font-bold" onclick="openAssignModal('${safeId}')">Assign to Doctor</button>
              <button class="btn-danger py-1.5 px-2.5 text-xs font-bold" onclick="markNotVisited('${safeId}')">Not Visited</button>
            `;
          } else if (apt.status === "Confirmed") {
            actionHtml = `
              <span class="badge badge-confirmed font-bold mr-1">With Doctor</span>
              <button class="btn-danger py-1 px-2 text-[10px]" onclick="markNotVisited('${safeId}')">Not Visited</button>
            `;
          } else if (apt.status === "Not Visited") {
            actionHtml = `<span class="badge badge-cancelled font-bold">Not Visited</span>`;
          } else if (apt.status === "Completed") {
            actionHtml = `<span class="badge badge-completed font-bold">Completed</span>`;
          } else {
            actionHtml = `<span class="text-xs text-gray-400 font-bold">${escapeHTML(apt.status)}</span>`;
          }

          return `
            <tr>
              <td>
                <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#eef5f0] text-[#284d43] font-bold text-sm border border-[#bfcfc5]">
                  #${serialNo}
                </span>
              </td>
              <td>
                <strong>${escapeHTML(apt.name)}</strong> <span class="text-xs text-[#587067]">(${escapeHTML(apt.age)} yrs)</span><br>
                <small class="text-[#587067]">Ph: ${escapeHTML(apt.phone || "N/A")}</small>
              </td>
              <td>
                <div>${vitalsDisplay}</div>
                <button class="btn-outline text-[11px] py-1 px-2.5 mt-1 font-bold inline-flex items-center gap-1 hover:bg-[#284d43] hover:text-white transition" onclick="openVitalsModal('${safeId}')">
                  Enter / Update Vitals
                </button>
              </td>
              <td><strong class="text-[#9a650c]">${escapeHTML(apt.bookingTime || "N/A")}</strong></td>
              <td>${escapeHTML(apt.place)}</td>
              <td><strong class="text-[#284d43]">${escapeHTML(apt.slot)}</strong></td>
              <td><span class="badge badge-${escapeHTML((apt.status || "pending").toLowerCase().replace(" ", "-"))}">${escapeHTML(apt.status)}</span></td>
              <td>${actionHtml}</td>
            </tr>
          `;
        }).join("");
      });
    }
  }
});