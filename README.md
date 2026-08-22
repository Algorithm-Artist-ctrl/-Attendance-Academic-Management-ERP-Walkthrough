# Vivekananda College of Technology & Management (VCTM) Attendance & Academic Management ERP

Official Institutional ERP for **Vivekananda College of Technology & Management (VCTM), Aligarh** ([https://vctm.in/](https://vctm.in/)).

College Code: **340** | Academic Session: **2026–2027 (Odd Semester)**

---

## 🚀 Key Features

1. **Multi-Department & Program Extensibility**:
   - Generic hierarchy: Institutions $\rightarrow$ Departments (CSE, EE, ME, MBA) $\rightarrow$ Programs (B.Tech, MBA, MCA, Diploma) $\rightarrow$ Academic Sessions $\rightarrow$ Years $\rightarrow$ Semesters $\rightarrow$ Sections $\rightarrow$ Students.
   - New departments, programs, and class sections can be created on-the-fly via Admin Panel without source code modifications.

2. **Complete Seed Data (Odd Semester 2026-2027)**:
   - **Section A**: 53 Students (48 Regular + 5 Lateral Entry), Room A 007, Class Coordinator: **Ms. Hemlata Chaudhary**
   - **Section B**: 53 Students (42 Regular + 11 Lateral Entry), Room A 006, Class Coordinator: **Mr. Imran Raza Khan**
   - **11 Faculty Members**: Mr. Wasim (HOD), Ms. Hemlata Chaudhary (HEM), Mr. Imran Raza Khan (IRK), Mr. Alok Gupta (ALG), Mr. Kuldeep Kumar (KK), Dr. Naseem Ahamad Khan (NAK), Ms. Shivani Sarswat (SHS), Mr. Gagandep Singh (GDS), Dr. Faizan Nasir (FZN), Mr. Praveen Sharma (PRS), Dr. Abhishek Garg (ABG).
   - **10 Subjects**: BAS303 (Maths 4), BVE301 (UHV), BCS301 (DS), BCS302 (COA), BCS303 (DSTL), BCS351 (DS Lab), BCS352 (COA Lab), BCS353 (Web Designing Workshop), BCC301 (Cyber Security), BCC351 (Mini Project).
   - **Full Weekly Timetable Matrix**: Monday to Saturday, Periods I to VIII with exact timings and room assignments.

3. **Role-Based Portals**:
   - **Student Portal**: Live today's lecture attendance status ("Not Recorded", "Present", "Absent"), overall % gauge, subject-wise breakdown, and 1-click **Attendance Correction Request** tracker.
   - **Faculty Portal**: Today's lecture schedule, fast **Mobile-First Attendance Marking** (Mark All Present, Clear All, individual toggles, remarks, and confirmation summary), and **Pending Correction Review** (Approve/Reject with remarks).
   - **HOD Portal**: Department CSE overview, student & faculty directory, faculty workload distribution, and **Defaulter Report (<75% attendance)** with instant CSV / PDF export.
   - **Super Admin Portal**: Full academic master data setup, student & faculty directories, timetable manager with **Real-Time Conflict Detection** (faculty overlap, room overlap, section overlap), **Bulk CSV Student Importer**, and **System Audit Logs**.

4. **Security & Row Level Security (RLS)**:
   - PostgreSQL migrations in `supabase/migrations/` with granular RLS policies, custom types, automated correction triggers, and audit logging.

---

## 🔑 Quick Login Credentials (For Testing)

| Role | Identifier (Roll / Email) | Default Password | Persona / Description |
|---|---|---|---|
| **Super Admin** | `admin@vctm.in` | `admin123` | Central College Administrator |
| **HOD** | `wasim.cse@vctm.in` | `hod123` | Mr. Wasim (HOD CSE) |
| **Faculty (Sec A)** | `hemlata.cse@vctm.in` | `123456` | Ms. Hemlata Chaudhary (Coordinator Sec A) |
| **Faculty (Sec B)** | `imran.cse@vctm.in` | `123456` | Mr. Imran Raza Khan (Coordinator Sec B) |
| **Faculty** | `alok.cse@vctm.in` | `123456` | Mr. Alok Gupta (DS / Lab) |
| **Student (Sec A)** | `2403400100047` | `123456` | SHAZEB (Section A Regular) |
| **Student (Sec A)** | `2503400100001` | `123456` | ADITYA KISHOR SARASWAT (Sec A) |
| **Student (Sec A - Lateral)** | `2603400109001` | `123456` | AHMAD SHEERZ (Sec A Lateral Entry) |
| **Student (Sec B)** | `2403400130012` | `123456` | LUBHNESH KUMAR (Section B Regular) |

*(You can also use the **Role Switcher** in the top navigation bar to test personas instantly).*

---

## 🛠️ How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Run development server
npm run dev

# 3. Build for production
npm run build

# 4. Run automated test suite
npx tsx src/tests/verify_erp.ts
```

---

## 🗄️ Supabase Cloud Configuration

Your Supabase project is configured in `.env`:
- **Project URL**: `https://obssoojzryqiudllnlkh.supabase.co`
- **Project Ref**: `obssoojzryqiudllnlkh`

To initialize the schema and seed data in your Supabase project:
1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/obssoojzryqiudllnlkh/sql/new).
2. Run the script in `supabase/migrations/001_initial_schema.sql` (Creates 17 relational tables, triggers, and RLS policies).
3. Run the script in `supabase/migrations/002_seed_vctm_cse_data.sql` (Populates complete VCTM CSE dataset: 106 students, 11 faculty, 10 subjects, full timetable).
