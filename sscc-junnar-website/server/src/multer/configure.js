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
  const mime = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  if (mime === 'image/svg+xml' || ext === '.svg') {
    return cb(new Error('SVG files are not allowed for security reasons'));
  }
  const isImage = (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') && /\.(jpe?g|png|webp)$/i.test(file.originalname);
  const isPdf = mime === 'application/pdf' && /\.pdf$/i.test(file.originalname);
  if (isImage || isPdf) cb(null, true);
  else cb(new Error('Only PDF or image files (JPEG, PNG, WEBP) allowed'));
};

const imageFilter = (_req, file, cb) => {
  const mime = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  if (mime === 'image/svg+xml' || ext === '.svg') {
    return cb(new Error('SVG files are not allowed for security reasons'));
  }
  const isImage = (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') && /\.(jpe?g|png|webp)$/i.test(file.originalname);
  if (isImage) cb(null, true);
  else cb(new Error('Only image files (JPEG, PNG, WEBP) allowed'));
};

const pdfFilter = (_req, file, cb) => {
  const mime = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  if (mime === 'application/pdf' && /\.pdf$/i.test(file.originalname)) cb(null, true);
  else cb(new Error('Only PDF allowed'));
};

export const uploadAdmissionDocs = multer({
  storage: storage('admissions'),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
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
