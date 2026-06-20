/**
 * demoSeed.js — SSC College Junnar Demo Data Generator
 *
 * Generates realistic, interconnected demo data for testing, UAT, and demonstrations.
 * SAFE RERUN: Uses a version sentinel key in CollegeSettings to skip if already seeded.
 * SAFE RESET: Call resetDemoData() to wipe all demo records before reseeding.
 *
 * Usage:
 *   import { performDemoSeed } from './demoSeed.js';
 *   await performDemoSeed();
 */

import { prisma } from './db/client.js';
import { hashPassword } from './utils/auth.js';
import { Role } from '@prisma/client';

const DEMO_VERSION = 'v3.0';
const DEMO_SENTINEL_KEY = 'demoDataVersion';

// ─── TEACHER DEFINITIONS ────────────────────────────────────────────────────

const TEACHERS = [
  {
    name: 'Prof. Anita R. Deshmukh',
    email: 'anita.deshmukh@ssccjunnar.edu',
    phone: '9876501001',
    department: 'Computer Applications',
    designation: 'Associate Professor',
    qualifications: 'M.Sc. (CS), B.Ed.',
    employeeId: 'SSC-T001',
    bio: 'Over 12 years of experience in Computer Applications and Programming languages.',
    assignments: [
      { className: 'FY-BCA-A', subject: 'Computer Fundamentals' },
      { className: 'FY-BCA-B', subject: 'Computer Fundamentals' },
      { className: 'SY-BCA-A', subject: 'Data Structures' },
    ],
  },
  {
    name: 'Prof. Rajendra M. Kulkarni',
    email: 'rajendra.kulkarni@ssccjunnar.edu',
    phone: '9876501002',
    department: 'Commerce',
    designation: 'Assistant Professor',
    qualifications: 'M.Com., NET',
    employeeId: 'SSC-T002',
    bio: 'Specializes in Financial Accounting and Business Law. NET qualified.',
    assignments: [
      { className: 'FY-BCom-A', subject: 'Financial Accounting' },
      { className: 'FY-BCom-B', subject: 'Financial Accounting' },
      { className: 'SY-BCom-A', subject: 'Cost Accounting' },
    ],
  },
  {
    name: 'Dr. Sunita V. Pawar',
    email: 'sunita.pawar@ssccjunnar.edu',
    phone: '9876501003',
    department: 'English',
    designation: 'Associate Professor',
    qualifications: 'Ph.D. (English Literature), M.A.',
    employeeId: 'SSC-T003',
    bio: 'Research interests include Post-colonial Literature and Indian Writing in English.',
    assignments: [
      { className: 'FY-BA-A', subject: 'English Literature' },
      { className: 'FY-BA-B', subject: 'English Literature' },
      { className: 'SY-BA-A', subject: 'Communication Skills' },
    ],
  },
  {
    name: 'Prof. Milind S. Jadhav',
    email: 'milind.jadhav@ssccjunnar.edu',
    phone: '9876501004',
    department: 'Business Administration',
    designation: 'Assistant Professor',
    qualifications: 'MBA (Finance), B.Com.',
    employeeId: 'SSC-T004',
    bio: 'Industry background in banking sector with 5 years before joining academia.',
    assignments: [
      { className: 'FY-BBA-A', subject: 'Principles of Management' },
      { className: 'FY-BBA-B', subject: 'Principles of Management' },
      { className: 'SY-BBA-A', subject: 'Marketing Management' },
    ],
  },
  {
    name: 'Dr. Priya N. Shinde',
    email: 'priya.shinde@ssccjunnar.edu',
    phone: '9876501005',
    department: 'Science',
    designation: 'Assistant Professor',
    qualifications: 'Ph.D. (Chemistry), M.Sc.',
    employeeId: 'SSC-T005',
    bio: 'Doctoral research in Organic Chemistry. Published 8 research papers in peer-reviewed journals.',
    assignments: [
      { className: 'FY-BSc-A', subject: 'Organic Chemistry' },
      { className: 'FY-BSc-B', subject: 'Organic Chemistry' },
      { className: 'SY-BSc-A', subject: 'Physical Chemistry' },
    ],
  },
  {
    name: 'Prof. Santosh K. More',
    email: 'santosh.more@ssccjunnar.edu',
    phone: '9876501006',
    department: 'Computer Applications',
    designation: 'Assistant Professor',
    qualifications: 'MCA, B.Sc. (CS)',
    employeeId: 'SSC-T006',
    bio: 'Expert in Web Technologies and Database Management Systems.',
    assignments: [
      { className: 'SY-BCA-A', subject: 'Database Management' },
      { className: 'SY-BCA-B', subject: 'Database Management' },
      { className: 'TY-BCA-A', subject: 'Software Engineering' },
    ],
  },
  {
    name: 'Prof. Rekha B. Wagh',
    email: 'rekha.wagh@ssccjunnar.edu',
    phone: '9876501007',
    department: 'Economics',
    designation: 'Assistant Professor',
    qualifications: 'M.A. (Economics), NET',
    employeeId: 'SSC-T007',
    bio: 'Focuses on Microeconomics and Indian Economy. NET qualified with SLET.',
    assignments: [
      { className: 'FY-BA-A', subject: 'Economics' },
      { className: 'FY-BA-B', subject: 'Economics' },
      { className: 'SY-BA-A', subject: 'Indian Economy' },
    ],
  },
  {
    name: 'Prof. Amol P. Gaikwad',
    email: 'amol.gaikwad@ssccjunnar.edu',
    phone: '9876501008',
    department: 'Mathematics',
    designation: 'Assistant Professor',
    qualifications: 'M.Sc. (Mathematics), B.Ed.',
    employeeId: 'SSC-T008',
    bio: 'Teaches Applied Mathematics and Statistics. Active in student mentoring activities.',
    assignments: [
      { className: 'FY-BSc-A', subject: 'Mathematics' },
      { className: 'FY-BSc-B', subject: 'Mathematics' },
      { className: 'FY-BCA-A', subject: 'Mathematics' },
    ],
  },
  {
    name: 'Dr. Kavita L. Bhosale',
    email: 'kavita.bhosale@ssccjunnar.edu',
    phone: '9876501009',
    department: 'History',
    designation: 'Associate Professor',
    qualifications: 'Ph.D. (History), M.A.',
    employeeId: 'SSC-T009',
    bio: 'Specializes in Medieval Indian History and Maratha History. Author of two books.',
    assignments: [
      { className: 'FY-BA-A', subject: 'History' },
      { className: 'FY-BA-B', subject: 'History' },
      { className: 'SY-BA-A', subject: 'Modern India History' },
    ],
  },
  {
    name: 'Prof. Nitin D. Patil',
    email: 'nitin.patil@ssccjunnar.edu',
    phone: '9876501010',
    department: 'Commerce',
    designation: 'Assistant Professor',
    qualifications: 'M.Com., LLB, NET',
    employeeId: 'SSC-T010',
    bio: 'Expert in Business Law, Taxation, and Corporate Accounting.',
    assignments: [
      { className: 'FY-BCom-A', subject: 'Business Law' },
      { className: 'FY-BCom-B', subject: 'Business Law' },
      { className: 'SY-BCom-A', subject: 'Direct & Indirect Taxes' },
    ],
  },
];

// ─── STUDENT DEFINITIONS ─────────────────────────────────────────────────────

const firstNames = [
  'Aarav','Aditi','Akash','Anika','Arjun','Ashwini','Bhavna','Chirag','Deepa','Divya',
  'Ganesh','Gautam','Harsha','Ishaan','Jaya','Kiran','Komal','Lakshmi','Manish','Meera',
  'Mohit','Neha','Nilesh','Omkar','Pallavi','Pooja','Prakash','Priya','Rahul','Raj',
  'Rakesh','Ravi','Rohit','Rupali','Sachin','Sadhana','Sagar','Sanjay','Savita','Shivani',
  'Shruti','Smita','Sneha','Sunil','Swapnil','Tanvi','Tejas','Tushar','Vaibhav','Varsha',
];
const lastNames = [
  'Bhosale','Chavan','Deshmukh','Gaikwad','Jadhav','Kadam','Kale','Kamble','Kulkarni','More',
  'Mane','Naik','Nimbalkar','Pawar','Patil','Salunke','Shinde','Thorat','Waghmare','Wagh',
];

