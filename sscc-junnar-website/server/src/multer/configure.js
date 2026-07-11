import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

import crypto from 'crypto';

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
      const baseExt = path.extname(file.originalname) || '';
      // Strip any path-traversal sequences or dangerous chars from extension
      const ext = baseExt.replace(/[^a-zA-Z0-9.]/g, '');
      const rand = crypto.randomBytes(4).toString('hex');
      cb(null, `${Date.now()}-${rand}${ext}`);
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

export function verifyMagicBytes(req, res, next) {
  const files = [];
  if (req.file) {
    files.push(req.file);
  }
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else if (typeof req.files === 'object') {
      Object.values(req.files).forEach(fileGroup => {
        if (Array.isArray(fileGroup)) {
          files.push(...fileGroup);
        } else if (fileGroup) {
          files.push(fileGroup);
        }
      });
    }
  }

  if (files.length === 0) {
    return next();
  }

  for (const file of files) {
    const filePath = file.path;
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(12);
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);

      const hex = buffer.toString('hex').toUpperCase();
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype.toLowerCase();

      let matched = false;

      if (hex.startsWith('FFD8FF')) {
        matched = (ext === '.jpg' || ext === '.jpeg') && (mime === 'image/jpeg');
      } else if (hex.startsWith('89504E47')) {
        matched = (ext === '.png') && (mime === 'image/png');
      } else if (hex.startsWith('25504446')) {
        matched = (ext === '.pdf') && (mime === 'application/pdf');
      } else if (hex.startsWith('52494646') && hex.substring(16, 24) === '57454250') {
        matched = (ext === '.webp') && (mime === 'image/webp');
      }

      if (!matched) {
        cleanupFiles(files);
        return res.status(400).json({ error: `File verification failed for '${file.originalname}'. Magic bytes mismatch or unsupported file type.` });
      }
    } catch (err) {
      console.error('Magic bytes read error:', err);
      cleanupFiles(files);
      return res.status(500).json({ error: 'Internal server error during file validation.' });
    }
  }

  next();
}

function cleanupFiles(files) {
  files.forEach(f => {
    if (f.path && fs.existsSync(f.path)) {
      try {
        fs.unlinkSync(f.path);
      } catch (err) {
        console.error('Failed to unlink invalid file:', err);
      }
    }
  });
}
