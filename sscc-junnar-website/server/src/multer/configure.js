import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '../../uploads');

export function ensureUploadDirs() {
  const dirs = ['admissions', 'notices', 'gallery', 'materials', 'avatars'];
  for (const d of dirs) {
    const p = path.join(uploadsRoot, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
  return uploadsRoot;
}

function storage(subdir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(uploadsRoot, subdir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  });
}

const docFilter = (_req, file, cb) => {
  const ok =
    /pdf|jpeg|jpg|png|image\//i.test(file.mimetype) ||
    /\.(pdf|jpe?g|png)$/i.test(file.originalname);
  if (ok) cb(null, true);
  else cb(new Error('Only PDF or image files allowed'));
};

const imageFilter = (_req, file, cb) => {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files allowed'));
};

const pdfFilter = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) cb(null, true);
  else cb(new Error('Only PDF allowed'));
};

export const uploadAdmissionDocs = multer({
  storage: storage('admissions'),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: docFilter,
});

export const uploadNoticePdf = multer({
  storage: storage('notices'),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: pdfFilter,
});

export const uploadGalleryImage = multer({
  storage: storage('gallery'),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const uploadStudyMaterial = multer({
  storage: storage('materials'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: docFilter,
});

export const uploadAvatarImage = multer({
  storage: storage('avatars'),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export function uploadsPath() {
  return uploadsRoot;
}