const COURSES = [
  { code: 'BCA',  name: 'Bachelor of Computer Applications', classes: ['FY-BCA-A','FY-BCA-B','SY-BCA-A','SY-BCA-B','TY-BCA-A'] },
  { code: 'BBA',  name: 'Bachelor of Business Administration', classes: ['FY-BBA-A','FY-BBA-B','SY-BBA-A'] },
  { code: 'BA',   name: 'Bachelor of Arts', classes: ['FY-BA-A','FY-BA-B','SY-BA-A'] },
  { code: 'BCom', name: 'Bachelor of Commerce', classes: ['FY-BCom-A','FY-BCom-B','SY-BCom-A'] },
  { code: 'BSc',  name: 'Bachelor of Science', classes: ['FY-BSc-A','FY-BSc-B','SY-BSc-A'] },
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStudents() {
  const students = [];
  let rollCounter = { BCA: 1, BBA: 51, BA: 101, BCom: 151, BSc: 201 };
  const usedEmails = new Set();
  const usedNames = new Set();

  for (let i = 0; i < 50; i++) {
    const course = COURSES[i % COURSES.length];
    const cls = course.classes[i % course.classes.length];
    const year = cls.startsWith('FY') ? '1' : cls.startsWith('SY') ? '2' : '3';

    // Generate unique name
    let firstName, lastName, fullName;
    let attempts = 0;
    do {
      firstName = firstNames[i % firstNames.length];
      if (attempts > 0) firstName = firstNames[(i + attempts * 7) % firstNames.length];
      lastName = lastNames[(i + attempts * 3) % lastNames.length];
      fullName = `${firstName} ${lastName}`;
      attempts++;
    } while (usedNames.has(fullName) && attempts < 50);
    usedNames.add(fullName);

    const rollNum = rollCounter[course.code]++;
    const rollFormatted = `${course.code.toUpperCase()}${year}${String(rollNum).padStart(3,'0')}`;

    // Build unique email
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rollNum}@student.ssccjunnar.edu`;
    let emailAttempt = 0;
    while (usedEmails.has(email)) {
      emailAttempt++;
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rollNum + emailAttempt * 100}@student.ssccjunnar.edu`;
    }
    usedEmails.add(email);

    students.push({
      name: fullName,
      email,
      phone: `98${String(7650 + i).padStart(4,'0')}${String(1000 + i).padStart(4,'0')}`.slice(0,10),
      rollNumber: rollFormatted,
      className: cls,
      courseName: course.name,
      year,
      targetAttendance: randInt(55, 98), // target attendance %
    });
  }
  return students;
}

// ─── SUBJECT MAPPING (which teacher teaches what in which class) ──────────────

function buildTeacherSubjectMap(teacherRecords) {
  // Returns: [{ teacherId, studentClass, subject }]
  const map = [];
  for (const t of teacherRecords) {
    const tp = t.teacherProfile;
    if (!tp || !Array.isArray(tp.assignments)) continue;
    for (const a of tp.assignments) {
      map.push({ teacherId: t.id, studentClass: a.className, subject: a.subject });
    }
  }
  return map;
}

// ─── DEPARTMENT DEFINITIONS ──────────────────────────────────────────────────

const DEPARTMENTS_DEMO = [
  {
    name: 'Department of Computer Applications',
    stream: 'IT',
    hodName: 'Prof. Anita R. Deshmukh',
    description: 'Offers BCA programme focusing on software development, databases, and networking. Equipped with modern computer labs.',
    subjects: ['Computer Fundamentals','Data Structures','Database Management','Web Technology','Software Engineering','Operating Systems'],
  },
  {
    name: 'Department of Commerce',
    stream: 'Commerce',
    hodName: 'Prof. Rajendra M. Kulkarni',
    description: 'Offers B.Com programme with specializations in Accounting, Taxation, and Business Law. Industry-oriented curriculum.',
    subjects: ['Financial Accounting','Cost Accounting','Business Law','Direct & Indirect Taxes','Auditing','Business Communication'],
  },
  {
    name: 'Department of Arts & Humanities',
    stream: 'Arts',
    hodName: 'Dr. Sunita V. Pawar',
    description: 'Offers B.A. programme with subjects in English Literature, History, Economics, and Communication Skills.',
    subjects: ['English Literature','History','Economics','Communication Skills','Indian Economy','Modern India History'],
  },
  {
    name: 'Department of Science',
    stream: 'Science',
    hodName: 'Dr. Priya N. Shinde',
    description: 'Offers B.Sc. programme covering Chemistry, Mathematics, and Physics with well-equipped laboratories.',
    subjects: ['Organic Chemistry','Physical Chemistry','Mathematics','Applied Mathematics','Physics','Statistics'],
  },
  {
    name: 'Department of Business Administration',
    stream: 'Commerce',
    hodName: 'Prof. Milind S. Jadhav',
    description: 'Offers BBA programme developing managerial acumen and entrepreneurship skills for the modern business environment.',
    subjects: ['Principles of Management','Marketing Management','Financial Management','Human Resource Management','Business Communication'],
  },
];

// ─── COURSE DEFINITIONS ───────────────────────────────────────────────────────

const COURSES_DEMO = [
  {
    name: 'Bachelor of Computer Applications (BCA)',
    level: 'UG',
    duration: '3 years (6 semesters)',
    eligibility: '12th pass in any stream with Mathematics',
    description: 'A comprehensive undergraduate programme in computer science covering programming, databases, networking, and software development. Prepares students for IT industry careers.',
    seatsApprox: 120,
  },
  {
    name: 'Bachelor of Commerce (B.Com)',
    level: 'UG',
    duration: '3 years (6 semesters)',
    eligibility: '12th pass in Commerce/Arts/Science stream',
    description: 'Undergraduate commerce programme with focus on accounting, taxation, business law, and financial management. Leads to CA, MBA, and corporate careers.',
    seatsApprox: 240,
  },
  {
    name: 'Bachelor of Arts (B.A.)',
    level: 'UG',
    duration: '3 years (6 semesters)',
    eligibility: '12th pass in any stream from recognized board',
    description: 'Multidisciplinary arts programme with subjects in English, History, Economics, and Humanities. Prepares students for civil services, education, and research careers.',
    seatsApprox: 480,
  },
  {
    name: 'Bachelor of Business Administration (BBA)',
    level: 'UG',
    duration: '3 years (6 semesters)',
    eligibility: '12th pass in any stream',
    description: 'Management programme developing future business leaders with skills in marketing, finance, HR, and entrepreneurship. Provides industry exposure through projects and internships.',
    seatsApprox: 120,
  },
  {
    name: 'Bachelor of Science (B.Sc.)',
    level: 'UG',
    duration: '3 years (6 semesters)',
    eligibility: '12th pass in Science stream (PCM or PCB)',
    description: 'Core science programme covering Chemistry, Mathematics, and Physics with hands-on laboratory experience and research methodology training.',
    seatsApprox: 180,
  },
];

// ─── NOTICES ──────────────────────────────────────────────────────────────────

const NOTICES_DEMO = [
  { title: 'Academic Calendar 2025–26 Published', body: 'The academic calendar for the year 2025–26 has been published. Students and faculty are requested to note important dates for examinations, holidays, and events. The calendar is available in the college office and on the notice board.', category: 'Academic' },
  { title: 'Semester End Examination Schedule', body: 'Semester End Examinations (SEE) for all UG courses will commence from 15th November 2025. The detailed time table is attached. Students must carry their Hall Ticket and College ID for all examinations. No late entry will be permitted.', category: 'Examination' },
  { title: 'Online Admission 2025–26 Open', body: 'Online admissions for the academic year 2025–26 are now open. Eligible students may apply at the college admission portal. Last date for submission of application forms is 30th June 2025. Shortlisted candidates will be called for document verification.', category: 'Admissions' },
  { title: 'Annual Sports Day – Registration Open', body: 'The college Annual Sports Day will be held on 25th January 2026. Students interested in participating in athletic events, team sports, and indoor games may register with their class representative by 10th January 2026. Prizes and certificates for winners.', category: 'Events' },
  { title: 'Diwali Holidays', body: 'The college will remain closed from 20th October to 27th October 2025 on account of Diwali vacation. Regular classes will resume on 28th October 2025. Wishing all students, faculty, and staff a Happy Diwali.', category: 'Holidays' },
  { title: 'Internal Assessment Test – I Schedule', body: 'Internal Assessment Test – I (Unit Test I) will be conducted from 5th August to 10th August 2025 for all classes. The subject-wise schedule has been posted on the class notice boards. Students are advised to prepare thoroughly.', category: 'Examination' },
  { title: 'Guest Lecture on Artificial Intelligence', body: 'The Department of Computer Applications is organizing a guest lecture on Artificial Intelligence and Machine Learning by Dr. Anil Mehta (Google India) on 12th September 2025 at 11:00 AM in the College Auditorium. All BCA and BBA students are encouraged to attend.', category: 'Events' },
  { title: 'Scholarship Applications – EBC & OBC', body: 'Students belonging to EBC and OBC categories who wish to avail state scholarship for the year 2025–26 should submit their applications with required documents (income certificate, caste certificate, marksheet) to the scholarship office before 31st August 2025.', category: 'Academic' },
  { title: 'Reopening After Summer Vacation', body: 'The college will reopen for the academic year 2025–26 from 15th June 2025. Orientation programme for newly admitted students (FY) will be held on 16th June and 17th June 2025. Senior students (SY, TY) should report from 18th June 2025.', category: 'Academic' },
  { title: 'Library Extended Hours During Exams', body: 'The college library will remain open from 8:00 AM to 8:00 PM (Monday to Saturday) and 10:00 AM to 5:00 PM on Sundays during the examination period (November–December 2025). Students can utilize this facility for last-minute revision.', category: 'Academic' },
  { title: 'Republic Day Celebration', body: 'Republic Day will be celebrated on 26th January 2026 in the college premises. The flag hoisting ceremony will be at 8:00 AM. All students and faculty are requested to attend. Cultural programme will follow the ceremony. Attendance is compulsory.', category: 'Events' },
  { title: 'Fee Payment Deadline – Second Installment', body: 'The last date for payment of second installment of tuition and other fees is 30th September 2025. Students who fail to pay fees by the due date will attract a late fee of Rs. 50 per day. Payments can be made at the college cash counter (10 AM – 2 PM).', category: 'Academic' },
  { title: 'NAAC Accreditation Visit Preparation', body: 'The college is preparing for the NAAC Peer Team visit scheduled in February 2026. All departments are requested to ensure documentation, records, and facilities are in order. Students may be called for interaction with the peer team. Your cooperation is appreciated.', category: 'Academic' },
  { title: 'Computer Lab Schedule – FY Students', body: 'FY BCA students are assigned computer lab sessions from Monday to Friday as per the timetable. Students must bring their student ID. No food or drinks are permitted in the lab. Lab assistant Mr. Rahul Kadam will be available for technical support.', category: 'Academic' },
  { title: 'Christmas & New Year Holidays', body: 'The college will remain closed from 25th December 2025 to 1st January 2026 on account of Christmas and New Year holidays. Regular classes will resume on 2nd January 2026. Season\'s greetings to all from the college management.', category: 'Holidays' },
  { title: 'Merit List for Admission 2025–26', body: 'The first merit list for admissions to FY UG courses for 2025–26 has been published on the college notice board and website. Shortlisted candidates must complete the admission process and fee payment within 3 days. Second merit list will be published if seats remain vacant.', category: 'Admissions' },
  { title: 'Anti-Ragging Committee Notice', body: 'The college strictly prohibits ragging in any form on campus and in hostels. Any student found involved in ragging will face immediate disciplinary action as per UGC/Supreme Court guidelines. Students may report ragging incidents to the Anti-Ragging Cell at ext. 104.', category: 'Academic' },
  { title: 'Environmental Awareness Workshop', body: 'The NSS Unit of the college is organizing an Environmental Awareness Workshop on 5th June 2025 (World Environment Day). Activities include tree plantation, cleanliness drive, and poster competition. All students are requested to participate enthusiastically.', category: 'Events' },
  { title: 'Practical Examination Guidelines', body: 'Practical examinations for B.Sc. and BCA students will be held from 1st December to 10th December 2025. Students must bring their journal (duly signed by the subject teacher), equipment, and student ID. Reporting time is 9:00 AM. Late entry will not be permitted.', category: 'Examination' },
  { title: 'Independence Day Celebration', body: 'Independence Day will be celebrated on 15th August 2025. Flag hoisting at 8:00 AM by the Principal. Cultural programme at 9:30 AM including patriotic songs, speeches, and dance performances. Attendance is compulsory for all students and faculty.', category: 'Events' },
];

