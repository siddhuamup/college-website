import { Router } from 'express';
import { prisma, withMongoId } from '../db/client.js';
import { createAuthMiddleware, requireRole } from '../middleware/auth.js';
import { Role } from '@prisma/client';

export function adminLibraryRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('admin'));

  // GET all books
  r.get('/books', async (_req, res) => {
    const books = await prisma.libraryBook.findMany({
      orderBy: { title: 'asc' }
    });
    res.json(books.map(withMongoId));
  });

  // POST create book
  r.post('/books', async (req, res) => {
    const { title, author, category, isbn, totalQty, shelfLocation } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const qty = Number(totalQty) || 1;
    const book = await prisma.libraryBook.create({
      data: {
        title,
        author: author || '',
        category: category || '',
        isbn: isbn || '',
        totalQty: qty,
        availableQty: qty,
        shelfLocation: shelfLocation || ''
      }
    });
    res.status(201).json(withMongoId(book));
  });

  // PATCH update book
  r.patch('/books/:id', async (req, res) => {
    const { title, author, category, isbn, totalQty, shelfLocation } = req.body || {};
    const book = await prisma.libraryBook.findUnique({ where: { id: req.params.id } });
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const data = {};
    if (title) data.title = title;
    if (author !== undefined) data.author = author;
    if (category !== undefined) data.category = category;
    if (isbn !== undefined) data.isbn = isbn;
    if (shelfLocation !== undefined) data.shelfLocation = shelfLocation;

    if (totalQty !== undefined) {
      const newTotal = Number(totalQty) || 0;
      const diff = newTotal - book.totalQty;
      const newAvailable = book.availableQty + diff;
      if (newAvailable < 0) {
        return res.status(400).json({ error: 'Cannot reduce total quantity below currently issued quantity' });
      }
      data.totalQty = newTotal;
      data.availableQty = newAvailable;
    }

    const updated = await prisma.libraryBook.update({
      where: { id: req.params.id },
      data
    });
    res.json(withMongoId(updated));
  });

  // DELETE book
  r.delete('/books/:id', async (req, res) => {
    try {
      await prisma.libraryBook.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Book not found' });
    }
  });

  // GET all issues
  r.get('/issues', async (_req, res) => {
    const issues = await prisma.libraryIssue.findMany({
      include: {
        book: true,
        student: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });
    res.json(issues.map(withMongoId));
  });

  // POST issue book
  r.post('/issues', async (req, res) => {
    const { studentId, bookId, dueDate } = req.body || {};
    if (!studentId || !bookId || !dueDate) {
      return res.status(400).json({ error: 'studentId, bookId, and dueDate are required' });
    }

    const student = await prisma.user.findFirst({
      where: { id: studentId, role: Role.student }
    });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Use interactive transaction to prevent race condition on availableQty
    try {
      const issue = await prisma.$transaction(async (tx) => {
        const book = await tx.libraryBook.findUnique({ where: { id: bookId } });
        if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
        if (book.availableQty <= 0) throw Object.assign(new Error('No copies available for issue'), { status: 400 });

        const newIssue = await tx.libraryIssue.create({
          data: {
            studentId,
            bookId,
            dueDate: new Date(dueDate),
            status: 'issued'
          },
          include: {
            book: true,
            student: { select: { id: true, name: true, email: true } }
          }
        });

        await tx.libraryBook.update({
          where: { id: bookId },
          data: { availableQty: { decrement: 1 } }
        });

        return newIssue;
      });

      res.status(201).json(withMongoId(issue));
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Failed to issue book' });
    }
  });

  // POST return book
  r.post('/issues/:id/return', async (req, res) => {
    const issue = await prisma.libraryIssue.findUnique({
      where: { id: req.params.id },
      include: { book: true }
    });
    if (!issue) return res.status(404).json({ error: 'Issue record not found' });
    if (issue.returnedAt) return res.status(400).json({ error: 'Book already returned' });

    const returnedAt = new Date();
    // Fetch library fine per day setting (defaults to ₹2)
    const fineRateRow = await prisma.collegeSettings.findUnique({ where: { key: 'libraryFinePerDay' } });
    let fineRate = 2;
    if (fineRateRow && fineRateRow.value !== undefined && fineRateRow.value !== null) {
      const parsedRate = Number(fineRateRow.value);
      if (!isNaN(parsedRate)) fineRate = parsedRate;
    }

    let fine = 0;
    const dueTime = new Date(issue.dueDate).getTime();
    const retTime = returnedAt.getTime();
    if (retTime > dueTime) {
      const days = Math.ceil((retTime - dueTime) / (1000 * 60 * 60 * 24));
      fine = days * fineRate;
    }

    const [updatedIssue] = await prisma.$transaction([
      prisma.libraryIssue.update({
        where: { id: req.params.id },
        data: {
          returnedAt,
          status: 'returned',
          fine
        },
        include: {
          book: true,
          student: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.libraryBook.update({
        where: { id: issue.bookId },
        data: { availableQty: issue.book.availableQty + 1 }
      })
    ]);

    res.json(withMongoId(updatedIssue));
  });

  // GET analytics
  r.get('/analytics', async (_req, res) => {
    // 1. Overdue books
    const now = new Date();
    const overdue = await prisma.libraryIssue.findMany({
      where: {
        returnedAt: null,
        dueDate: { lt: now }
      },
      include: {
        book: true,
        student: { select: { id: true, name: true, email: true } }
      }
    });

    // 2. Active issues count
    const activeCount = await prisma.libraryIssue.count({
      where: { returnedAt: null }
    });

    // 3. Most issued books (simple frequency logic)
    const allIssues = await prisma.libraryIssue.findMany({
      select: { bookId: true }
    });
    const freqs = {};
    allIssues.forEach(is => {
      freqs[is.bookId] = (freqs[is.bookId] || 0) + 1;
    });

    const bookIds = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]).slice(0, 5);
    const topBooks = await prisma.libraryBook.findMany({
      where: { id: { in: bookIds } }
    });

    const topBooksWithCount = topBooks.map(b => ({
      ...withMongoId(b),
      issueCount: freqs[b.id]
    })).sort((a, b) => b.issueCount - a.issueCount);

    res.json({
      activeIssuesCount: activeCount,
      overdueIssuesCount: overdue.length,
      overdueList: overdue.map(withMongoId),
      mostIssued: topBooksWithCount
    });
  });

  return r;
}

export function studentLibraryRouter({ jwtSecret }) {
  const r = Router();
  const auth = createAuthMiddleware(jwtSecret);
  r.use(auth, requireRole('student'));

  // Get student's currently issued books
  r.get('/my-books', async (req, res) => {
    const issues = await prisma.libraryIssue.findMany({
      where: {
        studentId: req.user.id,
        returnedAt: null
      },
      include: { book: true },
      orderBy: { issuedAt: 'desc' }
    });
    res.json(issues.map(withMongoId));
  });

  // Get student's book issue history (returned items)
  r.get('/history', async (req, res) => {
    const history = await prisma.libraryIssue.findMany({
      where: {
        studentId: req.user.id,
        returnedAt: { not: null }
      },
      include: { book: true },
      orderBy: { returnedAt: 'desc' }
    });
    res.json(history.map(withMongoId));
  });

  return r;
}
