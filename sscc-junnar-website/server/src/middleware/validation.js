import { z } from 'zod';

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    // Assign validated and parsed data back to request
    req[source] = result.data;
    next();
  };
}

// Common validators
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

// Auth Schemas
export const adminAccessSchema = z.object({
  accessKey: z.string().min(1, 'Access key is required')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: strongPassword
});

// Admin Schemas
export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  stream: z.string().optional(),
  hodName: z.string().optional(),
  description: z.string().optional(),
  subjects: z.union([z.string(), z.array(z.any())]).optional()
});

export const createCourseSchema = z.object({
  name: z.string().min(2, 'Course name is required'),
  level: z.string().optional(),
  duration: z.string().optional(),
  eligibility: z.string().optional(),
  description: z.string().optional(),
  seatsApprox: z.union([z.number(), z.string()]).transform(val => Number(val) || 0).optional(),
  departmentId: z.string().optional()
});

export const createNoticeSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  body: z.string().optional(),
  priority: z.string().optional(),
  audience: z.string().optional(),
  publishDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  expiryDate: z.string().optional().nullable().transform(val => val ? new Date(val) : undefined),
  isPublished: z.union([z.boolean(), z.string()]).transform(val => !(val === false || val === 'false')).optional()
});

export const createStudentSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: strongPassword,
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  rollNumber: z.string().optional(),
  className: z.string().optional(),
  courseName: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional()
});

export const createTeacherSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  assignments: z.union([z.string(), z.array(z.any())]).optional()
});

export const verifyAdmissionSchema = z.object({
  documentsVerified: z.boolean(),
  verificationNotes: z.string().optional()
});

export const decisionAdmissionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
  notes: z.string().optional(),
  createAccount: z.boolean().optional(),
  rollNumber: z.string().optional(),
  className: z.string().optional(),
  courseName: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  defaultPassword: z.string().optional()
});

// Teacher Schemas
export const markAttendanceSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  date: z.string().transform(val => new Date(val)),
  entries: z.array(z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    status: z.enum(['present', 'absent'])
  })).min(1, 'At least one student attendance entry is required')
});

export const saveMarkSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  examName: z.string().min(1, 'Exam name is required'),
  marksObtained: z.number().nonnegative(),
  maxMarks: z.number().positive(),
  term: z.string().optional()
});