// ─── ADMISSION APPLICATIONS ───────────────────────────────────────────────────

const ADMISSION_NAMES = [
  'Amruta Dhond','Bhushan Raut','Chandani Sawant','Datta Bhosale','Ekta Kamble',
  'Farhan Shaikh','Gita Hiremath','Hemant Bhagat','Isha Kulkarni','Jitendra Lad',
  'Kaveri Pol','Lokesh Shinde','Madhuri Jagtap','Nikhil Deshpande','Onkar Mane',
  'Poonam Patke','Quasar Vaidya','Rashmi Wagh','Sumeet Gore','Triveni Borse',
  'Uma Gawade','Vinay Kale','Wasim Khan','Yashwant Thorat','Zara Patel',
  'Ajay Rokade','Bhakti Misal','Chetan Joshi','Deepali Nair','Eswar Reddy',
  'Falguni Chouk','Ganpat Navale','Hari Om Tiwari','Indira Sawant','Jagannath More',
  'Krishnabai Salunkhe','Lata Dhumal','Manoj Pujari','Nishigandha Ghuge','Omkar Bhave',
  'Pranoti Karale','Rajashri Chougule','Sanika Shejul','Trushna Madane','Uday Nikam',
  'Vaishnavi Shekhar','Waman Dofe','Xenia Gomes','Yogesh Avhad','Zuber Momin',
];

const ADMISSION_COURSES = ['B.A.','B.Sc.','B.Com','BBA','BCA'];
const ADMISSION_STATUSES = ['pending','approved','under_review','rejected'];
const ADMISSION_BOARDS = ['Maharashtra State Board','CBSE','ISC','NIOS'];

// ─── STUDY MATERIAL TITLES ────────────────────────────────────────────────────

const MATERIAL_TITLES = {
  'Computer Fundamentals': ['Introduction to Computers – Unit 1 Notes','MS Office Practical Guide','Number Systems and Binary Arithmetic'],
  'Data Structures': ['Arrays and Linked Lists – Lecture Notes','Sorting Algorithms – Study Material','Trees and Graphs – Module 4'],
  'Database Management': ['SQL Queries Practice Set','ER Diagrams and Normalization','Database Design Project Guidelines'],
  'Software Engineering': ['SDLC Models – Study Notes','Project Management Fundamentals','Testing Methodologies Guide'],
  'Mathematics': ['Differential Calculus Notes','Matrix Algebra Practice Problems','Statistics Formula Sheet'],
  'Financial Accounting': ['Journal and Ledger Practice','Trial Balance Exercises','Final Accounts Problems'],
  'Cost Accounting': ['Marginal Costing Notes','Budget and Budgetary Control','Standard Costing Problems'],
  'Business Law': ['Contract Act Summary Notes','Sale of Goods Act Notes','Company Law Case Studies'],
  'English Literature': ['Poetry Analysis – Keats & Wordsworth','Prose Reading – Chapter Summaries','Grammar and Comprehension Practice'],
  'Communication Skills': ['Business Letter Writing Guide','Group Discussion Tips','Public Speaking Practice'],
  'Principles of Management': ['Management Functions Notes','Organizational Behavior Notes','Leadership Styles – Case Studies'],
  'Marketing Management': ['4Ps of Marketing Summary','Consumer Behavior Notes','Marketing Research Methods'],
  'Organic Chemistry': ['Functional Groups Notes','Reaction Mechanisms – Unit 3','Laboratory Safety Guidelines'],
  'Physical Chemistry': ['Thermodynamics – Chapter Notes','Chemical Kinetics Problems','Electrochemistry Summary'],
  'Economics': ['Demand and Supply Notes','Market Structures – Summary','National Income Concepts'],
  'History': ['Ancient India – Chapter Notes','Mughal Empire Notes','Freedom Movement Summary'],
  'Direct & Indirect Taxes': ['Income Tax Basics – Study Notes','GST Framework Overview','Tax Planning Problems'],
};

// ─── FEEDBACK TEMPLATES ──────────────────────────────────────────────────────

const FEEDBACK_MESSAGES = [
  'The faculty is very supportive and always willing to help students understand difficult concepts.',
  'The college campus is well-maintained and provides a great learning environment.',
  'I appreciate the practical-oriented approach to teaching in the science department.',
  'The library has a good collection of books and the extended hours during exams are very helpful.',
  'The sports facilities need some improvement, but overall the college experience is good.',
  'Faculty members are knowledgeable and explain concepts clearly with real-world examples.',
  'The computer labs are well-equipped and the software is regularly updated.',
  'I am satisfied with the quality of education and the focus on all-round development.',
  'The college organizes many extracurricular activities which helps in personality development.',
  'The attendance system is fair and teachers are punctual and dedicated.',
  'I would appreciate more industry visit opportunities and corporate interactions.',
  'The examination process is transparent and fair. Results are declared on time.',
  'The scholarship guidance cell helped me secure financial support. Very grateful.',
  'The NSS activities organized by the college develop a sense of social responsibility.',
  'Teachers provide individual attention and help students who are struggling academically.',
  'The college canteen food quality could be improved. Otherwise everything is good.',
  'The guest lectures from industry professionals are very insightful and motivating.',
  'I enjoy the collaborative learning environment and peer group discussions.',
  'The placement guidance cell should be more active in connecting students with companies.',
  'Overall a great institution with dedicated faculty and good infrastructure.',
  'The mentorship programme is very effective. My mentor teacher guides me regularly.',
  'I appreciate the zero-tolerance policy on ragging. The campus feels safe and inclusive.',
  'The annual cultural fest is the highlight of the year. Great platform for talent.',
  'The college is constantly improving and I am proud to be a student here.',
  'Online study materials shared by teachers are very helpful for revision.',
  'The interactive teaching methodology makes learning interesting and engaging.',
  'I am grateful for the supportive environment that helped me overcome my initial difficulties.',
  'The college administration is responsive to student concerns and grievances.',
  'Regular workshops and seminars help us stay updated with current developments.',
  'The overall academic atmosphere is very positive and motivating.',
];

// ─── HELPER: generate date within last N days ─────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

// ─── MAIN DEMO SEED ──────────────────────────────────────────────────────────

export async function performDemoSeed() {
  console.log('\n🌱 Starting demo data seed...\n');

  // Check sentinel
  const sentinel = await prisma.collegeSettings.findUnique({ where: { key: DEMO_SENTINEL_KEY } });
  if (sentinel && sentinel.value === DEMO_VERSION) {
    console.log(`✅ Demo data already seeded (${DEMO_VERSION}). Running updates/corrections.`);
    // return;
  }

  const startTime = Date.now();

  // ── STEP 1: Departments ────────────────────────────────────────────────────
  console.log('📚 Seeding departments...');
  await prisma.department.deleteMany({});
  const deptRecords = [];
  for (const d of DEPARTMENTS_DEMO) {
    const rec = await prisma.department.create({ data: d });
    deptRecords.push(rec);
  }
  console.log(`   ✓ ${deptRecords.length} departments created`);

  // ── STEP 2: Courses ───────────────────────────────────────────────────────
  console.log('🎓 Seeding courses...');
  await prisma.course.deleteMany({});
  for (let i = 0; i < COURSES_DEMO.length; i++) {
    await prisma.course.create({
      data: {
        ...COURSES_DEMO[i],
        departmentId: deptRecords[i % deptRecords.length].id,
      },
    });
  }
  console.log(`   ✓ ${COURSES_DEMO.length} courses created`);

  // ── STEP 3: Teachers ──────────────────────────────────────────────────────
  console.log('👩‍🏫 Seeding teachers...');
  const teacherRecords = [];
  for (const t of TEACHERS) {
    const existing = await prisma.user.findUnique({ where: { email: t.email } });
    if (existing) {
      // Update existing to make sure assignments are correct
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: t.name,
          phone: t.phone,
          bio: t.bio,
          teacherProfile: {
            employeeId: t.employeeId,
            department: t.department,
            designation: t.designation,
            qualifications: t.qualifications,
            assignments: t.assignments,
          },
        },
      });
      teacherRecords.push(updated);
    } else {
      const created = await prisma.user.create({
        data: {
          email: t.email,
          passwordHash: await hashPassword('Teacher@123'),
          role: Role.teacher,
          name: t.name,
          phone: t.phone,
          bio: t.bio,
          teacherProfile: {
            employeeId: t.employeeId,
            department: t.department,
            designation: t.designation,
            qualifications: t.qualifications,
            assignments: t.assignments,
          },
        },
      });
      teacherRecords.push(created);
    }
  }
  console.log(`   ✓ ${teacherRecords.length} teachers seeded (password: Teacher@123)`);

  // ── STEP 4: Students ──────────────────────────────────────────────────────
  console.log('🎒 Seeding students...');
  const studentDefs = generateStudents();
  const studentRecords = [];
  for (let idx = 0; idx < studentDefs.length; idx++) {
    const s = studentDefs[idx];
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    
    // Determine deterministic IDs
    const courseCode = s.rollNumber.replace(/[0-9]/g, '');
    const rollSeqNum = s.rollNumber.replace(/[^0-9]/g, '');
    const generatedStudentId = `SSC26${courseCode.toUpperCase()}${String(idx + 1).padStart(3, '0')}`;
    const generatedVerificationId = `SSC-VER-${generatedStudentId}`;
    const personalEmail = s.email.replace('@student.ssccjunnar.edu', '@gmail.com');

    const profileData = {
      studentId: generatedStudentId,
      personalEmail: personalEmail,
      collegeEmail: s.email,
      mobile: s.phone || '',
      course: s.courseName,
      courseName: s.courseName,
      className: s.className,
      year: s.year,
      division: 'A',
      rollNumber: s.rollNumber,
      address: 'Junnar, Pune District, Maharashtra, 410502',
      parentContact: '9123456789',
      emergencyContact: '9123456789',
      admissionYear: 2026,
      verificationId: generatedVerificationId,
      demoData: true,
    };

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          phone: s.phone,
          studentProfile: profileData
        }
      });
      studentRecords.push({ ...updated, targetAttendance: s.targetAttendance });
    } else {
      const created = await prisma.user.create({
        data: {
          email: s.email,
          passwordHash: await hashPassword('Student@123'),
          role: Role.student,
          name: s.name,
          phone: s.phone,
          studentProfile: profileData,
        },
      });
      studentRecords.push({ ...created, targetAttendance: s.targetAttendance });
    }
  }
  console.log(`   ✓ ${studentRecords.length} students seeded (password: Student@123)`);

  // ── STEP 5: Build teacher-subject-class map ───────────────────────────────
  const tsMap = buildTeacherSubjectMap(teacherRecords);

  // ── STEP 6: Attendance (last 90 days) ────────────────────────────────────
  console.log('📋 Seeding attendance records...');
  let totalAttRecords = 0;
  const WORKING_DAYS_BACK = 90;

  for (const student of studentRecords) {
    const sp = student.studentProfile;
    if (!sp || !sp.className) continue;
    const cls = sp.className;

    // Find all subjects taught in this student's class
    const mySubjects = tsMap.filter(m => m.studentClass === cls);
    if (!mySubjects.length) continue;

    const targetPct = student.targetAttendance || 75;

    for (const { teacherId, subject } of mySubjects) {
      // Generate attendance for working days in last 90 days
      // Classes happen ~4 times per week per subject
      for (let daysBack = 1; daysBack <= WORKING_DAYS_BACK; daysBack++) {
        const d = new Date();
        d.setDate(d.getDate() - daysBack);
        const dow = d.getDay();
        if (dow === 0) continue; // Skip Sunday

        // Each subject has class ~4 days/week → skip 3 out of 7 days per subject
        // Use a deterministic hash to decide if there's class today for this subject
        const hash = (student.id.charCodeAt(0) + subject.charCodeAt(0) + daysBack) % 7;
        if (hash < 3) continue; // ~57% of days have class (≈4/7)

        // Determine status based on target attendance with some randomness
        const rand = Math.random() * 100;
        const status = rand < targetPct ? 'present' : 'absent';

        const attendDate = new Date(d);
        attendDate.setHours(9, 0, 0, 0);

        try {
          await prisma.attendance.upsert({
            where: { studentId_subject_date: { studentId: student.id, subject, date: attendDate } },
            create: { studentId: student.id, teacherId, subject, date: attendDate, status },
            update: {},
          });
          totalAttRecords++;
        } catch {
          // Skip duplicates silently
        }
      }
    }
  }
  console.log(`   ✓ ${totalAttRecords} attendance records seeded`);

  // ── STEP 7: Marks ─────────────────────────────────────────────────────────
  console.log('📝 Seeding marks...');
  let totalMarks = 0;
  const EXAM_TYPES = [
    { name: 'Unit Test I', maxMarks: 20, term: 'Term 1' },
    { name: 'Unit Test II', maxMarks: 20, term: 'Term 2' },
    { name: 'Internal Assessment', maxMarks: 50, term: 'Term 1' },
    { name: 'Practical Examination', maxMarks: 30, term: 'Term 1' },
    { name: 'Semester Examination', maxMarks: 100, term: 'Term 2' },
  ];

  for (const student of studentRecords) {
    const sp = student.studentProfile;
    if (!sp || !sp.className) continue;
    const cls = sp.className;
    const mySubjects = tsMap.filter(m => m.studentClass === cls);

    for (const { teacherId, subject } of mySubjects) {
      for (const exam of EXAM_TYPES) {
        // Generate realistic marks (use student's attendance target as proxy for academic performance)
        const targetPct = student.targetAttendance || 75;
        const performancePct = Math.max(40, Math.min(97, targetPct + randInt(-10, 10)));
        const marksObtained = Math.round((performancePct / 100) * exam.maxMarks * 10) / 10;

        await prisma.mark.upsert({
          where: { id: `demo_${student.id}_${subject}_${exam.name}`.slice(0, 100) },
          create: {
            id: `demo_${student.id}_${subject}_${exam.name}`.slice(0, 100),
            studentId: student.id,
            teacherId,
            subject,
            examName: exam.name,
            marksObtained,
            maxMarks: exam.maxMarks,
            term: exam.term,
          },
          update: {},
        });
        totalMarks++;
      }
    }
  }
  console.log(`   ✓ ${totalMarks} mark records seeded`);

  // ── STEP 8: Study Materials ───────────────────────────────────────────────
  console.log('📂 Seeding study materials...');
  let totalMaterials = 0;
  for (const teacher of teacherRecords) {
    const tp = teacher.teacherProfile;
    if (!tp || !Array.isArray(tp.assignments)) continue;

    for (const asgn of tp.assignments) {
      const titles = MATERIAL_TITLES[asgn.subject] || [`${asgn.subject} – Study Notes`, `${asgn.subject} – Practice Problems`];
      for (let ti = 0; ti < Math.min(2, titles.length); ti++) {
        const title = titles[ti];
        const existing = await prisma.studyMaterial.findFirst({
          where: { teacherId: teacher.id, subject: asgn.subject, title },
        });
        if (!existing) {
          await prisma.studyMaterial.create({
            data: {
              teacherId: teacher.id,
              title,
              subject: asgn.subject,
              className: asgn.className,
              file: {
                originalName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                storedName: `demo_material_${teacher.id.slice(0,8)}_${ti}.pdf`,
                mimeType: 'application/pdf',
                demoData: true,
              },
            },
          });
          totalMaterials++;
        }
      }
    }
  }
  console.log(`   ✓ ${totalMaterials} study materials seeded`);

  // ── STEP 9: Notices ───────────────────────────────────────────────────────
  console.log('📢 Seeding notices...');
  // Get admin user for notices
  const adminUser = await prisma.user.findFirst({ where: { role: Role.admin } });
  let totalNotices = 0;
  for (let i = 0; i < NOTICES_DEMO.length; i++) {
    const n = NOTICES_DEMO[i];
    const existing = await prisma.notice.findFirst({ where: { title: n.title } });
    if (!existing) {
      await prisma.notice.create({
        data: {
          title: n.title,
          body: n.body,
          isPublished: true,
          createdById: adminUser?.id || null,
        },
      });
      totalNotices++;
    }
  }
  console.log(`   ✓ ${totalNotices} notices seeded`);

  // ── STEP 10: Admission Applications ──────────────────────────────────────
  console.log('📋 Seeding admission applications...');
  let totalAdmissions = 0;
  for (let i = 0; i < 50; i++) {
    const fullName = ADMISSION_NAMES[i] || `Applicant ${i + 1}`;
    const appNumber = `APP2025${String(1000 + i).padStart(4,'0')}`;
    const existing = await prisma.admissionApplication.findUnique({ where: { applicationNumber: appNumber } });
    if (!existing) {
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0].toLowerCase();
      const lastName = (nameParts[1] || 'demo').toLowerCase();
      await prisma.admissionApplication.create({
        data: {
          applicationNumber: appNumber,
          fullName,
          email: `${firstName}.${lastName}.adm${i}@gmail.com`,
          phone: `98${String(7600 + i).padStart(4,'0')}${String(2000 + i).padStart(4,'0')}`.slice(0,10),
          address: `${randInt(1,99)} Shivaji Nagar, Junnar, Pune – 410502, Maharashtra`,
          courseApplied: ADMISSION_COURSES[i % ADMISSION_COURSES.length],
          board12: ADMISSION_BOARDS[i % ADMISSION_BOARDS.length],
          marks12: randInt(55, 96) * 6, // 12th marks out of 600
          maxMarks12: 600,
          status: ADMISSION_STATUSES[i % ADMISSION_STATUSES.length],
          documentsVerified: i % 3 === 0,
          documentFiles: [],
        },
      });
      totalAdmissions++;
    }
  }
  console.log(`   ✓ ${totalAdmissions} admission applications seeded`);

  // ── STEP 11: Gallery metadata ─────────────────────────────────────────────
  console.log('🖼️  Seeding gallery metadata...');
  const GALLERY_CAPTIONS = [
    'Annual Prize Distribution Ceremony 2024',
    'Science Exhibition – Department of Science',
    'Independence Day Celebration 2024',
    'College Farewell Programme – TY Students 2024',
    'NSS Tree Plantation Drive',
    'Annual Sports Day 2024',
    'Cultural Fest – "Utsav 2024"',
    'Blood Donation Camp organized by NSS Unit',
  ];
  let totalGallery = 0;
  for (let i = 0; i < GALLERY_CAPTIONS.length; i++) {
    const existing = await prisma.galleryItem.findFirst({ where: { caption: GALLERY_CAPTIONS[i] } });
    if (!existing) {
      await prisma.galleryItem.create({
        data: {
          caption: GALLERY_CAPTIONS[i],
          sortOrder: i + 1,
          imageFile: {
            originalName: `gallery_${i + 1}.jpg`,
            storedName: `demo_gallery_${i + 1}.jpg`,
            demoData: true,
          },
        },
      });
      totalGallery++;
    }
  }
  console.log(`   ✓ ${totalGallery} gallery items seeded`);

  // ── STEP 12: Feedback ─────────────────────────────────────────────────────
  console.log('💬 Seeding feedback...');
  let totalFeedback = 0;
  for (let i = 0; i < 30; i++) {
    const student = studentRecords[i % studentRecords.length];
    const message = FEEDBACK_MESSAGES[i % FEEDBACK_MESSAGES.length];
    const existing = await prisma.feedback.findFirst({
      where: { userId: student.id, message: message.slice(0, 20) },
    });
    if (!existing) {
      await prisma.feedback.create({
        data: {
          name: student.name,
          email: student.email,
          message,
          rating: randInt(3, 5),
          userId: student.id,
          category: 'student',
        },
      });
      totalFeedback++;
    }
  }
  console.log(`   ✓ ${totalFeedback} feedback entries seeded`);

  // ── STEP 14: Placement Demo Data ──────────────────────────────────────────
  await performPlacementSeed(studentRecords);

  // ── STEP 15: Timetable Demo Data ──────────────────────────────────────────
  await performTimetableSeed(studentRecords, teacherRecords);

  // ── STEP 16: Library Demo Data ────────────────────────────────────────────
  await performLibrarySeed(studentRecords);

  // ── STEP 17: Exam Demo Data ───────────────────────────────────────────────
  await performExamSeed(teacherRecords);

  // ── STEP 18: Leave Requests Demo Data ─────────────────────────────────────
  await performLeaveSeed(teacherRecords);

  // ── STEP 19: Set sentinel ─────────────────────────────────────────────────
  await prisma.collegeSettings.upsert({
    where: { key: 'attendanceThreshold' },
    create: { key: 'attendanceThreshold', value: 75 },
    update: {},
  });

  await prisma.collegeSettings.upsert({
    where: { key: DEMO_SENTINEL_KEY },
    create: { key: DEMO_SENTINEL_KEY, value: DEMO_VERSION },
    update: { value: DEMO_VERSION },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n✅ Demo data seeding complete in ' + elapsed + 's');
  console.log('\n📌 Demo Credentials:');
  console.log('   Admin:   principal@ssccjunnar.edu / Admin@123');
  console.log('   Teacher: anita.deshmukh@ssccjunnar.edu / Teacher@123');
  console.log('   Teacher: rajendra.kulkarni@ssccjunnar.edu / Teacher@123');
  console.log('   Student: aarav.bhosale1@student.ssccjunnar.edu / Student@123');
  console.log('   Student: aditi.chavan6@student.ssccjunnar.edu / Student@123');
  console.log('\n   All 10 teacher passwords: Teacher@123');
  console.log('   All 50 student passwords:  Student@123');
  console.log('\n🏢 Placement Cell seeded: 15 companies, 20 drives, 100+ applications\n');
}

// ─── PLACEMENT DEMO DATA ─────────────────────────────────────────────────────

const PLACEMENT_COMPANIES = [
  { companyName: 'Tata Consultancy Services (TCS)', industry: 'IT Services & Consulting', website: 'https://www.tcs.com', packageOffered: '3.36 LPA', eligibilityCriteria: '60% aggregate in graduation, BCA/BSc/BBA, no active backlogs', location: 'Pune, Mumbai, Hyderabad', description: 'Leading global IT services company. TCS Mass Hiring Drive for fresh graduates.' },
  { companyName: 'Infosys', industry: 'IT Services & Consulting', website: 'https://www.infosys.com', packageOffered: '3.60 LPA', eligibilityCriteria: '65% in 10th, 12th and graduation; BCA/BSc preferred', location: 'Pune, Bangalore, Chennai', description: 'Infosys InfyTQ Campus Hiring Programme for 2025 batch. Apply for Systems Engineer role.' },
  { companyName: 'Wipro Technologies', industry: 'IT Services', website: 'https://www.wipro.com', packageOffered: '3.50 LPA', eligibilityCriteria: '60% throughout academics; any UG with CS background', location: 'Pune, Mysore, Hyderabad', description: 'Wipro National Talent Hunt for Engineering and IT graduates. NLTH programme.' },
  { companyName: 'Cognizant Technology Solutions', industry: 'IT Services & BPO', website: 'https://www.cognizant.com', packageOffered: '4.00 LPA', eligibilityCriteria: '60% in graduation; BCA/BSc/BBA eligible', location: 'Pune, Mumbai, Kolkata', description: 'Cognizant GenC Programme for fresh graduates. Competitive programming test + HR round.' },
  { companyName: 'Accenture India', industry: 'Management Consulting & IT', website: 'https://www.accenture.com/in-en', packageOffered: '4.50 LPA', eligibilityCriteria: '55% in graduation, no active backlogs, any stream', location: 'Mumbai, Pune, Bangalore', description: 'Accenture ASE (Associate Software Engineer) campus hiring 2025.' },
  { companyName: 'Capgemini', industry: 'IT Consulting & Services', website: 'https://www.capgemini.com/in-en', packageOffered: '3.80 LPA', eligibilityCriteria: '60% in 12th and graduation, BCA/BSc/BBA', location: 'Pune, Mumbai, Hyderabad', description: 'Capgemini Fresher Drive 2025. Analyst role with 6-month training program.' },
  { companyName: 'Tech Mahindra', industry: 'IT & BPO Services', website: 'https://www.techmahindra.com', packageOffered: '3.25 LPA', eligibilityCriteria: '50% aggregate; graduates from any discipline', location: 'Pune, Nagpur, Hyderabad', description: 'Tech Mahindra SMART Hiring. Lateral and fresher opportunities in IT support and development.' },
  { companyName: 'HCL Technologies', industry: 'IT & Digital Transformation', website: 'https://www.hcltech.com', packageOffered: '4.25 LPA', eligibilityCriteria: '60% in graduation; BCA/BSc/BBA preferred, no active backlogs', location: 'Pune, Noida, Chennai', description: 'HCL TechBee Campus Hiring for fresh graduates 2025 batch. Training + placement program.' },
  { companyName: 'Mphasis', industry: 'IT Services & Banking Tech', website: 'https://www.mphasis.com', packageOffered: '3.75 LPA', eligibilityCriteria: '60% aggregate, BCA/BSc eligible', location: 'Pune, Bangalore', description: 'Mphasis Next campus hiring for developer and analyst roles. Strong banking domain focus.' },
  { companyName: 'L&T Infotech (LTIMindtree)', industry: 'IT Services & Solutions', website: 'https://www.ltimindtree.com', packageOffered: '4.00 LPA', eligibilityCriteria: '65% in graduation; BCA/BSc/BBA, all streams', location: 'Pune, Mumbai, Bangalore', description: 'LTIMindtree campus hiring for 2025 batch. Multiple roles across IT services and consulting.' },
  { companyName: 'Persistent Systems', industry: 'Software Products & IT Services', website: 'https://www.persistent.com', packageOffered: '4.50 LPA', eligibilityCriteria: '65% in 12th and graduation; BCA/BSc preferred', location: 'Pune, Nagpur, Goa', description: 'Persistent Systems Campus Connect Programme. Roles in product engineering and testing.' },
  { companyName: 'KPIT Technologies', industry: 'Automotive & IoT Software', website: 'https://www.kpit.com', packageOffered: '4.00 LPA', eligibilityCriteria: '60% aggregate; BSc/BCA/BBA candidates welcome', location: 'Pune, Bangalore', description: 'KPIT Campus Hiring 2025 for embedded systems and software testing roles.' },
  { companyName: 'Reliance Jio Infocomm', industry: 'Telecom & Digital Services', website: 'https://www.jio.com', packageOffered: '3.50 LPA', eligibilityCriteria: '55% in graduation; any UG stream', location: 'Mumbai, Pune, Pan-India', description: 'Jio Young Leader Programme. Campus hiring for customer success and tech roles.' },
  { companyName: 'HDFC Bank (IT Division)', industry: 'Banking & Financial Services', website: 'https://www.hdfcbank.com', packageOffered: '5.00 LPA', eligibilityCriteria: '60% in graduation; BCA/BCom/BBA preferred; no backlogs', location: 'Mumbai, Pune, Thane', description: 'HDFC Bank campus hiring for Digital Banking and IT Operations roles 2025.' },
  { companyName: 'Bajaj Finserv Technology', industry: 'NBFC & Fintech', website: 'https://www.bajajfinserv.in', packageOffered: '4.50 LPA', eligibilityCriteria: '60% aggregate; BCA/BCom/BBA; Pune area preferred', location: 'Pune', description: 'Bajaj Finserv Digital/Tech campus hiring 2025. Business Analyst and IT Associate roles.' },
];

const PLACEMENT_DRIVES = [
  { companyIdx: 0,  title: 'TCS National Qualifier Test – 2025 Batch', daysAgo: 45, deadlineDays: 10, status: 'active' },
  { companyIdx: 1,  title: 'Infosys Systems Engineer – Off-Campus Drive', daysAgo: 30, deadlineDays: 5,  status: 'active' },
  { companyIdx: 2,  title: 'Wipro NLTH Campus Drive 2025', daysAgo: 20, deadlineDays: 15, status: 'active' },
  { companyIdx: 3,  title: 'Cognizant GenC Hiring – Maharashtra Colleges', daysAgo: 60, deadlineDays: -5, status: 'closed' },
  { companyIdx: 4,  title: 'Accenture ASE – Freshers Drive June 2025', daysAgo: 15, deadlineDays: 20, status: 'active' },
  { companyIdx: 5,  title: 'Capgemini Analyst Hiring – BCA & BSc', daysAgo: 10, deadlineDays: 25, status: 'active' },
  { companyIdx: 6,  title: 'Tech Mahindra SMART Drive – May 2025', daysAgo: 75, deadlineDays: -10, status: 'closed' },
  { companyIdx: 7,  title: 'HCL TechBee Fresher Programme', daysAgo: 5,  deadlineDays: 30, status: 'active' },
  { companyIdx: 8,  title: 'Mphasis Software Engineer – Campus Hire', daysAgo: 40, deadlineDays: -2, status: 'closed' },
  { companyIdx: 9,  title: 'LTIMindtree Campus Drive – 2025 Batch', daysAgo: 25, deadlineDays: 10, status: 'active' },
  { companyIdx: 10, title: 'Persistent Systems – Engineer Trainee Drive', daysAgo: 35, deadlineDays: -8, status: 'closed' },
  { companyIdx: 11, title: 'KPIT Automotive Tech Campus Drive 2025', daysAgo: 18, deadlineDays: 12, status: 'active' },
  { companyIdx: 12, title: 'Reliance Jio Young Leader Programme 2025', daysAgo: 8,  deadlineDays: 22, status: 'active' },
  { companyIdx: 13, title: 'HDFC Bank IT Associate – Campus Hiring', daysAgo: 50, deadlineDays: -15, status: 'closed' },
  { companyIdx: 14, title: 'Bajaj Finserv Business Analyst – 2025', daysAgo: 12, deadlineDays: 18, status: 'active' },
  { companyIdx: 0,  title: 'TCS BPS Ignite Programme – Commerce Graduates', daysAgo: 3,  deadlineDays: 28, status: 'active' },
  { companyIdx: 1,  title: 'Infosys BPO – Data Analyst Role 2025', daysAgo: 22, deadlineDays: 8,  status: 'active' },
  { companyIdx: 4,  title: 'Accenture Operations – Customer Facing Roles', daysAgo: 55, deadlineDays: -20, status: 'closed' },
  { companyIdx: 5,  title: 'Capgemini Digital India Initiative 2025', daysAgo: 7,  deadlineDays: 23, status: 'active' },
  { companyIdx: 9,  title: 'LTIMindtree – BCA & BSc Off Campus June 2025', daysAgo: 2,  deadlineDays: 35, status: 'active' },
];

const APP_STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'selected', 'rejected'];
// Distribution weights: applied=35, shortlisted=25, interview=20, selected=12, rejected=8
const STATUS_WEIGHTS = [35, 25, 20, 12, 8];

function weightedStatus(seed) {
  let v = seed % 100;
  let cum = 0;
  for (let i = 0; i < STATUS_WEIGHTS.length; i++) {
    cum += STATUS_WEIGHTS[i];
    if (v < cum) return APP_STATUSES[i];
  }
  return 'applied';
}

async function performPlacementSeed(studentRecords) {
  console.log('\n🏢 Seeding placement cell data...');

  // Clear existing placement demo data
  await prisma.placementApplication.deleteMany({});
  await prisma.placementDrive.deleteMany({});
  await prisma.company.deleteMany({});

  // Create companies
  const companyRecords = [];
  for (const c of PLACEMENT_COMPANIES) {
    const rec = await prisma.company.create({ data: c });
    companyRecords.push(rec);
  }
  console.log(`   ✓ ${companyRecords.length} companies created`);

  // Create drives
  const driveRecords = [];
  const now = new Date();
  for (const d of PLACEMENT_DRIVES) {
    const driveDate = new Date(now);
    driveDate.setDate(driveDate.getDate() - d.daysAgo + 30);
    driveDate.setHours(10, 0, 0, 0);
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + d.deadlineDays);
    deadline.setHours(23, 59, 0, 0);
    const rec = await prisma.placementDrive.create({
      data: {
        companyId: companyRecords[d.companyIdx].id,
        title: d.title,
        description: `Campus recruitment drive for ${companyRecords[d.companyIdx].companyName}. Open to eligible graduates from SSC College, Junnar.`,
        driveDate,
        applicationDeadline: deadline,
        status: d.status,
        createdAt: new Date(now.getTime() - d.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
    driveRecords.push(rec);
  }
  console.log(`   ✓ ${driveRecords.length} drives created`);

  // Create applications — 100+ across drives
  let totalApps = 0;
  const usedPairs = new Set();

  // Distribute students across drives: each student applies to 2-4 drives
  for (let si = 0; si < studentRecords.length; si++) {
    const student = studentRecords[si];
    const numApps = 2 + (si % 3); // 2, 3, or 4 applications per student
    const seed = si;

    for (let ai = 0; ai < numApps; ai++) {
      const driveIdx = (si * 3 + ai * 7) % driveRecords.length;
      const drive = driveRecords[driveIdx];
      const pairKey = `${student.id}:${drive.id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);

      const applicationStatus = weightedStatus(seed * 10 + ai * 13);
      const appliedDaysAgo = randInt(1, PLACEMENT_DRIVES[driveIdx]?.daysAgo || 30);
      const appliedAt = new Date(now.getTime() - appliedDaysAgo * 24 * 60 * 60 * 1000);

      await prisma.placementApplication.create({
        data: {
          studentId: student.id,
          driveId: drive.id,
          applicationStatus,
          appliedAt,
          updatedAt: appliedAt,
        },
      });
      totalApps++;
    }
  }
  console.log(`   ✓ ${totalApps} placement applications created`);
  const selectedCount = await prisma.placementApplication.count({ where: { applicationStatus: 'selected' } });
  console.log(`   ✓ ${selectedCount} students marked as selected`);
}

// ─── RESET HELPER ────────────────────────────────────────────────────────────

export async function resetDemoData() {
  console.log('\n🗑️  Resetting demo data...');

  // Clear new tables first to satisfy foreign key constraints
  await prisma.leaveRequest.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.libraryIssue.deleteMany({});
  await prisma.libraryBook.deleteMany({});
  await prisma.exam.deleteMany({});

  // Delete records seeded by demo (cascade handles attendance, marks, materials, feedback)
  const demoStudents = await prisma.user.findMany({
    where: { role: Role.student, email: { contains: '@student.ssccjunnar.edu' } },
  });
  const demoTeacherEmails = TEACHERS.map(t => t.email);
  const demoTeachers = await prisma.user.findMany({
    where: { role: Role.teacher, email: { in: demoTeacherEmails } },
  });

  // Delete student-linked data first (cascades handle attendance/marks/materials/feedback)
  for (const s of demoStudents) {
    await prisma.attendance.deleteMany({ where: { studentId: s.id } });
    await prisma.mark.deleteMany({ where: { studentId: s.id } });
    await prisma.feedback.deleteMany({ where: { userId: s.id } });
  }
  await prisma.user.deleteMany({
    where: { role: Role.student, email: { contains: '@student.ssccjunnar.edu' } },
  });

  for (const t of demoTeachers) {
    await prisma.studyMaterial.deleteMany({ where: { teacherId: t.id } });
    await prisma.attendance.deleteMany({ where: { teacherId: t.id } });
    await prisma.mark.deleteMany({ where: { teacherId: t.id } });
  }
  await prisma.user.deleteMany({
    where: { role: Role.teacher, email: { in: demoTeacherEmails } },
  });

  // Delete notices with demo titles
  for (const n of NOTICES_DEMO) {
    await prisma.notice.deleteMany({ where: { title: n.title } });
  }

  // Delete demo admissions
  for (let i = 0; i < 50; i++) {
    const appNumber = `APP2025${String(1000 + i).padStart(4,'0')}`;
    await prisma.admissionApplication.deleteMany({ where: { applicationNumber: appNumber } });
  }

  // Also clear placement data
  await prisma.placementApplication.deleteMany({});
  await prisma.placementDrive.deleteMany({});
  await prisma.company.deleteMany({});

  // Remove sentinel to allow reseed
  await prisma.collegeSettings.deleteMany({ where: { key: DEMO_SENTINEL_KEY } });

  console.log('✅ Demo data reset complete. Run npm run seed to regenerate.\n');
}

// ─── TIMETABLE DEMO DATA ─────────────────────────────────────────────────────

async function performTimetableSeed(studentRecords, teacherRecords) {
  console.log('\n📅 Seeding timetable data...');
  await prisma.timetable.deleteMany({});

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periods = [1, 2, 3, 4, 5, 6];
  const pTimes = [
    { period: 1, start: '09:00', end: '10:00' },
    { period: 2, start: '10:00', end: '11:00' },
    { period: 3, start: '11:00', end: '12:00' },
    { period: 4, start: '12:00', end: '01:00' },
    { period: 5, start: '01:30', end: '02:30' },
    { period: 6, start: '02:30', end: '03:30' }
  ];

  // Get distinct classes from student definitions
  const classes = Array.from(new Set(studentRecords.map(s => s.studentProfile?.className).filter(Boolean)));
  
  // Group teacher assignments by class
  const classAssignments = {};
  for (const t of teacherRecords) {
    const tp = t.teacherProfile;
    if (tp && Array.isArray(tp.assignments)) {
      for (const a of tp.assignments) {
        if (!classAssignments[a.className]) classAssignments[a.className] = [];
        classAssignments[a.className].push({
          teacherId: t.id,
          teacherName: t.name,
          subject: a.subject
        });
      }
    }
  }

  const busyTeachers = new Set(); // format: "teacherId:day:period"
  let timetablesCreated = 0;

  for (const cls of classes) {
    const assignments = classAssignments[cls] || [];
    if (assignments.length === 0) continue;

    const slots = [];
    for (const day of days) {
      // 3 to 5 periods per day
      const numPeriods = randInt(3, 5);
      const activePeriods = periods.slice(0, numPeriods);

      for (const period of activePeriods) {
        const pTime = pTimes.find(pt => pt.period === period);
        // Shuffle to get a randomized assignment
        const shuffled = [...assignments].sort(() => Math.random() - 0.5);
        
        for (const asgn of shuffled) {
          const key = `${asgn.teacherId}:${day}:${period}`;
          if (!busyTeachers.has(key)) {
            slots.push({
              day,
              period,
              startTime: pTime.start,
              endTime: pTime.end,
              subject: asgn.subject,
              teacherId: asgn.teacherId,
              teacherName: asgn.teacherName,
              room: `Room ${randInt(101, 108)}`
            });
            busyTeachers.add(key);
            break;
          }
        }
      }
    }

    await prisma.timetable.create({
      data: {
        className: cls,
        weekLabel: 'current',
        slots,
        isActive: true
      }
    });
    timetablesCreated++;
  }
  console.log(`   ✓ ${timetablesCreated} class timetables created (clash-free)`);
}

// ─── LIBRARY DEMO DATA ───────────────────────────────────────────────────────

const LIBRARY_BOOKS_DEMO = [
  { title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Computer Science", isbn: "9780262033848", shelfLocation: "Shelf A-1" },
  { title: "Database System Concepts", author: "Abraham Silberschatz", category: "Computer Science", isbn: "9780073523323", shelfLocation: "Shelf A-2" },
  { title: "Clean Code", author: "Robert C. Martin", category: "Computer Science", isbn: "9780132350884", shelfLocation: "Shelf A-3" },
  { title: "Design Patterns", author: "Erich Gamma", category: "Computer Science", isbn: "9780201633610", shelfLocation: "Shelf A-4" },
  { title: "Artificial Intelligence: A Modern Approach", author: "Stuart Russell", category: "Computer Science", isbn: "9780136086208", shelfLocation: "Shelf A-5" },
  { title: "Principles of Management", author: "Harold Koontz", category: "Management", isbn: "9780070669147", shelfLocation: "Shelf B-1" },
  { title: "Marketing Management", author: "Philip Kotler", category: "Management", isbn: "9780132102902", shelfLocation: "Shelf B-2" },
  { title: "Organizational Behavior", author: "Stephen P. Robbins", category: "Management", isbn: "9780136124016", shelfLocation: "Shelf B-3" },
  { title: "Financial Accounting", author: "J.R. Monga", category: "Commerce", isbn: "9788190742511", shelfLocation: "Shelf C-1" },
  { title: "Cost Accounting: Principles & Practice", author: "M.N. Arora", category: "Commerce", isbn: "9789325960010", shelfLocation: "Shelf C-2" },
  { title: "Business Law", author: "M.C. Kuchhal", category: "Commerce", isbn: "9789325960102", shelfLocation: "Shelf C-3" },
  { title: "Income Tax Law and Practice", author: "Dr. H.C. Mehrotra", category: "Commerce", isbn: "9789388832049", shelfLocation: "Shelf C-4" },
  { title: "Organic Chemistry", author: "Morrison & Boyd", category: "Chemistry", isbn: "9788131704813", shelfLocation: "Shelf D-1" },
  { title: "Concise Inorganic Chemistry", author: "J.D. Lee", category: "Chemistry", isbn: "9788126515547", shelfLocation: "Shelf D-2" },
  { title: "Physical Chemistry", author: "P.W. Atkins", category: "Chemistry", isbn: "9780199543373", shelfLocation: "Shelf D-3" },
  { title: "University Physics", author: "Francis Sears", category: "Physics", isbn: "9780201603224", shelfLocation: "Shelf D-4" },
  { title: "Advanced Engineering Mathematics", author: "Erwin Kreyszig", category: "Mathematics", isbn: "9780470458365", shelfLocation: "Shelf D-5" },
  { title: "Introduction to Probability and Statistics", author: "William Mendenhall", category: "Mathematics", isbn: "9781133103752", shelfLocation: "Shelf D-6" },
  { title: "A History of India (Vol 1)", author: "Romila Thapar", category: "History", isbn: "9780140138351", shelfLocation: "Shelf E-1" },
  { title: "A History of India (Vol 2)", author: "Percival Spear", category: "History", isbn: "9780140138368", shelfLocation: "Shelf E-2" },
  { title: "Discovery of India", author: "Jawaharlal Nehru", category: "History", isbn: "9780143031031", shelfLocation: "Shelf E-3" },
  { title: "Principles of Economics", author: "N. Gregory Mankiw", category: "Economics", isbn: "9780324589979", shelfLocation: "Shelf E-4" },
  { title: "Macroeconomics", author: "Richard T. Froyen", category: "Economics", isbn: "9780132438353", shelfLocation: "Shelf E-5" },
  { title: "Indian Economy", author: "Ramesh Singh", category: "Economics", isbn: "9789353165079", shelfLocation: "Shelf E-6" },
  { title: "Complete Works of William Shakespeare", author: "William Shakespeare", category: "English Literature", isbn: "9781853268953", shelfLocation: "Shelf F-1" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", category: "English Literature", isbn: "9780743273565", shelfLocation: "Shelf F-2" },
  { title: "To Kill a Mockingbird", author: "Harper Lee", category: "English Literature", isbn: "9780446310789", shelfLocation: "Shelf F-3" },
  { title: "1984", author: "George Orwell", category: "English Literature", isbn: "9780451524935", shelfLocation: "Shelf F-4" },
  { title: "Effective Java", author: "Joshua Bloch", category: "Computer Science", isbn: "9780134685991", shelfLocation: "Shelf A-6" },
  { title: "Operating System Concepts", author: "Abraham Silberschatz", category: "Computer Science", isbn: "9781118063330", shelfLocation: "Shelf A-7" },
  { title: "Computer Networks", author: "Andrew S. Tanenbaum", category: "Computer Science", isbn: "9780132126953", shelfLocation: "Shelf A-8" },
  { title: "Software Engineering: A Practitioner's Approach", author: "Roger S. Pressman", category: "Computer Science", isbn: "9780078022128", shelfLocation: "Shelf A-9" },
  { title: "Principles of Corporate Finance", author: "Richard A. Brealey", category: "Commerce", isbn: "9780078034763", shelfLocation: "Shelf C-5" },
  { title: "Management Information Systems", author: "Kenneth C. Laudon", category: "Management", isbn: "9780133814781", shelfLocation: "Shelf B-4" },
  { title: "Introduction to Spectroscopy", author: "Donald L. Pavia", category: "Chemistry", isbn: "9781285460123", shelfLocation: "Shelf D-7" },
  { title: "Calculus: Early Transcendentals", author: "James Stewart", category: "Mathematics", isbn: "9780538497909", shelfLocation: "Shelf D-8" },
  { title: "India Since Independence", author: "Bipan Chandra", category: "History", isbn: "9780143104094", shelfLocation: "Shelf E-7" },
  { title: "Microeconomic Theory", author: "Andreu Mas-Colell", category: "Economics", isbn: "9780195073409", shelfLocation: "Shelf E-8" },
  { title: "Wings of Fire", author: "A.P.J. Abdul Kalam", category: "Biography", isbn: "9788173711466", shelfLocation: "Shelf G-1" },
  { title: "A Brief History of Time", author: "Stephen Hawking", category: "Physics", isbn: "9780553380163", shelfLocation: "Shelf D-9" }
];

async function performLibrarySeed(studentRecords) {
  console.log('\n📚 Seeding library catalog...');
  await prisma.libraryIssue.deleteMany({});
  await prisma.libraryBook.deleteMany({});

  const bookRecords = [];
  for (const b of LIBRARY_BOOKS_DEMO) {
    const qty = randInt(4, 8);
    const rec = await prisma.libraryBook.create({
      data: {
        title: b.title,
        author: b.author,
        category: b.category,
        isbn: b.isbn,
        totalQty: qty,
        availableQty: qty,
        shelfLocation: b.shelfLocation
      }
    });
    bookRecords.push(rec);
  }
  console.log(`   ✓ ${bookRecords.length} books added to catalog`);

  console.log('📖 Seeding book issues (returned, active, overdue)...');
  let totalIssues = 0;
  const now = new Date();

  // Create 50 issues
  for (let i = 0; i < 50; i++) {
    const student = studentRecords[i % studentRecords.length];
    const bookIdx = (i * 7 + 3) % bookRecords.length;
    const book = bookRecords[bookIdx];

    // Decide state: 20 returned (i < 20), 15 active (20 <= i < 35), 15 overdue (i >= 35)
    let issuedAt, dueDate, returnedAt, status, fine;

    if (i < 20) {
      // Returned
      issuedAt = new Date(now);
      issuedAt.setDate(issuedAt.getDate() - randInt(20, 40));
      dueDate = new Date(issuedAt);
      dueDate.setDate(dueDate.getDate() + 14);

      // Returned late or on-time
      const returnedDaysAfter = randInt(5, 22);
      returnedAt = new Date(issuedAt);
      returnedAt.setDate(returnedAt.getDate() + returnedDaysAfter);

      status = 'returned';
      
      const diffTime = returnedAt.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fine = diffDays > 0 ? diffDays * 2 : 0;
    } else if (i < 35) {
      // Active & not overdue
      if (book.availableQty <= 0) continue;
      issuedAt = new Date(now);
      issuedAt.setDate(issuedAt.getDate() - randInt(2, 10));
      dueDate = new Date(issuedAt);
      dueDate.setDate(dueDate.getDate() + 14);
      returnedAt = null;
      status = 'issued';
      fine = 0;

      book.availableQty -= 1;
    } else {
      // Overdue
      if (book.availableQty <= 0) continue;
      issuedAt = new Date(now);
      issuedAt.setDate(issuedAt.getDate() - randInt(20, 30));
      dueDate = new Date(issuedAt);
      dueDate.setDate(dueDate.getDate() + 14); // was due 6-16 days ago
      returnedAt = null;
      status = 'issued';

      // Fine calculated dynamically up to today
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fine = diffDays > 0 ? diffDays * 2 : 0;

      book.availableQty -= 1;
    }

    await prisma.libraryIssue.create({
      data: {
        studentId: student.id,
        bookId: book.id,
        issuedAt,
        dueDate,
        returnedAt,
        status,
        fine
      }
    });
    totalIssues++;
  }

  // Update book available quantities in database
  for (const b of bookRecords) {
    await prisma.libraryBook.update({
      where: { id: b.id },
      data: { availableQty: b.availableQty }
    });
  }

  console.log(`   ✓ ${totalIssues} library issues logs created`);
}

// ─── EXAMS & RESULTS DEMO DATA ───────────────────────────────────────────────

async function performExamSeed(teacherRecords) {
  console.log('\n📝 Seeding exam schedules & linking marks...');
  await prisma.exam.deleteMany({});

  const tsMap = buildTeacherSubjectMap(teacherRecords);
  let totalExams = 0;

  const EXAM_TYPES = [
    { name: 'Unit Test I', maxMarks: 20, examType: 'internal', daysAgo: 90, resultsPublished: true },
    { name: 'Unit Test II', maxMarks: 20, examType: 'internal', daysAgo: 45, resultsPublished: true },
    { name: 'Internal Assessment', maxMarks: 50, examType: 'internal', daysAgo: 60, resultsPublished: true },
    { name: 'Practical Examination', maxMarks: 30, examType: 'practical', daysAgo: 20, resultsPublished: true },
    { name: 'Semester Examination', maxMarks: 100, examType: 'semester', daysAgo: -10, resultsPublished: false }, // future
  ];

  for (const { studentClass, subject } of tsMap) {
    for (const ex of EXAM_TYPES) {
      const examDate = new Date();
      examDate.setDate(examDate.getDate() - ex.daysAgo);
      examDate.setHours(10, 0, 0, 0);

      await prisma.exam.create({
        data: {
          title: ex.name,
          examType: ex.examType,
          className: studentClass,
          subject,
          examDate,
          startTime: ex.examType === 'practical' ? '09:00 AM' : '11:00 AM',
          duration: ex.examType === 'semester' ? '3 Hours' : '1.5 Hours',
          venue: ex.examType === 'practical' ? 'Main Computer Lab' : `Block Room ${randInt(101, 105)}`,
          maxMarks: ex.maxMarks,
          isPublished: true,
          resultsPublished: ex.resultsPublished
        }
      });
      totalExams++;
    }

    // Add a draft/unpublished future exam for variety
    const draftDate = new Date();
    draftDate.setDate(draftDate.getDate() + 30);
    await prisma.exam.create({
      data: {
        title: 'Mock Placement Test',
        examType: 'internal',
        className: studentClass,
        subject,
        examDate: draftDate,
        startTime: '02:00 PM',
        duration: '2 Hours',
        venue: 'Seminar Auditorium',
        maxMarks: 50,
        isPublished: false,
        resultsPublished: false
      }
    });
    totalExams++;
  }

  console.log(`   ✓ ${totalExams} exams seeded and mapped to marks system`);
}

// ─── LEAVE HANDLING DEMO DATA ────────────────────────────────────────────────

async function performLeaveSeed(teacherRecords) {
  console.log('\n🍁 Seeding teacher leave requests...');
  await prisma.leaveRequest.deleteMany({});

  let totalLeaves = 0;
  const leaveTypes = ['casual', 'sick', 'earned'];
  const reasons = [
    'Attending family wedding out of town',
    'Suffering from viral fever and chest infection',
    'Urgent personal work at home town',
    'Routine medical health checkup',
    'Attending national research conference',
    'My child is unwell and needs supervision',
    'Moving house and settling down',
    'Urgent banking and legal work'
  ];
  const adminNotes = [
    'Approved. Prof. More will adjust classes.',
    'Approved. Please upload medical certificate later.',
    'Rejected due to university exam duties scheduled on these dates.',
    'Approved, please verify work substitution.',
    'Rejected. Multiple faculty on leave in the same department.'
  ];

  for (let i = 0; i < 20; i++) {
    const teacher = teacherRecords[i % teacherRecords.length];
    const leaveType = pickRandom(leaveTypes);
    const reason = pickRandom(reasons);

    const isPast = i % 2 === 0;
    const status = isPast ? (i % 4 === 0 ? 'rejected' : 'approved') : 'pending';

    const fromDate = new Date();
    if (isPast) {
      fromDate.setDate(fromDate.getDate() - randInt(5, 30));
    } else {
      fromDate.setDate(fromDate.getDate() + randInt(2, 15));
    }
    fromDate.setHours(9, 0, 0, 0);

    const toDate = new Date(fromDate);
    toDate.setDate(toDate.getDate() + randInt(0, 3));
    toDate.setHours(18, 0, 0, 0);

    const adminNote = status === 'pending' ? '' : pickRandom(adminNotes);

    await prisma.leaveRequest.create({
      data: {
        teacherId: teacher.id,
        fromDate,
        toDate,
        reason,
        leaveType,
        status,
        adminNote
      }
    });
    totalLeaves++;
  }
  console.log(`   ✓ ${totalLeaves} teacher leave requests created`);
}
